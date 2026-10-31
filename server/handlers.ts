import { z } from 'zod';
import { databaseUrl, isProduction, sessionSecret } from './env.js';
import {
  ApiError,
  answer,
  createAttempt,
  currentItem,
  finish,
  getResult,
  getTaker,
  type Deps,
} from './service.js';
import { MemoryStore } from './store-memory.js';
import { PgStore } from './store-pg.js';
import type { Store } from './store.js';
import { deriveKeys, verifyTakerToken } from './tokens.js';

/**
 * Web-standard request handlers (Request → Response), shared by the Vercel functions in /api and
 * by the local dev server. Validation is done here with zod; logic lives in service.ts.
 */

export const TAKER_COOKIE = 'uniqo_taker';
export const TAKER_HEADER = 'x-taker';
const COOKIE_MAX_AGE = 400 * 24 * 60 * 60; // the longest browsers allow

let deps: Deps | null = null;

function getDeps(): Deps {
  if (deps) return deps;
  let store: Store;
  if (databaseUrl()) {
    store = new PgStore();
  } else if (isProduction()) {
    throw new Error('DATABASE_URL must be set in production.');
  } else {
    console.warn(
      '[unIQo] DATABASE_URL not set: using an in-memory store. Data is lost on restart.',
    );
    store = new MemoryStore();
  }
  deps = { store, keys: deriveKeys(sessionSecret()), now: () => new Date() };
  return deps;
}

/** For tests: swap in a store and clock. */
export function setDeps(next: Deps | null) {
  deps = next;
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie') ?? '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

/** The signed test-taker id from the cookie, or the copy kept in localStorage (header). */
function takerFrom(request: Request, d: Deps): string | null {
  return (
    verifyTakerToken(readCookie(request, TAKER_COOKIE), d.keys) ??
    verifyTakerToken(request.headers.get(TAKER_HEADER), d.keys)
  );
}

function takerCookie(token: string): string {
  const secure = isProduction() ? '; Secure' : '';
  return `${TAKER_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; SameSite=Lax${secure}`;
}

function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
  });
}

async function body<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  const text = await request.text();
  if (text.length > 10_000) throw new ApiError(413, 'too_large', 'Request body too large.');
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError(400, 'bad_json', 'Request body is not valid JSON.');
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new ApiError(
      400,
      'invalid',
      result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    );
  }
  return result.data;
}

const AttemptId = z.uuid();

function attemptIdFrom(request: Request): string {
  // /api/attempts/<id>[/<action>]
  const id = new URL(request.url).pathname.split('/')[3] ?? '';
  if (!AttemptId.safeParse(id).success) throw new ApiError(404, 'not_found', 'Attempt not found.');
  return id;
}

async function run(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiError) return json({ error: err.code, message: err.message }, err.status);
    console.error('[unIQo] unhandled error', err);
    return json({ error: 'server_error', message: 'Something went wrong on our side.' }, 500);
  }
}

const CreateBody = z.object({
  age: z.number().int().min(8).max(110),
  consentResearch: z.boolean(),
});

const AnswerBody = z.object({
  itemToken: z.string().min(1).max(2000),
  answerIndex: z.number().int().min(0).max(7).nullable(),
  responseMs: z
    .number()
    .int()
    .min(0)
    .max(24 * 60 * 60 * 1000),
  timedOut: z.boolean().optional(),
});

export const handleMe = (request: Request) =>
  run(async () => {
    const d = getDeps();
    const summary = await getTaker(d, takerFrom(request, d));
    return json(
      summary,
      200,
      summary.takerToken ? { 'set-cookie': takerCookie(summary.takerToken) } : {},
    );
  });

export const handleCreateAttempt = (request: Request) =>
  run(async () => {
    const d = getDeps();
    const input = await body(request, CreateBody);
    const started = await createAttempt(d, takerFrom(request, d), input);
    return json(started, 201, { 'set-cookie': takerCookie(started.takerToken) });
  });

export const handleCurrent = (request: Request) =>
  run(async () => {
    const d = getDeps();
    return json(await currentItem(d, takerFrom(request, d), attemptIdFrom(request)));
  });

export const handleAnswer = (request: Request) =>
  run(async () => {
    const d = getDeps();
    const id = attemptIdFrom(request);
    const input = await body(request, AnswerBody);
    return json(await answer(d, takerFrom(request, d), id, input));
  });

export const handleFinish = (request: Request) =>
  run(async () => {
    const d = getDeps();
    return json(await finish(d, takerFrom(request, d), attemptIdFrom(request)));
  });

export const handleResult = (request: Request) =>
  run(async () => {
    const d = getDeps();
    return json(await getResult(d, takerFrom(request, d), attemptIdFrom(request)));
  });

/** Route table used by the local dev server; Vercel routes by file path instead. */
export const ROUTES: {
  method: string;
  pattern: RegExp;
  handler: (r: Request) => Promise<Response>;
}[] = [
  { method: 'GET', pattern: /^\/api\/me$/, handler: handleMe },
  { method: 'POST', pattern: /^\/api\/attempts$/, handler: handleCreateAttempt },
  { method: 'GET', pattern: /^\/api\/attempts\/[^/]+$/, handler: handleCurrent },
  { method: 'POST', pattern: /^\/api\/attempts\/[^/]+\/answer$/, handler: handleAnswer },
  { method: 'POST', pattern: /^\/api\/attempts\/[^/]+\/finish$/, handler: handleFinish },
  { method: 'GET', pattern: /^\/api\/attempts\/[^/]+\/result$/, handler: handleResult },
];
