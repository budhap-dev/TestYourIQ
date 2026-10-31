/** A shape made of unit squares, as [x, y] grid positions (y increases downwards). */
export type Cells = [number, number][];

export type SpatialTask = 'rotate' | 'mirror';

/** Public content of a spatial item. */
export interface SpatialContent {
  kind: 'spatial';
  /** rotate: find the same shape turned. mirror: find its mirror image. */
  task: SpatialTask;
  target: Cells;
  options: Cells[];
  /** Largest width or height across the target and options, so all draw at one scale. */
  span: number;
}
