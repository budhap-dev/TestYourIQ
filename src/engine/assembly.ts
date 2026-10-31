import { information } from './irt.js';
import type { Area, Difficulty, IrtParams, Track } from './types.js';

/**
 * Test blueprint and adaptive item selection. Every test has the same sections, item counts,
 * item-type mix, opening difficulties and timing (parallel forms). Within those constraints,
 * each later item is the one most informative at the current ability estimate.
 */

export type SourceId =
  'matrix' | 'series' | 'number-analogy' | 'rotation' | 'mirror' | 'verbal-analogy' | 'verbal-odd';

export interface SectionPlan {
  area: Area;
  items: number;
  /** Time limit for the whole section. */
  seconds: number;
  /** Item types, used in rotation. */
  sources: readonly SourceId[];
  /** Fixed difficulties for the first items, before the estimate means much. */
  opening: readonly Difficulty[];
  minDifficulty: Difficulty;
  maxDifficulty: Difficulty;
  /** No more than this many items of one difficulty per section, so forms keep a spread. */
  maxPerDifficulty: number;
}

const section = (area: Area, seconds: number, sources: SourceId[], track: Track): SectionPlan => ({
  area,
  items: 8,
  seconds,
  sources,
  opening: track === 'adult' ? [2, 3] : [1, 2],
  minDifficulty: 1,
  maxDifficulty: track === 'adult' ? 5 : 4,
  maxPerDifficulty: 3,
});

export const BLUEPRINTS: Record<Track, readonly SectionPlan[]> = {
  adult: [
    section('pattern', 600, ['matrix'], 'adult'),
    section('numerical', 420, ['series', 'number-analogy'], 'adult'),
    section('spatial', 360, ['rotation', 'mirror'], 'adult'),
    section('verbal', 240, ['verbal-analogy', 'verbal-odd'], 'adult'),
  ],
  junior: [
    section('pattern', 660, ['matrix'], 'junior'),
    section('numerical', 480, ['series', 'number-analogy'], 'junior'),
    section('spatial', 420, ['rotation', 'mirror'], 'junior'),
    section('verbal', 300, ['verbal-analogy', 'verbal-odd'], 'junior'),
  ],
};

export const totalItems = (track: Track) => BLUEPRINTS[track].reduce((n, s) => n + s.items, 0);
export const totalSeconds = (track: Track) => BLUEPRINTS[track].reduce((n, s) => n + s.seconds, 0);

export interface Candidate {
  /** Template key for generated items, item id for bank items. */
  id: string;
  difficulty: Difficulty;
  irt: IrtParams;
}

/**
 * Choose the next item for `slot` of a section. `used` lists the difficulties already given in
 * this section. Candidates should arrive in a random (seeded) order so ties don't always go
 * to the same item. Returns null if there is no candidate at all.
 */
export function selectCandidate(
  plan: SectionPlan,
  slot: number,
  used: readonly Difficulty[],
  theta: number,
  candidates: readonly Candidate[],
): Candidate | null {
  const inRange = candidates.filter(
    (c) => c.difficulty >= plan.minDifficulty && c.difficulty <= plan.maxDifficulty,
  );
  const pool = inRange.length ? inRange : candidates;
  if (pool.length === 0) return null;

  const opening = plan.opening[slot];
  if (opening !== undefined) {
    const distance = (c: Candidate) => Math.abs(c.difficulty - opening);
    const best = Math.min(...pool.map(distance));
    return pool.find((c) => distance(c) === best) ?? null;
  }

  const count = (d: Difficulty) => used.filter((u) => u === d).length;
  const capped = pool.filter((c) => count(c.difficulty) < plan.maxPerDifficulty);
  const choices = capped.length ? capped : pool;
  let best: Candidate | null = null;
  let bestInfo = -1;
  for (const c of choices) {
    const info = information(theta, c.irt.a, c.irt.b);
    if (info > bestInfo + 1e-12) {
      best = c;
      bestInfo = info;
    }
  }
  return best;
}
