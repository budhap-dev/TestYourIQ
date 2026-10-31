import type { AttrInfo } from './model.js';

/**
 * Every value the missing cell (bottom right) could take for one attribute, under any rule a
 * solver might reasonably see in the eight visible cells, reading along rows or down columns.
 * A well-formed item has exactly one implied value per attribute.
 */
export function impliedValues(visible: (number | null)[][], info: AttrInfo): Set<number> {
  const out = new Set<number>();
  const transpose = [0, 1, 2].map((c) => [0, 1, 2].map((r) => visible[r]?.[c] ?? null));

  for (const lines of [visible, transpose]) {
    const [l0, l1, l2] = lines as (number | null)[][];
    if (!l0 || !l1 || !l2) continue;
    const full = [l0, l1] as number[][];
    const [x, y] = l2 as [number, number];

    // Constant along each line (covers "fixed" too).
    if (full.every((l) => l[0] === l[1] && l[1] === l[2]) && x === y) out.add(x);

    // Arithmetic progression with one shared step.
    if (info.ordered) {
      const diff = (a: number, b: number) => {
        if (!info.cyclic) return b - a;
        const d = (((b - a) % info.size) + info.size) % info.size;
        return d > info.size / 2 ? d - info.size : d;
      };
      const lineSteps = ([a, b, c]: number[]) => [
        diff(a as number, b as number),
        diff(b as number, c as number),
      ];
      const step = diff(l0[0] as number, l0[1] as number);
      const steps = [...full.flatMap(lineSteps), diff(x, y)];
      if (step !== 0 && steps.every((s) => s === step)) {
        const next = info.cyclic ? (((y + step) % info.size) + info.size) % info.size : y + step;
        if (next >= 0 && next < info.size) out.add(next);
      }
    }

    // Same set of three values in each line.
    const set = new Set(l0);
    if (
      set.size === 3 &&
      new Set(l1).size === 3 &&
      l1.every((v) => set.has(v as number)) &&
      x !== y &&
      set.has(x) &&
      set.has(y)
    ) {
      for (const v of set) if (v !== x && v !== y) out.add(v as number);
    }
  }
  return out;
}
