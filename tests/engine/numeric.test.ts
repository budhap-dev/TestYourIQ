// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { NUMBER_ANALOGY_LEVELS, generateNumberAnalogy } from '../../src/engine/numeric/analogy';
import { SERIES_LEVELS, generateSeries } from '../../src/engine/numeric/series';
import { DIFFICULTIES, type Item } from '../../src/engine/types';

const SEEDS = Array.from({ length: 400 }, (_, i) => i * 6007 + 11);

/** Independent check: does a completed sequence follow one of the rules a solver might see? */
function sequenceFollowsARule(t: number[]): boolean {
  const d = (s: number[]) => s.slice(1).map((v, i) => v - (s[i] as number));
  const constant = (s: number[]) => s.length >= 2 && s.every((v) => v === s[0]);
  const at = (i: number) => t[i] as number;
  let level = t;
  for (let k = 0; k < 3; k++) {
    level = d(level);
    if (constant(level)) return true;
  }
  if (t.every((v, i) => i < 2 || v === at(i - 1) + at(i - 2))) return true;
  const evens = t.filter((_, i) => i % 2 === 0);
  const odds = t.filter((_, i) => i % 2 === 1);
  if (constant(d(evens)) && constant(d(odds))) return true;
  for (let r = -5; r <= 5; r++) {
    const c = at(1) - r * at(0);
    if (t.every((v, i) => i === 0 || v === r * at(i - 1) + c)) return true;
  }
  const steps = (a: number, b: number) => [
    (v: number) => v + (b - a),
    ...(a !== 0 && b % a === 0 ? [(v: number) => (v * b) / a] : []),
  ];
  for (const f of steps(at(0), at(1))) {
    for (const g of steps(at(1), at(2))) {
      if (t.every((v, i) => i === 0 || v === (i % 2 === 1 ? f : g)(at(i - 1)))) return true;
    }
  }
  const gaps = d(t);
  const ratio = (gaps[1] as number) / (gaps[0] as number);
  return (
    Number.isInteger(ratio) &&
    ratio !== 1 &&
    gaps.every((v, i) => i === 0 || v === ratio * (gaps[i - 1] as number))
  );
}

/** Independent check: do all four input/output pairs fit one simple rule? */
function pairsFollowARule(pairs: [number, number][]): boolean {
  const families: ((x: number, p: number, q: number) => number)[] = [
    (x, p, q) => p * x + q,
    (x, p, q) => x * x + p * x + q * 0,
    (x, p) => x * x + p,
    (x, p) => p * x * x,
    (x, p) => x ** 3 + p,
  ];
  for (const f of families) {
    for (let p = -12; p <= 12; p++) {
      for (let q = -12; q <= 12; q++) {
        if (pairs.every(([x, y]) => f(x, p, q) === y)) return true;
      }
    }
  }
  return false;
}

const strategies: Record<string, (o: number[]) => number> = {
  middle: (o) => Math.floor((o.length - 1) / 2),
  'closest to its neighbour': (o) => {
    const gaps = o.map((v, i) =>
      Math.min(...o.filter((_, j) => j !== i).map((w) => Math.abs(w - v))),
    );
    return gaps.indexOf(Math.min(...gaps));
  },
  'closest to the mean': (o) => {
    const mean = o.reduce((a, b) => a + b, 0) / o.length;
    const dist = o.map((v) => Math.abs(v - mean));
    return dist.indexOf(Math.min(...dist));
  },
};

function commonChecks(items: Item<{ options: number[] }>[], optionCount: number) {
  it('has distinct, ascending, positive whole-number options', () => {
    for (const item of items) {
      const o = item.content.options;
      expect(o).toHaveLength(optionCount);
      expect([...o].sort((a, b) => a - b)).toEqual(o);
      expect(new Set(o).size).toBe(o.length);
      for (const v of o) expect(Number.isInteger(v) && v > 0).toBe(true);
    }
  });

  it('spreads the answer evenly across positions', () => {
    const counts = new Array<number>(optionCount).fill(0);
    for (const item of items) counts[item.answerIndex] = (counts[item.answerIndex] ?? 0) + 1;
    for (const c of counts) expect(c).toBeGreaterThan((items.length / optionCount) * 0.6);
  });

  it.each(Object.keys(strategies))('gives no advantage to guessing "%s"', (name) => {
    const strategy = strategies[name] as (o: number[]) => number;
    const hits = items.filter((i) => strategy(i.content.options) === i.answerIndex).length;
    expect(hits / items.length).toBeLessThan(1 / optionCount + 0.07);
  });
}

describe.each(DIFFICULTIES)('number series, difficulty %i', (difficulty) => {
  const items = SEEDS.map((s) => generateSeries(s, difficulty));

  it('is deterministic for a seed', () => {
    for (const s of SEEDS.slice(0, 30))
      expect(generateSeries(s, difficulty)).toEqual(generateSeries(s, difficulty));
  });

  it('has exactly one option that continues the series by a rule', () => {
    for (const item of items) {
      const valid = item.content.options
        .map((o, i) => (sequenceFollowsARule([...item.content.terms, o]) ? i : -1))
        .filter((i) => i >= 0);
      expect(
        valid,
        `${item.key} ${item.content.terms.join(',')} ${item.content.options.join('/')}`,
      ).toEqual([item.answerIndex]);
    }
  });

  commonChecks(items, SERIES_LEVELS[difficulty].optionCount);
});

describe.each(DIFFICULTIES)('number analogies, difficulty %i', (difficulty) => {
  const items = SEEDS.map((s) => generateNumberAnalogy(s, difficulty));

  it('is deterministic for a seed', () => {
    for (const s of SEEDS.slice(0, 30)) {
      expect(generateNumberAnalogy(s, difficulty)).toEqual(generateNumberAnalogy(s, difficulty));
    }
  });

  it('has exactly one option that fits the examples by a rule', () => {
    for (const item of items) {
      const { pairs, query, options } = item.content;
      expect(pairs).toHaveLength(3);
      const valid = options
        .map((o, i) => (pairsFollowARule([...pairs, [query, o]]) ? i : -1))
        .filter((i) => i >= 0);
      expect(valid, `${item.key} ${item.explanation}`).toEqual([item.answerIndex]);
    }
  });

  commonChecks(items, NUMBER_ANALOGY_LEVELS[difficulty].optionCount);
});
