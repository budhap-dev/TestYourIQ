/** Public content of verbal items. */
export type VerbalContent =
  | {
      kind: 'verbal';
      format: 'analogy';
      /** "a is to b as c is to …" */
      stem: [string, string, string];
      options: string[];
    }
  | {
      kind: 'verbal';
      format: 'odd-one-out';
      options: string[];
    };

export type { Track } from '../types.js';
