// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { estimateAbility, information, probability, type Response } from '../../src/engine/irt';
import { AGE_BANDS, SEED_NORMS, bandForAge, trackForAge } from '../../src/engine/norms';
import {
  estimateForBand,
  normalCdf,
  scoreAreas,
  scoreIq,
  type AreaResponse,
} from '../../src/engine/scoring';

const items = (bs: number[], a = 1.2) => bs.map((b) => ({ a, b }));
const spread = Array.from({ length: 30 }, (_, i) => -3 + (6 * i) / 29);
const answer = (list: { a: number; b: number }[], correct: (i: number) => boolean): Response[] =>
  list.map((it, i) => ({ ...it, correct: correct(i) }));

describe('2PL model', () => {
  it('gives 50% at θ = b and rises with θ', () => {
    expect(probability(0.4, 1.3, 0.4)).toBeCloseTo(0.5, 10);
    expect(probability(1, 1, 0)).toBeGreaterThan(probability(0, 1, 0));
    expect(probability(1, 1, 0)).toBeCloseTo(1 / (1 + Math.exp(-1)), 10);
  });

  it('has maximum information a²/4 at θ = b', () => {
    expect(information(0.7, 2, 0.7)).toBeCloseTo(1, 10);
    expect(information(1.5, 2, 0.7)).toBeLessThan(1);
  });
});

describe('EAP estimation', () => {
  it('returns the prior with no responses', () => {
    const e = estimateAbility([]);
    expect(e.theta).toBeCloseTo(0, 3);
    expect(e.se).toBeCloseTo(1, 2);
  });

  it('matches direct numerical integration for one item', () => {
    // Posterior ∝ φ(θ)·σ(θ) for one correct item with a = 1, b = 0.
    let num = 0;
    let den = 0;
    for (let t = -10; t <= 10; t += 0.0005) {
      const w = Math.exp(-0.5 * t * t) * probability(t, 1, 0);
      num += t * w;
      den += w;
    }
    expect(estimateAbility([{ a: 1, b: 0, correct: true }]).theta).toBeCloseTo(num / den, 3);
  });

  it('is symmetric: flipping every answer flips θ', () => {
    const list = items(spread);
    const pattern = (i: number) => i % 3 !== 0;
    const up = estimateAbility(answer(list, pattern));
    const down = estimateAbility(answer(items(spread.map((b) => -b)), (i) => !pattern(i)));
    expect(up.theta).toBeCloseTo(-down.theta, 4);
    expect(up.se).toBeCloseTo(down.se, 4);
  });

  it('puts a half-right pattern on items at b = 0 near θ = 0', () => {
    const e = estimateAbility(answer(items(new Array(20).fill(0)), (i) => i % 2 === 0));
    expect(Math.abs(e.theta)).toBeLessThan(0.01);
  });

  it('rises with every extra correct answer (Guttman patterns)', () => {
    const list = items(spread);
    let previous = -Infinity;
    for (let k = 0; k <= list.length; k++) {
      // The k easiest items right, the rest wrong.
      const { theta } = estimateAbility(answer(list, (i) => i < k));
      expect(theta).toBeGreaterThan(previous);
      previous = theta;
    }
  });

  it('gives extreme but finite estimates for all right or all wrong', () => {
    const list = items(spread);
    const high = estimateAbility(answer(list, () => true));
    const low = estimateAbility(answer(list, () => false));
    expect(high.theta).toBeGreaterThan(2);
    expect(low.theta).toBeLessThan(-2);
    expect(Number.isFinite(high.theta) && Number.isFinite(low.theta)).toBe(true);
  });

  it('narrows the standard error as items are added', () => {
    const list = items(new Array(40).fill(0));
    const se = (n: number) => estimateAbility(answer(list.slice(0, n), (i) => i % 2 === 0)).se;
    expect(se(10)).toBeLessThan(se(4));
    expect(se(40)).toBeLessThan(se(10));
    expect(se(40)).toBeLessThan(0.4);
  });

  it('recovers simulated abilities on average', () => {
    // Deterministic simulation: 25 items near the true θ, outcomes by expected proportion.
    for (const truth of [-1.5, 0, 1.5]) {
      const list = items(Array.from({ length: 25 }, (_, i) => truth - 1.2 + (2.4 * i) / 24));
      const responses = answer(list, (i) => probability(truth, 1.2, list[i]?.b ?? 0) > 0.5);
      expect(estimateAbility(responses).theta).toBeGreaterThan(truth - 0.6);
      expect(estimateAbility(responses).theta).toBeLessThan(truth + 0.6);
    }
  });

  it('uses the age band as the prior', () => {
    const eight = SEED_NORMS.j8 ?? { mean: 0, sd: 1, n: 0 };
    expect(estimateForBand([], eight).theta).toBeCloseTo(eight.mean, 2);
  });
});

