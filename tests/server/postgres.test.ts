// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { itemFromKey } from '../../src/engine/generators';
import {
  answer,
  createAttempt,
  finish,
  getResult,
  type Deps,
  type Progress,
} from '../../server/service';
import { PgStore } from '../../server/store-pg';
import { deriveKeys, verifyTakerToken } from '../../server/tokens';
import { migratedDb } from './pglite';

/**
 * Runs the real migrations and the Postgres store against an embedded Postgres (PGlite), so
 * the SQL is exercised without a database server.
 */

let db: PGlite;
let deps: Deps;
let clock = new Date('2026-11-01T10:00:00Z');

beforeAll(async () => {
  const setup = await migratedDb();
  db = setup.db;
  // Overrides one template in a later version, to check the newest version wins.
  await db.query(
    "insert into item_params (param_key, version, a, b) values ('gen:matrix:v1:d2', 2, 1.7, -0.9)",
  );
  const pool = setup.pool;
  deps = {
    store: new PgStore(pool),
    keys: deriveKeys('test-secret-test-secret-test-secret-123'),
    now: () => clock,
  };
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe('Postgres store (embedded)', () => {
  it('runs a complete attempt and a retake against the real schema', async () => {
    const run = async (takerId: string | null) => {
      const started = await createAttempt(deps, takerId, { age: 28, consentResearch: true });
      const tid = verifyTakerToken(started.takerToken, deps.keys);
      let step: Progress = { done: false, next: started.next };
      while (!step.done) {
        const { rows } = await db.query<{ state: { pending: { itemKey: string } } }>(
          'select state from attempts where id = $1',
          [started.attemptId],
        );
        const item = itemFromKey(rows[0]?.state.pending.itemKey ?? '');
        clock = new Date(clock.getTime() + 7000);
        step = await answer(deps, tid, started.attemptId, {
          itemToken: step.next.token,
          answerIndex: item?.answerIndex ?? 0,
          responseMs: 7000,
        });
      }
      const result = await finish(deps, tid, started.attemptId);
      return { started, tid, result };
    };

    const first = await run(null);
    expect(first.result.correct).toBe(32);
    expect(await getResult(deps, first.tid, first.started.attemptId)).toEqual(first.result);

    clock = new Date(clock.getTime() + 2 * 3600_000);
    const second = await run(first.tid);
    expect(second.result.retake.previous?.iqLabel).toBe(first.result.score.iqLabel);

    const { rows: overlap } = await db.query(
      `select item_key from responses where attempt_id = $1 and presented
       intersect select item_key from responses where attempt_id = $2 and presented`,
      [first.started.attemptId, second.started.attemptId],
    );
    expect(overlap).toEqual([]);

    const { rows: attempts } = await db.query<{
      attempt_number: number;
      eligible_for_norms: boolean;
      norms_version: number;
    }>(
      'select attempt_number, eligible_for_norms, norms_version from attempts order by attempt_number',
    );
    expect(attempts).toEqual([
      { attempt_number: 1, eligible_for_norms: true, norms_version: 1 },
      { attempt_number: 2, eligible_for_norms: false, norms_version: 1 },
    ]);
    const { rows: taker } = await db.query<{ first_completed_attempt_id: string }>(
      'select first_completed_attempt_id from test_takers',
    );
    expect(taker[0]?.first_completed_attempt_id).toBe(first.started.attemptId);
  }, 60_000);

  it('uses the newest item parameters', async () => {
    const params = await deps.store.transaction((tx) => tx.itemParams());
    expect(params.get('gen:matrix:v1:d2')).toEqual({ a: 1.7, b: -0.9 });
    expect(params.get('gen:matrix:v1:d3')).toEqual({ a: 1.2, b: 0 });
  });

  it('rolls back a failed transaction', async () => {
    const before = await db.query('select count(*)::int as n from test_takers');
    await expect(
      deps.store.transaction(async (tx) => {
        await tx.createTaker('6f1c2a4e-0b7d-4c3e-9a51-2d7e8f9a0b1c', clock);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    const after = await db.query('select count(*)::int as n from test_takers');
    expect(after.rows).toEqual(before.rows);
  });
});
