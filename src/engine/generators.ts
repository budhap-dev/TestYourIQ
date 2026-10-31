import { parseItemKey } from './itemKey.js';
import {
  MATRIX_GENERATOR_ID,
  MATRIX_GENERATOR_VERSION,
  MATRIX_LEVELS,
  generateMatrix,
} from './matrix/generate.js';
import {
  NUMBER_ANALOGY_GENERATOR_ID,
  NUMBER_ANALOGY_GENERATOR_VERSION,
  NUMBER_ANALOGY_LEVELS,
  generateNumberAnalogy,
} from './numeric/analogy.js';
import {
  SERIES_GENERATOR_ID,
  SERIES_GENERATOR_VERSION,
  SERIES_LEVELS,
  generateSeries,
} from './numeric/series.js';
import {
  MIRROR_GENERATOR_ID,
  ROTATION_GENERATOR_ID,
  SPATIAL_GENERATOR_VERSION,
  SPATIAL_LEVELS,
  generateMirror,
  generateRotation,
} from './spatial/generate.js';
import type { Area, Difficulty, IrtParams, Item } from './types.js';
import { verbalItem } from './verbal/bank.js';

/**
 * Registry of item generators and the verbal bank. Server-side only: this module knows the
 * answers, so client code must never import it (it imports render functions and content types).
 */
export interface Generator {
  id: string;
  version: number;
  area: Area;
  generate(seed: number, difficulty: Difficulty): Item;
  /** Seed IRT parameters for this generator at each difficulty. */
  levels: Record<Difficulty, { irt: IrtParams }>;
}

const list: Generator[] = [
  {
    id: MATRIX_GENERATOR_ID,
    version: MATRIX_GENERATOR_VERSION,
    area: 'pattern',
    generate: generateMatrix,
    levels: MATRIX_LEVELS,
  },
  {
    id: SERIES_GENERATOR_ID,
    version: SERIES_GENERATOR_VERSION,
    area: 'numerical',
    generate: generateSeries,
    levels: SERIES_LEVELS,
  },
  {
    id: NUMBER_ANALOGY_GENERATOR_ID,
    version: NUMBER_ANALOGY_GENERATOR_VERSION,
    area: 'numerical',
    generate: generateNumberAnalogy,
    levels: NUMBER_ANALOGY_LEVELS,
  },
  {
    id: ROTATION_GENERATOR_ID,
    version: SPATIAL_GENERATOR_VERSION,
    area: 'spatial',
    generate: generateRotation,
    levels: SPATIAL_LEVELS,
  },
  {
    id: MIRROR_GENERATOR_ID,
    version: SPATIAL_GENERATOR_VERSION,
    area: 'spatial',
    generate: generateMirror,
    levels: SPATIAL_LEVELS,
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

/**
 * IRT parameters are stored per template: one row per generator, version and difficulty
 * (`gen:matrix:v1:d3`), and one per bank item (`bank:a-an-001`).
 */
export function paramKey(itemKey: string): string {
  const parsed = parseItemKey(itemKey);
  if (!parsed) throw new Error(`Unknown item key: ${itemKey}`);
  return parsed.kind === 'bank'
    ? itemKey
    : templateKey(parsed.generatorId, parsed.version, parsed.difficulty);
}

export const templateKey = (generatorId: string, version: number, difficulty: Difficulty) =>
  `gen:${generatorId}:v${version}:d${difficulty}`;
