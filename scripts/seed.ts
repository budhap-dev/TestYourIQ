import { GENERATORS, templateKey } from '../src/engine/generators.js';
import { DIFFICULTIES } from '../src/engine/types.js';
import { VERBAL_BANK } from '../src/engine/verbal/bank.js';
import { closePool, getPool } from '../server/db.js';

/**
 * Inserts version-1 (seed) IRT parameters for every generator template and bank item.
 * Existing rows are left alone, so it's safe to re-run after adding items. Usage: npm run seed
 */

export function seedParams(): { key: string; a: number; b: number }[] {
  const rows = Object.values(GENERATORS).flatMap((g) =>
    DIFFICULTIES.map((d) => ({ key: templateKey(g.id, g.version, d), ...g.levels[d].irt })),
  );
  for (const e of [...VERBAL_BANK.adult, ...VERBAL_BANK.junior]) {
    rows.push({ key: `bank:${e.id}`, a: 1, b: e.difficulty - 3 });
  }
  return rows;
}

async function main() {
  const pool = await getPool();
  const rows = seedParams();
  let inserted = 0;
  for (const r of rows) {
    const res = await pool.query(
      'insert into item_params (param_key, version, a, b, n) values ($1, 1, $2, $3, 0) on conflict do nothing returning 1',
      [r.key, r.a, r.b],
    );
    inserted += res.rows.length;
  }
  console.log(`item_params: ${inserted} inserted, ${rows.length - inserted} already present`);
}

if (process.argv[1]?.endsWith('seed.ts')) {
  main()
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(closePool);
}
