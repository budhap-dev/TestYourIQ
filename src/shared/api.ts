import type { AreaResult, IqResult } from '../engine/scoring.js';
import type { Area, PublicItem, Track } from '../engine/types.js';

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

export interface TakerSummary {
  takerToken: string | null;
  completedBefore: number;
  previous: PreviousResult | null;
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
