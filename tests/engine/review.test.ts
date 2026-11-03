// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { GENERATORS } from '../../src/engine/generators';
import type { MatrixContent } from '../../src/engine/matrix/model';
import { describeCell } from '../../src/engine/matrix/render';
import { whyWrong } from '../../src/engine/review';
import type { SpatialContent } from '../../src/engine/spatial/model';
import { DIFFICULTIES, type Item } from '../../src/engine/types';
import { VERBAL_BANK, verbalItem } from '../../src/engine/verbal/bank';

const SEEDS = Array.from({ length: 60 }, (_, i) => i * 7919 + 3);
const all = (id: string) =>
  DIFFICULTIES.flatMap((d) => SEEDS.map((s) => GENERATORS[id]?.generate(s, d) as Item));

describe('solutions', () => {
  it.each(Object.keys(GENERATORS))('%s: every item has a readable solution', (id) => {
    for (const item of all(id)) {
      expect(item.solution.length).toBeGreaterThan(20);
      expect(item.solution).not.toMatch(/undefined|NaN|null|\[object/);
      expect(item.solution).toMatch(/\.$/);
    }
  });

  it.each(['series', 'number-analogy'])('%s: the working ends in the right answer', (id) => {
    for (const item of all(id)) {
      const c = item.content as { options: number[] };
      expect(item.solution.endsWith(`= ${c.options[item.answerIndex]}.`)).toBe(true);
    }
  });

  it('matrix: names the right answer as it is described to screen readers', () => {
    for (const item of all('matrix')) {
      const answer = (item.content as MatrixContent).options[item.answerIndex];
      if (!answer) throw new Error('no answer');
      expect(item.solution.endsWith(`So the answer is ${describeCell(answer)}.`)).toBe(true);
    }
  });

  it('verbal: every bank item has a solution naming its answer', () => {
    for (const entry of [...VERBAL_BANK.adult, ...VERBAL_BANK.junior]) {
      expect(verbalItem(entry.id)?.solution).toContain(entry.answer);
    }
  });
});

describe('why a choice is wrong', () => {
  it('says nothing for the right answer or no answer', () => {
    for (const id of Object.keys(GENERATORS)) {
      const item = GENERATORS[id]?.generate(5, 3) as Item;
      expect(whyWrong(item, item.answerIndex)).toBeNull();
      expect(whyWrong(item, null)).toBeNull();
    }
  });

  it('matrix: names the attributes that differ from the answer', () => {
    for (const item of all('matrix')) {
      const c = item.content as MatrixContent;
      const answer = c.options[item.answerIndex];
      c.options.forEach((o, i) => {
        if (i === item.answerIndex || !answer) return;
        const note = whyWrong(item, i) ?? '';
        expect(note).toMatch(/^Your choice has the wrong /);
        if (o.shading !== answer.shading) expect(note).toContain('shading');
        if (o.size !== answer.size) expect(note).toContain('size');
        if (o.count !== answer.count) expect(note).toContain('number of shapes');
      });
    }
  });

  it.each([
    ['rotation', 'mirror image'],
    ['mirror', 'only turned'],
  ])('%s: exactly one wrong option is the tempting %s', (id, phrase) => {
    for (const item of all(id)) {
      const c = item.content as SpatialContent;
      const notes = c.options.map((_, i) => whyWrong(item, i));
      expect(notes.filter((n) => n?.includes(phrase))).toHaveLength(1);
      expect(notes.filter((n) => n === null)).toHaveLength(1);
    }
  });
});
