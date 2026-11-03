import { ROTATABLE_SHAPES, SHAPES, type Cell, type MatrixContent } from './matrix/model.js';
import { reflect, rotationClass } from './spatial/polyomino.js';
import type { SpatialContent } from './spatial/model.js';
import type { Item } from './types.js';

/**
 * Why a chosen option is wrong, in plain language, when the item lets us say more than "it
 * isn't the answer". Server-side only, used by the answer review once a test is finished.
 */
export function whyWrong(item: Item, chosen: number | null): string | null {
  if (chosen === null || chosen === item.answerIndex) return null;
  const content = item.content;
  switch (content.kind) {
    case 'matrix':
      return matrixNote(content, chosen, item.answerIndex);
    case 'spatial':
      return spatialNote(content, chosen);
    default:
      return null;
  }
}

const CELL_PARTS: { key: keyof Cell; name: string }[] = [
  { key: 'shape', name: 'shape' },
  { key: 'count', name: 'number of shapes' },
  { key: 'shading', name: 'shading' },
  { key: 'size', name: 'size' },
  { key: 'rotation', name: 'angle' },
];

const joinAnd = (parts: string[]) =>
  parts.length <= 1 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;

function matrixNote(content: MatrixContent, chosen: number, answer: number): string | null {
  const mine = content.options[chosen];
  const right = content.options[answer];
  if (!mine || !right) return null;
  const turns = ROTATABLE_SHAPES.includes(SHAPES.indexOf(mine.shape));
  const wrong = CELL_PARTS.filter(
    ({ key }) => (key !== 'rotation' || turns) && mine[key] !== right[key],
  ).map((p) => p.name);
  return wrong.length ? `Your choice has the wrong ${joinAnd(wrong)}.` : null;
}

function spatialNote(content: SpatialContent, chosen: number): string | null {
  const mine = content.options[chosen];
  if (!mine) return null;
  const same = rotationClass(mine) === rotationClass(content.target);
  const flipped = rotationClass(mine) === rotationClass(reflect(content.target));
  if (content.task === 'rotate' && flipped)
    return 'Your choice is a mirror image of the shape, so turning it can’t make it match.';
  if (content.task === 'mirror' && same)
    return 'Your choice is the same shape, only turned, not flipped over.';
  return 'Your choice has a square in a different place.';
}
