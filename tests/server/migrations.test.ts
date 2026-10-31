// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AGE_BANDS, SEED_NORMS } from '../../src/engine/norms';
import { seedParams } from '../../scripts/seed';
import { GENERATORS } from '../../src/engine/generators';
import { VERBAL_BANK } from '../../src/engine/verbal/bank';

describe('seed norms migration', () => {
  const sql = readFileSync(resolve('db/migrations/002_seed_norms.sql'), 'utf8');
  const rows = [
    ...sql.matchAll(/\(1, '(junior|adult)', '([^']+)', (-?[\d.]+), ([\d.]+), (\d+)\)/g),
  ];

  it('matches SEED_NORMS for every age band', () => {
    expect(rows).toHaveLength(AGE_BANDS.length);
    for (const [, track, band, mean, sd, n] of rows) {
      const def = AGE_BANDS.find((b) => b.id === band);
      expect(def?.track).toBe(track);
      expect(SEED_NORMS[band ?? '']).toEqual({ mean: Number(mean), sd: Number(sd), n: Number(n) });
    }
  });
});

describe('schema', () => {
  // Columns only: comments are stripped.
  const sql = readFileSync(resolve('db/migrations/001_init.sql'), 'utf8')
    .replace(/--.*$/gm, '')
    .toLowerCase();

  it('creates the spec tables', () => {
    for (const t of [
      'test_takers',
      'attempts',
      'responses',
      'seen_items',
      'item_params',
      'norms',
    ]) {
      expect(sql).toContain(`create table ${t} (`);
    }
  });

  it('stores no personal details beyond age in years', () => {
    for (const word of ['email', 'name text', 'birth', 'ip_address', 'ip text', 'user_agent']) {
      expect(sql).not.toContain(word);
    }
  });
});

describe('seed parameters', () => {
  it('cover every generator template and bank item once', () => {
    const rows = seedParams();
    const expected =
      Object.keys(GENERATORS).length * 5 + VERBAL_BANK.adult.length + VERBAL_BANK.junior.length;
    expect(rows).toHaveLength(expected);
    expect(new Set(rows.map((r) => r.key)).size).toBe(expected);
  });
});
