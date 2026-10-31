import { useMemo, useState } from 'react';
import { Button } from '../../components/Button';
import { GENERATORS, checkAnswer } from '../../engine/generators';
import { DIFFICULTIES, type Difficulty, type Item, type ItemContent } from '../../engine/types';
import { VERBAL_BANK, verbalItem } from '../../engine/verbal/bank';
import type { Track } from '../../engine/verbal/model';
import { ItemView } from '../../features/test/ItemView';
import { useDocumentTitle } from '../useDocumentTitle';
import pageStyles from './Page.module.css';
import styles from './DevPuzzles.module.css';

/** Development-only workbench for inspecting generated items. Not included in production builds. */
export function DevPuzzles() {
  useDocumentTitle('Puzzle workbench');
  const [source, setSource] = useState('matrix');
  const [difficulty, setDifficulty] = useState<Difficulty>(3);
  const [seed, setSeed] = useState(12345);
  const [selected, setSelected] = useState<number | null>(null);
  const [reveal, setReveal] = useState(false);

  const item = useMemo(() => {
    if (source.startsWith('verbal-')) {
      const bank = VERBAL_BANK[source.slice(7) as Track];
      return verbalItem(bank[seed % bank.length]?.id ?? '') as Item<ItemContent>;
    }
    return (GENERATORS[source] ?? GENERATORS.matrix)?.generate(
      seed,
      difficulty,
    ) as Item<ItemContent>;
  }, [source, seed, difficulty]);
  const isBank = source.startsWith('verbal-');
  const reset = () => setSelected(null);

  return (
    <div>
      <h1 className={pageStyles.title}>Puzzle workbench</h1>
      <p className={pageStyles.lede}>Every generator and the verbal bank · dev only</p>

      <div className={styles.controls} style={{ marginTop: 'var(--space-5)' }}>
        <label className={styles.field}>
          Item type
          <select
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              reset();
            }}
          >
            {Object.keys(GENERATORS).map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
            <option value="verbal-adult">verbal (adult bank)</option>
            <option value="verbal-junior">verbal (junior bank)</option>
          </select>
        </label>
        <label className={styles.field}>
          Difficulty
          <select
            disabled={isBank}
            value={isBank ? item.difficulty : difficulty}
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
          {isBank ? 'Item number' : 'Seed'}
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

      <ItemView
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
