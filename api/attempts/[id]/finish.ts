import { handleFinish } from '../../../server/handlers.js';

export const POST = (request: Request) => handleFinish(request);
