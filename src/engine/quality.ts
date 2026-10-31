import { probability } from './irt.js';

/**
 * Response-quality checks used to keep careless or random attempts out of the norming data.
 * They never change a person's score; they only affect whether the attempt is used to
 * recalibrate the test.
 */

export interface QualityResponse {
  a: number;
  b: number;
  correct: boolean;
  /** null when skipped or not reached. */
  answerIndex: number | null;
  responseMs: number | null;
  /** True for items that were shown. Items never reached because time ran out are false. */
  presented: boolean;
}

export type QualityFlag = 'too_fast' | 'same_position' | 'aberrant_pattern';

export const MIN_MEDIAN_MS = 3000;
const SAME_POSITION_SHARE = 0.75;
const MIN_ANSWERS_FOR_POSITION = 12;
const LZ_CUTOFF = -2.5;
const MIN_ITEMS_FOR_LZ = 15;

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((x, y) => x - y);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

/**
 * Standardised log-likelihood person-fit statistic (Drasgow et al.). Strongly negative values
 * mean the pattern is unlike any real ability level, e.g. hard items right and easy ones wrong.
 */
export function lz(responses: readonly QualityResponse[], theta: number): number | null {
  if (responses.length < MIN_ITEMS_FOR_LZ) return null;
  let l0 = 0;
  let expected = 0;
  let variance = 0;
  for (const r of responses) {
    const p = Math.min(1 - 1e-9, Math.max(1e-9, probability(theta, r.a, r.b)));
    const logit = Math.log(p / (1 - p));
    l0 += r.correct ? Math.log(p) : Math.log(1 - p);
    expected += p * Math.log(p) + (1 - p) * Math.log(1 - p);
    variance += p * (1 - p) * logit * logit;
  }
  return variance > 0 ? (l0 - expected) / Math.sqrt(variance) : null;
}

export function assessQuality(
  responses: readonly QualityResponse[],
  theta: number,
): { flags: QualityFlag[]; medianMs: number | null; lz: number | null } {
  const flags: QualityFlag[] = [];
  const shown = responses.filter((r) => r.presented);

  const times = shown.map((r) => r.responseMs).filter((t): t is number => t !== null);
  const medianMs = median(times);
  if (medianMs !== null && medianMs < MIN_MEDIAN_MS) flags.push('too_fast');

  const answered = shown.map((r) => r.answerIndex).filter((i): i is number => i !== null);
  if (answered.length >= MIN_ANSWERS_FOR_POSITION) {
    const counts = new Map<number, number>();
    for (const i of answered) counts.set(i, (counts.get(i) ?? 0) + 1);
    if (Math.max(...counts.values()) / answered.length >= SAME_POSITION_SHARE)
      flags.push('same_position');
  }

  const fit = lz(shown, theta);
  if (fit !== null && fit < LZ_CUTOFF) flags.push('aberrant_pattern');

  return { flags, medianMs, lz: fit };
}
