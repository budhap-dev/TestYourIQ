import { ButtonLink } from '../../components/Button';
import { Notice } from '../../components/Notice';
import { useDocumentTitle } from '../useDocumentTitle';
import styles from './Landing.module.css';

const AREAS = [
  { name: 'Pattern reasoning', detail: 'Find the rule in a grid of shapes and fill the gap.' },
  { name: 'Numerical reasoning', detail: 'Continue number series and complete number analogies.' },
  { name: 'Spatial reasoning', detail: 'Rotate shapes in your head and spot mirror images.' },
  { name: 'Verbal reasoning', detail: 'Word analogies and odd-one-out questions.' },
];

/** Decorative 3×3 puzzle: shape changes across columns, count across rows. */
function HeroFigure() {
  const cell = 64;
  const gap = 10;
  const shapes = (kind: number, count: number, cx: number, cy: number) =>
    Array.from({ length: count }, (_, i) => {
      const x = cx + (i - (count - 1) / 2) * 16;
      if (kind === 0) return <circle key={i} cx={x} cy={cy} r="6" />;
      if (kind === 1) return <rect key={i} x={x - 6} y={cy - 6} width="12" height="12" rx="1.5" />;
      return <path key={i} d={`M${x} ${cy - 7} L${x + 7} ${cy + 6} L${x - 7} ${cy + 6} Z`} />;
    });

  return (
    <svg viewBox={`0 0 ${cell * 3 + gap * 2} ${cell * 3 + gap * 2}`} aria-hidden="true">
      {[0, 1, 2].flatMap((row) =>
        [0, 1, 2].map((col) => {
          const x = col * (cell + gap);
          const y = row * (cell + gap);
          const missing = row === 2 && col === 2;
          return (
            <g key={`${row}-${col}`}>
              <rect
                x={x + 0.5}
                y={y + 0.5}
                width={cell - 1}
                height={cell - 1}
                rx="8"
                fill="none"
                stroke="currentColor"
                strokeOpacity={missing ? 1 : 0.2}
                strokeDasharray={missing ? '4 4' : undefined}
                className={missing ? styles.figureAccent : undefined}
              />
              {missing ? (
                <text
                  x={x + cell / 2}
                  y={y + cell / 2 + 9}
                  textAnchor="middle"
                  fontSize="26"
                  fontFamily="var(--font-display)"
                  fill="currentColor"
                  className={styles.figureAccent}
                >
                  ?
                </text>
              ) : (
                <g fill="currentColor">{shapes(col, row + 1, x + cell / 2, y + cell / 2)}</g>
              )}
            </g>
          );
        }),
      )}
    </svg>
  );
}

export function Landing() {
  useDocumentTitle();

  return (
    <>
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroText}>
          <p className={styles.eyebrow}>Free · No sign-up · Ages 8 and up</p>
          <h1 id="hero-title" className={styles.title}>
            A careful estimate of how you <em>reason</em>.
          </h1>
          <p className={styles.lede}>
            Work through original puzzles with patterns, numbers, shapes and words. We compare your
            result with people your own age, and show how sure we can be about it.
          </p>
          <ButtonLink to="/setup" size="lg">
            Start the test
          </ButtonLink>
          <dl className={styles.facts}>
            <div className={styles.fact}>
              <dt>Time</dt>
              <dd>25–35 min</dd>
            </div>
            <div className={styles.fact}>
              <dt>Skill areas</dt>
              <dd>4</dd>
            </div>
            <div className={styles.fact}>
              <dt>Cost</dt>
              <dd>Free</dd>
            </div>
          </dl>
        </div>
        <div className={styles.figure}>
          <HeroFigure />
        </div>
      </section>

      <div className={styles.sections}>
        <section className={styles.section} aria-labelledby="measures">
          <h2 id="measures">What it measures</h2>
          <p>
            The test looks at four kinds of reasoning. Every question is written or generated for
            this test. None comes from a published IQ test.
          </p>
          <ul className={styles.areas}>
            {AREAS.map((a) => (
              <li key={a.name} className={styles.area}>
                <strong>{a.name}</strong>
                <span>{a.detail}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className={styles.stack}>
          <section className={styles.section} aria-labelledby="how">
            <h2 id="how">How it works</h2>
            <p>
              Tell us your age and try two practice questions. Then answer one question at a time.
              Each section has a timer, but you don’t need to rush. You can skip a question, but you
              can’t go back once you’ve answered. The questions adjust to how you’re doing, so most
              people find some easy and some hard.
            </p>
            <p>
              Under 16? You’ll get the Junior version, with questions and scoring made for your age.
            </p>
          </section>

          <section className={styles.section} aria-labelledby="meaning">
            <h2 id="meaning">What your score means</h2>
            <p>
              A score of 100 is average for your age. About two in three people score between 85 and
              115. Because no short test is exact, you’ll also see a range your true score probably
              falls in, and how your result compares with others your age.
            </p>
          </section>
        </div>

        <div className={styles.notices}>
          <Notice title="An estimate, not a diagnosis">
            <p>
              This is a short online test, not an assessment by a qualified psychologist. It’s for
              curiosity, so please don’t use it for decisions about school, work or health.
            </p>
          </Notice>
          <Notice title="Some questions are visual" tone="neutral">
            <p>
              Pattern and shape questions are pictures, and we can’t yet describe them well enough
              for a screen reader. Everything else works with a keyboard and screen reader.
            </p>
          </Notice>
        </div>

        <div className={styles.cta}>
          <ButtonLink to="/setup" size="lg">
            Start the test
          </ButtonLink>
          <p>Your result appears as soon as you finish. No email needed.</p>
        </div>
      </div>
    </>
  );
}
