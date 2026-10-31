import { handleAnswer } from '../../../server/handlers.js';

export const POST = (request: Request) => handleAnswer(request);
