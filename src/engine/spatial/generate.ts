import { generatedKey } from '../itemKey';
import { createRng, type Rng } from '../rng';
import type { Difficulty, IrtParams, Item } from '../types';
import type { Cells, SpatialContent, SpatialTask } from './model';
import {
  applyMoves,
  grow,
  isChiral,
  isConnected,
  randomMove,
  reflect,
  rotate,
  rotationClass,
  shapeKey,
  size,
  type Move,
} from './polyomino';

export const ROTATION_GENERATOR_ID = 'rotation';
export const MIRROR_GENERATOR_ID = 'mirror';
export const SPATIAL_GENERATOR_VERSION = 1;

/**
 * Difficulty is set by explicit parameters:
 *  - cells:        squares in the shape
 *  - optionCount:  4 or 8; options are every combination of "mirrored or not" and one or two
 *                  single-square changes, so no option is the odd one out
 *  - near:         changed squares move at most two places, so differences are subtle
 *  - turnMirrors:  mirror task only: options are also turned, not just flipped
 */
export interface SpatialLevel {
  cells: number;
  optionCount: 4 | 8;
  near: boolean;
  turnMirrors: boolean;
  irt: IrtParams;
}

export const SPATIAL_LEVELS: Record<Difficulty, SpatialLevel> = {
  1: { cells: 5, optionCount: 4, near: false, turnMirrors: false, irt: { a: 1.0, b: -2.0 } },
  2: { cells: 6, optionCount: 4, near: false, turnMirrors: false, irt: { a: 1.1, b: -1.0 } },
  3: { cells: 6, optionCount: 4, near: true, turnMirrors: true, irt: { a: 1.2, b: 0.0 } },
  4: { cells: 7, optionCount: 8, near: true, turnMirrors: true, irt: { a: 1.3, b: 1.0 } },
  5: { cells: 8, optionCount: 8, near: true, turnMirrors: true, irt: { a: 1.3, b: 2.0 } },
};

const MAX_ATTEMPTS = 300;
const key = ([x, y]: [number, number]) => `${x},${y}`;

function pickMoves(shape: Cells, count: number, near: boolean, rng: Rng): Move[] | null {
  const moves: Move[] = [];
  const used = new Set<string>();
  for (let i = 0; i < count; i++) {
    const m = randomMove(shape, near, used, rng);
    if (!m) return null;
    moves.push(m);
    used.add(key(m.from)).add(key(m.to));
  }
  // Every subset of moves must leave the shape in one piece.
  for (let mask = 1; mask < 1 << count; mask++) {
    if (
      !isConnected(
        applyMoves(
          shape,
          moves.filter((_, b) => mask & (1 << b)),
        ),
      )
    )
      return null;
  }
  return moves;
}

function attempt(task: SpatialTask, level: SpatialLevel, rng: Rng) {
  const target = grow(level.cells, rng);
  const { w, h } = size(target);
  if (Math.min(w, h) < 2 || !isChiral(target)) return null;

  const k = Math.log2(level.optionCount);
  const moves = pickMoves(target, k - 1, level.near, rng);
  if (!moves) return null;

  // Bit 0 mirrors; bits 1.. apply each move.
  const shapes = Array.from({ length: level.optionCount }, (_, v) => {
    const moved = applyMoves(
      target,
      moves.filter((_, b) => v & (1 << (b + 1))),
    );
    return v & 1 ? reflect(moved) : moved;
  });
  const classes = shapes.map(rotationClass);
  if (new Set(classes).size !== shapes.length) return null;

  const correct = task === 'rotate' ? 0 : 1;
  const turn = task === 'rotate' || level.turnMirrors;
  // Turn each option. The answer must never look identical to the target, which a half turn
  // can do for shapes with two-fold symmetry.
  const options = shapes.map((s, v) => {
    if (!turn) return s;
    const turns = rng.shuffle([1, 2, 3]);
    const visible = turns.find((t) => v !== correct || shapeKey(rotate(s, t)) !== shapeKey(target));
    return rotate(s, visible ?? 1);
  });
  const order = rng.shuffle(options.map((_, i) => i));
  const span = Math.max(...[target, ...options].map((s) => Math.max(size(s).w, size(s).h)));

  return {
    content: {
      kind: 'spatial',
      task,
      target,
      options: order.map((i) => options[i] as Cells),
      span,
    } as SpatialContent,
    answerIndex: order.indexOf(correct),
    explanation: `${task}: ${level.cells} squares, ${moves.length} changed square(s)${turn ? ', options turned' : ''}`,
  };
}

function generateSpatial(
  task: SpatialTask,
  seed: number,
  difficulty: Difficulty,
): Item<SpatialContent> {
  const level = SPATIAL_LEVELS[difficulty];
  const rng = createRng(seed);
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const result = attempt(task, level, rng);
    if (result) {
      const id = task === 'rotate' ? ROTATION_GENERATOR_ID : MIRROR_GENERATOR_ID;
      return {
        key: generatedKey(id, SPATIAL_GENERATOR_VERSION, difficulty, seed),
        area: 'spatial',
        difficulty,
        content: result.content,
        optionCount: level.optionCount,
        answerIndex: result.answerIndex,
        irt: level.irt,
        explanation: result.explanation,
      };
    }
  }
  throw new Error(`${task} generator failed for seed ${seed} at difficulty ${difficulty}`);
}

export const generateRotation = (seed: number, difficulty: Difficulty) =>
  generateSpatial('rotate', seed, difficulty);

export const generateMirror = (seed: number, difficulty: Difficulty) =>
  generateSpatial('mirror', seed, difficulty);
