import { parseItemKey } from './itemKey';
import { MATRIX_GENERATOR_ID, MATRIX_GENERATOR_VERSION, generateMatrix } from './matrix/generate';
import type { Area, Difficulty, Item } from './types';

/**
 * Registry of item generators. Server-side only: generators know the answers, so client code
 * must never import this module (it imports render functions and content types instead).
 */
export interface Generator {
  id: string;
  version: number;
  area: Area;
  generate(seed: number, difficulty: Difficulty): Item;
}

export const GENERATORS: Record<string, Generator> = {
  [MATRIX_GENERATOR_ID]: {
    id: MATRIX_GENERATOR_ID,
    version: MATRIX_GENERATOR_VERSION,
    area: 'pattern',
    generate: generateMatrix,
  },
};

/** Rebuild a generated item from its key, or null if the key is unknown or out of date. */
export function itemFromKey(key: string): Item | null {
  const parsed = parseItemKey(key);
  if (parsed?.kind !== 'generated') return null;
  const gen = GENERATORS[parsed.generatorId];
  if (!gen || gen.version !== parsed.version) return null;
  return gen.generate(parsed.seed, parsed.difficulty);
}

export function checkAnswer(key: string, answerIndex: number | null): boolean {
  const item = itemFromKey(key);
  if (!item) throw new Error(`Unknown item key: ${key}`);
  return answerIndex !== null && answerIndex === item.answerIndex;
}
