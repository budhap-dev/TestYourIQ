import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { PoolLike } from '../../server/db';
import { seedParams } from '../../scripts/seed';

/** An embedded Postgres with the real migrations and seed parameters applied. */
export async function migratedDb(): Promise<{ db: PGlite; pool: PoolLike }> {
  const db = new PGlite();
  const dir = resolve('db/migrations');
  for (const file of readdirSync(dir).sort()) await db.exec(readFileSync(join(dir, file), 'utf8'));
  const values = seedParams()
    .map((r) => `('${r.key}', 1, ${r.a}, ${r.b})`)
    .join(',');
  await db.exec(`insert into item_params (param_key, version, a, b) values ${values}`);

  // PGlite is a single connection; serialise transactions like a pool of one.
  let queue: Promise<unknown> = Promise.resolve();
  const pool: PoolLike = {
    query: (text, params) => db.query(text, params) as never,
    connect: async () => {
      let release!: () => void;
      const turn = new Promise<void>((r) => (release = r));
      const wait = queue;
      queue = queue.then(() => turn);
      await wait;
      return {
        query: (text: string, params?: unknown[]) => db.query(text, params) as never,
        release,
      };
    },
    end: async () => undefined,
  };
  return { db, pool };
}
