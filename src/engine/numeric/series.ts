import { generatedKey } from '../itemKey.js';
import { createRng, type Rng } from '../rng.js';
import type { Difficulty, IrtParams, Item } from '../types.js';
import type { SeriesContent } from './model.js';
import { pickSpacedOptions } from './options.js';
import { seriesPredictions } from './solve.js';

export const SERIES_GENERATOR_ID = 'series';
export const SERIES_GENERATOR_VERSION = 1;

const SHOWN = 6;
const MAX_VALUE = 999;

type Family =
  | 'arith-up'
  | 'arith-down'
  | 'geometric'
  | 'second-order'
  | 'interleaved'
  | 'alternating-ops'
  | 'fibonacci'
  | 'squares'
  | 'doubling-gaps'
  | 'double-plus';

interface Built {
  /** SHOWN visible terms followed by the answer. */
  terms: number[];
  /** Option spacings matching likely mistakes, most plausible first. */
  spacings: number[];
  rule: string;
}

const seq = (n: number, f: (i: number) => number) => Array.from({ length: n }, (_, i) => f(i));

function recurrence(first: number, n: number, next: (prev: number, i: number) => number) {
  const t = [first];
  for (let i = 1; i < n; i++) t.push(next(t[i - 1] as number, i - 1));
  return t;
}

const BUILDERS: Record<Family, (rng: Rng) => Built> = {
  'arith-up': (rng) => {
    const a = rng.int(5, 30);
    const d = rng.int(2, 9);
    return { terms: seq(7, (i) => a + d * i), spacings: [d], rule: `+${d}` };
  },
  'arith-down': (rng) => {
    const a = rng.int(60, 99);
    const d = rng.int(3, 9);
    return { terms: seq(7, (i) => a - d * i), spacings: [d], rule: `−${d}` };
  },
  geometric: (rng) => {
    const r = rng.pick([2, 3]);
    const a = r === 2 ? rng.int(2, 9) : rng.int(1, 3);
    const t = seq(7, (i) => a * r ** i);
    const t5 = t[5] as number;
    return { terms: t, spacings: [t5, Math.round(t5 / 2)], rule: `×${r}` };
  },
  'second-order': (rng) => {
    const d0 = rng.int(1, 5);
    const dd = rng.int(1, 3);
    const t = recurrence(rng.int(1, 12), 7, (p, i) => p + d0 + dd * i);
    return {
      terms: t,
      spacings: [dd, (t[5] as number) - (t[4] as number)],
      rule: `gaps grow by ${dd}`,
    };
  },
  interleaved: (rng) => {
    const a = rng.int(1, 15);
    const da = rng.int(2, 6);
    const b = rng.int(10, 40);
    const db = rng.pick([-5, -4, -3, -2, 2, 3, 4, 5, 6, 7, 8].filter((v) => v !== da));
    return {
      terms: seq(7, (i) => (i % 2 === 0 ? a + da * (i / 2) : b + db * ((i - 1) / 2))),
      spacings: [da, Math.abs(db)],
      rule: `alternate: +${da} and ${db > 0 ? '+' : '−'}${Math.abs(db)}`,
    };
  },
  'alternating-ops': (rng) => {
    const k = rng.int(1, 9);
    const m = rng.pick([2, 3]);
    const addFirst = rng.next() < 0.5;
    const t = recurrence(rng.int(1, 9), 7, (p, i) => ((i % 2 === 0) === addFirst ? p + k : p * m));
    return {
      terms: t,
      spacings: [k, t[5] as number],
      rule: addFirst ? `+${k} then ×${m}` : `×${m} then +${k}`,
    };
  },
  fibonacci: (rng) => {
    const t = [rng.int(1, 6), rng.int(1, 9)];
    while (t.length < 7) t.push((t[t.length - 1] as number) + (t[t.length - 2] as number));
    return { terms: t, spacings: [t[4] as number, t[3] as number], rule: 'add the previous two' };
  },
  squares: (rng) => {
    const k = rng.int(1, 6);
    const c = rng.pick([-2, -1, 0, 1, 2, 3]);
    const t = seq(7, (i) => (i + k) ** 2 + c);
    return {
      terms: t,
      spacings: [(t[5] as number) - (t[4] as number), 2],
      rule: c === 0 ? 'square numbers' : `square numbers ${c > 0 ? '+' : '−'} ${Math.abs(c)}`,
    };
  },
  'doubling-gaps': (rng) => {
    const d = rng.int(1, 3);
    const t = recurrence(rng.int(1, 10), 7, (p, i) => p + d * 2 ** i);
    const gap = (t[5] as number) - (t[4] as number);
    return { terms: t, spacings: [gap, gap / 2], rule: 'gaps double' };
  },
  'double-plus': (rng) => {
    const c = rng.pick([-3, -2, -1, 1, 2, 3]);
    const t = recurrence(rng.int(2, 7), 7, (p) => 2 * p + c);
    return {
      terms: t,
      spacings: [t[5] as number, Math.abs(c)],
      rule: `×2 then ${c > 0 ? '+' : '−'}${Math.abs(c)}`,
    };
  },
};

export interface SeriesLevel {
  families: readonly Family[];
  optionCount: number;
  irt: IrtParams;
}

export const SERIES_LEVELS: Record<Difficulty, SeriesLevel> = {
  1: { families: ['arith-up'], optionCount: 4, irt: { a: 1.0, b: -2.0 } },
  2: { families: ['arith-down', 'geometric'], optionCount: 4, irt: { a: 1.1, b: -1.0 } },
  3: { families: ['second-order', 'interleaved'], optionCount: 4, irt: { a: 1.2, b: 0.0 } },
  4: {
    families: ['fibonacci', 'alternating-ops', 'squares'],
    optionCount: 6,
    irt: { a: 1.3, b: 1.0 },
  },
  5: { families: ['doubling-gaps', 'double-plus'], optionCount: 6, irt: { a: 1.3, b: 2.0 } },
};

const MAX_ATTEMPTS = 200;

export function generateSeries(seed: number, difficulty: Difficulty): Item<SeriesContent> {
  const level = SERIES_LEVELS[difficulty];
  const rng = createRng(seed);
  const rank = rng.int(0, level.optionCount - 1);
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const built = BUILDERS[rng.pick(level.families)](rng);
    const shown = built.terms.slice(0, SHOWN);
    const answer = built.terms[SHOWN] as number;
    if (built.terms.some((v) => !Number.isInteger(v) || v <= 0 || v > MAX_VALUE)) continue;

    const predictions = seriesPredictions(shown);
    if (predictions.size !== 1 || !predictions.has(answer)) continue;

    const picked = pickSpacedOptions(
      answer,
      built.spacings,
      level.optionCount,
      rank,
      new Set(shown),
    );
    if (!picked) continue;

    return {
      key: generatedKey(SERIES_GENERATOR_ID, SERIES_GENERATOR_VERSION, difficulty, seed),
      area: 'numerical',
      difficulty,
      content: { kind: 'series', terms: shown, options: picked.options },
      optionCount: level.optionCount,
      answerIndex: picked.answerIndex,
      irt: level.irt,
      explanation: built.rule,
    };
  }
  throw new Error(`series generator failed for seed ${seed} at difficulty ${difficulty}`);
}