describe('age bands', () => {
  it.each([
    [7, null, null],
    [8, 'junior', 'j8'],
    [15, 'junior', 'j15'],
    [16, 'adult', 'a16-19'],
    [24, 'adult', 'a20-24'],
    [25, 'adult', 'a25-34'],
    [74, 'adult', 'a65-74'],
    [75, 'adult', 'a75plus'],
    [101, 'adult', 'a75plus'],
    [111, null, null],
    [12.5, null, null],
  ])('age %s → %s / %s', (age, track, band) => {
    expect(trackForAge(age)).toBe(track);
    expect(bandForAge(age)?.id ?? null).toBe(band);
  });

  it('has a seed norm for every band, flagged as uncalibrated', () => {
    expect(AGE_BANDS).toHaveLength(16);
    for (const b of AGE_BANDS) expect(SEED_NORMS[b.id]?.n).toBe(0);
  });
});

describe('IQ scoring', () => {
  const norm = { mean: 0.2, sd: 0.9, n: 1200 };

  it('maps the band mean to 100 and one SD to 115', () => {
    expect(scoreIq({ theta: 0.2, se: 0.3 }, norm).iq).toBe(100);
    expect(scoreIq({ theta: 1.1, se: 0.3 }, norm).iq).toBe(115);
    expect(scoreIq({ theta: -0.7, se: 0.3 }, norm).iq).toBe(85);
  });

  it('computes the 95% range from the standard error', () => {
    const r = scoreIq({ theta: 0.2, se: 0.3 }, norm);
    const margin = (1.96 * 15 * 0.3) / 0.9; // 9.8
    expect(r.low).toBe(Math.round(100 - margin));
    expect(r.high).toBe(Math.round(100 + margin));
  });

  it('computes percentiles from the normal curve', () => {
    expect(scoreIq({ theta: 0.2, se: 0.3 }, norm).percentile).toBeCloseTo(50, 5);
    expect(scoreIq({ theta: 1.1, se: 0.3 }, norm).percentile).toBeCloseTo(84.13, 1);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 4);
    expect(normalCdf(-1)).toBeCloseTo(0.1587, 4);
  });

  it('clamps to 55–145 and labels the extremes', () => {
    const top = scoreIq({ theta: 4, se: 0.5 }, norm);
    expect(top.iq).toBe(145);
    expect(top.iqLabel).toBe('145+');
    expect(top.high).toBe(145);
    expect(top.percentileLabel).toBe('more than 99%');
    const bottom = scoreIq({ theta: -4, se: 0.5 }, norm);
    expect(bottom.iq).toBe(55);
    expect(bottom.iqLabel).toBe('below 55');
    expect(bottom.percentileLabel).toBe('less than 1%');
    expect(scoreIq({ theta: 1.1, se: 0.3 }, norm).iqLabel).toBe('115');
  });

  it('flags norms with fewer than 500 attempts as calibrating', () => {
    expect(scoreIq({ theta: 0, se: 0.3 }, { mean: 0, sd: 1, n: 499 }).calibrating).toBe(true);
    expect(scoreIq({ theta: 0, se: 0.3 }, { mean: 0, sd: 1, n: 500 }).calibrating).toBe(false);
  });
});

describe('area bands', () => {
  const norm = { mean: 0, sd: 1, n: 0 };
  const block = (area: AreaResponse['area'], right: number, of = 8): AreaResponse[] =>
    Array.from({ length: of }, (_, i) => ({
      area,
      a: 1.2,
      b: -1.5 + (3 * i) / (of - 1),
      correct: i < right,
    }));

  it('bands each area from its own items', () => {
    const results = scoreAreas(
      [
        ...block('pattern', 8),
        ...block('numerical', 4),
        ...block('spatial', 0),
        ...block('verbal', 4),
      ],
      norm,
    );
    const band = Object.fromEntries(results.map((r) => [r.area, r.band]));
    expect(band).toEqual({
      pattern: 'above average',
      numerical: 'average',
      spatial: 'below average',
      verbal: 'average',
    });
    for (const r of results) {
      expect(r.position).toBeGreaterThanOrEqual(0);
      expect(r.position).toBeLessThanOrEqual(1);
    }
  });

  it('leaves out areas with no items', () => {
    expect(scoreAreas(block('pattern', 3), norm).map((r) => r.area)).toEqual(['pattern']);
  });
});
