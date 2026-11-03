import type { AreaResult, IqResult } from '../engine/scoring.js';
import type { Area, ItemContent, PublicItem, Track } from '../engine/types.js';

/** Request and response shapes for the /api endpoints, shared by the server and the browser. */

export interface SectionInfo {
  area: Area;
  items: number;
  seconds: number;
}

export interface ItemPayload {
  /** Encrypted, short-lived; send it back with the answer. */
  token: string;
  number: number;
  total: number;
  section: {
    index: number;
    count: number;
    area: Area;
    itemNumber: number;
    items: number;
    seconds: number;
    endsAt: string;
  };
  serverNow: string;
  item: PublicItem;
}

export interface PreviousResult {
  completedAt: string;
  iqLabel: string;
  low: number;
  high: number;
}

export interface RetakeInfo {
  attemptNumber: number;
  completedBefore: number;
  previous: PreviousResult | null;
}

export interface AttemptStarted {
  takerToken: string;
  attemptId: string;
  track: Track;
  sections: SectionInfo[];
  retake: RetakeInfo;
  next: ItemPayload;
}

export type Progress = { done: true } | { done: false; next: ItemPayload };

export interface ResultView {
  attemptId: string;
  completedAt: string;
  track: Track;
  ageBand: string;
  score: IqResult;
  areas: AreaResult[];
  answered: number;
  correct: number;
  total: number;
  normsVersion: number;
  retake: RetakeInfo;
}

/**
 * not-reached: the section's time ran out before the question was shown. Its content is never
 * sent, because an unseen question can still come up in a later test.
 */
export type ReviewOutcome = 'correct' | 'wrong' | 'skipped' | 'timed-out' | 'not-reached';

export interface ReviewQuestion {
  number: number;
  area: Area;
  outcome: ReviewOutcome;
  /** Null for questions never shown. */
  content: ItemContent | null;
  /** The option the test-taker picked, or null if none. */
  chosen: number | null;
  /** The right option. Null for word questions, whose answers stay private (see DECISIONS.md). */
  correct: number | null;
  /** How to solve it, in plain language. Null wherever `correct` is. */
  solution: string | null;
  /** Why the chosen option is wrong, when there's something specific to say. */
  note: string | null;
}

export interface ReviewView {
  attemptId: string;
  questions: ReviewQuestion[];
}

export interface TakerSummary {
  takerToken: string | null;
  completedBefore: number;
  previous: PreviousResult | null;
  /** An unfinished test this browser can resume. */
  inProgress: { attemptId: string; startedAt: string } | null;
}

export interface ApiErrorBody {
  error: string;
  message: string;
}

export interface AnswerOutcomeBody {
  itemToken: string;
  answerIndex: number | null;
  responseMs: number;
  timedOut?: boolean;
}

export const AREA_LABELS: Record<Area, string> = {
  pattern: 'Patterns',
  numerical: 'Numbers',
  spatial: 'Shapes',
  verbal: 'Words',
};
