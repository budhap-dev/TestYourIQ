import type { ItemContent } from '../../engine/types';

/**
 * Two fixed practice questions for the setup screen. They're written by hand (not produced by
 * the generators), are never part of a real test, and their answers live in the client only
 * because they're untimed demonstrations with feedback.
 */
export interface PracticeItem {
  content: ItemContent;
  answer: number;
  explain: string;
}

const circle = (count: number) =>
  ({ shape: 'circle', count, shading: 'outline', size: 'medium', rotation: 0 }) as const;

export const PRACTICE: PracticeItem[] = [
  {
    content: {
      kind: 'matrix',
      cells: [
        circle(1),
        circle(2),
        circle(3),
        circle(1),
        circle(2),
        circle(3),
        circle(1),
        circle(2),
        null,
      ],
      options: [circle(4), circle(3), circle(2), { ...circle(3), shading: 'solid' }],
    },
    answer: 1,
    explain: 'Each row goes 1, 2, 3 outlined circles, so the gap needs 3 outlined circles.',
  },
  {
    content: { kind: 'series', terms: [3, 7, 11, 15, 19, 23], options: [25, 26, 27, 29] },
    answer: 2,
    explain: 'Each number is 4 more than the one before, so 23 + 4 = 27.',
  },
];
