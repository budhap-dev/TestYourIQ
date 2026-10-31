import type { ItemContent } from '../../engine/types';
import { MatrixPuzzle } from './MatrixPuzzle';
import type { ChoiceProps } from './OptionGrid';
import { SpatialPuzzle } from './SpatialPuzzle';
import { TextPuzzle } from './TextPuzzle';

/** Renders any item's prompt and options. */
export function ItemView({ content, ...choice }: { content: ItemContent } & ChoiceProps) {
  switch (content.kind) {
    case 'matrix':
      return <MatrixPuzzle content={content} {...choice} />;
    case 'spatial':
      return <SpatialPuzzle content={content} {...choice} />;
    default:
      return <TextPuzzle content={content} {...choice} />;
  }
}
