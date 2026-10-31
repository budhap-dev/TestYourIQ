import { SvgTree } from '../../components/SvgTree';
import type { SpatialContent } from '../../engine/spatial/model';
import { renderShape } from '../../engine/spatial/render';
import { OptionGrid, type ChoiceProps } from './OptionGrid';
import styles from './SpatialPuzzle.module.css';

const QUESTION = {
  rotate: 'Which shape is the same as this one, only turned?',
  mirror: 'Which shape is this one’s mirror image?',
};

export function SpatialPuzzle({ content, ...choice }: { content: SpatialContent } & ChoiceProps) {
  return (
    <div className={styles.puzzle}>
      <div className={styles.targetWrap}>
        <div className={styles.target} role="img" aria-label="The shape to compare">
          <SvgTree node={renderShape(content.target, content.span)} aria-hidden="true" />
        </div>
        {content.task === 'mirror' && (
          <>
            <span className={styles.mirror} aria-hidden="true" />
            <span className={styles.mirrorLabel} aria-hidden="true">
              Mirror
            </span>
          </>
        )}
      </div>
      <OptionGrid
        legend={QUESTION[content.task]}
        layout="shapes"
        options={content.options.map((shape, i) => ({
          label: `shape ${i + 1}`,
          content: <SvgTree node={renderShape(shape, content.span)} aria-hidden="true" />,
        }))}
        {...choice}
      />
    </div>
  );
}
