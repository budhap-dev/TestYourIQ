// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PoolLike } from '../../server/db';
import { handleMaintenance } from '../../server/cron';
import { purgeExpired, runCalibration } from '../../server/maintenance';
import { answer, createAttempt, finish, type Progress } from '../../server/service';
import { PgStore } from '../../server/store-pg';
import { deriveKeys, verifyTakerToken } from '../../server/tokens';
import { itemFromKey } from '../../src/engine/generators';
import { probability } from '../../src/engine/irt';
import { createRng } from '../../src/engine/rng';
import { migratedDb } from './pglite';

let db: PGlite;
let pool: PoolLike;

// Ten templates with known "true" parameters.
const TRUE: Record<string, { a: number; b: number }> = Object.fromEntries(
  ['matrix', 'series'].flatMap((g) =>
    [1, 2, 3, 4, 5].map((d) => [
      `gen:${g}:v1:d${d}`,
      { a: g === 'matrix' ? 1.4 : 0.9, b: (d - 3) * 0.8 },
    ]),
  ),
);

/** Insert simulated eligible attempts: each person answers every template once. */
async function insertPeople(band: string, n: number, mean: number, seed: number) {
  const rng = createRng(seed);
  const takers: string[] = [];
  const attempts: string[] = [];
  const responses: string[] = [];
  for (let i = 0; i < n; i++) {
    const theta =
      mean +
      Math.sqrt(-2 * Math.log(Math.max(1e-12, rng.next()))) * Math.cos(2 * Math.PI * rng.next());
    const taker = randomUUID();
    const attempt = randomUUID();
    takers.push(`('${taker}')`);
    attempts.push(
      `('${attempt}', '${taker}', 'adult', 30, '${band}', true, 1, 1, 'completed', '{}', true)`,
    );
    Object.entries(TRUE).forEach(([key, { a, b }], pos) => {
      const correct = rng.next() < probability(theta, a, b);
      const area = key.includes('matrix') ? 'pattern' : 'numerical';
      responses.push(
        `('${attempt}', ${pos}, 0, '${key}:${seed * 10000 + i}', '${area}', 3, 1, 0, ${correct})`,
      );
    });
  }
  await db.exec(`insert into test_takers (id) values ${takers.join(',')}`);
  await db.exec(
    `insert into attempts (id, test_taker_id, track, age_years, age_band, consent_research, attempt_number,
       form_seed, status, state, eligible_for_norms) values ${attempts.join(',')}`,
  );
  await db.exec(
    `insert into responses (attempt_id, position, section, item_key, area, difficulty, a, b, is_correct)
     values ${responses.join(',')}`,
  );
}

