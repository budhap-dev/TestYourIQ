import {
  calibrate,
  DEFAULT_CALIBRATION,
  type CalibrationOptions,
  type CalibrationPerson,
} from '../src/engine/calibration.js';
import { GENERATORS, paramKey, templateKey } from '../src/engine/generators.js';
import { AGE_BANDS, SEED_NORMS, type Norm } from '../src/engine/norms.js';
import { DIFFICULTIES, type IrtParams } from '../src/engine/types.js';
import { VERBAL_BANK } from '../src/engine/verbal/bank.js';
import type { PoolLike, Queryable } from './db.js';

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come back untyped from the driver */

/** Version-1 parameters from the engine, for any key missing from the database. */
function seedParamMap(): Map<string, IrtParams> {
  const map = new Map<string, IrtParams>();
  for (const g of Object.values(GENERATORS)) {
    for (const d of DIFFICULTIES) map.set(templateKey(g.id, g.version, d), g.levels[d].irt);
  }
  for (const e of [...VERBAL_BANK.adult, ...VERBAL_BANK.junior])
    map.set(`bank:${e.id}`, { a: 1, b: e.difficulty - 3 });
  return map;
}

export interface CalibrationSummary {
  dryRun: boolean;
  eligibleAttempts: number;
  responses: number;
  iterations: number;
  anchored: boolean;
  itemsUpdated: number;
  bandsUpdated: string[];
  normsVersion: number | null;
  paramsVersion: number | null;
}

/**
 * Re-estimates item parameters and age-band norms from eligible attempts (first attempts, with
 * consent, without quality flags), using only questions that were actually shown. Writes a new
 * norms version and a new item_params version; earlier versions are never changed.
 */
export async function runCalibration(
  pool: PoolLike,
  {
    dryRun = false,
    options = DEFAULT_CALIBRATION,
  }: { dryRun?: boolean; options?: CalibrationOptions } = {},
): Promise<CalibrationSummary> {
  const { rows: normRows } = await pool.query<any>(
    'select version, age_band, mean, sd, n from norms where version = (select max(version) from norms_versions)',
  );
  const norms: Record<string, Norm> = { ...SEED_NORMS };
  for (const r of normRows)
    norms[r.age_band] = { mean: Number(r.mean), sd: Number(r.sd), n: Number(r.n) };
  const currentVersion = normRows[0] ? Number(normRows[0].version) : 0;

  const params = seedParamMap();
  const { rows: paramRows } = await pool.query<any>(
    'select distinct on (param_key) param_key, a, b from item_params order by param_key, version desc',
  );
  for (const r of paramRows) params.set(r.param_key, { a: Number(r.a), b: Number(r.b) });

  const { rows } = await pool.query<any>(
    `select a.id, a.age_band, r.item_key, r.is_correct
       from attempts a join responses r on r.attempt_id = a.id
      where a.eligible_for_norms and a.status = 'completed' and r.presented
      order by a.id, r.position`,
  );
  const byAttempt = new Map<string, CalibrationPerson>();
  for (const r of rows) {
    const person: CalibrationPerson = byAttempt.get(r.id) ?? { band: r.age_band, responses: [] };
    person.responses.push({ key: paramKey(r.item_key), correct: r.is_correct });
    byAttempt.set(r.id, person);
  }
  const people = [...byAttempt.values()];
  const result = calibrate(people, params, norms, options);

  const updatedItems = [...result.items].filter(([, i]) => i.updated);
  const updatedBands = [...result.bands].filter(([, b]) => b.updated).map(([band]) => band);
  const summary: CalibrationSummary = {
    dryRun,
    eligibleAttempts: people.length,
    responses: rows.length,
    iterations: result.iterations,
    anchored: result.anchored,
    itemsUpdated: updatedItems.length,
    bandsUpdated: updatedBands,
    normsVersion: null,
    paramsVersion: null,
  };
  if (dryRun) return summary;

  const client = await pool.connect();
  try {
    await client.query('begin');
    const normsVersion = currentVersion + 1;
    await client.query('insert into norms_versions (version, note) values ($1, $2)', [
      normsVersion,
      `Calibration from ${people.length} eligible attempts; bands re-estimated: ${updatedBands.join(', ') || 'none'}`,
    ]);
    for (const band of AGE_BANDS) {
      const b = result.bands.get(band.id) ?? { ...(norms[band.id] as Norm), n: 0 };
      await client.query(
        'insert into norms (version, track, age_band, mean, sd, n) values ($1, $2, $3, $4, $5, $6)',
        [normsVersion, band.track, band.id, b.mean, b.sd, b.n],
      );
    }
    let paramsVersion: number | null = null;
    if (updatedItems.length) {
      const { rows: v } = await client.query<any>(
        'select coalesce(max(version), 0) + 1 as next from item_params',
      );
      paramsVersion = Number(v[0]?.next ?? 2);
      for (const [key, item] of updatedItems) {
        await client.query(
          'insert into item_params (param_key, version, a, b, n) values ($1, $2, $3, $4, $5)',
          [key, paramsVersion, item.a, item.b, item.n],
        );
      }
    }
    await client.query('commit');
    return { ...summary, normsVersion, paramsVersion };
  } catch (err) {
    await client.query('rollback').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export interface PurgeSummary {
  dryRun: boolean;
  cutoff: string;
  attempts: number;
  seenItems: number;
  testTakers: number;
}

/**
 * Deletes test records older than the retention period (24 months, as the privacy page says):
 * attempts and their responses, seen-item records, and test-takers with nothing left. Norms and
 * item parameters are aggregates and are kept.
 */
export async function purgeExpired(
  db: Queryable,
  {
    months = 24,
    now = new Date(),
    dryRun = false,
  }: { months?: number; now?: Date; dryRun?: boolean } = {},
): Promise<PurgeSummary> {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - months);
  const count = async (sql: string) => Number((await db.query<any>(sql, [cutoff])).rows[0]?.n ?? 0);
  const orphanTakers = `from test_takers t where t.created_at < $1
      and not exists (select 1 from attempts a where a.test_taker_id = t.id and a.started_at >= $1)`;

  const summary: PurgeSummary = {
    dryRun,
    cutoff: cutoff.toISOString(),
    attempts: await count('select count(*) as n from attempts where started_at < $1'),
    seenItems: await count('select count(*) as n from seen_items where seen_at < $1'),
    testTakers: await count(`select count(*) as n ${orphanTakers}`),
  };
  if (dryRun) return summary;
  await db.query('delete from attempts where started_at < $1', [cutoff]);
  await db.query('delete from seen_items where seen_at < $1', [cutoff]);
  await db.query(`delete ${orphanTakers}`, [cutoff]);
  return summary;
}
