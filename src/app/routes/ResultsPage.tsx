import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ButtonLink } from '../../components/Button';
import { Notice } from '../../components/Notice';
import { AreaBars } from '../../features/results/AreaBars';
import { BellCurve } from '../../features/results/BellCurve';
import { peopleAged, percentileText, rangeText } from '../../features/results/wording';
import type { ResultView } from '../../shared/api';
import { ApiRequestError, api } from '../api';
import { useDocumentTitle } from '../useDocumentTitle';
import styles from './ResultsPage.module.css';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

export function ResultsPage() {
  const { attemptId = '' } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState<ResultView | null>(null);
  const [error, setError] = useState<string | null>(null);
  useDocumentTitle('Your results');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        return await api.result(attemptId);
      } catch (err) {
        // Reloaded before finishing completed: finish now, or go back to the test.
        if (err instanceof ApiRequestError && err.code === 'not_finished') {
          try {
            return await api.finish(attemptId);
          } catch {
            navigate(`/test/${attemptId}`, { replace: true });
            return null;
          }
        }
        throw err;
      }
    };
    load().then(
      (r) => !cancelled && r && setResult(r),
      (err) =>
        !cancelled &&
        setError(
          err instanceof ApiRequestError && err.status === 404
            ? 'We couldn’t find this result. Results can only be seen in the browser that took the test.'
            : 'We couldn’t load your result. Please try again.',
        ),
    );
    return () => {
      cancelled = true;
    };
  }, [attemptId, navigate]);

  if (error) {
    return (
      <div className={styles.message}>
        <h1>Result not available</h1>
        <p>{error}</p>
        <ButtonLink to="/" variant="secondary">
          Back to the start
        </ButtonLink>
      </div>
    );
  }

  if (!result) {
    return (
      <div className={styles.page} aria-busy="true">
        <p role="status">Loading your result…</p>
        <div className={styles.skeleton} />
      </div>
    );
  }

  const { score, retake } = result;
  const who = peopleAged(result.ageBand);
  const previous = retake.attemptNumber > 1 ? retake.previous : null;

  return (
    <article className={styles.page}>
      <section className={styles.hero} aria-labelledby="score">
        <p className={styles.eyebrow}>Your result</p>
        <h1 id="score" className={styles.headline}>
          <span>Estimated IQ</span>
          <span className={styles.number}>{score.iqLabel}</span>
        </h1>
        <p className={styles.range}>{rangeText(score)}</p>
        <p className={styles.percentile}>{percentileText(score, result.ageBand)}</p>
      </section>

      <div className={styles.notices}>
        {score.calibrating && (
          <Notice title="Calibrating: early estimate">
            <p>
              We’re still collecting results to fine-tune how scores compare within each age group.
              Until then, treat your number as a rough guide.
            </p>
          </Notice>
        )}
        {retake.attemptNumber > 1 && (
          <Notice title="This was a retake" tone="neutral">
            <p>
              {previous
                ? `Your previous result was ${previous.iqLabel} (likely ${previous.low}–${previous.high}), on ${formatDate(previous.completedAt)}. `
                : ''}
              You had new questions this time, but getting used to the kinds of question can add a
              few points, so a small rise may be practice rather than a real change.
            </p>
          </Notice>
        )}
      </div>

      <section className={styles.card} aria-labelledby="curve">
        <h2 id="curve">Where you sit</h2>
        <BellCurve
          iq={score.iq}
          low={score.low}
          high={score.high}
          label={score.iqLabel}
          who={who}
        />
      </section>

      <section className={styles.card} aria-labelledby="areas">
        <h2 id="areas">By skill area</h2>
        <AreaBars areas={result.areas} />
        <p className={styles.explain}>
          Each area rests on about eight questions, so these are broad bands, not separate scores.
        </p>
      </section>

      <section className={styles.explain} aria-labelledby="meaning">
        <h2 id="meaning">What this means</h2>
        <ul>
          <li>
            <strong>100 is average</strong> for {who}. About two in three people score between 85
            and 115.
          </li>
          <li>
            <strong>The range</strong> ({score.low}–{score.high}) is where your score would probably
            land if you could take many tests like this one. A short test can’t pin it down exactly.
          </li>
          <li>
            <strong>The percentage</strong> compares you with others your age, not with everyone.
          </li>
          <li>
            <strong>It’s a snapshot.</strong> Tiredness, nerves, distractions, a small screen or
            reading in a second language can all pull a score down.
          </li>
        </ul>
      </section>

      <Notice title="An estimate, not a diagnosis" tone="neutral">
        <p>
          This is a short online test, not an assessment by a qualified psychologist. Please don’t
          use it for decisions about school, work or health. If you need an assessment, a GP or
          school can point you to one.
        </p>
      </Notice>

      <div className={styles.actions}>
        <ButtonLink to="/" variant="secondary">
          Back to the start
        </ButtonLink>
      </div>
    </article>
  );
}
