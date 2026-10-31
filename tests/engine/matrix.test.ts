// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { MATRIX_LEVELS, generateMatrix } from '../../src/engine/matrix/generate';
import {
  ATTRS,
  ATTR_INFO,
  COUNTS,
  ROTATIONS,
  SHADINGS,
  SHAPES,
  SIZES,
  cellSignature,
  type Attr,
  type Cell,
} from '../../src/engine/matrix/model';
import { describeCell, renderCell } from '../../src/engine/matrix/render';
import { svgToString, type SvgNode } from '../../src/engine/svg';
import { DIFFICULTIES } from '../../src/engine/types';

const SEEDS = Array.from({ length: 300 }, (_, i) => i * 7919 + 13);

const index = (cell: Cell, attr: Attr): number =>
  ({
    shape: SHAPES.indexOf(cell.shape),
    count: (COUNTS as readonly number[]).indexOf(cell.count),
    shading: SHADINGS.indexOf(cell.shading),
    size: SIZES.indexOf(cell.size),
    rotation: (ROTATIONS as readonly number[]).indexOf(cell.rotation),
  })[attr];

/**
 * Independent check, written differently from the generator's solver: does a completed 3×3
 * grid of values follow some rule along rows or down columns?
 */
function gridFollowsARule(grid: number[][], attr: Attr): boolean {
  const { size, ordered, cyclic } = ATTR_INFO[attr];
  const cols = [0, 1, 2].map((c) => grid.map((row) => row[c] as number));
  return [grid, cols].some((lines) => {
    const constant = lines.every((l) => new Set(l).size === 1);
    const sets = lines.map((l) => [...l].sort().join());
    const distribute = lines.every((l) => new Set(l).size === 3) && new Set(sets).size === 1;
    let progression = false;
    if (ordered) {
      const d = (a: number, b: number) => (cyclic ? (((b - a) % size) + size) % size : b - a);
      const steps = lines.flatMap((l) => [
        d(l[0] as number, l[1] as number),
        d(l[1] as number, l[2] as number),
      ]);
      progression = steps[0] !== 0 && steps.every((s) => s === steps[0]);
    }
    return constant || distribute || progression;
  });
}

function optionIsValid(cells: (Cell | null)[], option: Cell): boolean {
  const full = cells.map((c) => c ?? option);
  return ATTRS.every((attr) => {
    const values = full.map((c) => index(c, attr));
    const grid = [values.slice(0, 3), values.slice(3, 6), values.slice(6, 9)];
    return gridFollowsARule(grid, attr);
  });
}

function shapeNodes(node: SvgNode): SvgNode[] {
  return [node, ...(node.children ?? []).flatMap(shapeNodes)].filter(
    (n) => n.tag === 'circle' || n.tag === 'polygon',
  );
}

