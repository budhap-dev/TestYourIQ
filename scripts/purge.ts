import { closePool, getPool } from '../server/db.js';
import { purgeExpired } from '../server/maintenance.js';

/**
 * Deletes test records older than 24 months. Usage: npm run purge [-- --dry-run]
 */
async function main() {
  const summary = await purgeExpired(await getPool(), {
    dryRun: process.argv.includes('--dry-run'),
  });
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(closePool);
