export type Area = 'pattern' | 'numerical' | 'spatial' | 'verbal';

/** Difficulty bands, 1 (easiest) to 5 (hardest). */
export type Difficulty = 1 | 2 | 3 | 4 | 5;
export const DIFFICULTIES: readonly Difficulty[] = [1, 2, 3, 4, 5];

export function isDifficulty(value: unknown): value is Difficulty {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

/** 2-parameter logistic IRT parameters: discrimination `a`, difficulty `b`. */
export interface IrtParams {
  a: number;
  b: number;
}

/**
 * A complete item, including its answer. Server-side only: send `toPublicItem(item)` to clients.
 * `content` must contain everything the client needs to display the item and nothing more.
 */
export interface Item<Content = unknown> {
  key: string;
  area: Area;
  difficulty: Difficulty;
  content: Content;
  optionCount: number;
  answerIndex: number;
  /** Seed IRT parameters, before calibration from real responses. */
  irt: IrtParams;
  /** Human-readable description of the rules, for review and debugging. Never sent to clients. */
  explanation: string;
}

export interface PublicItem<Content = unknown> {
  area: Area;
  content: Content;
  optionCount: number;
}

/** Strip everything that could reveal the answer or let a client regenerate the item. */
export function toPublicItem<C>(item: Item<C>): PublicItem<C> {
  return { area: item.area, content: item.content, optionCount: item.optionCount };
}
