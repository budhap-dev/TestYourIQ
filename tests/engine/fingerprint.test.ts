// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { contentFingerprint } from '../../src/engine/fingerprint';
import { GENERATORS } from '../../src/engine/generators';
import type { ItemContent } from '../../src/engine/types';

describe('content fingerprints', () => {
  const series: ItemContent = {
    kind: 'series',
    terms: [1, 3, 5, 7, 9, 11],
    options: [13, 15, 17, 19],
  };

  it('ignore option order, so a reshuffled puzzle is still a repeat', () => {
    expect(contentFingerprint(series)).toBe(
      contentFingerprint({ ...series, options: [19, 17, 15, 13] }),
    );
  });

  it('differ when the question differs', () => {
    expect(contentFingerprint(series)).not.toBe(
      contentFingerprint({ ...series, terms: [1, 3, 5, 7, 9, 12] }),
    );
  });

  it('treat the words of an odd-one-out item as the question', () => {
    const odd = (words: string[]): ItemContent => ({
      kind: 'verbal',
      format: 'odd-one-out',
      options: words,
    });
    expect(contentFingerprint(odd(['a', 'b', 'c', 'd', 'e']))).toBe(
      contentFingerprint(odd(['e', 'd', 'c', 'b', 'a'])),
    );
    expect(contentFingerprint(odd(['a', 'b', 'c', 'd', 'e']))).not.toBe(
      contentFingerprint(odd(['a', 'b', 'c', 'd', 'f'])),
    );
  });

  it('catch different seeds that produce the same easy puzzle', () => {
    // Level-1 number series have only a few hundred variants, so seeds collide on content.
    const prints = new Map<string, number>();
    let collisions = 0;
    for (let seed = 0; seed < 3000; seed++) {
      const fp = contentFingerprint(
        (GENERATORS.series?.generate(seed, 1) as { content: ItemContent }).content,
      );
      if (prints.has(fp)) collisions++;
      prints.set(fp, seed);
    }
    expect(collisions).toBeGreaterThan(0);
  });
});
