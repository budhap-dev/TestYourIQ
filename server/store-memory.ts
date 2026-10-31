import { SEED_NORMS } from '../src/engine/norms.js';
import type { IrtParams } from '../src/engine/types.js';
import type { AttemptRow, NormSet, ResponseRow, Store, TakerRow, Tx } from './store.js';

/**
 * In-memory store for tests and for running the app locally without a database. Rows are
 * deep-copied in and out, so callers can't mutate stored state by accident. Transactions are
 * serialised, which is enough to mirror Postgres row locks for a single process.
 */
export class MemoryStore implements Store {
  takers = new Map<string, TakerRow>();
  attempts = new Map<string, AttemptRow>();
  responses = new Map<string, ResponseRow[]>();
  seen = new Map<string, Set<string>>();
  norms: NormSet = { version: 1, byBand: structuredClone(SEED_NORMS) };
  params = new Map<string, IrtParams>();
  private queue: Promise<unknown> = Promise.resolve();

  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    const run = this.queue.then(() => fn(this.tx()));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private tx(): Tx {
    const clone = structuredClone;
    return {
      getTaker: async (id) => clone(this.takers.get(id) ?? null),
      createTaker: async (id, now) => {
        this.takers.set(id, { id, createdAt: now, firstCompletedAttemptId: null });
      },
      setFirstCompleted: async (takerId, attemptId) => {
        const t = this.takers.get(takerId);
        if (t) t.firstCompletedAttemptId = attemptId;
      },
      listAttempts: async (takerId) =>
        clone(
          [...this.attempts.values()]
            .filter((a) => a.testTakerId === takerId)
            .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime()),
        ),
      insertAttempt: async (row) => {
        this.attempts.set(row.id, clone(row));
      },
      getAttemptForUpdate: async (id) => clone(this.attempts.get(id) ?? null),
      updateAttempt: async (row) => {
        this.attempts.set(row.id, clone(row));
      },
      insertResponse: async (row) => {
        const list = this.responses.get(row.attemptId) ?? [];
        if (list.some((r) => r.position === row.position)) throw new Error('duplicate response');
        list.push(clone(row));
        this.responses.set(row.attemptId, list);
      },
      listResponses: async (attemptId) =>
        clone([...(this.responses.get(attemptId) ?? [])].sort((a, b) => a.position - b.position)),
      seenItemKeys: async (takerId) => new Set(this.seen.get(takerId) ?? []),
      addSeen: async (takerId, itemKey) => {
        const set = this.seen.get(takerId) ?? new Set<string>();
        set.add(itemKey);
        this.seen.set(takerId, set);
      },
      currentNorms: async () => clone(this.norms),
      itemParams: async () => new Map(this.params),
    };
  }
}
