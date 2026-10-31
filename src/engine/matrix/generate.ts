import { generatedKey } from '../itemKey';
import { createRng, type Rng } from '../rng';
import type { Difficulty, IrtParams, Item } from '../types';
import {
  ATTRS,
  ATTR_INFO,
  ROTATABLE_SHAPES,
  cellSignature,
  toCell,
  type Attr,
  type CellValues,
  type MatrixContent,
} from './model';
import { buildGrid, ruleFits, type Grid, type RuleSpec, type RuleType } from './rules';
import { impliedValues } from './solve';

export const MATRIX_GENERATOR_ID = 'matrix';
export const MATRIX_GENERATOR_VERSION = 1;

/**
 * Difficulty is set by explicit parameters:
 *  - ruleCount:     how many attributes change across the grid at once
 *  - ruleTypes:     which kinds of rule those attributes may follow
 *  - minDistribute: how many of them must be the harder "distribute" rule
 *  - optionCount:   4 or 8 options (2 or 3 attributes varied among the options). Kept at or
 *                   below 2^ruleCount from level 2 up, so every wrong option breaks a rule that
 *                   actually varies in the grid rather than an obvious constant one.
 *  - similarity:    "near" wrong values are one step from the right one; "far" ones aren't
 *  - answerIsNew:   the answer can't be copied from any visible cell
 */
export interface MatrixLevel {
  ruleCount: number;
  ruleTypes: readonly RuleType[];
  minDistribute: number;
  optionCount: 4 | 8;
  similarity: 'near' | 'far';
  answerIsNew: boolean;
  irt: IrtParams;
}

export const MATRIX_LEVELS: Record<Difficulty, MatrixLevel> = {
  1: {
    ruleCount: 1,
    ruleTypes: ['progression'],
    minDistribute: 0,
    optionCount: 4,
    similarity: 'far',
    answerIsNew: false,
    irt: { a: 1.0, b: -2.0 },
  },
  2: {
    ruleCount: 2,
    ruleTypes: ['progression', 'row-constant'],
    minDistribute: 0,
    optionCount: 4,
    similarity: 'far',
    answerIsNew: false,
    irt: { a: 1.1, b: -1.0 },
  },
  3: {
    ruleCount: 2,
    ruleTypes: ['progression', 'distribute'],
    minDistribute: 1,
    optionCount: 4,
    similarity: 'near',
    answerIsNew: true,
    irt: { a: 1.2, b: 0.0 },
  },
  4: {
    ruleCount: 3,
    ruleTypes: ['progression', 'distribute', 'row-constant'],
    minDistribute: 1,
    optionCount: 8,
    similarity: 'near',
    answerIsNew: true,
    irt: { a: 1.3, b: 1.0 },
  },
  5: {
    ruleCount: 4,
    ruleTypes: ['progression', 'distribute'],
    minDistribute: 2,
    optionCount: 8,
    similarity: 'near',
    answerIsNew: true,
    irt: { a: 1.3, b: 2.0 },
  },
};

const MAX_ATTEMPTS = 200;

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

function pickRuleAttrs(level: MatrixLevel, rng: Rng): Attr[] {
  const usable = ATTRS.filter((a) => level.ruleTypes.some((t) => ruleFits(t, a)));
  const chosen: Attr[] = [];
  for (const attr of rng.shuffle(usable)) {
    if (chosen.length === level.ruleCount) break;
    // Rotation only shows on asymmetric shapes, so it can't vary alongside shape.
    if (attr === 'rotation' && chosen.includes('shape')) continue;
    if (attr === 'shape' && chosen.includes('rotation')) continue;
    chosen.push(attr);
  }
  return chosen;
}

function assignRuleTypes(attrs: Attr[], level: MatrixLevel, rng: Rng): Map<Attr, RuleType> {
  const types = new Map<Attr, RuleType>();
  for (const attr of rng.shuffle(attrs).slice(0, level.minDistribute))
    types.set(attr, 'distribute');
  for (const attr of attrs) {
    if (!types.has(attr))
      types.set(attr, rng.pick(level.ruleTypes.filter((t) => ruleFits(t, attr))));
  }
  return types;
}

function allowedValues(attr: Attr, ruleAttrs: Attr[]): number[] {
  if (attr === 'shape' && ruleAttrs.includes('rotation')) return [...ROTATABLE_SHAPES];
  if (attr === 'rotation' && !ruleAttrs.includes('rotation')) return [0];
  return range(ATTR_INFO[attr].size);
}

