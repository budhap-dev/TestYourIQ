import { probability } from './irt.js';
import type { Norm } from './norms.js';
import type { IrtParams } from './types.js';

/**
 * Recalibration from real responses: marginal maximum likelihood by EM (Bock & Aitkin), with
 * one latent distribution per age band.
 *
 *  - E-step: each person's posterior over a grid of θ values, given their band's distribution
 *    and current item parameters.
 *  - M-step: each item's a and b from the expected correct/total counts at each grid point
 *    (Fisher scoring, with weak priors that keep small samples sensible); each band's mean and
 *    SD from its members' posterior moments.
 *  - Scale: the reference bands (young adults) are fixed at N(0, 1) when they have enough
 *    people. Otherwise every band keeps its current norm and only items move.
 *
 * Items or bands with too little data keep their previous values.
 */

export interface CalibrationPerson {
  band: string;
  responses: { key: string; correct: boolean }[];
}

export interface CalibrationOptions {
  /** Minimum responses before an item's parameters are re-estimated. */
  minItemN: number;
  /** Minimum people before a band's mean and SD are re-estimated. */
  minBandN: number;
  /** Bands fixed at N(0, 1) to anchor the scale, and how many people they need between them. */
  referenceBands: readonly string[];
  minReferenceN: number;
  maxIterations: number;
  tolerance: number;
}

export const DEFAULT_CALIBRATION: CalibrationOptions = {
  minItemN: 50,
  minBandN: 30,
  referenceBands: ['a20-24', 'a25-34'],
  minReferenceN: 200,
  maxIterations: 50,
  tolerance: 1e-3,
};

export interface CalibratedItem extends IrtParams {
  n: number;
  updated: boolean;
}

export interface CalibratedBand extends Norm {
  updated: boolean;
}

export interface CalibrationResult {
  items: Map<string, CalibratedItem>;
  bands: Map<string, CalibratedBand>;
  iterations: number;
  anchored: boolean;
}

const NODES = Array.from({ length: 49 }, (_, i) => -7 + i * 0.25); // −7 … +5
const A_PRIOR_SD = 0.5; // on log a
const B_PRIOR_SD = 1.5;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function normalWeights(mean: number, sd: number): number[] {
  const w = NODES.map((t) => Math.exp(-0.5 * ((t - mean) / sd) ** 2));
  const total = w.reduce((x, y) => x + y, 0);
  return w.map((v) => v / total);
}

/** Fit one item to expected counts at the grid nodes. */
function fitItem(r: number[], n: number[], start: IrtParams, prior: IrtParams): IrtParams {
  let alpha = Math.log(start.a);
  let b = start.b;
  const alpha0 = Math.log(prior.a);
  for (let iter = 0; iter < 30; iter++) {
    const a = Math.exp(alpha);
    let gA = -(alpha - alpha0) / A_PRIOR_SD ** 2;
    let gB = -(b - prior.b) / B_PRIOR_SD ** 2;
    let iAA = 1 / A_PRIOR_SD ** 2;
    let iBB = 1 / B_PRIOR_SD ** 2;
    let iAB = 0;
    NODES.forEach((theta, q) => {
      const nq = n[q] as number;
      if (nq <= 0) return;
      const p = probability(theta, a, b);
      const z = a * (theta - b);
      const resid = (r[q] as number) - nq * p;
      const w = nq * p * (1 - p);
      gA += resid * z;
      gB += -resid * a;
      iAA += w * z * z;
      iBB += w * a * a;
      iAB += -w * z * a;
    });
    const det = iAA * iBB - iAB * iAB;
    if (det <= 1e-12) break;
    const dA = (iBB * gA - iAB * gB) / det;
    const dB = (iAA * gB - iAB * gA) / det;
    alpha = clamp(alpha + clamp(dA, -0.5, 0.5), Math.log(0.2), Math.log(4));
    b = clamp(b + clamp(dB, -1, 1), -6, 6);
    if (Math.abs(dA) < 1e-6 && Math.abs(dB) < 1e-6) break;
  }
  return { a: Math.exp(alpha), b };
}

