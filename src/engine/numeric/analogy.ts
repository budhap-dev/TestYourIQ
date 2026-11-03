import { generatedKey } from '../itemKey.js';
import { createRng, type Rng } from '../rng.js';
import type { Difficulty, IrtParams, Item } from '../types.js';
import type { NumberAnalogyContent } from './model.js';
import { pickSpacedOptions } from './options.js';
import { analogyPredictions } from './solve.js';

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
  /** The rule in words, as an instruction ("multiply by 3"). */
  words: string;
  /** The working for one input, without the result ("7 × 3"). */
  show: (x: number) => string;
}

const signed = (n: number) => (n > 0 ? `+ ${n}` : `− ${-n}`);
const addOrSubtract = (n: number) => (n > 0 ? `add ${n}` : `subtract ${-n}`);

const RULES: Record<Family, (rng: Rng) => Rule> = {
  add: (rng) => {
    const c = rng.int(2, 12);
    return {
      f: (x) => x + c,
      spacings: () => [c],
      xs: [1, 20],
      name: `x + ${c}`,
      words: `add ${c}`,
      show: (x) => `${x} + ${c}`,
    };
  },
  multiply: (rng) => {
    const c = rng.int(2, 6);
    return {
      f: (x) => c * x,
      spacings: (q) => [q, c],
      xs: [2, 12],
      name: `${c}x`,
      words: `multiply by ${c}`,
      show: (x) => `${x} × ${c}`,
    };
  },
  linear: (rng) => {
    const c = rng.int(2, 4);
    const d = rng.pick([-7, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 7]);
    return {
      f: (x) => c * x + d,
      spacings: () => [c, Math.abs(d)],
      xs: [2, 12],
      name: `${c}x ${signed(d)}`,
      words: `multiply by ${c}, then ${addOrSubtract(d)}`,
      show: (x) => `${x} × ${c} ${signed(d)}`,
    };
  },
  square: () => ({
    f: (x) => x * x,
    spacings: (q) => [q],
    xs: [2, 12],
    name: 'x²',
    words: 'multiply the number by itself',
    show: (x) => `${x} × ${x}`,
  }),
  'square-plus': (rng) => {
    const c = rng.pick([-5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6]);
    return {
      f: (x) => x * x + c,
      spacings: (q) => [q, Math.abs(c)],
      xs: [2, 10],
      name: `x² ${signed(c)}`,
      words: `multiply the number by itself, then ${addOrSubtract(c)}`,
      show: (x) => `${x} × ${x} ${signed(c)}`,
    };
  },
  'times-next': () => ({
    f: (x) => x * (x + 1),
    spacings: (q) => [q],
    xs: [2, 12],
    name: 'x × (x + 1)',
    words: 'multiply the number by the next number up',
    show: (x) => `${x} × ${x + 1}`,
  }),
  cube: () => ({
    f: (x) => x ** 3,
    spacings: (q) => [q * q, q],
    xs: [2, 9],
    name: 'x³',
    words: 'multiply the number by itself, then by itself again',
    show: (x) => `${x} × ${x} × ${x}`,
  }),
  'square-plus-multiple': (rng) => {
    const c = rng.int(2, 5);
    return {
      f: (x) => x * x + c * x,
      spacings: (q) => [q, c * q],
      xs: [2, 12],
      name: `x² + ${c}x`,
      words: `multiply the number by itself, then add ${c} times the number`,
      show: (x) => `${x} × ${x} + ${c} × ${x}`,
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
      solution: `The same rule turns each number on the left into the one on the right: ${rule.words}. For example, ${rule.show(pairs[0]?.[0] as number)} = ${pairs[0]?.[1]}. So for ${q}: ${rule.show(q)} = ${answer}.`,
    };
  }
  throw new Error(`number analogy generator failed for seed ${seed} at difficulty ${difficulty}`);
}
