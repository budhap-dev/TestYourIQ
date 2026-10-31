// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  SPATIAL_LEVELS,
  generateMirror,
  generateRotation,
} from '../../src/engine/spatial/generate';
import type { Cells } from '../../src/engine/spatial/model';
import { renderShape } from '../../src/engine/spatial/render';
import { DIFFICULTIES } from '../../src/engine/types';

const SEEDS = Array.from({ length: 250 }, (_, i) => i * 4099 + 5);

// Independent geometry, written separately from the engine's.
const norm = (c: Cells) => {
  const mx = Math.min(...c.map((p) => p[0]));
  const my = Math.min(...c.map((p) => p[1]));
  return c
    .map(([x, y]) => `${x - mx},${y - my}`)
    .sort()
    .join(' ');
};
const turn = (c: Cells): Cells => c.map(([x, y]) => [-y, x]);
const flip = (c: Cells): Cells => c.map(([x, y]) => [-x, y]);
const turns = (c: Cells) => [c, turn(c), turn(turn(c)), turn(turn(turn(c)))].map(norm);
const sameTurned = (a: Cells, b: Cells) => turns(a).includes(norm(b));
const sameOrMirrored = (a: Cells, b: Cells) => sameTurned(a, b) || sameTurned(flip(a), b);

describe.each([
  ['rotation', generateRotation, (target: Cells, o: Cells) => sameTurned(target, o)],
  ['mirror', generateMirror, (target: Cells, o: Cells) => sameTurned(flip(target), o)],
] as const)('%s generator', (_name, generate, isCorrect) => {
  describe.each(DIFFICULTIES)('difficulty %i', (difficulty) => {
    const level = SPATIAL_LEVELS[difficulty];
    const items = SEEDS.map((s) => generate(s, difficulty));

    it('is deterministic for a seed', () => {
      for (const s of SEEDS.slice(0, 20))
        expect(generate(s, difficulty)).toEqual(generate(s, difficulty));
    });

    it('has exactly one correct option, at answerIndex', () => {
      for (const item of items) {
        const valid = item.content.options
          .map((o, i) => (isCorrect(item.content.target, o) ? i : -1))
          .filter((i) => i >= 0);
        expect(valid, item.key).toEqual([item.answerIndex]);
      }
    });

    it('has no two options that are the same shape turned', () => {
      for (const item of items) {
        const o = item.content.options;
        for (let i = 0; i < o.length; i++) {
          for (let j = i + 1; j < o.length; j++)
            expect(sameTurned(o[i] as Cells, o[j] as Cells), item.key).toBe(false);
        }
      }
    });

    it('pairs every option with its mirror image, so none is the odd one out', () => {
      for (const item of items) {
        for (const o of item.content.options) {
          const partners = item.content.options.filter((p) => p !== o && sameOrMirrored(o, p));
          expect(partners, item.key).toHaveLength(1);
        }
      }
    });

    it('uses the level’s shape size and option count', () => {
      for (const item of items) {
        expect(item.content.target).toHaveLength(level.cells);
        expect(item.content.options).toHaveLength(level.optionCount);
        for (const o of item.content.options) expect(o).toHaveLength(level.cells);
      }
    });

    it('never shows the answer looking identical to the target', () => {
      if (_name === 'mirror') return;
      for (const item of items) {
        expect(norm(item.content.options[item.answerIndex] as Cells), item.key).not.toBe(
          norm(item.content.target),
        );
      }
    });

    it('spreads the answer across positions', () => {
      const counts = new Array<number>(level.optionCount).fill(0);
      for (const item of items) counts[item.answerIndex] = (counts[item.answerIndex] ?? 0) + 1;
      for (const c of counts) expect(c).toBeGreaterThan((items.length / level.optionCount) * 0.5);
    });

    it('draws every shape inside the canvas', () => {
      for (const item of items.slice(0, 40)) {
        for (const shape of [item.content.target, ...item.content.options]) {
          const svg = renderShape(shape, item.content.span);
          expect(svg.children).toHaveLength(shape.length);
          for (const r of svg.children ?? []) {
            const x = Number(r.attrs.x);
            const y = Number(r.attrs.y);
            const w = Number(r.attrs.width);
            expect(x).toBeGreaterThanOrEqual(3.9);
            expect(y).toBeGreaterThanOrEqual(3.9);
            expect(x + w).toBeLessThanOrEqual(96.1);
            expect(y + w).toBeLessThanOrEqual(96.1);
          }
        }
      }
    });
  });
});
