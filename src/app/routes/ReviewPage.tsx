import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { Button, ButtonLink } from '../../components/Button';
import { Notice } from '../../components/Notice';
import type { OptionMark } from '../../features/test/OptionGrid';
import { ItemView } from '../../features/test/ItemView';
import {
  AREA_LABELS,
  type ReviewOutcome,
  type ReviewQuestion,
  type ReviewView,
} from '../../shared/api';
import { ApiRequestError, api } from '../api';
import { useDocumentTitle } from '../useDocumentTitle';
import styles from './ReviewPage.module.css';

const OUTCOME: Record<Exclude<ReviewOutcome, 'not-reached'>, { icon: string; text: string }> = {
  correct: { icon: '✓', text: 'Right' },
  wrong: { icon: '✗', text: 'Wrong' },
  skipped: { icon: '–', text: 'Skipped' },
  'timed-out': { icon: '–', text: 'Time ran out' },
};

function marksFor(q: ReviewQuestion): Partial<Record<number, OptionMark>> {
  const marks: Partial<Record<number, OptionMark>> = {};
  if (q.correct !== null) marks[q.correct] = 'correct';
  if (q.chosen !== null)
    marks[q.chosen] = q.outcome === 'correct' ? 'chosen-right' : 'chosen-wrong';
  return marks;
}

type Entry =
  | { kind: 'question'; question: ReviewQuestion }
  | { kind: 'not-reached'; from: number; to: number; area: ReviewQuestion['area'] };

/** Questions in order, with each run of not-reached questions folded into one line. */
function entries(questions: ReviewQuestion[]): Entry[] {
  const out: Entry[] = [];
  for (const q of questions) {
    const last = out.at(-1);
    if (q.outcome !== 'not-reached') out.push({ kind: 'question', question: q });
    else if (last?.kind === 'not-reached' && last.area === q.area && last.to === q.number - 1)
      last.to = q.number;
    else out.push({ kind: 'not-reached', from: q.number, to: q.number, area: q.area });
  }
  return out;
}

function QuestionCard({ q }: { q: ReviewQuestion }) {
  const outcome = OUTCOME[q.outcome as keyof typeof OUTCOME];
  const headingId = `q${q.number}`;
  return (
    <li className={styles.card} aria-labelledby={headingId}>
      <div className={styles.cardHead}>
        <h2 id={headingId} className={styles.cardTitle}>
          Question {q.number} <span>· {AREA_LABELS[q.area]}</span>
        </h2>
        <span className={styles.outcome} data-outcome={q.outcome}>
          <span aria-hidden="true">{outcome.icon}</span> {outcome.text}
        </span>
      </div>
      {q.content ? (
        <ItemView content={q.content} selected={null} onSelect={() => {}} marks={marksFor(q)} />
      ) : (
        <p className={styles.muted}>This question can no longer be shown.</p>
      )}
      {q.content && !q.solution && q.outcome !== 'correct' && (
        <p className={styles.muted}>Answers to word questions aren’t shown.</p>
      )}
      {q.solution && (
        <div className={styles.solution}>
          <h3>How to solve it</h3>
          <p>{q.solution}</p>
          {q.note && <p>{q.note}</p>}
        </div>
      )}
    </li>
  );
}

export function ReviewPage() {
  const { attemptId = '' } = useParams();
  const [review, setReview] = useState<ReviewView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  useDocumentTitle('Your answers');

  useEffect(() => {
    let cancelled = false;
    api.review(attemptId).then(
      (r) => !cancelled && setReview(r),
      (err) =>
        !cancelled &&
        setError(
          err instanceof ApiRequestError && err.status === 404
            ? 'We couldn’t find this test. Answers can only be seen in the browser that took it.'
            : err instanceof ApiRequestError && err.code === 'not_finished'
              ? 'Answers are shown once the test is finished.'
              : 'We couldn’t load your answers. Please try again.',
        ),
    );
    return () => {
      cancelled = true;
    };
  }, [attemptId]);

  if (error) {
    return (
      <div className={styles.page}>
        <h1>Answers not available</h1>
        <p>{error}</p>
        <ButtonLink to="/" variant="secondary">
          Back to the start
        </ButtonLink>
      </div>
    );
  }

  if (!review) {
    return (
      <div className={styles.page} aria-busy="true">
        <p role="status">Loading your answers…</p>
      </div>
    );
  }

  const qs = review.questions;
  const count = (o: ReviewOutcome) => qs.filter((q) => q.outcome === o).length;
  const missed = qs.filter((q) => q.outcome !== 'correct');
  const all = showAll || missed.length === 0;
  const shown = entries(all ? qs : missed);
  const hasWords = qs.some((q) => q.area === 'verbal' && q.content);
  const summary = [
    count('wrong') && `${count('wrong')} wrong`,
    count('skipped') && `${count('skipped')} skipped`,
    count('timed-out') + count('not-reached') &&
      `${count('timed-out') + count('not-reached')} not answered in time`,
  ].filter(Boolean);

  return (
    <article className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Your answers</p>
        <h1>
          You got {count('correct')} of {qs.length} right
        </h1>
        {summary.length > 0 && <p className={styles.lead}>{summary.join(' · ')}</p>}
      </header>

      {hasWords && (
        <Notice tone="neutral" title="Word questions">
          <p>
            For word questions we show whether you were right, but not the answer. They come from a
            fixed set of questions, so keeping the answers private keeps the test fair for everyone.
          </p>
        </Notice>
      )}

      {missed.length > 0 && (
        <div className={styles.filter} role="group" aria-label="Show">
          <Button
            variant={all ? 'quiet' : 'secondary'}
            aria-pressed={!all}
            onClick={() => setShowAll(false)}
          >
            Missed ({missed.length})
          </Button>
          <Button
            variant={all ? 'secondary' : 'quiet'}
            aria-pressed={all}
            onClick={() => setShowAll(true)}
          >
            All questions ({qs.length})
          </Button>
        </div>
      )}

      <ol className={styles.list}>
        {shown.map((e) =>
          e.kind === 'question' ? (
            <QuestionCard key={e.question.number} q={e.question} />
          ) : (
            <li key={`nr${e.from}`} className={styles.notReached}>
              <strong>
                {e.from === e.to ? `Question ${e.from}` : `Questions ${e.from}–${e.to}`}
              </strong>{' '}
              · {AREA_LABELS[e.area]}: time ran out before{' '}
              {e.from === e.to ? 'this was' : 'these were'} shown. They count as not answered, and
              you may see them in a later test.
            </li>
          ),
        )}
      </ol>

      <div className={styles.actions}>
        <ButtonLink to={`/results/${attemptId}`} variant="secondary">
          Back to your result
        </ButtonLink>
      </div>
    </article>
  );
}