beforeAll(async () => {
  ({ db, pool } = await migratedDb());
  await insertPeople('a20-24', 320, 0, 1);
  await insertPeople('a65-74', 120, -0.8, 2);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

const count = async (sql: string) => Number((await db.query<{ n: number }>(sql)).rows[0]?.n);

describe('calibration run', () => {
  it('reports without writing on a dry run', async () => {
    const summary = await runCalibration(pool, { dryRun: true });
    expect(summary).toMatchObject({
      dryRun: true,
      eligibleAttempts: 440,
      anchored: true,
      itemsUpdated: 10,
    });
    expect(await count('select max(version) as n from norms_versions')).toBe(1);
  });

  it('writes a new norms version and parameter version, keeping history', async () => {
    const summary = await runCalibration(pool);
    expect(summary.normsVersion).toBe(2);
    expect(summary.paramsVersion).toBe(2);
    expect(summary.bandsUpdated.sort()).toEqual(['a20-24', 'a65-74']);

    expect(await count('select count(*) as n from norms where version = 1')).toBe(16);
    expect(await count('select count(*) as n from norms where version = 2')).toBe(16);
    expect(await count('select count(*) as n from item_params where version = 2')).toBe(10);
    const v1 = await db.query<{ b: number }>(
      "select b from item_params where param_key = 'gen:matrix:v1:d1' and version = 1",
    );
    expect(v1.rows[0]?.b).toBe(-2);

    const older = await db.query<{ mean: number; sd: number; n: number }>(
      "select mean, sd, n from norms where version = 2 and age_band = 'a65-74'",
    );
    expect(older.rows[0]?.n).toBe(120);
    expect(older.rows[0]?.mean).toBeGreaterThan(-1.2);
    expect(older.rows[0]?.mean).toBeLessThan(-0.4);
    const junior = await db.query<{ mean: number; n: number }>(
      "select mean, n from norms where version = 2 and age_band = 'j8'",
    );
    expect(junior.rows[0]).toEqual({ mean: -2, n: 0 });

    const hard = await db.query<{ b: number }>(
      "select b from item_params where param_key = 'gen:matrix:v1:d5' and version = 2",
    );
    expect(hard.rows[0]?.b).toBeGreaterThan(0.8);
    expect(hard.rows[0]?.b).toBeLessThan(2.4);
  }, 60_000);

  it('scores new attempts against the latest norms version', async () => {
    let clock = new Date('2026-11-02T10:00:00Z');
    const deps = {
      store: new PgStore(pool),
      keys: deriveKeys('test-secret-test-secret-test-secret-123'),
      now: () => clock,
    };
    const started = await createAttempt(deps, null, { age: 22, consentResearch: false });
    const takerId = verifyTakerToken(started.takerToken, deps.keys);
    let step: Progress = { done: false, next: started.next };
    while (!step.done) {
      const { rows } = await db.query<{ state: { pending: { itemKey: string } } }>(
        'select state from attempts where id = $1',
        [started.attemptId],
      );
      clock = new Date(clock.getTime() + 6000);
      step = await answer(deps, takerId, started.attemptId, {
        itemToken: step.next.token,
        answerIndex: itemFromKey(rows[0]?.state.pending.itemKey ?? '')?.answerIndex ?? 0,
        responseMs: 6000,
      });
    }
    const result = await finish(deps, takerId, started.attemptId);
    expect(result.normsVersion).toBe(2);
  }, 60_000);
});

describe('retention purge', () => {
  it('deletes records older than 24 months and nothing newer', async () => {
    const old = randomUUID();
    const oldAttempt = randomUUID();
    await db.query(
      "insert into test_takers (id, created_at) values ($1, now() - interval '3 years')",
      [old],
    );
    await db.query(
      `insert into attempts (id, test_taker_id, track, age_years, age_band, attempt_number, form_seed, started_at, status, state)
       values ($1, $2, 'adult', 40, 'a35-44', 1, 1, now() - interval '3 years', 'abandoned', '{}')`,
      [oldAttempt, old],
    );
    await db.query(
      "insert into seen_items (test_taker_id, item_key, seen_at) values ($1, 'bank:a-an-001', now() - interval '3 years')",
      [old],
    );
    const before = await count('select count(*) as n from attempts');

    const dry = await purgeExpired(pool, { dryRun: true });
    expect(dry).toMatchObject({ attempts: 1, seenItems: 1, testTakers: 1 });
    expect(await count('select count(*) as n from attempts')).toBe(before);

    await purgeExpired(pool);
    expect(await count('select count(*) as n from attempts')).toBe(before - 1);
    expect(await count(`select count(*) as n from test_takers where id = '${old}'`)).toBe(0);
    expect(await count('select count(*) as n from norms')).toBe(32);
  });
});

describe('maintenance endpoint', () => {
  it('is off without CRON_SECRET and refuses a wrong token', async () => {
    const prev = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    expect((await handleMaintenance(new Request('http://x/api/cron/maintenance'))).status).toBe(
      503,
    );
    process.env.CRON_SECRET = 'cron-secret-value';
    const wrong = new Request('http://x/api/cron/maintenance', {
      headers: { authorization: 'Bearer nope' },
    });
    expect((await handleMaintenance(wrong)).status).toBe(401);
    if (prev === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prev;
  });
});