export function calibrate(
  people: readonly CalibrationPerson[],
  params: ReadonlyMap<string, IrtParams>,
  norms: Readonly<Record<string, Norm>>,
  options: CalibrationOptions = DEFAULT_CALIBRATION,
): CalibrationResult {
  // Index items and count responses.
  const keys = [...new Set(people.flatMap((p) => p.responses.map((r) => r.key)))];
  const counts = new Map(keys.map((k) => [k, 0]));
  for (const p of people)
    for (const r of p.responses) counts.set(r.key, (counts.get(r.key) ?? 0) + 1);
  const current = new Map(keys.map((k) => [k, params.get(k) ?? { a: 1, b: 0 }]));
  const free = new Set(keys.filter((k) => (counts.get(k) ?? 0) >= options.minItemN));

  const bands = [...new Set(people.map((p) => p.band))];
  const size = (b: string) => people.filter((p) => p.band === b).length;
  const referenceN = options.referenceBands.reduce((n, b) => n + size(b), 0);
  const anchored = referenceN >= options.minReferenceN;
  const dist = new Map(
    bands.map((b) => {
      const isRef = anchored && options.referenceBands.includes(b);
      const norm = norms[b] ?? { mean: 0, sd: 1, n: 0 };
      return [b, isRef ? { mean: 0, sd: 1 } : { mean: norm.mean, sd: norm.sd }];
    }),
  );
  const freeBand = (b: string) =>
    anchored && !options.referenceBands.includes(b) && size(b) >= options.minBandN;

  let iterations = 0;
  let posteriors: number[][] = [];
  for (; iterations < options.maxIterations; iterations++) {
    // E-step
    const priors = new Map(
      bands.map((b) => {
        const d = dist.get(b) ?? { mean: 0, sd: 1 };
        return [b, normalWeights(d.mean, d.sd)];
      }),
    );
    posteriors = people.map((person) => {
      const prior = priors.get(person.band) as number[];
      const logs = NODES.map((theta, q) => {
        let l = Math.log((prior[q] as number) + 1e-300);
        for (const r of person.responses) {
          const { a, b } = current.get(r.key) as IrtParams;
          const pr = Math.min(1 - 1e-12, Math.max(1e-12, probability(theta, a, b)));
          l += r.correct ? Math.log(pr) : Math.log(1 - pr);
        }
        return l;
      });
      const max = Math.max(...logs);
      const w = logs.map((l) => Math.exp(l - max));
      const total = w.reduce((x, y) => x + y, 0);
      return w.map((v) => v / total);
    });

    // M-step: items
    const r = new Map<string, number[]>();
    const n = new Map<string, number[]>();
    for (const k of free) {
      r.set(
        k,
        NODES.map(() => 0),
      );
      n.set(
        k,
        NODES.map(() => 0),
      );
    }
    people.forEach((person, i) => {
      const post = posteriors[i] as number[];
      for (const resp of person.responses) {
        const nk = n.get(resp.key);
        if (!nk) continue;
        const rk = r.get(resp.key) as number[];
        for (let q = 0; q < NODES.length; q++) {
          nk[q] = (nk[q] as number) + (post[q] as number);
          if (resp.correct) rk[q] = (rk[q] as number) + (post[q] as number);
        }
      }
    });
    let change = 0;
    for (const k of free) {
      const before = current.get(k) as IrtParams;
      const after = fitItem(
        r.get(k) as number[],
        n.get(k) as number[],
        before,
        params.get(k) ?? { a: 1, b: 0 },
      );
      change = Math.max(change, Math.abs(after.a - before.a), Math.abs(after.b - before.b));
      current.set(k, after);
    }

    // M-step: band distributions
    for (const b of bands) {
      if (!freeBand(b)) continue;
      const before = dist.get(b) ?? { mean: 0, sd: 1 };
      const { mean, sd } = moments(people, posteriors, b);
      change = Math.max(change, Math.abs(mean - before.mean), Math.abs(sd - before.sd));
      dist.set(b, { mean, sd });
    }
    if (change < options.tolerance) {
      iterations++;
      break;
    }
  }

  const items = new Map<string, CalibratedItem>(
    keys.map((k) => [
      k,
      { ...(current.get(k) as IrtParams), n: counts.get(k) ?? 0, updated: free.has(k) },
    ]),
  );
  const outBands = new Map<string, CalibratedBand>();
  for (const [b, norm] of Object.entries(norms)) {
    const count = size(b);
    if (count >= options.minBandN && posteriors.length) {
      outBands.set(b, { ...moments(people, posteriors, b), n: count, updated: true });
    } else {
      outBands.set(b, { mean: norm.mean, sd: norm.sd, n: count, updated: false });
    }
  }
  return { items, bands: outBands, iterations, anchored };
}

/** Band mean and SD from posterior moments (not shrunk like the spread of point estimates). */
function moments(people: readonly CalibrationPerson[], posteriors: number[][], band: string) {
  let m1 = 0;
  let m2 = 0;
  let count = 0;
  people.forEach((p, i) => {
    if (p.band !== band) return;
    const post = posteriors[i] as number[];
    NODES.forEach((t, q) => {
      m1 += t * (post[q] as number);
      m2 += t * t * (post[q] as number);
    });
    count++;
  });
  const mean = m1 / count;
  return { mean, sd: Math.sqrt(Math.max(0.05, m2 / count - mean * mean)) };
}
