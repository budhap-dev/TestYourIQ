import { handleCreateAttempt } from '../../server/handlers.js';

export const POST = (request: Request) => handleCreateAttempt(request);
