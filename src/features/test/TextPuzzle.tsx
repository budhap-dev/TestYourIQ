import type { NumberAnalogyContent, SeriesContent } from '../../engine/numeric/model';
import type { VerbalContent } from '../../engine/verbal/model';
import { OptionGrid, type ChoiceProps } from './OptionGrid';
import styles from './TextPuzzle.module.css';

type TextContent = SeriesContent | NumberAnalogyContent | VerbalContent;

function Prompt({ content }: { content: TextContent }) {
  switch (content.kind) {
    case 'series':
      return (
        <>
          <p className={styles.question}>What number comes next?</p>
          <ol
            className={styles.sequence}
            aria-label={`Sequence: ${content.terms.join(', ')}, then what?`}
          >
            {content.terms.map((t, i) => (
              <li key={i} className={styles.term}>
                {t}
              </li>
            ))}
            <li className={styles.blank} aria-hidden="true">
              ?
            </li>
          </ol>
        </>
      );
    case 'number-analogy':
      return (
        <>
          <p className={styles.question}>
            Each number on the left becomes the one on the right. What does the last one become?
          </p>
          <ul className={styles.pairs}>
            {[...content.pairs, [content.query, null] as const].map(([x, y], i) => (
              <li
                key={i}
                className={styles.pair}
                aria-label={y === null ? `${x} becomes what?` : `${x} becomes ${y}`}
              >
                <span className={styles.term}>{x}</span>
                <span className={styles.arrow} aria-hidden="true">
                  →
                </span>
                <span className={y === null ? styles.blank : styles.term}>{y ?? '?'}</span>
              </li>
            ))}
          </ul>
        </>
      );
    case 'verbal':
      return content.format === 'analogy' ? (
        <>
          <p className={styles.question}>Complete the pair.</p>
          <p className={styles.analogy}>
            <strong>{content.stem[0]}</strong> is to <strong>{content.stem[1]}</strong> as{' '}
            <strong>{content.stem[2]}</strong> is to …
          </p>
        </>
      ) : (
        <p className={styles.analogy}>Which word is the odd one out?</p>
      );
  }
}

export function TextPuzzle({ content, ...choice }: { content: TextContent } & ChoiceProps) {
  return (
    <div className={styles.puzzle}>
      <div className={styles.prompt}>
        <Prompt content={content} />
      </div>
      <OptionGrid
        legend="Choose one answer"
        layout="text"
        options={content.options.map((o) => ({ label: String(o), content: <span>{o}</span> }))}
        {...choice}
      />
    </div>
  );
}