describe.each(DIFFICULTIES)('matrix generator, difficulty %i', (difficulty) => {
  const level = MATRIX_LEVELS[difficulty];
  const items = SEEDS.map((seed) => generateMatrix(seed, difficulty));

  it('is deterministic for a seed', () => {
    for (const seed of SEEDS.slice(0, 30)) {
      expect(generateMatrix(seed, difficulty)).toEqual(generateMatrix(seed, difficulty));
    }
  });

  it('has exactly one correct answer, at answerIndex', () => {
    for (const item of items) {
      const valid = item.content.options
        .map((o, i) => (optionIsValid(item.content.cells, o) ? i : -1))
        .filter((i) => i >= 0);
      expect(valid, item.key).toEqual([item.answerIndex]);
    }
  });

  it('has no duplicate options, including rotations that look the same', () => {
    for (const item of items) {
      const sigs = item.content.options.map(cellSignature);
      expect(new Set(sigs).size, item.key).toBe(level.optionCount);
    }
  });

  it('uses the level’s number of rules and options', () => {
    for (const item of items) {
      expect(item.content.cells).toHaveLength(9);
      expect(item.content.cells[8]).toBeNull();
      expect(item.content.options).toHaveLength(level.optionCount);
      expect(item.explanation.split(';')).toHaveLength(level.ruleCount);
      expect(item.irt).toEqual(level.irt);
      expect(item.area).toBe('pattern');
    }
  });

  it('gives no clue from the options alone (balanced option set)', () => {
    for (const item of items) {
      const answer = item.content.options[item.answerIndex] as Cell;
      for (const attr of ATTRS) {
        const matching = item.content.options.filter((o) => index(o, attr) === index(answer, attr));
        expect([level.optionCount / 2, level.optionCount], `${item.key} ${attr}`).toContain(
          matching.length,
        );
      }
    }
  });

  it('makes every wrong option break between 1 and log2(options) rules', () => {
    const k = Math.log2(level.optionCount);
    for (const item of items) {
      const answer = item.content.options[item.answerIndex] as Cell;
      item.content.options.forEach((o, i) => {
        if (i === item.answerIndex) return;
        const broken = ATTRS.filter((a) => index(o, a) !== index(answer, a)).length;
        expect(broken).toBeGreaterThanOrEqual(1);
        expect(broken).toBeLessThanOrEqual(k);
      });
    }
  });

  if (difficulty > 1) {
    it('only varies attributes that follow a rule in the grid', () => {
      for (const item of items) {
        const answer = item.content.options[item.answerIndex] as Cell;
        const ruleAttrs = item.explanation.split('; ').map((r) => r.split(':')[0]);
        for (const attr of ATTRS) {
          if (ruleAttrs.includes(attr)) continue;
          for (const o of item.content.options)
            expect(index(o, attr), item.key).toBe(index(answer, attr));
        }
      }
    });
  }

  it('spreads the answer across option positions', () => {
    const counts = new Array<number>(level.optionCount).fill(0);
    for (const item of items) counts[item.answerIndex] = (counts[item.answerIndex] ?? 0) + 1;
    const expected = items.length / level.optionCount;
    for (const c of counts) expect(c).toBeGreaterThan(expected * 0.5);
  });

  if (level.answerIsNew) {
    it('never lets the answer be copied from a visible cell', () => {
      for (const item of items) {
        const answer = cellSignature(item.content.options[item.answerIndex] as Cell);
        const visible = item.content.cells.slice(0, 8).map((c) => cellSignature(c as Cell));
        expect(visible, item.key).not.toContain(answer);
      }
    });
  }

  it('renders every cell and option inside the canvas', () => {
    for (const item of items.slice(0, 60)) {
      for (const cell of [...item.content.cells, ...item.content.options]) {
        if (!cell) continue;
        const nodes = shapeNodes(renderCell(cell));
        expect(nodes).toHaveLength(cell.count);
        for (const n of nodes) {
          const coords =
            n.tag === 'circle'
              ? [
                  Number(n.attrs.cx) - Number(n.attrs.r),
                  Number(n.attrs.cx) + Number(n.attrs.r),
                  Number(n.attrs.cy) - Number(n.attrs.r),
                  Number(n.attrs.cy) + Number(n.attrs.r),
                ]
              : String(n.attrs.points).split(/[ ,]/).map(Number);
          for (const v of coords) {
            expect(v).toBeGreaterThanOrEqual(2);
            expect(v).toBeLessThanOrEqual(98);
          }
        }
      }
    }
  });
});

describe('cell rendering', () => {
  const base: Cell = {
    shape: 'triangle',
    count: 1,
    shading: 'outline',
    size: 'medium',
    rotation: 0,
  };

  it('uses currentColor for every shading so cells follow the theme', () => {
    const solid = svgToString(renderCell({ ...base, shading: 'solid' }));
    const shaded = svgToString(renderCell({ ...base, shading: 'shaded' }));
    expect(solid).toContain('fill="currentColor"');
    expect(solid).not.toContain('fill-opacity');
    expect(shaded).toMatch(/fill="currentColor" fill-opacity="0\.\d+"/);
    expect(svgToString(renderCell(base))).toContain('fill="none"');
  });

  it('applies rotation to the geometry', () => {
    const up = svgToString(renderCell(base));
    const right = svgToString(renderCell({ ...base, rotation: 90 }));
    expect(up).not.toEqual(right);
    expect(up).not.toContain('transform=');
  });

  it('describes cells in plain language', () => {
    expect(
      describeCell({ ...base, count: 3, shape: 'cross', shading: 'shaded', size: 'large' }),
    ).toBe('3 large shaded crosses');
    expect(describeCell({ ...base, shape: 'arrow', rotation: 90 })).toBe(
      '1 medium outlined arrow, turned 90°',
    );
  });
});
