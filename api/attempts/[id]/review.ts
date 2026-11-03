import { handleReview } from '../../../server/handlers.js';

export const GET = (request: Request) => handleReview(request);
