/**
 * A tiny declarative SVG tree. Renderers in the engine produce these; the React app maps them
 * to elements and tests can serialise them to strings. Attribute names use SVG spelling.
 */

export type SvgTag = 'svg' | 'g' | 'circle' | 'line' | 'polygon' | 'rect';

export interface SvgNode {
  tag: SvgTag;
  attrs: Record<string, string | number>;
  children?: SvgNode[];
}

const escapeAttr = (v: string | number) =>
  String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export function svgToString(node: SvgNode): string {
  const attrs = Object.entries(node.attrs)
    .map(([k, v]) => ` ${k}="${escapeAttr(v)}"`)
    .join('');
  const children = node.children?.map(svgToString).join('') ?? '';
  return children ? `<${node.tag}${attrs}>${children}</${node.tag}>` : `<${node.tag}${attrs}/>`;
}
