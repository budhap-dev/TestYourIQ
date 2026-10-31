// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { checkAnswer, itemFromKey } from '../../src/engine/generators';
import { VERBAL_BANK, verbalItem } from '../../src/engine/verbal/bank';

describe.each([
  ['adult', 150, 5],
  ['junior', 80, 4],
] as const)('%s verbal bank', (track, minItems, maxDifficulty) => {
  const bank = VERBAL_BANK[track];
  const items = bank.map((e) => verbalItem(e.id));

  it(`has at least ${minItems} valid items`, () => {
    expect(bank.length).toBeGreaterThanOrEqual(minItems);
    for (const item of items) expect(item).not.toBeNull();
  });

  it('uses the right id prefix for the track', () => {
    for (const e of bank) expect(e.id.startsWith(track === 'adult' ? 'a-' : 'j-')).toBe(true);
  });

  it('covers difficulties 1 to ' + maxDifficulty, () => {
    const levels = new Set(bank.map((e) => e.difficulty));
    for (let d = 1; d <= maxDifficulty; d++) expect(levels.has(d)).toBe(true);
  });

  it('has a mix of analogies and odd-one-out items', () => {
    const analogies = bank.filter((e) => e.type === 'analogy').length;
    expect(analogies / bank.length).toBeGreaterThan(0.4);
    expect(analogies / bank.length).toBeLessThan(0.7);
  });

  it('never repeats a stem word among the options', () => {
    for (const e of bank) {
      if (e.type !== 'analogy') continue;
      const stem = e.stem.map((w) => w.toLowerCase());
      for (const o of [e.answer, ...e.distractors])
        expect(stem, e.id).not.toContain(o.toLowerCase());
    }
  });

  it('places the answer at every position fairly often', () => {
    for (const [size, list] of [
      [4, items.filter((i) => i?.optionCount === 4)],
      [5, items.filter((i) => i?.optionCount === 5)],
    ] as const) {
      const counts = new Array<number>(size).fill(0);
      for (const i of list) counts[i?.answerIndex ?? 0] = (counts[i?.answerIndex ?? 0] ?? 0) + 1;
      for (const c of counts) expect(c).toBeGreaterThan((list.length / size) * 0.4);
    }
  });

  it('checks answers through the bank key', () => {
    for (const item of items.slice(0, 20)) {
      if (!item) continue;
      expect(itemFromKey(item.key)).toEqual(item);
      expect(checkAnswer(item.key, item.answerIndex)).toBe(true);
      expect(checkAnswer(item.key, (item.answerIndex + 1) % item.optionCount)).toBe(false);
    }
  });
});

it('rejects unknown bank ids', () => {
  expect(verbalItem('a-an-999')).toBeNull();
  expect(itemFromKey('bank:nope')).toBeNull();
});
