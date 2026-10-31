import { useEffect, useId, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../../components/Button';
import { Notice } from '../../components/Notice';
import { ADULT_AGE, MAX_AGE, MIN_AGE, ageFromDateOfBirth } from '../../features/test/age';
import { PracticeRound } from '../../features/test/PracticeRound';
import { SECTION_SUMMARY } from '../../features/test/sections';
import type { TakerSummary } from '../../shared/api';
import { ApiRequestError, api } from '../api';
import { useDocumentTitle } from '../useDocumentTitle';
import styles from './Setup.module.css';

type Step = 'about' | 'practice' | 'ready';
const STEPS: { id: Step; label: string }[] = [
  { id: 'about', label: 'About you' },
  { id: 'practice', label: 'Practice' },
  { id: 'ready', label: 'Ready' },
];

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

export function Setup() {
  useDocumentTitle('Before you start');
  const navigate = useNavigate();
  const ids = { age: useId(), dob: useId(), ageHint: useId(), error: useId() };

  const [step, setStep] = useState<Step>('about');
  const [useDob, setUseDob] = useState(false);
  const [ageText, setAgeText] = useState('');
  const [dob, setDob] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [history, setHistory] = useState<TakerSummary | null>(null);

  useEffect(() => {
    api.me().then(setHistory, () => setHistory(null));
  }, []);

  const age = useDob ? ageFromDateOfBirth(dob) : /^\d{1,3}$/.test(ageText) ? Number(ageText) : null;
  const junior = age !== null && age < ADULT_AGE;

  const submitAbout = (e: FormEvent) => {
    e.preventDefault();
    if (age === null)
      return setError(useDob ? 'Enter your date of birth.' : 'Enter your age in years.');
    if (age < MIN_AGE) return setError('This test is for ages 8 and over.');
    if (age > MAX_AGE) return setError('Please check your age.');
    setError(null);
    setStep('practice');
  };

  const start = async () => {
    if (age === null) return;
    setStarting(true);
    setError(null);
    try {
      const started = await api.start(age, consent);
      navigate(`/test/${started.attemptId}`, { state: { started } });
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.',
      );
      setStarting(false);
    }
  };

  const retake = history && history.completedBefore > 0 ? history : null;

  return (
    <div className={[styles.page, step === 'practice' && styles.wide].filter(Boolean).join(' ')}>
      <header className={styles.header}>
        <ol className={styles.steps} aria-label="Setup steps">
          {STEPS.map((s) => (
            <li key={s.id} aria-current={s.id === step ? 'step' : undefined}>
              {s.label}
            </li>
          ))}
        </ol>
        <h1 className={styles.title}>
          {step === 'about'
            ? 'Before you start'
            : step === 'practice'
              ? 'Try two practice questions'
              : 'Ready when you are'}
        </h1>
      </header>

      {retake && step !== 'practice' && (
        <Notice title="You’ve taken this test before">
          <p>
            Your last result was {retake.previous?.iqLabel ?? 'recorded'}
            {retake.previous ? `, on ${formatDate(retake.previous.completedAt)}` : ''}. You’ll get
            new questions you haven’t seen. Knowing the kinds of question can still lift a score by
            a few points.
          </p>
        </Notice>
      )}

      {step === 'about' && (
        <form className={styles.form} onSubmit={submitAbout} noValidate>
          <p className={styles.lede}>We compare your result with people your own age.</p>

          {useDob ? (
            <div className={styles.field}>
              <label className={styles.label} htmlFor={ids.dob}>
                Date of birth
              </label>
              <p className={styles.hint} id={ids.ageHint}>
                We only use it to work out your age in years. It isn’t sent or stored.
              </p>
              <input
                id={ids.dob}
                className={styles.input}
                type="date"
                value={dob}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setDob(e.target.value)}
                aria-describedby={`${ids.ageHint}${error ? ` ${ids.error}` : ''}`}
                aria-invalid={error ? true : undefined}
              />
            </div>
          ) : (
            <div className={styles.field}>
              <label className={styles.label} htmlFor={ids.age}>
                How old are you?
              </label>
              <p className={styles.hint} id={ids.ageHint}>
                In whole years.
              </p>
              <input
                id={ids.age}
                className={styles.input}
                inputMode="numeric"
                autoComplete="off"
                value={ageText}
                onChange={(e) => setAgeText(e.target.value.replace(/\D/g, '').slice(0, 3))}
                aria-describedby={`${ids.ageHint}${error ? ` ${ids.error}` : ''}`}
                aria-invalid={error ? true : undefined}
              />
            </div>
          )}
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => {
              setUseDob((v) => !v);
              setError(null);
            }}
          >
            {useDob ? 'Enter my age instead' : 'Use my date of birth instead'}
          </button>

          {error && (
            <p className={styles.error} id={ids.error} role="alert">
              {error}
            </p>
          )}

          {age !== null && age >= MIN_AGE && age <= MAX_AGE && (
            <p className={styles.hint}>
              {junior
                ? 'You’ll take the Junior version, with questions and scores made for your age.'
                : 'You’ll take the Adult version.'}
            </p>
          )}

          <label className={styles.consent}>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              <strong>Optional:</strong>{' '}
              {junior
                ? 'Let us use my answers, without my name or anything about me except my age, to make the test fairer.'
                : 'Use my anonymous answers to help make scores more accurate for everyone.'}{' '}
              <span className={styles.hint}>You can take the test either way.</span>
            </span>
          </label>

          <div className={styles.actions}>
            <Button type="submit" size="lg">
              Continue
            </Button>
          </div>
        </form>
      )}

      {step === 'practice' && <PracticeRound onDone={() => setStep('ready')} />}

      {step === 'ready' && (
        <div className={styles.form}>
          <p className={styles.lede}>
            The test has four sections of 8 questions. Each section has its own timer.
          </p>
          <ul className={styles.sections}>
            {SECTION_SUMMARY[junior ? 'junior' : 'adult'].map(([name, minutes]) => (
              <li key={name}>
                <span>{name}</span>
                <span>{minutes} min</span>
              </li>
            ))}
          </ul>
          <ul className={styles.tips}>
            <li>
              Choose with a click, a tap, or the keys <kbd>1</kbd>–<kbd>8</kbd>. Press{' '}
              <kbd>Enter</kbd> to confirm.
            </li>
            <li>
              Not sure? Skip and move on. You can’t go back to a question once you’ve answered it.
            </li>
            <li>
              If time runs out, the rest of that section is left blank and the next one starts.
            </li>
          </ul>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <div className={styles.actions}>
            <Button size="lg" onClick={start} disabled={starting}>
              {starting ? 'Starting…' : 'Start the test'}
            </Button>
            <Button variant="quiet" onClick={() => setStep('about')} disabled={starting}>
              Back
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
