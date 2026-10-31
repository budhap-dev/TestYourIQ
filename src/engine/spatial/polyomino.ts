import type { Rng } from '../rng';
import type { Cells } from './model';

/** Geometry for shapes made of unit squares. Every function returns new arrays. */

const DIRS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

const keyOf = ([x, y]: [number, number]) => `${x},${y}`;

/** Shift so the minimum x and y are 0, and sort for stable comparison. */
export function normalize(cells: Cells): Cells {
  const minX = Math.min(...cells.map(([x]) => x));
  const minY = Math.min(...cells.map(([, y]) => y));
  return cells
    .map(([x, y]) => [x - minX, y - minY] as [number, number])
    .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

/** Rotate clockwise (on screen) by quarter turns. */
export function rotate(cells: Cells, quarterTurns: number): Cells {
  let out = cells;
  for (let i = 0; i < ((quarterTurns % 4) + 4) % 4; i++) out = out.map(([x, y]) => [-y, x]);
  return normalize(out);
}

/** Mirror left to right. */
export function reflect(cells: Cells): Cells {
  return normalize(cells.map(([x, y]) => [-x, y]));
}

export const shapeKey = (cells: Cells) => normalize(cells).map(keyOf).join(';');

/** Equal for two shapes exactly when one is a turned copy of the other. */
export function rotationClass(cells: Cells): string {
  return [0, 1, 2, 3].map((t) => shapeKey(rotate(cells, t))).sort()[0] as string;
}

/** A shape is chiral if its mirror image can't be turned to match it. */
export function isChiral(cells: Cells): boolean {
  return rotationClass(cells) !== rotationClass(reflect(cells));
}

export function size(cells: Cells): { w: number; h: number } {
  const n = normalize(cells);
  return {
    w: Math.max(...n.map(([x]) => x)) + 1,
    h: Math.max(...n.map(([, y]) => y)) + 1,
  };
}

export function isConnected(cells: Cells): boolean {
  if (cells.length === 0) return false;
  const all = new Set(cells.map(keyOf));
  const seen = new Set<string>([keyOf(cells[0] as [number, number])]);
  const stack = [cells[0] as [number, number]];
  while (stack.length) {
    const [x, y] = stack.pop() as [number, number];
    for (const [dx, dy] of DIRS) {
      const k = keyOf([x + dx, y + dy]);
      if (all.has(k) && !seen.has(k)) {
        seen.add(k);
        stack.push([x + dx, y + dy]);
      }
    }
  }
  return seen.size === cells.length;
}

/** A random connected shape of n cells, grown one neighbour at a time. */
export function grow(n: number, rng: Rng): Cells {
  const cells: Cells = [[0, 0]];
  const taken = new Set([keyOf([0, 0])]);
  while (cells.length < n) {
    const [x, y] = rng.pick(cells);
    const [dx, dy] = rng.pick(DIRS);
    const next: [number, number] = [x + dx, y + dy];
    if (!taken.has(keyOf(next))) {
      taken.add(keyOf(next));
      cells.push(next);
    }
  }
  return normalize(cells);
}

export interface Move {
  from: [number, number];
  to: [number, number];
}

export function applyMoves(cells: Cells, moves: Move[]): Cells {
  const removed = new Set(moves.map((m) => keyOf(m.from)));
  return normalize([...cells.filter((c) => !removed.has(keyOf(c))), ...moves.map((m) => m.to)]);
}

/**
 * Move one square to a new place on the edge of the shape, keeping it in one piece.
 * "near" keeps the new place within two squares of the old one, so the change is subtle.
 */
export function randomMove(
  cells: Cells,
  near: boolean,
  avoid: ReadonlySet<string>,
  rng: Rng,
): Move | null {
  const taken = new Set(cells.map(keyOf));
  for (const from of rng.shuffle(cells)) {
    if (avoid.has(keyOf(from))) continue;
    const rest = cells.filter((c) => keyOf(c) !== keyOf(from));
    if (!isConnected(rest)) continue;
    const spots = rest
      .flatMap(([x, y]) => DIRS.map(([dx, dy]) => [x + dx, y + dy] as [number, number]))
      .filter((p) => !taken.has(keyOf(p)) && !avoid.has(keyOf(p)))
      .filter((p) => !near || Math.max(Math.abs(p[0] - from[0]), Math.abs(p[1] - from[1])) <= 2);
    if (spots.length) return { from, to: rng.pick(spots) };
  }
  return null;
}
