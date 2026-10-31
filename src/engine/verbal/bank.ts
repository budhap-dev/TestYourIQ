import { z } from 'zod';
import { createRng, hashString } from '../rng';
import type { Difficulty, Item } from '../types';
import adultBank from './bank.adult.json';
import juniorBank from './bank.junior.json';
import type { Track, VerbalContent } from './model';

/**
 * Hand-written verbal items. Each bank file is validated when this module loads. Options are
 * shuffled in a fixed order derived from the item id, so answer positions are spread evenly
 * without editing the files by hand.
 */

const Word = z.string().trim().min(1).max(40);
const Base = {
  id: z.string().regex(/^[aj]-(an|oo)-\d{3}$/),
  difficulty: z.number().int().min(1).max(5),
};

const BankEntry = z.discriminatedUnion('type', [
  z.object({
    ...Base,
    type: z.literal('analogy'),
    stem: z.tuple([Word, Word, Word]),
    answer: Word,
    distractors: z.array(Word).length(3),
  }),
  z.object({
    ...Base,
    type: z.literal('odd-one-out'),
    answer: Word,
    others: z.array(Word).length(4),
    reason: z.string().min(1),
  }),
]);

export type BankEntry = z.infer<typeof BankEntry>;

const Bank = z.array(BankEntry).superRefine((items, ctx) => {
  const ids = new Set<string>();
  items.forEach((item, i) => {
    if (ids.has(item.id))
      ctx.addIssue({ code: 'custom', path: [i, 'id'], message: 'duplicate id' });
    ids.add(item.id);
    const words = [item.answer, ...(item.type === 'analogy' ? item.distractors : item.others)];
    if (new Set(words.map((w) => w.toLowerCase())).size !== words.length) {
      ctx.addIssue({ code: 'custom', path: [i], message: 'duplicate option' });
    }
  });
});

export const VERBAL_BANK: Record<Track, BankEntry[]> = {
  adult: Bank.parse(adultBank),
  junior: Bank.parse(juniorBank),
};

const BY_ID = new Map(
  [...VERBAL_BANK.adult, ...VERBAL_BANK.junior].map((entry) => [entry.id, entry] as const),
);

export const trackOf = (id: string): Track => (id.startsWith('j-') ? 'junior' : 'adult');

export function verbalItem(id: string): Item<VerbalContent> | null {
  const entry = BY_ID.get(id);
  if (!entry) return null;

  const wrong = entry.type === 'analogy' ? entry.distractors : entry.others;
  const options = createRng(hashString(id)).shuffle([entry.answer, ...wrong]);
  const content: VerbalContent =
    entry.type === 'analogy'
      ? { kind: 'verbal', format: 'analogy', stem: entry.stem, options }
      : { kind: 'verbal', format: 'odd-one-out', options };

  return {
    key: `bank:${id}`,
    area: 'verbal',
    difficulty: entry.difficulty as Difficulty,
    content,
    optionCount: options.length,
    answerIndex: options.indexOf(entry.answer),
    irt: { a: 1.0, b: entry.difficulty - 3 },
    explanation:
      entry.type === 'analogy'
        ? `${entry.stem[0]} : ${entry.stem[1]} :: ${entry.stem[2]} : ${entry.answer}`
        : `${entry.answer}: ${entry.reason}`,
  };
}
