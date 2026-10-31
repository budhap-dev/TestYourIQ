import { isSeed } from './rng.js';
import { isDifficulty, type Difficulty } from './types.js';

/**
 * Item keys identify an item for seen-item tracking and answer checking.
 *   generated: `gen:<generatorId>:v<version>:d<difficulty>:<seed>`
 *   bank:      `bank:<itemId>`
 * The generator version is part of the key so a changed generator never reinterprets old keys.
 */

export type ParsedItemKey =
  | {
      kind: 'generated';
      generatorId: string;
      version: number;
      difficulty: Difficulty;
      seed: number;
    }
  | { kind: 'bank'; itemId: string };

const GENERATED = /^gen:([a-z][a-z0-9-]*):v(\d+):d(\d):(\d+)$/;
const BANK = /^bank:([a-z0-9][a-z0-9_-]*)$/;

export function generatedKey(
  generatorId: string,
  version: number,
  difficulty: Difficulty,
  seed: number,
): string {
  return `gen:${generatorId}:v${version}:d${difficulty}:${seed}`;
}

export function bankKey(itemId: string): string {
  return `bank:${itemId}`;
}

export function parseItemKey(key: string): ParsedItemKey | null {
  const g = GENERATED.exec(key);
  if (g) {
    const [, generatorId, version, difficulty, seed] = g;
    const d = Number(difficulty);
    const s = Number(seed);
    if (!generatorId || !isDifficulty(d) || !isSeed(s)) return null;
    return { kind: 'generated', generatorId, version: Number(version), difficulty: d, seed: s };
  }
  const b = BANK.exec(key);
  if (b?.[1]) return { kind: 'bank', itemId: b[1] };
  return null;
}
