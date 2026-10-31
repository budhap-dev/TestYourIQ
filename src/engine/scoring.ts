import { estimateAbility, type Estimate, type Response } from './irt';
import { CALIBRATION_THRESHOLD, type Norm } from './norms';
import { AREAS, type Area } from './types';

export const IQ_MIN = 55;
export const IQ_MAX = 145;

export interface IqResult {
  /** Rounded and clamped to 55–145. */
  iq: number;
  /** "112", "145+" or "below 55". */
  iqLabel: string;
  /** 95% range, rounded and clamped. */
  low: number;
  high: number;
  z: number;
  /** 0–100, unrounded. */
  percentile: number;
  /** Plain-language percentile, e.g. "79%", "more than 99%", "less than 1%". */
  percentileLabel: string;
  /** True while the norm rests on fewer than the calibration threshold of attempts. */
  calibrating: boolean;
}

/** Standard normal CDF (Abramowitz & Stegun 7.1.26, error < 1.5e−7). */
export function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const poly =
    t *
    (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-x * x);
  return 0.5 * (1 + Math.sign(z) * erf);
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function scoreIq({ theta, se }: Estimate, norm: Norm): IqResult {
  const z = (theta - norm.mean) / norm.sd;
  const raw = 100 + 15 * z;
  const margin = (1.96 * 15 * se) / norm.sd;
  const percentile = normalCdf(z) * 100;

  return {
    iq: Math.round(clamp(raw, IQ_MIN, IQ_MAX)),
    iqLabel:
      raw >= IQ_MAX + 0.5
        ? `${IQ_MAX}+`
        : raw < IQ_MIN - 0.5
          ? `below ${IQ_MIN}`
          : `${Math.round(raw)}`,
    low: Math.round(clamp(raw - margin, IQ_MIN, IQ_MAX)),
    high: Math.round(clamp(raw + margin, IQ_MIN, IQ_MAX)),
    z,
    percentile,
    percentileLabel:
      percentile >= 99.5
        ? 'more than 99%'
        : percentile < 0.5
          ? 'less than 1%'
          : `${Math.round(percentile)}%`,
    calibrating: norm.n < CALIBRATION_THRESHOLD,
  };
}

export type AreaBand = 'below average' | 'average' | 'above average';

/** z beyond ±0.67 is roughly the bottom or top quarter. */
const BAND_CUT = 0.67;

export interface AreaResult {
  area: Area;
  items: number;
  correct: number;
  band: AreaBand;
  /** For the bar: position on a 0–1 scale (θ from −3 to +3 SDs around the age mean). */
  position: number;
}

export interface AreaResponse extends Response {
  area: Area;
}

/** EAP for a whole attempt, with a standard normal prior on the age band's own scale. */
export function estimateForBand(responses: readonly Response[], norm: Norm): Estimate {
  return estimateAbility(responses, norm);
}

/**
 * Per-area results, each from EAP on that area's items only. Shown as broad bands rather than
 * numbers because they rest on few items.
 */
export function scoreAreas(responses: readonly AreaResponse[], norm: Norm): AreaResult[] {
  return AREAS.flatMap((area) => {
    const own = responses.filter((r) => r.area === area);
    if (own.length === 0) return [];
    const { theta } = estimateAbility(own, norm);
    const z = (theta - norm.mean) / norm.sd;
    return [
      {
        area,
        items: own.length,
        correct: own.filter((r) => r.correct).length,
        band: z < -BAND_CUT ? 'below average' : z > BAND_CUT ? 'above average' : 'average',
        position: clamp((z + 3) / 6, 0, 1),
      },
    ];
  });
}