/** A plausible wrong value for one attribute of the answer. */
function alternative(
  attr: Attr,
  answer: number,
  grid: Grid,
  allowed: number[],
  similarity: MatrixLevel['similarity'],
  rng: Rng,
): number | null {
  const info = ATTR_INFO[attr];
  const others = allowed.filter((v) => v !== answer);
  if (others.length === 0) return null;

  if (similarity === 'near' && info.ordered) {
    const steps = info.cyclic ? [1, -1, 2, -2] : [1, -1];
    const near = steps
      .map((s) => (info.cyclic ? (answer + s + info.size) % info.size : answer + s))
      .filter((v) => others.includes(v));
    if (near.length) return rng.pick(near);
  }
  // Values seen elsewhere in the grid are the most tempting wrong choices.
  const seen = [...new Set(grid.flat().slice(0, 8))].filter((v) => others.includes(v));
  return rng.pick(seen.length ? seen : others);
}

function describe(rules: RuleSpec[]): string {
  return rules
    .map((r) => {
      if (r.type !== 'progression') return `${r.attr}: ${r.type}`;
      const step = r.attr === 'rotation' ? `${(r.step ?? 0) * 45}°` : `${r.step}`;
      return `${r.attr}: progression (${(r.step ?? 0) > 0 ? '+' : ''}${step})`;
    })
    .join('; ');
}

function attempt(level: MatrixLevel, rng: Rng) {
  const ruleAttrs = pickRuleAttrs(level, rng);
  if (ruleAttrs.length !== level.ruleCount) return null;
  const types = assignRuleTypes(ruleAttrs, level, rng);

  const grids = {} as Record<Attr, Grid>;
  const rules: RuleSpec[] = [];
  for (const attr of ATTRS) {
    const type = types.get(attr) ?? 'fixed';
    const { grid, step } = buildGrid(type, attr, allowedValues(attr, ruleAttrs), rng);
    grids[attr] = grid;
    rules.push(step === undefined ? { attr, type } : { attr, type, step });
  }

  const valuesAt = (r: number, c: number) =>
    Object.fromEntries(ATTRS.map((a) => [a, grids[a][r]?.[c] as number])) as CellValues;
  const answer = valuesAt(2, 2);

  // Reject grids where any attribute admits a second reading.
  for (const attr of ATTRS) {
    const visible = grids[attr].map((row, r) => row.map((v, c) => (r === 2 && c === 2 ? null : v)));
    const implied = impliedValues(visible, ATTR_INFO[attr]);
    if (implied.size !== 1 || !implied.has(answer[attr])) return null;
  }

  const cells = range(9).map((i) => toCell(valuesAt(Math.floor(i / 3), i % 3)));
  const answerCell = toCell(answer);
  if (
    level.answerIsNew &&
    cells.slice(0, 8).some((c) => cellSignature(c) === cellSignature(answerCell))
  ) {
    return null;
  }

  // Balanced options: vary k attributes and take every combination (2^k options), so each
  // value of each varied attribute appears in exactly half the options.
  const k = Math.log2(level.optionCount);
  const nonRule = ATTRS.filter((a) => !ruleAttrs.includes(a) && a !== 'rotation');
  const flips: { attr: Attr; value: number }[] = [];
  for (const attr of [...rng.shuffle(ruleAttrs), ...rng.shuffle(nonRule)]) {
    if (flips.length === k) break;
    const value = alternative(
      attr,
      answer[attr],
      grids[attr],
      allowedValues(attr, ruleAttrs),
      level.similarity,
      rng,
    );
    if (value !== null) flips.push({ attr, value });
  }
  if (flips.length !== k) return null;

  const options = range(level.optionCount).map((mask) => {
    const v = { ...answer };
    flips.forEach((f, bit) => {
      if (mask & (1 << bit)) v[f.attr] = f.value;
    });
    return toCell(v);
  });
  if (new Set(options.map(cellSignature)).size !== options.length) return null;

  const order = rng.shuffle(range(options.length));
  return {
    content: {
      kind: 'matrix',
      cells: cells.map((c, i) => (i === 8 ? null : c)),
      options: order.map((i) => options[i]),
    } as MatrixContent,
    answerIndex: order.indexOf(0),
    explanation: describe(rules.filter((r) => r.type !== 'fixed')),
  };
}

export function generateMatrix(seed: number, difficulty: Difficulty): Item<MatrixContent> {
  const level = MATRIX_LEVELS[difficulty];
  const rng = createRng(seed);
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const result = attempt(level, rng);
    if (result) {
      return {
        key: generatedKey(MATRIX_GENERATOR_ID, MATRIX_GENERATOR_VERSION, difficulty, seed),
        area: 'pattern',
        difficulty,
        content: result.content,
        optionCount: level.optionCount,
        answerIndex: result.answerIndex,
        irt: level.irt,
        explanation: result.explanation,
      };
    }
  }
  throw new Error(`matrix generator failed for seed ${seed} at difficulty ${difficulty}`);
}
