import type { ReactNode } from 'react';
import styles from './options.module.css';

export interface ChoiceProps {
  selected: number | null;
  onSelect: (index: number) => void;
  disabled?: boolean | undefined;
  /** Dev preview only: outline this option. */
  highlight?: number | null | undefined;
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
}: OptionGridProps) {
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
