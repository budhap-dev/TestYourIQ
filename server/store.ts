import type { Norm } from '../src/engine/norms.js';
import type { ResultView } from './service.js';
import type { Area, Difficulty, IrtParams, Track } from '../src/engine/types.js';

/** Persistence boundary. Postgres in production, in-memory for tests and DB-less local dev. */

export type AttemptStatus = 'in_progress' | 'completed' | 'abandoned';

export interface PendingItem {
  position: number;
  section: number;
  slot: number;
  itemKey: string;
  issuedAt: string;
}

export interface AttemptState {
  section: number;
  slot: number;
  /** Position the next response will take (0-based, across the whole test). */
  position: number;
  sectionStartedAt: string;
  pending: PendingItem | null;
  done: boolean;
}

export interface AttemptRow {
  id: string;
  testTakerId: string;
  track: Track;
  ageYears: number;
  ageBand: string;
  consentResearch: boolean;
  attemptNumber: number;
  formSeed: number;
  startedAt: Date;
  completedAt: Date | null;
  status: AttemptStatus;
  state: AttemptState;
  theta: number | null;
  thetaSe: number | null;
  iq: number | null;
  normsVersion: number | null;
  eligibleForNorms: boolean;
  flags: Record<string, unknown>;
  result: ResultView | null;
}

export interface ResponseRow {
  attemptId: string;
  position: number;
  section: number;
  itemKey: string;
  area: Area;
  difficulty: Difficulty;
  a: number;
  b: number;
  answerIndex: number | null;
  isCorrect: boolean;
  responseMs: number | null;
  timedOut: boolean;
  /** False for items never shown because the section's time ran out. */
  presented: boolean;
}

export interface TakerRow {
  id: string;
  createdAt: Date;
  firstCompletedAttemptId: string | null;
}

export interface NormSet {
  version: number;
  byBand: Record<string, Norm>;
}

export interface Tx {
  getTaker(id: string): Promise<TakerRow | null>;
  createTaker(id: string, now: Date): Promise<void>;
  setFirstCompleted(takerId: string, attemptId: string): Promise<void>;

  listAttempts(takerId: string): Promise<AttemptRow[]>;
  insertAttempt(row: AttemptRow): Promise<void>;
  /** Locks the row for the rest of the transaction. */
  getAttemptForUpdate(id: string): Promise<AttemptRow | null>;
  updateAttempt(row: AttemptRow): Promise<void>;

  insertResponse(row: ResponseRow): Promise<void>;
  listResponses(attemptId: string): Promise<ResponseRow[]>;

  seenItemKeys(takerId: string): Promise<Set<string>>;
  addSeen(takerId: string, itemKey: string, now: Date): Promise<void>;

  /** Latest norms version. */
  currentNorms(): Promise<NormSet>;
  /** Latest parameters per template or bank item; missing keys fall back to seed values. */
  itemParams(): Promise<Map<string, IrtParams>>;
}

export interface Store {
  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
}
