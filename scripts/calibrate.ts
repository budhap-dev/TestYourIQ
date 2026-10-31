import { closePool, getPool } from '../server/db.js';
import { runCalibration } from '../server/maintenance.js';

/**
 * Recalibrates item parameters and age norms from eligible attempts and writes new versions.
 * Usage: npm run calibrate [-- --dry-run]
 */
async function main() {
  const summary = await runCalibration(await getPool(), {
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
