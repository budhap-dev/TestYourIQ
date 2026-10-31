import type { Track } from './types';

/**
 * Age bands and the population mean/SD of θ in each. The seed values below are clearly marked
 * estimates, used until real eligible attempts recalibrate them (scripts/calibrate). They assume
 * reasoning scores rise through childhood and dip gently in later adulthood.
 */

export const JUNIOR_MIN_AGE = 8;
export const ADULT_MIN_AGE = 16;
export const MAX_AGE = 110;

export interface BandDef {
  id: string;
  track: Track;
  minAge: number;
  /** Inclusive; null for the open-ended top band. */
  maxAge: number | null;
  label: string;
}

const junior: BandDef[] = Array.from({ length: 8 }, (_, i) => ({
  id: `j${8 + i}`,
  track: 'junior',
  minAge: 8 + i,
  maxAge: 8 + i,
  label: `age ${8 + i}`,
}));

const adultRanges: [number, number | null][] = [
  [16, 19],
  [20, 24],
  [25, 34],
  [35, 44],
  [45, 54],
  [55, 64],
  [65, 74],
  [75, null],
];
const adult: BandDef[] = adultRanges.map(([min, max]) => ({
  id: max === null ? `a${min}plus` : `a${min}-${max}`,
  track: 'adult',
  minAge: min,
  maxAge: max,
  label: max === null ? `${min} and over` : `${min}–${max}`,
}));

export const AGE_BANDS: readonly BandDef[] = [...junior, ...adult];

export function trackForAge(age: number): Track | null {
  if (!Number.isInteger(age) || age < JUNIOR_MIN_AGE || age > MAX_AGE) return null;
  return age < ADULT_MIN_AGE ? 'junior' : 'adult';
}

export function bandForAge(age: number): BandDef | null {
  if (trackForAge(age) === null) return null;
  return AGE_BANDS.find((b) => age >= b.minAge && (b.maxAge === null || age <= b.maxAge)) ?? null;
}

export interface Norm {
  mean: number;
  sd: number;
  /** Eligible attempts behind this norm; 0 for seed estimates. */
  n: number;
}

/** Below this many eligible attempts, results show a "calibrating" note. */
export const CALIBRATION_THRESHOLD = 500;

export const SEED_NORMS: Record<string, Norm> = {
  j8: { mean: -2.0, sd: 1, n: 0 },
  j9: { mean: -1.7, sd: 1, n: 0 },
  j10: { mean: -1.4, sd: 1, n: 0 },
  j11: { mean: -1.1, sd: 1, n: 0 },
  j12: { mean: -0.85, sd: 1, n: 0 },
  j13: { mean: -0.6, sd: 1, n: 0 },
  j14: { mean: -0.4, sd: 1, n: 0 },
  j15: { mean: -0.25, sd: 1, n: 0 },
  'a16-19': { mean: -0.1, sd: 1, n: 0 },
  'a20-24': { mean: 0, sd: 1, n: 0 },
  'a25-34': { mean: 0, sd: 1, n: 0 },
  'a35-44': { mean: -0.05, sd: 1, n: 0 },
  'a45-54': { mean: -0.15, sd: 1, n: 0 },
  'a55-64': { mean: -0.3, sd: 1, n: 0 },
  'a65-74': { mean: -0.5, sd: 1, n: 0 },
  a75plus: { mean: -0.75, sd: 1, n: 0 },
};
