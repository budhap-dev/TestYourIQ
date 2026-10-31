/** Environment configuration, read lazily so tests and scripts can set it first. */

export const isProduction = () =>
  process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';

const DEV_SECRET = 'local-development-secret-not-for-production-use';

export function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (isProduction()) throw new Error('SESSION_SECRET must be set (at least 32 characters).');
  if (secret) console.warn('[unIQo] SESSION_SECRET is shorter than 32 characters.');
  return secret || DEV_SECRET;
}

export const databaseUrl = () => process.env.DATABASE_URL || null;
