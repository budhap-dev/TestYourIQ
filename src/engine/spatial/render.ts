import type { SvgNode } from '../svg.js';
import type { Cells } from './model.js';
import { normalize, size } from './polyomino.js';

/**
 * Renders a shape of unit squares on a 100×100 canvas, centred, at a scale shared by every
 * shape in the item (`span` squares fit across). Uses currentColor so it follows the theme.
 */
export function renderShape(cells: Cells, span: number): SvgNode {
  const unit = 92 / span;
  const shape = normalize(cells);
  const { w, h } = size(shape);
  const ox = (100 - w * unit) / 2;
  const oy = (100 - h * unit) / 2;
  const round = (n: number) => Math.round(n * 100) / 100;

  return {
    tag: 'svg',
    attrs: { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 100 100' },
    children: shape.map(([x, y]) => ({
      tag: 'rect',
      attrs: {
        x: round(ox + x * unit),
        y: round(oy + y * unit),
        width: round(unit),
        height: round(unit),
        fill: 'currentColor',
        'fill-opacity': 0.3,
        stroke: 'currentColor',
        'stroke-width': 2,
        'stroke-linejoin': 'round',
      },
    })),
  };
}
