import { generatedKey } from '../itemKey';
import { createRng, type Rng } from '../rng';
import type { Difficulty, IrtParams, Item } from '../types';
import type { NumberAnalogyContent } from './model';
import { pickSpacedOptions } from './options';
import { analogyPredictions } from './solve';

export const NUMBER_ANALOGY_GENERATOR_ID = 'number-analogy';
export const NUMBER_ANALOGY_GENERATOR_VERSION = 1;

const EXAMPLES = 3;
const MAX_VALUE = 999;

type Family =
  | 'add'
  | 'multiply'
  | 'linear'
  | 'square'
  | 'square-plus'
  | 'times-next'
  | 'cube'
  | 'square-plus-multiple';

interface Rule {
  f: (x: number) => number;
  /** Option spacings matching likely mistakes, most plausible first. */
  spacings: (q: number) => number[];
  xs: [number, number];
  name: string;
}

const signed = (n: number) => (n > 0 ? `+ ${n}` : `− ${-n}`);

const RULES: Record<Family, (rng: Rng) => Rule> = {
  add: (rng) => {
    const c = rng.int(2, 12);
    return { f: (x) => x + c, spacings: () => [c], xs: [1, 20], name: `x + ${c}` };
  },
  multiply: (rng) => {
    const c = rng.int(2, 6);
    return { f: (x) => c * x, spacings: (q) => [q, c], xs: [2, 12], name: `${c}x` };
  },
  linear: (rng) => {
    const c = rng.int(2, 4);
    const d = rng.pick([-7, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 7]);
    return {
      f: (x) => c * x + d,
      spacings: () => [c, Math.abs(d)],
      xs: [2, 12],
      name: `${c}x ${signed(d)}`,
    };
  },
  square: () => ({ f: (x) => x * x, spacings: (q) => [q], xs: [2, 12], name: 'x²' }),
  'square-plus': (rng) => {
    const c = rng.pick([-5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6]);
    return {
      f: (x) => x * x + c,
      spacings: (q) => [q, Math.abs(c)],
      xs: [2, 10],
      name: `x² ${signed(c)}`,
    };
  },
  'times-next': () => ({
    f: (x) => x * (x + 1),
    spacings: (q) => [q],
    xs: [2, 12],
    name: 'x × (x + 1)',
  }),
  cube: () => ({ f: (x) => x ** 3, spacings: (q) => [q * q, q], xs: [2, 9], name: 'x³' }),
  'square-plus-multiple': (rng) => {
    const c = rng.int(2, 5);
    return {
      f: (x) => x * x + c * x,
      spacings: (q) => [q, c * q],
      xs: [2, 12],
      name: `x² + ${c}x`,
    };
  },
};

export interface NumberAnalogyLevel {
  families: readonly Family[];
  optionCount: number;
  irt: IrtParams;
}

export const NUMBER_ANALOGY_LEVELS: Record<Difficulty, NumberAnalogyLevel> = {
  1: { families: ['add'], optionCount: 4, irt: { a: 1.0, b: -2.0 } },
  2: { families: ['multiply'], optionCount: 4, irt: { a: 1.1, b: -1.0 } },
  3: { families: ['linear', 'square'], optionCount: 4, irt: { a: 1.2, b: 0.0 } },
  4: { families: ['square-plus', 'times-next'], optionCount: 6, irt: { a: 1.3, b: 1.0 } },
  5: { families: ['cube', 'square-plus-multiple'], optionCount: 6, irt: { a: 1.3, b: 2.0 } },
};

const MAX_ATTEMPTS = 200;

export function generateNumberAnalogy(
  seed: number,
  difficulty: Difficulty,
): Item<NumberAnalogyContent> {
  const level = NUMBER_ANALOGY_LEVELS[difficulty];
  const rng = createRng(seed);
  const rank = rng.int(0, level.optionCount - 1);
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const rule = RULES[rng.pick(level.families)](rng);
    const [lo, hi] = rule.xs;
    const xs = rng
      .shuffle(Array.from({ length: hi - lo + 1 }, (_, j) => lo + j))
      .slice(0, EXAMPLES + 1);
    const q = xs[EXAMPLES] as number;
    const pairs = xs.slice(0, EXAMPLES).map((x) => [x, rule.f(x)] as [number, number]);
    const answer = rule.f(q);
    if ([...pairs.map(([, y]) => y), answer].some((y) => y <= 0 || y > MAX_VALUE)) continue;

    const predictions = analogyPredictions(pairs, q);
    if (predictions.size !== 1 || !predictions.has(answer)) continue;

    const picked = pickSpacedOptions(
      answer,
      rule.spacings(q),
      level.optionCount,
      rank,
      new Set([q]),
    );
    if (!picked) continue;

    return {
      key: generatedKey(
        NUMBER_ANALOGY_GENERATOR_ID,
        NUMBER_ANALOGY_GENERATOR_VERSION,
        difficulty,
        seed,
      ),
      area: 'numerical',
      difficulty,
      content: { kind: 'number-analogy', pairs, query: q, options: picked.options },
      optionCount: level.optionCount,
      answerIndex: picked.answerIndex,
      irt: level.irt,
      explanation: rule.name,
    };
  }
  throw new Error(`number analogy generator failed for seed ${seed} at difficulty ${difficulty}`);
}
