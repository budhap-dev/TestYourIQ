import { SvgTree } from '../../components/SvgTree';
import type { MatrixContent } from '../../engine/matrix/model';
import { describeCell, renderCell } from '../../engine/matrix/render';
import styles from './MatrixPuzzle.module.css';

interface MatrixPuzzleProps {
  content: MatrixContent;
  selected: number | null;
  onSelect: (index: number) => void;
  disabled?: boolean;
  /** Dev preview only: outline this option. */
  highlight?: number | null;
}

export function MatrixPuzzle({
  content,
  selected,
  onSelect,
  disabled,
  highlight,
}: MatrixPuzzleProps) {
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

      <fieldset className={styles.options} data-count={content.options.length}>
        <legend className={styles.legend}>Which one completes the grid?</legend>
        {content.options.map((cell, i) => (
          <button
            key={i}
            type="button"
            className={[styles.option, highlight === i && styles.correct].filter(Boolean).join(' ')}
            aria-pressed={selected === i}
            aria-label={`Option ${i + 1}: ${describeCell(cell)}`}
            disabled={disabled}
            onClick={() => onSelect(i)}
          >
            <span className={styles.number} aria-hidden="true">
              {i + 1}
            </span>
            <SvgTree node={renderCell(cell)} aria-hidden="true" />
          </button>
        ))}
      </fieldset>
    </div>
  );
}
