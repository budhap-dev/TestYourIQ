import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { Button, ButtonLink } from '../../components/Button';
import { ItemView } from '../../features/test/ItemView';
import { useChoiceKeys } from '../../features/test/useChoiceKeys';
import { formatClock, useCountdown } from '../../features/test/useCountdown';
import {
  AREA_LABELS,
  type AttemptStarted,
  type ItemPayload,
  type Progress,
} from '../../shared/api';
import { ApiRequestError, api } from '../api';
import { useDocumentTitle } from '../useDocumentTitle';
import styles from './TestPage.module.css';

type Status = 'loading' | 'ready' | 'sending' | 'finishing' | 'error';

function ClockIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10 6v4.25l2.75 1.75"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function TestPage() {
  const { attemptId = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const started = (location.state as { started?: AttemptStarted } | null)?.started;

  const [payload, setPayload] = useState<ItemPayload | null>(
    started?.attemptId === attemptId ? started.next : null,
  );
  const [status, setStatus] = useState<Status>(payload ? 'ready' : 'loading');
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shownAt = useRef(0);
  const timedOutToken = useRef<string | null>(null);

  useDocumentTitle(payload ? `Question ${payload.number} of ${payload.total}` : 'Test');

  const finishUp = useCallback(async () => {
    setStatus('finishing');
    await api.finish(attemptId);
    navigate(`/results/${attemptId}`, { replace: true });
  }, [attemptId, navigate]);

  const apply = useCallback(
    async (step: Progress) => {
      if (step.done) return finishUp();
      setPayload(step.next);
      setSelected(null);
      setStatus('ready');
    },
    [finishUp],
  );

  const fail = useCallback((err: unknown) => {
    if (err instanceof ApiRequestError && err.code === 'not_in_progress') {
      setError(
        'This test is no longer in progress. It may have been started again elsewhere, or left for too long.',
      );
    } else {
      setError(err instanceof ApiRequestError ? err.message : 'Something went wrong.');
    }
    setStatus('error');
  }, []);

  const resync = useCallback(() => {
    setStatus('loading');
    setError(null);
    api.current(attemptId).then(apply, fail);
  }, [attemptId, apply, fail]);

  // Load the current question on arrival, unless the start screen handed it over.
  const hasInitial = useRef(payload !== null);
  useEffect(() => {
    if (hasInitial.current) return;
    hasInitial.current = true;
    api.current(attemptId).then(apply, fail);
  }, [attemptId, apply, fail]);

  // Response time runs from when a question appears.
  useEffect(() => {
    shownAt.current = performance.now();
  }, [payload?.token]);

  const send = useCallback(
    async (answerIndex: number | null, timedOut = false) => {
      if (!payload || status !== 'ready') return;
      setStatus('sending');
      try {
        const step = await api.answer(attemptId, {
          itemToken: payload.token,
          answerIndex,
          responseMs: Math.round(performance.now() - shownAt.current),
          ...(timedOut ? { timedOut: true } : {}),
        });
        await apply(step);
      } catch (err) {
        if (err instanceof ApiRequestError && err.code === 'stale_token') resync();
        else fail(err);
      }
    },
    [payload, status, attemptId, apply, resync, fail],
  );

  const confirm = useCallback(() => {
    if (selected !== null) void send(selected);
  }, [selected, send]);
  const choose = useCallback((i: number) => status === 'ready' && setSelected(i), [status]);
  useChoiceKeys(payload?.item.optionCount ?? 0, choose, confirm, status === 'ready');

  const remaining = useCountdown(payload?.section.endsAt ?? null, payload?.serverNow ?? null);
  useEffect(() => {
    if (remaining === 0 && payload && timedOutToken.current !== payload.token) {
      timedOutToken.current = payload.token;
      void send(null, true);
    }
  }, [remaining, payload, send]);

  if (status === 'error') {
    return (
      <div className={styles.message}>
        <h1>We hit a problem</h1>
        <p>{error}</p>
        <div className={styles.right} style={{ marginLeft: 0 }}>
          <Button onClick={resync}>Try again</Button>
          <ButtonLink to="/setup" variant="secondary">
            Start a new test
          </ButtonLink>
        </div>
      </div>
    );
  }

  if (!payload || status === 'loading' || status === 'finishing') {
    return (
      <div className={styles.page} aria-busy="true">
        <p className={styles.counter} role="status">
          {status === 'finishing' ? 'Working out your result…' : 'Loading your question…'}
        </p>
        <div className={styles.skeleton} />
      </div>
    );
  }

  const { section } = payload;
  const lowTime = remaining !== null && remaining <= 60;

  return (
    <div className={styles.page}>
      <div className={styles.bar}>
        <div className={styles.barRow}>
          <p className={styles.section}>
            {AREA_LABELS[section.area]}{' '}
            <span>
              · Section {section.index + 1} of {section.count}
            </span>
          </p>
          {remaining !== null && (
            <p className={[styles.timer, lowTime && styles.timerLow].filter(Boolean).join(' ')}>
              <ClockIcon />
              <span className="visually-hidden">Time left in this section:</span>
              <strong role="timer" aria-live="off">
                {formatClock(remaining)}
              </strong>
              <span aria-hidden="true">left</span>
            </p>
          )}
        </div>
        <div className={styles.progress} aria-hidden="true">
          <span style={{ width: `${((payload.number - 1) / payload.total) * 100}%` }} />
        </div>
        <p className={styles.counter}>
          Question {payload.number} of {payload.total}
        </p>
        {/* Announced once, not every second. */}
        <p className="visually-hidden" aria-live="polite">
          {lowTime ? 'About one minute left in this section.' : ''}
        </p>
      </div>

      {section.itemNumber === 1 && (
        <p className={styles.newSection}>
          <strong>{AREA_LABELS[section.area]}:</strong> {section.items} questions,{' '}
          {Math.round(section.seconds / 60)} minutes for this section.
        </p>
      )}

      <div key={payload.number} className={styles.stage}>
        <ItemView
          content={payload.item.content}
          selected={selected}
          onSelect={choose}
          disabled={status !== 'ready'}
        />
      </div>

      <div className={styles.actions}>
        <p className={styles.keysHint}>
          Keys <kbd>1</kbd>–<kbd>{Math.min(payload.item.optionCount, 8)}</kbd> choose ·{' '}
          <kbd>Enter</kbd> confirms
        </p>
        <div className={styles.right}>
          <Button variant="quiet" onClick={() => void send(null)} disabled={status !== 'ready'}>
            Skip
          </Button>
          <Button onClick={confirm} disabled={selected === null || status !== 'ready'}>
            {status === 'sending' ? 'Saving…' : 'Confirm'}
          </Button>
        </div>
      </div>
    </div>
  );
}
