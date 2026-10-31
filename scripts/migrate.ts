import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { closePool, getPool } from '../server/db.js';

/**
 * Applies db/migrations/*.sql in name order, each in its own transaction, recording what has
 * run in schema_migrations. Safe to run repeatedly. Usage: npm run migrate
 */

const dir = join(import.meta.dirname, '..', 'db', 'migrations');

async function main() {
  const pool = await getPool();
  await pool.query(
    'create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())',
  );
  const { rows } = await pool.query<{ name: string }>('select name from schema_migrations');
  const applied = new Set(rows.map((r) => r.name));
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(readFileSync(join(dir, file), 'utf8'));
      await client.query('insert into schema_migrations (name) values ($1)', [file]);
      await client.query('commit');
      console.log(`applied ${file}`);
    } catch (err) {
      await client.query('rollback');
      throw new Error(`Migration ${file} failed: ${(err as Error).message}`, { cause: err });
    } finally {
      client.release();
    }
  }
  console.log(`database is up to date (${files.length} migrations)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(closePool);
