import { useMemo, useState } from 'react';
import { Button } from '../../components/Button';
import { checkAnswer } from '../../engine/generators';
import { generateMatrix } from '../../engine/matrix/generate';
import { DIFFICULTIES, type Difficulty } from '../../engine/types';
import { MatrixPuzzle } from '../../features/test/MatrixPuzzle';
import { useDocumentTitle } from '../useDocumentTitle';
import pageStyles from './Page.module.css';
import styles from './DevPuzzles.module.css';

/** Development-only workbench for inspecting generated items. Not included in production builds. */
export function DevPuzzles() {
  useDocumentTitle('Puzzle workbench');
  const [difficulty, setDifficulty] = useState<Difficulty>(3);
  const [seed, setSeed] = useState(12345);
  const [selected, setSelected] = useState<number | null>(null);
  const [reveal, setReveal] = useState(false);

  const item = useMemo(() => generateMatrix(seed, difficulty), [seed, difficulty]);
  const reset = () => setSelected(null);

  return (
    <div>
      <h1 className={pageStyles.title}>Puzzle workbench</h1>
      <p className={pageStyles.lede}>Pattern matrices · dev only</p>

      <div className={styles.controls} style={{ marginTop: 'var(--space-5)' }}>
        <label className={styles.field}>
          Difficulty
          <select
            value={difficulty}
            onChange={(e) => {
              setDifficulty(Number(e.target.value) as Difficulty);
              reset();
            }}
          >
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          Seed
          <input
            type="number"
            min={0}
            value={seed}
            onChange={(e) => {
              setSeed(Math.max(0, Math.floor(Number(e.target.value) || 0)));
              reset();
            }}
          />
        </label>
        <Button
          variant="secondary"
          onClick={() => {
            setSeed(crypto.getRandomValues(new Uint32Array(1))[0] ?? 0);
            reset();
          }}
        >
          Random seed
        </Button>
        <label className={styles.check}>
          <input type="checkbox" checked={reveal} onChange={(e) => setReveal(e.target.checked)} />
          Show answer
        </label>
      </div>

      <MatrixPuzzle
        content={item.content}
        selected={selected}
        onSelect={setSelected}
        highlight={reveal ? item.answerIndex : null}
      />

      <div className={styles.meta}>
        <p>
          Key: <code>{item.key}</code>
        </p>
        {selected !== null && (
          <p role="status">
            Option {selected + 1}: {checkAnswer(item.key, selected) ? 'correct' : 'wrong'}
          </p>
        )}
        {reveal && (
          <p>
            Rules: <code>{item.explanation}</code> · IRT a={item.irt.a}, b={item.irt.b}
          </p>
        )}
      </div>
    </div>
  );
}
