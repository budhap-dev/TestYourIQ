import { timingSafeEqual } from 'node:crypto';
import { getPool } from './db.js';
import { purgeExpired, runCalibration } from './maintenance.js';

/**
 * Scheduled maintenance for Vercel Cron: purge expired records, then recalibrate. Vercel sends
 * `Authorization: Bearer $CRON_SECRET`; without CRON_SECRET configured the endpoint is off.
 */
export async function handleMaintenance(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
  if (!secret) return json({ error: 'disabled', message: 'CRON_SECRET is not set.' }, 503);

  const given = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return json({ error: 'unauthorised' }, 401);
  }
  try {
    const pool = await getPool();
    const purge = await purgeExpired(pool);
    const calibration = await runCalibration(pool);
    return json({ purge, calibration });
  } catch (err) {
    console.error('[unIQo] maintenance failed', err);
    return json({ error: 'server_error' }, 500);
  }
}
