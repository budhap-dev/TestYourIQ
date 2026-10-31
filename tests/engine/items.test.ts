// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { checkAnswer, itemFromKey } from '../../src/engine/generators';
import { bankKey, generatedKey, parseItemKey } from '../../src/engine/itemKey';
import { generateMatrix } from '../../src/engine/matrix/generate';
import { toPublicItem } from '../../src/engine/types';

describe('item keys', () => {
  it('round-trips generated and bank keys', () => {
    expect(parseItemKey(generatedKey('matrix', 1, 3, 123456))).toEqual({
      kind: 'generated',
      generatorId: 'matrix',
      version: 1,
      difficulty: 3,
      seed: 123456,
    });
    expect(parseItemKey(bankKey('adult-analogy-017'))).toEqual({
      kind: 'bank',
      itemId: 'adult-analogy-017',
    });
  });

  it.each([
    'gen:matrix:v1:d9:1',
    'gen:matrix:v1:d3:-1',
    'gen:matrix:v1:d3:99999999999',
    'gen:Matrix:v1:d3:1',
    'bank:',
    'nonsense',
  ])('rejects %s', (key) => {
    expect(parseItemKey(key)).toBeNull();
  });
});

describe('answer checking', () => {
  const item = generateMatrix(2024, 3);

  it('rebuilds the same item from its key', () => {
    expect(itemFromKey(item.key)).toEqual(item);
  });

  it('accepts only the correct option; a skip is wrong', () => {
    for (let i = 0; i < item.optionCount; i++) {
      expect(checkAnswer(item.key, i)).toBe(i === item.answerIndex);
    }
    expect(checkAnswer(item.key, null)).toBe(false);
  });

  it('refuses keys from unknown generators or versions', () => {
    expect(itemFromKey('gen:matrix:v99:d3:1')).toBeNull();
    expect(itemFromKey('gen:nope:v1:d3:1')).toBeNull();
    expect(() => checkAnswer('gen:nope:v1:d3:1', 0)).toThrow();
  });
});

describe('public items', () => {
  it('carry no answer, key, seed, rules or IRT parameters', () => {
    const item = generateMatrix(77, 5);
    const pub = toPublicItem(item);
    expect(Object.keys(pub).sort()).toEqual(['area', 'content', 'optionCount']);
    const json = JSON.stringify(pub);
    for (const secret of [
      'answer',
      'key',
      'seed',
      'explanation',
      'irt',
      'progression',
      'distribute',
    ]) {
      expect(json).not.toContain(secret);
    }
  });
});
