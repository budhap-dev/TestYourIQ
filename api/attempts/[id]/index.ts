import { handleCurrent } from '../../../server/handlers.js';

export const GET = (request: Request) => handleCurrent(request);
