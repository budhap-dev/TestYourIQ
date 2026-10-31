import { Pool as NeonPool } from '@neondatabase/serverless';
import { databaseUrl } from './env.js';

/**
 * A pg-compatible connection pool. Neon URLs use Neon's serverless driver (WebSockets, works
 * in Vercel functions); anything else, such as a local Postgres, uses node-postgres.
 */

export interface Queryable {
  query<R = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: R[] }>;
}

export interface PoolLike extends Queryable {
  connect(): Promise<Queryable & { release(): void }>;
  end(): Promise<void>;
}

let pool: PoolLike | null = null;

export async function getPool(): Promise<PoolLike> {
  if (pool) return pool;
  const url = databaseUrl();
  if (!url) throw new Error('DATABASE_URL is not set.');
  if (/\.neon\.tech(:\d+)?\//.test(url) || url.includes('.neon.tech')) {
    pool = new NeonPool({ connectionString: url }) as unknown as PoolLike;
  } else {
    // node-postgres is only needed for non-Neon databases, such as local development.
    const { default: pg } = await import('pg');
    pool = new pg.Pool({ connectionString: url }) as unknown as PoolLike;
  }
  return pool;
}

export async function closePool(): Promise<void> {
  await pool?.end();
  pool = null;
}
