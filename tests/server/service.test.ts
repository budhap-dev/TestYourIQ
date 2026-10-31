// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { BLUEPRINTS } from '../../src/engine/assembly';
import { itemFromKey } from '../../src/engine/generators';
import { VERBAL_BANK } from '../../src/engine/verbal/bank';
import {
  ABANDON_AFTER_MS,
  ApiError,
  SECTION_GRACE_MS,
  answer,
  createAttempt,
  currentItem,
  finish,
  getResult,
  getTaker,
  type Deps,
  type ItemPayload,
  type Progress,
} from '../../server/service';
import { MemoryStore } from '../../server/store-memory';
import { deriveKeys, verifyTakerToken } from '../../server/tokens';

let store: MemoryStore;
let clock: Date;
let deps: Deps;
const keys = deriveKeys('test-secret-test-secret-test-secret-123');
const tick = (ms: number) => (clock = new Date(clock.getTime() + ms));

beforeEach(() => {
  store = new MemoryStore();
  clock = new Date('2026-11-01T10:00:00Z');
  deps = { store, keys, now: () => clock };
});

/** The correct option for the attempt's pending item (server-side knowledge, for tests). */
function correctIndex(attemptId: string): number {
  const pending = store.attempts.get(attemptId)?.state.pending;
  const item = pending && itemFromKey(pending.itemKey);
  if (!item) throw new Error('no pending item');
  return item.answerIndex;
}

type Strategy = (attemptId: string, next: ItemPayload) => number | null;
const allRight: Strategy = (id) => correctIndex(id);
const allWrong: Strategy = (id, next) => (correctIndex(id) + 1) % next.item.optionCount;

async function takeTest(
  age: number,
  strategy: Strategy,
  opts: { takerId?: string | null; consent?: boolean; ms?: number } = {},
) {
  const started = await createAttempt(deps, opts.takerId ?? null, {
    age,
    consentResearch: opts.consent ?? true,
  });
  const takerId = verifyTakerToken(started.takerToken, keys);
  const payloads: ItemPayload[] = [];
  let step: Progress = { done: false, next: started.next };
  while (!step.done) {
    payloads.push(step.next);
    tick(opts.ms ?? 8000);
    step = await answer(deps, takerId, started.attemptId, {
      itemToken: step.next.token,
      answerIndex: strategy(started.attemptId, step.next),
      responseMs: opts.ms ?? 8000,
    });
  }
  const result = await finish(deps, takerId, started.attemptId);
  return { started, takerId, payloads, result };
}

const keysOf = (attemptId: string) =>
  (store.responses.get(attemptId) ?? []).filter((r) => r.presented).map((r) => r.itemKey);

describe('a complete attempt', () => {
  it('runs 32 items in four timed sections and scores them', async () => {
    const { started, payloads, result } = await takeTest(30, allRight);
    expect(started.track).toBe('adult');
    expect(started.sections.map((s) => s.area)).toEqual([
      'pattern',
      'numerical',
      'spatial',
      'verbal',
    ]);
    expect(payloads).toHaveLength(32);
    expect(payloads.map((p) => p.item.area)).toEqual([
      ...Array(8).fill('pattern'),
      ...Array(8).fill('numerical'),
      ...Array(8).fill('spatial'),
      ...Array(8).fill('verbal'),
    ]);
    expect(result.correct).toBe(32);
    expect(result.score.iq).toBeGreaterThan(125);
    expect(result.score.calibrating).toBe(true);
    expect(result.areas.map((a) => a.band)).toEqual(Array(4).fill('above average'));
    expect(result.retake).toEqual({ attemptNumber: 1, completedBefore: 0, previous: null });
  });

  it('adapts: a strong test-taker gets harder items than a weak one', async () => {
    const strong = await takeTest(30, allRight);
    const weak = await takeTest(30, allWrong);
    const mean = (id: string) => {
      const rows = store.responses.get(id) ?? [];
      return rows.reduce((s, r) => s + r.difficulty, 0) / rows.length;
    };
    expect(mean(strong.started.attemptId)).toBeGreaterThan(mean(weak.started.attemptId) + 1);
    expect(weak.result.score.iq).toBeLessThan(80);
  });

  it('never sends answers, item keys or seeds to the client', async () => {
    const { payloads, result, started } = await takeTest(40, allRight);
    const wire = JSON.stringify([started, payloads, result]);
    for (const key of keysOf(started.attemptId)) {
      expect(wire).not.toContain(key);
      expect(wire).not.toContain(key.split(':').pop());
    }
    expect(wire).not.toContain('answerIndex');
    expect(wire).not.toContain('formSeed');
  });

  it('only lets a consenting first attempt into the norms', async () => {
    const consenting = await takeTest(30, allRight, { consent: true });
    expect(store.attempts.get(consenting.started.attemptId)?.eligibleForNorms).toBe(true);
    const declined = await takeTest(30, allRight, { consent: false });
    expect(store.attempts.get(declined.started.attemptId)?.eligibleForNorms).toBe(false);
  });

  it('flags and excludes answers that are much too fast', async () => {
    const { started } = await takeTest(30, allRight, { ms: 1500 });
    const row = store.attempts.get(started.attemptId);
    expect(row?.flags.quality).toContain('too_fast');
    expect(row?.eligibleForNorms).toBe(false);
  });
});

