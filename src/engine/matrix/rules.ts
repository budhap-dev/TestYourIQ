import type { Rng } from '../rng.js';
import { ATTR_INFO, type Attr } from './model.js';

/**
 * Rules say how one attribute changes across each row of the 3×3 grid.
 *  - fixed:        the same value in all nine cells
 *  - row-constant: constant along each row, a different value per row
 *  - progression:  steps by a fixed amount along each row (ordered attributes only)
 *  - distribute:   each row holds the same three values in a different order (a Latin square)
 */
export type RuleType = 'fixed' | 'row-constant' | 'progression' | 'distribute';

/** values[row][col], as indices into the attribute's domain. */
export type Grid = number[][];

export interface RuleSpec {
  attr: Attr;
  type: RuleType;
  /** Step for progressions, for the explanation. */
  step?: number;
}

export function ruleFits(type: RuleType, attr: Attr): boolean {
  return type !== 'progression' || ATTR_INFO[attr].ordered;
}

const mod = (n: number, m: number) => ((n % m) + m) % m;

export function buildGrid(
  type: RuleType,
  attr: Attr,
  allowed: readonly number[],
  rng: Rng,
): { grid: Grid; step?: number } {
  const info = ATTR_INFO[attr];
  const three = () => rng.shuffle(allowed).slice(0, 3);

  switch (type) {
    case 'fixed': {
      const v = rng.pick(allowed);
      return { grid: [0, 1, 2].map(() => [v, v, v]) };
    }
    case 'row-constant': {
      const vals = three();
      return { grid: vals.map((v) => [v, v, v]) };
    }
    case 'distribute': {
      const vals = three();
      const shift = rng.pick([1, 2]);
      return {
        grid: [0, 1, 2].map((r) => [0, 1, 2].map((c) => vals[(c + shift * r) % 3] as number)),
      };
    }
    case 'progression': {
      if (info.cyclic) {
        const step = rng.pick([1, -1, 2, -2]);
        return {
          grid: [0, 1, 2].map(() => {
            const base = rng.pick(allowed);
            return [0, 1, 2].map((c) => mod(base + step * c, info.size));
          }),
          step,
        };
      }
      const step = rng.pick([1, -1]);
      const bases = allowed.filter(
        (b) => allowed.includes(b + 2 * step) && allowed.includes(b + step),
      );
      return {
        grid: [0, 1, 2].map(() => {
          const base = rng.pick(bases);
          return [base, base + step, base + 2 * step];
        }),
        step,
      };
    }
  }
}
