// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ROUTES,
  TAKER_COOKIE,
  handleAnswer,
  handleCreateAttempt,
  handleCurrent,
  handleMe,
  setDeps,
} from '../../server/handlers';
import { MemoryStore } from '../../server/store-memory';
import { deriveKeys } from '../../server/tokens';

const base = 'http://localhost/api';
const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(base + path, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', ...headers },
  });

beforeEach(() => {
  setDeps({
    store: new MemoryStore(),
    keys: deriveKeys('test-secret-test-secret-test-secret-123'),
    now: () => new Date(),
  });
});
afterEach(() => setDeps(null));

const cookieFrom = (res: Response) => (res.headers.get('set-cookie') ?? '').split(';')[0] ?? '';

describe('HTTP handlers', () => {
  it('starts an attempt and sets an HTTP-only test-taker cookie', async () => {
    const res = await handleCreateAttempt(post('/attempts', { age: 25, consentResearch: false }));
    expect(res.status).toBe(201);
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain(`${TAKER_COOKIE}=`);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
    const body = (await res.json()) as {
      attemptId: string;
      takerToken: string;
      next: { token: string };
    };
    expect(body.next.token).toBeTruthy();
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('recognises the test-taker by cookie or by the localStorage header', async () => {
    const res = await handleCreateAttempt(post('/attempts', { age: 25, consentResearch: false }));
    const body = (await res.json()) as { attemptId: string; takerToken: string };
    const byCookie = await handleCurrent(
      new Request(`${base}/attempts/${body.attemptId}`, { headers: { cookie: cookieFrom(res) } }),
    );
    expect(byCookie.status).toBe(200);
    const byHeader = await handleCurrent(
      new Request(`${base}/attempts/${body.attemptId}`, {
        headers: { 'x-taker': body.takerToken },
      }),
    );
    expect(byHeader.status).toBe(200);
    const anonymous = await handleCurrent(new Request(`${base}/attempts/${body.attemptId}`));
    expect(anonymous.status).toBe(404);
    const me = await handleMe(new Request(`${base}/me`, { headers: { cookie: cookieFrom(res) } }));
    expect(((await me.json()) as { completedBefore: number }).completedBefore).toBe(0);
  });

  it('validates bodies', async () => {
    for (const bad of [
      { age: 7, consentResearch: true },
      { age: 'thirty', consentResearch: true },
      { age: 30 },
      {},
    ]) {
      const res = await handleCreateAttempt(post('/attempts', bad));
      expect(res.status).toBe(400);
      expect(((await res.json()) as { error: string }).error).toBe('invalid');
    }
    const junk = await handleCreateAttempt(
      new Request(`${base}/attempts`, { method: 'POST', body: '{not json' }),
    );
    expect(junk.status).toBe(400);

    const res = await handleCreateAttempt(post('/attempts', { age: 25, consentResearch: false }));
    const { attemptId } = (await res.json()) as { attemptId: string };
    const answer = await handleAnswer(
      post(
        `/attempts/${attemptId}/answer`,
        { itemToken: 'x', answerIndex: 9, responseMs: 10 },
        { cookie: cookieFrom(res) },
      ),
    );
    expect(answer.status).toBe(400);
  });

  it('returns 404 for malformed attempt ids', async () => {
    const res = await handleCurrent(new Request(`${base}/attempts/not-a-uuid`));
    expect(res.status).toBe(404);
  });

  it('routes every API path in the dev route table', () => {
    const paths = [
      ['GET', '/api/me'],
      ['POST', '/api/attempts'],
      ['GET', '/api/attempts/abc'],
      ['POST', '/api/attempts/abc/answer'],
      ['POST', '/api/attempts/abc/finish'],
      ['GET', '/api/attempts/abc/result'],
    ];
    for (const [method, path] of paths) {
      expect(ROUTES.filter((r) => r.method === method && r.pattern.test(path ?? ''))).toHaveLength(
        1,
      );
    }
  });
});