describe('retakes', () => {
  it('never repeats an item, shows the previous score and stays out of the norms', async () => {
    const first = await takeTest(35, allRight);
    tick(2 * 60 * 60 * 1000);
    const second = await takeTest(35, allRight, { takerId: first.takerId });

    const overlap = keysOf(first.started.attemptId).filter((k) =>
      keysOf(second.started.attemptId).includes(k),
    );
    expect(overlap).toEqual([]);
    expect(second.started.retake.attemptNumber).toBe(2);
    expect(second.started.retake.previous?.iqLabel).toBe(first.result.score.iqLabel);
    expect(second.result.retake.previous?.iqLabel).toBe(first.result.score.iqLabel);
    expect(store.attempts.get(second.started.attemptId)?.eligibleForNorms).toBe(false);
  });

  it('keeps junior verbal items unique across many retakes, then runs short', async () => {
    let takerId: string | null = null;
    const verbalSeen: string[] = [];
    for (let i = 0; i < 13; i++) {
      tick(2 * 60 * 60 * 1000);
      const run = await takeTest(11, allRight, { takerId });
      takerId = run.takerId;
      verbalSeen.push(...keysOf(run.started.attemptId).filter((k) => k.startsWith('bank:')));
    }
    expect(new Set(verbalSeen).size).toBe(verbalSeen.length);
    expect(verbalSeen.every((k) => k.startsWith('bank:j-'))).toBe(true);
    expect(verbalSeen.length).toBe(VERBAL_BANK.junior.length);
  });

  it('marks an unfinished attempt abandoned when a new one starts', async () => {
    const a = await createAttempt(deps, null, { age: 30, consentResearch: true });
    const takerId = verifyTakerToken(a.takerToken, keys);
    await createAttempt(deps, takerId, { age: 30, consentResearch: true });
    expect(store.attempts.get(a.attemptId)?.status).toBe('abandoned');
    await expect(
      answer(deps, takerId, a.attemptId, {
        itemToken: a.next.token,
        answerIndex: 0,
        responseMs: 5000,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('reports earlier results for the setup page', async () => {
    const first = await takeTest(30, allRight);
    const summary = await getTaker(deps, first.takerId);
    expect(summary.completedBefore).toBe(1);
    expect(summary.previous?.iqLabel).toBe(first.result.score.iqLabel);
    expect((await getTaker(deps, null)).completedBefore).toBe(0);
  });
});

describe('junior track', () => {
  it('uses junior verbal items and difficulty 4 at most', async () => {
    const { started } = await takeTest(10, allRight);
    expect(started.track).toBe('junior');
    const rows = store.responses.get(started.attemptId) ?? [];
    expect(Math.max(...rows.map((r) => r.difficulty))).toBeLessThanOrEqual(4);
    expect(
      rows.filter((r) => r.area === 'verbal').every((r) => r.itemKey.startsWith('bank:j-')),
    ).toBe(true);
  });

  it('rejects ages under 8', async () => {
    await expect(
      createAttempt(deps, null, { age: 7, consentResearch: false }),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe('timing', () => {
  it('scores the rest of a section as not reached when its time runs out', async () => {
    const started = await createAttempt(deps, null, { age: 30, consentResearch: true });
    const takerId = verifyTakerToken(started.takerToken, keys);
    let step: Progress = await answer(deps, takerId, started.attemptId, {
      itemToken: started.next.token,
      answerIndex: correctIndex(started.attemptId),
      responseMs: 5000,
    });
    if (step.done) throw new Error('unexpected end');
    tick((BLUEPRINTS.adult[0]?.seconds ?? 0) * 1000 + SECTION_GRACE_MS + 1000);
    step = await answer(deps, takerId, started.attemptId, {
      itemToken: step.next.token,
      answerIndex: 0,
      responseMs: 1000,
    });
    if (step.done) throw new Error('unexpected end');

    expect(step.next.section.area).toBe('numerical');
    const rows = store.responses.get(started.attemptId) ?? [];
    expect(rows).toHaveLength(8);
    expect(rows.slice(1).every((r) => r.timedOut && !r.isCorrect)).toBe(true);
    expect(rows.filter((r) => !r.presented)).toHaveLength(6);
    // Items never shown are not treated as seen.
    const seen = store.seen.get(takerId ?? '') ?? new Set();
    for (const r of rows.filter((x) => !x.presented)) expect(seen.has(r.itemKey)).toBe(false);
  });

  it('times out a section when the client says time is up', async () => {
    const started = await createAttempt(deps, null, { age: 30, consentResearch: true });
    const takerId = verifyTakerToken(started.takerToken, keys);
    const step = await answer(deps, takerId, started.attemptId, {
      itemToken: started.next.token,
      answerIndex: null,
      responseMs: 600_000,
      timedOut: true,
    });
    expect(step.done).toBe(false);
    if (!step.done) expect(step.next.section.index).toBe(1);
  });

  it('expires attempts left for hours', async () => {
    const started = await createAttempt(deps, null, { age: 30, consentResearch: true });
    const takerId = verifyTakerToken(started.takerToken, keys);
    tick(ABANDON_AFTER_MS + 1);
    await expect(currentItem(deps, takerId, started.attemptId)).rejects.toMatchObject({
      status: 409,
    });
  });

  it('caps the reported response time by the server clock', async () => {
    const started = await createAttempt(deps, null, { age: 30, consentResearch: true });
    const takerId = verifyTakerToken(started.takerToken, keys);
    tick(4000);
    await answer(deps, takerId, started.attemptId, {
      itemToken: started.next.token,
      answerIndex: 0,
      responseMs: 90_000,
    });
    expect(store.responses.get(started.attemptId)?.[0]?.responseMs).toBeLessThanOrEqual(6000);
  });
});

describe('resuming', () => {
  it('re-issues the same question after a reload', async () => {
    const started = await createAttempt(deps, null, { age: 30, consentResearch: true });
    const takerId = verifyTakerToken(started.takerToken, keys);
    const again = await currentItem(deps, takerId, started.attemptId);
    expect(again.done).toBe(false);
    if (!again.done) {
      expect(again.next.item).toEqual(started.next.item);
      expect(again.next.number).toBe(1);
    }
  });
});

describe('protection', () => {
  it('rejects tampered, replayed and foreign requests', async () => {
    const started = await createAttempt(deps, null, { age: 30, consentResearch: true });
    const takerId = verifyTakerToken(started.takerToken, keys);
    const token = started.next.token;

    const bad = token.slice(0, -4) + (token.endsWith('AAAA') ? 'BBBB' : 'AAAA');
    await expect(
      answer(deps, takerId, started.attemptId, { itemToken: bad, answerIndex: 0, responseMs: 1 }),
    ).rejects.toMatchObject({
      status: 400,
    });

    await answer(deps, takerId, started.attemptId, {
      itemToken: token,
      answerIndex: 0,
      responseMs: 5000,
    });
    await expect(
      answer(deps, takerId, started.attemptId, {
        itemToken: token,
        answerIndex: 1,
        responseMs: 5000,
      }),
    ).rejects.toMatchObject({
      status: 409,
      code: 'stale_token',
    });

    const stranger = await createAttempt(deps, null, { age: 30, consentResearch: true });
    const strangerId = verifyTakerToken(stranger.takerToken, keys);
    await expect(currentItem(deps, strangerId, started.attemptId)).rejects.toMatchObject({
      status: 404,
    });
    await expect(getResult(deps, null, started.attemptId)).rejects.toMatchObject({ status: 404 });
  });

  it('rejects an option number that does not exist', async () => {
    const started = await createAttempt(deps, null, { age: 30, consentResearch: true });
    const takerId = verifyTakerToken(started.takerToken, keys);
    await expect(
      answer(deps, takerId, started.attemptId, {
        itemToken: started.next.token,
        answerIndex: 7,
        responseMs: 1,
      }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('limits a test-taker to 5 new attempts an hour', async () => {
    const first = await createAttempt(deps, null, { age: 30, consentResearch: true });
    const takerId = verifyTakerToken(first.takerToken, keys);
    for (let i = 0; i < 4; i++)
      await createAttempt(deps, takerId, { age: 30, consentResearch: true });
    await expect(
      createAttempt(deps, takerId, { age: 30, consentResearch: true }),
    ).rejects.toMatchObject({ status: 429 });
    tick(61 * 60 * 1000);
    await expect(
      createAttempt(deps, takerId, { age: 30, consentResearch: true }),
    ).resolves.toBeDefined();
  });
});

describe('finishing', () => {
  it('refuses to finish early, then returns the same result every time', async () => {
    const started = await createAttempt(deps, null, { age: 30, consentResearch: true });
    const takerId = verifyTakerToken(started.takerToken, keys);
    await expect(finish(deps, takerId, started.attemptId)).rejects.toMatchObject({ status: 409 });
    await expect(getResult(deps, takerId, started.attemptId)).rejects.toMatchObject({
      status: 409,
    });

    const done = await takeTest(30, allRight, { takerId });
    expect(await finish(deps, done.takerId, done.started.attemptId)).toEqual(done.result);
    expect(await getResult(deps, done.takerId, done.started.attemptId)).toEqual(done.result);
  });
});
