import { SvgTree } from '../../components/SvgTree';
import type { MatrixContent } from '../../engine/matrix/model';
import { describeCell, renderCell } from '../../engine/matrix/render';
import styles from './MatrixPuzzle.module.css';
import { OptionGrid, type ChoiceProps } from './OptionGrid';

export function MatrixPuzzle({ content, ...choice }: { content: MatrixContent } & ChoiceProps) {
  return (
    <div className={styles.puzzle}>
      <div
        className={styles.matrix}
        role="group"
        aria-label="Pattern grid. The last cell is missing."
      >
        {content.cells.map((cell, i) =>
          cell ? (
            <div key={i} className={styles.cell} role="img" aria-label={describeCell(cell)}>
              <SvgTree node={renderCell(cell)} aria-hidden="true" />
            </div>
          ) : (
            <div key={i} className={styles.missing} role="img" aria-label="Missing cell">
              ?
            </div>
          ),
        )}
      </div>
      <OptionGrid
        legend="Which one completes the grid?"
        layout="pictures"
        options={content.options.map((cell) => ({
          label: describeCell(cell),
          content: <SvgTree node={renderCell(cell)} aria-hidden="true" />,
        }))}
        {...choice}
      />
    </div>
  );
}
