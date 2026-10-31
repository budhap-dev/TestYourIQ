import { createElement, type ReactElement, type SVGProps } from 'react';
import type { SvgNode } from '../engine/svg';

const toReactName = (name: string) => name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

function toElement(node: SvgNode, extra: object = {}): ReactElement {
  const props: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node.attrs)) props[toReactName(k)] = v;
  return createElement(
    node.tag,
    { ...props, ...extra },
    node.children?.map((child, i) => toElement(child, { key: i })),
  );
}

/** Render an engine SVG tree. Extra props (className, aria-*) go on the root element as-is. */
export function SvgTree({ node, ...rest }: { node: SvgNode } & SVGProps<SVGSVGElement>) {
  return toElement(node, rest);
}
