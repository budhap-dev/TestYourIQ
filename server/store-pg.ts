import type { Norm } from '../src/engine/norms.js';
import type { IrtParams } from '../src/engine/types.js';
import { getPool, type PoolLike, type Queryable } from './db.js';
import type { AttemptRow, NormSet, ResponseRow, Store, TakerRow, Tx } from './store.js';

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come back untyped from the driver */

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

function toAttempt(r: any): AttemptRow {
  return {
    id: r.id,
    testTakerId: r.test_taker_id,
    track: r.track,
    ageYears: Number(r.age_years),
    ageBand: r.age_band,
    consentResearch: r.consent_research,
    attemptNumber: Number(r.attempt_number),
    formSeed: Number(r.form_seed),
    startedAt: new Date(r.started_at),
    completedAt: r.completed_at ? new Date(r.completed_at) : null,
    status: r.status,
    state: r.state,
    theta: num(r.theta),
    thetaSe: num(r.theta_se),
    iq: num(r.iq),
    normsVersion: num(r.norms_version),
    eligibleForNorms: r.eligible_for_norms,
    flags: r.flags ?? {},
    result: r.result ?? null,
  };
}

function toResponse(r: any): ResponseRow {
  return {
    attemptId: r.attempt_id,
    position: Number(r.position),
    section: Number(r.section),
    itemKey: r.item_key,
    area: r.area,
    difficulty: Number(r.difficulty) as ResponseRow['difficulty'],
    a: Number(r.a),
    b: Number(r.b),
    answerIndex: num(r.answer_index),
    isCorrect: r.is_correct,
    responseMs: num(r.response_ms),
    timedOut: r.timed_out,
    presented: r.presented,
  };
}

function makeTx(db: Queryable): Tx {
  return {
    async getTaker(id) {
      const { rows } = await db.query<any>('select * from test_takers where id = $1', [id]);
      const r = rows[0];
      return r
        ? ({
            id: r.id,
            createdAt: new Date(r.created_at),
            firstCompletedAttemptId: r.first_completed_attempt_id,
          } as TakerRow)
        : null;
    },
    async createTaker(id, now) {
      await db.query('insert into test_takers (id, created_at) values ($1, $2)', [id, now]);
    },
    async setFirstCompleted(takerId, attemptId) {
      await db.query(
        'update test_takers set first_completed_attempt_id = $2 where id = $1 and first_completed_attempt_id is null',
        [takerId, attemptId],
      );
    },
    async listAttempts(takerId) {
      const { rows } = await db.query<any>(
        'select * from attempts where test_taker_id = $1 order by started_at',
        [takerId],
      );
      return rows.map(toAttempt);
    },
    async insertAttempt(a) {
      await db.query(
        `insert into attempts (id, test_taker_id, track, age_years, age_band, consent_research, attempt_number,
           form_seed, started_at, status, state, flags)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          a.id,
          a.testTakerId,
          a.track,
          a.ageYears,
          a.ageBand,
          a.consentResearch,
          a.attemptNumber,
          a.formSeed,
          a.startedAt,
          a.status,
          JSON.stringify(a.state),
          JSON.stringify(a.flags),
        ],
      );
    },
    async getAttemptForUpdate(id) {
      const { rows } = await db.query<any>('select * from attempts where id = $1 for update', [id]);
      return rows[0] ? toAttempt(rows[0]) : null;
    },
    async updateAttempt(a) {
      await db.query(
        `update attempts set status = $2, completed_at = $3, state = $4, theta = $5, theta_se = $6, iq = $7,
           norms_version = $8, eligible_for_norms = $9, flags = $10, result = $11
         where id = $1`,
        [
          a.id,
          a.status,
          a.completedAt,
          JSON.stringify(a.state),
          a.theta,
          a.thetaSe,
          a.iq,
          a.normsVersion,
          a.eligibleForNorms,
          JSON.stringify(a.flags),
          a.result ? JSON.stringify(a.result) : null,
        ],
      );
    },
    async insertResponse(r) {
      await db.query(
        `insert into responses (attempt_id, position, section, item_key, area, difficulty, a, b, answer_index,
           is_correct, response_ms, timed_out, presented)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          r.attemptId,
          r.position,
          r.section,
          r.itemKey,
          r.area,
          r.difficulty,
          r.a,
          r.b,
          r.answerIndex,
          r.isCorrect,
          r.responseMs,
          r.timedOut,
          r.presented,
        ],
      );
    },
    async listResponses(attemptId) {
      const { rows } = await db.query<any>(
        'select * from responses where attempt_id = $1 order by position',
        [attemptId],
      );
      return rows.map(toResponse);
    },
    async seenItemKeys(takerId) {
      const { rows } = await db.query<any>(
        'select item_key from seen_items where test_taker_id = $1',
        [takerId],
      );
      return new Set(rows.map((r) => r.item_key as string));
    },
    async addSeen(takerId, itemKey, now) {
      await db.query(
        'insert into seen_items (test_taker_id, item_key, seen_at) values ($1, $2, $3) on conflict do nothing',
        [takerId, itemKey, now],
      );
    },
    async currentNorms() {
      const { rows } = await db.query<any>(
        'select version, age_band, mean, sd, n from norms where version = (select max(version) from norms_versions)',
      );
      const byBand: Record<string, Norm> = {};
      for (const r of rows)
        byBand[r.age_band] = { mean: Number(r.mean), sd: Number(r.sd), n: Number(r.n) };
      return { version: rows[0] ? Number(rows[0].version) : 0, byBand } satisfies NormSet;
    },
    async itemParams() {
      const { rows } = await db.query<any>(
        'select distinct on (param_key) param_key, a, b from item_params order by param_key, version desc',
      );
      return new Map<string, IrtParams>(
        rows.map((r) => [r.param_key, { a: Number(r.a), b: Number(r.b) }]),
      );
    },
  };
}

export class PgStore implements Store {
  /** Uses the shared pool unless one is given (tests pass an embedded Postgres). */
  constructor(private readonly pool?: PoolLike) {}

  async transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    const client = await (this.pool ?? (await getPool())).connect();
    try {
      await client.query('begin');
      const result = await fn(makeTx(client));
      await client.query('commit');
      return result;
    } catch (err) {
      await client.query('rollback').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }
}
