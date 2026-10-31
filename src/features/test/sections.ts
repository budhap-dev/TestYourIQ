import type { Track } from '../../engine/types';

/** Section names and minutes for the "ready" screen. Mirrors the server blueprint (tested). */
export const SECTION_SUMMARY: Record<Track, readonly (readonly [string, number])[]> = {
  adult: [
    ['Patterns', 10],
    ['Numbers', 7],
    ['Shapes', 6],
    ['Words', 4],
  ],
  junior: [
    ['Patterns', 11],
    ['Numbers', 8],
    ['Shapes', 7],
    ['Words', 5],
  ],
};
