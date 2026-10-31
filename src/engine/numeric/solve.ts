/**
 * Every answer a solver could reasonably defend for a number series or analogy. A well-formed
 * item yields exactly one prediction. These are deliberately broader than the generators, so
 * that an item which happens to fit a second, different rule is rejected.
 */

const diffs = (t: number[]) => t.slice(1).map((v, i) => v - (t[i] as number));
const allEqual = (t: number[]) => t.length >= 2 && t.every((v) => v === t[0]);
const last = (t: number[]) => t[t.length - 1] as number;

type Op = { kind: 'add' | 'mul'; k: number };
const apply = (op: Op, v: number) => (op.kind === 'add' ? v + op.k : v * op.k);

function opsBetween(a: number, b: number): Op[] {
  const ops: Op[] = [{ kind: 'add', k: b - a }];
  if (a !== 0 && b % a === 0) ops.push({ kind: 'mul', k: b / a });
  return ops;
}

export function seriesPredictions(t: number[]): Set<number> {
  const out = new Set<number>();
  const n = t.length;

  // Polynomial: some level of differences (up to the third) is constant.
  const levels = [t];
  for (let k = 1; k <= 3; k++) {
    const d = diffs(levels[k - 1] as number[]);
    levels.push(d);
    if (allEqual(d)) {
      out.add(
        levels.reduceRight((acc, level, i) => (i === k ? acc : acc + last(level)), d[0] as number),
      );
      break;
    }
  }

  // Affine recurrence t[i+1] = r·t[i] + c with whole r (covers geometric and "double then add").
  const [t0, t1, t2] = t as [number, number, number];
  if (t1 !== t0 && (t2 - t1) % (t1 - t0) === 0) {
    const r = (t2 - t1) / (t1 - t0);
    const c = t1 - r * t0;
    if (t.every((v, i) => i === 0 || v === r * (t[i - 1] as number) + c)) out.add(r * last(t) + c);
  }

  // Each term is the sum of the previous two.
  if (n >= 4 && t.every((v, i) => i < 2 || v === (t[i - 1] as number) + (t[i - 2] as number))) {
    out.add(last(t) + (t[n - 2] as number));
  }

  // Two interleaved arithmetic sequences (needs three terms of each).
  if (n >= 6) {
    const evens = t.filter((_, i) => i % 2 === 0);
    const odds = t.filter((_, i) => i % 2 === 1);
    if (allEqual(diffs(evens)) && allEqual(diffs(odds))) {
      const seq = n % 2 === 0 ? evens : odds;
      out.add(last(seq) + (diffs(seq)[0] as number));
    }
  }

  // Two operations applied alternately (e.g. +3 then ×2).
  for (const a of opsBetween(t0, t1)) {
    for (const b of opsBetween(t1, t2)) {
      const ops = [a, b];
      if (t.every((v, i) => i === 0 || v === apply(ops[(i - 1) % 2] as Op, t[i - 1] as number))) {
        out.add(apply(ops[(n - 1) % 2] as Op, last(t)));
      }
    }
  }

  // Differences form a geometric sequence with whole ratio.
  const d = diffs(t);
  const [d0, d1] = d as [number, number];
  if (d0 !== 0 && d1 % d0 === 0) {
    const r = d1 / d0;
    if (r !== 1 && d.every((v, i) => i === 0 || v === r * (d[i - 1] as number))) {
      out.add(last(t) + r * last(d));
    }
  }

  return out;
}

export function analogyPredictions(pairs: [number, number][], q: number): Set<number> {
  const out = new Set<number>();
  const [[x1, y1], [x2, y2]] = pairs as [[number, number], [number, number]];
  const fits = (f: (x: number) => number) => pairs.every(([x, y]) => Math.abs(f(x) - y) < 1e-9);
  const add = (f: (x: number) => number) => {
    if (fits(f)) out.add(Math.round(f(q) * 1e6) / 1e6);
  };

  if (x1 !== x2) add((x) => y1 + ((y2 - y1) * (x - x1)) / (x2 - x1)); // linear
  add((x) => x * x + (y1 - x1 * x1)); // x² + c
  if (x1 !== 0) add((x) => x * x + ((y1 - x1 * x1) / x1) * x); // x² + c·x
  if (x1 !== 0) add((x) => (y1 / (x1 * x1)) * x * x); // c·x²
  add((x) => x ** 3 + (y1 - x1 ** 3)); // x³ + c
  return out;
}
