/**
 * The pattern-matrix cell model. A cell shows `count` copies of one shape with a shading,
 * size and rotation. Attributes are handled internally as indices into the domains below.
 */

export const SHAPES = [
  'circle',
  'square',
  'triangle',
  'diamond',
  'hexagon',
  'cross',
  'arrow',
] as const;
export const SHADINGS = ['outline', 'shaded', 'solid'] as const;
export const SIZES = ['small', 'medium', 'large'] as const;
export const COUNTS = [1, 2, 3, 4] as const;
export const ROTATIONS = [0, 45, 90, 135, 180, 225, 270, 315] as const;

export type Shape = (typeof SHAPES)[number];
export type Shading = (typeof SHADINGS)[number];
export type Size = (typeof SIZES)[number];

/** What the client receives and renders for one cell. */
export interface Cell {
  shape: Shape;
  count: number;
  shading: Shading;
  size: Size;
  /** Degrees clockwise. */
  rotation: number;
}

/** Public content of a matrix item: 9 cells with the last one missing, plus the options. */
export interface MatrixContent {
  kind: 'matrix';
  cells: (Cell | null)[];
  options: Cell[];
}

export const ATTRS = ['shape', 'count', 'shading', 'size', 'rotation'] as const;
export type Attr = (typeof ATTRS)[number];

export interface AttrInfo {
  size: number;
  /** Values have a natural order, so "more/less" progressions make sense. */
  ordered: boolean;
  /** Values wrap around (rotation). */
  cyclic: boolean;
}

export const ATTR_INFO: Record<Attr, AttrInfo> = {
  shape: { size: SHAPES.length, ordered: false, cyclic: false },
  count: { size: COUNTS.length, ordered: true, cyclic: false },
  shading: { size: SHADINGS.length, ordered: true, cyclic: false },
  size: { size: SIZES.length, ordered: true, cyclic: false },
  rotation: { size: ROTATIONS.length, ordered: true, cyclic: true },
};

export type CellValues = Record<Attr, number>;

/** Shapes whose rotation is visible at every 45° step. */
export const ROTATABLE_SHAPES: readonly number[] = [
  SHAPES.indexOf('triangle'),
  SHAPES.indexOf('arrow'),
];

/** Rotational symmetry in degrees: rotations differing by a multiple of this look identical. */
const SYMMETRY: Record<Shape, number> = {
  circle: 1,
  square: 90,
  diamond: 90,
  cross: 90,
  hexagon: 60,
  triangle: 120,
  arrow: 360,
};

export function toCell(v: CellValues): Cell {
  return {
    shape: SHAPES[v.shape] as Shape,
    count: COUNTS[v.count] as number,
    shading: SHADINGS[v.shading] as Shading,
    size: SIZES[v.size] as Size,
    rotation: ROTATIONS[v.rotation] as number,
  };
}

/** A string that is equal for two cells exactly when they look the same. */
export function cellSignature(cell: Cell): string {
  const rotation = cell.rotation % SYMMETRY[cell.shape];
  return `${cell.shape}/${cell.count}/${cell.shading}/${cell.size}/${rotation}`;
}
