import { handleMe } from '../server/handlers.js';

export const GET = (request: Request) => handleMe(request);
