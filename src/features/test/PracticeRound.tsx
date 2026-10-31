import { useCallback, useState } from 'react';
import { Button } from '../../components/Button';
import { ItemView } from './ItemView';
import { PRACTICE } from './practice';
import styles from './PracticeRound.module.css';
import { useChoiceKeys } from './useChoiceKeys';

/** Two untimed practice questions with feedback. */
export function PracticeRound({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const item = PRACTICE[index];

  const check = useCallback(() => {
    if (selected !== null) setChecked(true);
  }, [selected]);
  const select = useCallback((i: number) => !checked && setSelected(i), [checked]);
  useChoiceKeys(item?.content.options.length ?? 0, select, check, !checked);

  if (!item) return null;
  const correct = selected === item.answer;
  const last = index === PRACTICE.length - 1;

  return (
    <div className={styles.round}>
      <p className={styles.meta}>
        <span>
          Practice question {index + 1} of {PRACTICE.length}
        </span>
        <span>Not timed, not scored</span>
      </p>
      <ItemView content={item.content} selected={selected} onSelect={select} disabled={checked} />
      {checked && (
        <div className={styles.feedback} data-correct={correct} role="status">
          <p className={styles.feedbackTitle}>
            {correct ? 'That’s right.' : `Not quite. The answer is option ${item.answer + 1}.`}
          </p>
          <p>{item.explain}</p>
        </div>
      )}
      <div className={styles.actions}>
        {!checked ? (
          <Button onClick={check} disabled={selected === null}>
            Check answer
          </Button>
        ) : last ? (
          <Button onClick={onDone}>I’m ready</Button>
        ) : (
          <Button
            onClick={() => {
              setIndex((i) => i + 1);
              setSelected(null);
              setChecked(false);
            }}
          >
            Next practice question
          </Button>
        )}
      </div>
    </div>
  );
}
