import type { ReactNode } from 'react';
import styles from './options.module.css';

/** How an option is marked in the answer review. */
export type OptionMark = 'correct' | 'chosen-right' | 'chosen-wrong';

const MARK_TEXT: Record<OptionMark, { icon: string; text: string; spoken: string }> = {
  correct: { icon: '✓', text: 'Correct', spoken: 'the correct answer' },
  'chosen-right': { icon: '✓', text: 'Your pick', spoken: 'your answer, correct' },
  'chosen-wrong': { icon: '✗', text: 'Your pick', spoken: 'your answer, not correct' },
};

export interface ChoiceProps {
  selected: number | null;
  onSelect: (index: number) => void;
  disabled?: boolean | undefined;
  /** Dev preview only: outline this option. */
  highlight?: number | null | undefined;
  /** Answer review: show options read-only, with these marks. */
  marks?: Partial<Record<number, OptionMark>> | undefined;
}

interface OptionGridProps extends ChoiceProps {
  legend: string;
  layout: 'pictures' | 'shapes' | 'text';
  options: { label: string; content: ReactNode }[];
}

/** Numbered answer options. Number keys 1–8 are wired up by the test runner. */
export function OptionGrid({
  legend,
  layout,
  options,
  selected,
  onSelect,
  disabled,
  highlight,
  marks,
}: OptionGridProps) {
  if (marks) {
    return (
      <div
        className={styles.options}
        data-layout={layout}
        data-count={options.length}
        data-review=""
        role="group"
        aria-label={legend}
      >
        <p className={styles.legend} aria-hidden="true">
          {legend}
        </p>
        {options.map((o, i) => {
          const mark = marks[i];
          return (
            <div key={i} className={styles.option} data-mark={mark}>
              <span className={styles.number} aria-hidden="true">
                {i + 1}
              </span>
              <span className="visually-hidden">
                Option {i + 1}
                {layout === 'text' ? '' : `: ${o.label}`}
                {mark ? `, ${MARK_TEXT[mark].spoken}` : ''}.
              </span>
              {layout === 'text' ? <span aria-hidden="true">{o.content}</span> : o.content}
              {mark && (
                <span className={styles.mark} aria-hidden="true">
                  {MARK_TEXT[mark].icon} {MARK_TEXT[mark].text}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <fieldset className={styles.options} data-layout={layout} data-count={options.length}>
      <legend className={styles.legend}>{legend}</legend>
      {options.map((o, i) => (
        <button
          key={i}
          type="button"
          className={[styles.option, highlight === i && styles.correct].filter(Boolean).join(' ')}
          aria-pressed={selected === i}
          aria-label={`Option ${i + 1}: ${o.label}`}
          disabled={disabled}
          onClick={() => onSelect(i)}
        >
          <span className={styles.number} aria-hidden="true">
            {i + 1}
          </span>
          {o.content}
        </button>
      ))}
    </fieldset>
  );
}
