import type { SvgNode } from '../svg';
import { SIZES, type Cell, type Shape } from './model';

/**
 * Renders one matrix cell to a declarative SVG tree on a 100×100 canvas. Colours use
 * `currentColor` so cells follow the page theme. Shading is outline, a half-tone fill or solid;
 * the half-tone stays legible at small sizes where hatching turns to noise.
 */

const STROKE = 2.5;
const SHADED_OPACITY = 0.38;
const RADIUS: Record<(typeof SIZES)[number], number> = { small: 15, medium: 21, large: 27 };
const MULTI_SCALE = 0.7;

const LAYOUTS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [
    [27, 50],
    [73, 50],
  ],
  3: [
    [50, 27],
    [27, 72],
    [73, 72],
  ],
  4: [
    [28, 28],
    [72, 28],
    [28, 72],
    [72, 72],
  ],
};

const W = 0.34; // cross arm half-width
const UNIT_POLYGONS: Record<Exclude<Shape, 'circle'>, [number, number][]> = {
  square: [
    [-0.82, -0.82],
    [0.82, -0.82],
    [0.82, 0.82],
    [-0.82, 0.82],
  ],
  diamond: [
    [0, -1.12],
    [1.12, 0],
    [0, 1.12],
    [-1.12, 0],
  ],
  triangle: [-90, 30, 150].map((deg) => {
    const t = (deg * Math.PI) / 180;
    return [1.12 * Math.cos(t), 1.12 * Math.sin(t)] as [number, number];
  }),
  hexagon: [-90, -30, 30, 90, 150, 210].map((deg) => {
    const t = (deg * Math.PI) / 180;
    return [Math.cos(t), Math.sin(t)] as [number, number];
  }),
  cross: [
    [-W, -1],
    [W, -1],
    [W, -W],
    [1, -W],
    [1, W],
    [W, W],
    [W, 1],
    [-W, 1],
    [-W, W],
    [-1, W],
    [-1, -W],
    [-W, -W],
  ],
  arrow: [
    [0, -1],
    [0.72, -0.12],
    [0.28, -0.12],
    [0.28, 1],
    [-0.28, 1],
    [-0.28, -0.12],
    [-0.72, -0.12],
  ],
};

const round = (n: number) => Math.round(n * 100) / 100;

function shapeNode(
  shape: Shape,
  cx: number,
  cy: number,
  r: number,
  rotation: number,
  fill: Record<string, string | number>,
): SvgNode {
  const paint = {
    ...fill,
    stroke: 'currentColor',
    'stroke-width': STROKE,
    'stroke-linejoin': 'round',
  };
  if (shape === 'circle') return { tag: 'circle', attrs: { cx, cy, r: round(r), ...paint } };

  const t = (rotation * Math.PI) / 180;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  const points = UNIT_POLYGONS[shape]
    .map(
      ([x, y]) => `${round(cx + r * (x * cos - y * sin))},${round(cy + r * (x * sin + y * cos))}`,
    )
    .join(' ');
  return { tag: 'polygon', attrs: { points, ...paint } };
}

export function renderCell(cell: Cell): SvgNode {
  const fill =
    cell.shading === 'solid'
      ? { fill: 'currentColor' }
      : cell.shading === 'shaded'
        ? { fill: 'currentColor', 'fill-opacity': SHADED_OPACITY }
        : { fill: 'none' };
  const positions = LAYOUTS[cell.count] ?? LAYOUTS[1] ?? [];
  const r = RADIUS[cell.size] * (cell.count > 1 ? MULTI_SCALE : 1);

  return {
    tag: 'svg',
    attrs: { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 100 100' },
    children: positions.map(([x, y]) => shapeNode(cell.shape, x, y, r, cell.rotation, fill)),
  };
}

/** Plain-language description of a cell, e.g. "3 large shaded triangles, turned 90°". */
export function describeCell(cell: Cell): string {
  const noun =
    cell.count === 1 ? cell.shape : cell.shape === 'cross' ? 'crosses' : `${cell.shape}s`;
  const shading = cell.shading === 'outline' ? 'outlined' : cell.shading;
  const turned =
    cell.shape === 'arrow' || cell.shape === 'triangle'
      ? cell.rotation === 0
        ? ''
        : `, turned ${cell.rotation}°`
      : '';
  return `${cell.count} ${cell.size} ${shading} ${noun}${turned}`;
}
