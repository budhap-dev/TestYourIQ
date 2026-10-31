import { handleMaintenance } from '../../server/cron.js';

export const GET = (request: Request) => handleMaintenance(request);
