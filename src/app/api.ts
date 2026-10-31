import type {
  AnswerOutcomeBody,
  ApiErrorBody,
  AttemptStarted,
  Progress,
  ResultView,
  TakerSummary,
} from '../shared/api';

/**
 * Browser client for /api. The signed test-taker token is kept in localStorage as well as the
 * HTTP-only cookie, so clearing one doesn't lose the other (§5.2). Storage may be unavailable;
 * the cookie alone still works.
 */

const TAKER_KEY = 'uniqo-taker';

function storedTaker(): string | null {
  try {
    return localStorage.getItem(TAKER_KEY);
  } catch {
    return null;
  }
}

function storeTaker(token: string | null | undefined) {
  if (!token) return;
  try {
    localStorage.setItem(TAKER_KEY, token);
  } catch {
    // ignore
  }
}

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' };
  const taker = storedTaker();
  if (taker) headers['x-taker'] = taker;
  if (body !== undefined) headers['content-type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      credentials: 'same-origin',
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new ApiRequestError(
      0,
      'network',
      'We couldn’t reach the server. Check your connection and try again.',
    );
  }
  const data = (await res.json().catch(() => null)) as
    (T & { takerToken?: string }) | ApiErrorBody | null;
  if (!res.ok) {
    const err = data as ApiErrorBody | null;
    throw new ApiRequestError(
      res.status,
      err?.error ?? 'error',
      err?.message ?? 'Something went wrong.',
    );
  }
  storeTaker((data as { takerToken?: string } | null)?.takerToken);
  return data as T;
}

export const api = {
  me: () => request<TakerSummary>('GET', '/me'),
  start: (age: number, consentResearch: boolean) =>
    request<AttemptStarted>('POST', '/attempts', { age, consentResearch }),
  current: (id: string) => request<Progress>('GET', `/attempts/${id}`),
  answer: (id: string, body: AnswerOutcomeBody) =>
    request<Progress>('POST', `/attempts/${id}/answer`, body),
  finish: (id: string) => request<ResultView>('POST', `/attempts/${id}/finish`),
  result: (id: string) => request<ResultView>('GET', `/attempts/${id}/result`),
};
