// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  calibrate,
  DEFAULT_CALIBRATION,
  type CalibrationPerson,
} from '../../src/engine/calibration';
import { probability } from '../../src/engine/irt';
import { SEED_NORMS } from '../../src/engine/norms';
import { createRng } from '../../src/engine/rng';

/** Simulated test-takers answering random subsets of items with known parameters. */
function simulate(
  bands: Record<string, { mean: number; sd: number; n: number }>,
  items: Map<string, { a: number; b: number }>,
  perPerson: number,
  seed: number,
) {
  const rng = createRng(seed);
  const normal = () => {
    const u = Math.max(1e-12, rng.next());
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng.next());
  };
  const keys = [...items.keys()];
  const people: CalibrationPerson[] = [];
  for (const [band, { mean, sd, n }] of Object.entries(bands)) {
    for (let i = 0; i < n; i++) {
      const theta = mean + sd * normal();
      const responses = rng
        .shuffle(keys)
        .slice(0, perPerson)
        .map((key) => {
          const { a, b } = items.get(key) as { a: number; b: number };
          return { key, correct: rng.next() < probability(theta, a, b) };
        });
      people.push({ band, responses });
    }
  }
  return people;
}

describe('calibration (MML-EM)', () => {
  const truth = new Map(
    Array.from(
      { length: 40 },
      (_, i) => [`item${i}`, { a: 0.8 + (i % 5) * 0.2, b: -2.5 + (5 * i) / 39 }] as const,
    ),
  );
  const people = simulate(
    {
      'a20-24': { mean: 0, sd: 1, n: 700 },
      'a25-34': { mean: 0, sd: 1, n: 500 },
      'a65-74': { mean: -0.8, sd: 1.2, n: 600 },
    },
    truth,
    24,
    7,
  );
  // Start from deliberately wrong parameters and the seed norms.
  const start = new Map([...truth.keys()].map((k) => [k, { a: 1, b: 0 }]));
  const result = calibrate(people, start, SEED_NORMS);

  it('recovers item difficulty and discrimination', () => {
    const errB = [...truth].map(([k, t]) => (result.items.get(k)?.b ?? 0) - t.b);
    const errA = [...truth].map(([k, t]) => (result.items.get(k)?.a ?? 0) - t.a);
    const rmse = (e: number[]) => Math.sqrt(e.reduce((s, x) => s + x * x, 0) / e.length);
    expect(rmse(errB)).toBeLessThan(0.2);
    expect(rmse(errA)).toBeLessThan(0.25);
    expect(result.anchored).toBe(true);
  });

  it('recovers each band’s mean and SD, including a non-reference band', () => {
    const older = result.bands.get('a65-74');
    expect(older?.mean).toBeGreaterThan(-1.0);
    expect(older?.mean).toBeLessThan(-0.6);
    expect(older?.sd).toBeGreaterThan(1.0);
    expect(older?.sd).toBeLessThan(1.4);
    expect(older?.n).toBe(600);
    expect(Math.abs(result.bands.get('a20-24')?.mean ?? 9)).toBeLessThan(0.15);
  });

  it('keeps previous values where there is too little data', () => {
    expect(result.bands.get('j8')).toEqual({ ...SEED_NORMS.j8, n: 0, updated: false });
    const sparse = calibrate(people.slice(0, 40), start, SEED_NORMS);
    expect(sparse.anchored).toBe(false);
    expect([...sparse.items.values()].every((i) => !i.updated)).toBe(true);
    expect(sparse.items.get('item0')).toMatchObject({ a: 1, b: 0 });
  });

  it('converges within the iteration limit', () => {
    expect(result.iterations).toBeLessThan(DEFAULT_CALIBRATION.maxIterations);
  });
});
