import { parseItemKey } from './itemKey';
import { MATRIX_GENERATOR_ID, MATRIX_GENERATOR_VERSION, generateMatrix } from './matrix/generate';
import {
  NUMBER_ANALOGY_GENERATOR_ID,
  NUMBER_ANALOGY_GENERATOR_VERSION,
  generateNumberAnalogy,
} from './numeric/analogy';
import { SERIES_GENERATOR_ID, SERIES_GENERATOR_VERSION, generateSeries } from './numeric/series';
import {
  MIRROR_GENERATOR_ID,
  ROTATION_GENERATOR_ID,
  SPATIAL_GENERATOR_VERSION,
  generateMirror,
  generateRotation,
} from './spatial/generate';
import type { Area, Difficulty, Item } from './types';
import { verbalItem } from './verbal/bank';

/**
 * Registry of item generators and the verbal bank. Server-side only: this module knows the
 * answers, so client code must never import it (it imports render functions and content types).
 */
export interface Generator {
  id: string;
  version: number;
  area: Area;
  generate(seed: number, difficulty: Difficulty): Item;
}

const list: Generator[] = [
  {
    id: MATRIX_GENERATOR_ID,
    version: MATRIX_GENERATOR_VERSION,
    area: 'pattern',
    generate: generateMatrix,
  },
  {
    id: SERIES_GENERATOR_ID,
    version: SERIES_GENERATOR_VERSION,
    area: 'numerical',
    generate: generateSeries,
  },
  {
    id: NUMBER_ANALOGY_GENERATOR_ID,
    version: NUMBER_ANALOGY_GENERATOR_VERSION,
    area: 'numerical',
    generate: generateNumberAnalogy,
  },
  {
    id: ROTATION_GENERATOR_ID,
    version: SPATIAL_GENERATOR_VERSION,
    area: 'spatial',
    generate: generateRotation,
  },
  {
    id: MIRROR_GENERATOR_ID,
    version: SPATIAL_GENERATOR_VERSION,
    area: 'spatial',
    generate: generateMirror,
  },
];

export const GENERATORS: Record<string, Generator> = Object.fromEntries(list.map((g) => [g.id, g]));

/** Rebuild an item from its key, or null if the key is unknown or out of date. */
export function itemFromKey(key: string): Item | null {
  const parsed = parseItemKey(key);
  if (!parsed) return null;
  if (parsed.kind === 'bank') return verbalItem(parsed.itemId);
  const gen = GENERATORS[parsed.generatorId];
  if (!gen || gen.version !== parsed.version) return null;
  return gen.generate(parsed.seed, parsed.difficulty);
}

export function checkAnswer(key: string, answerIndex: number | null): boolean {
  const item = itemFromKey(key);
  if (!item) throw new Error(`Unknown item key: ${key}`);
  return answerIndex !== null && answerIndex === item.answerIndex;
}
