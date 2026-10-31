import { hashString } from './rng.js';
import type { ItemContent } from './types.js';

/**
 * Identifies the question a person sees, independent of seed and option order. Two seeds can
 * produce the same puzzle (easy levels have only a few hundred variants), and the same puzzle
 * with reshuffled options is still a repeat. Seen-item tracking records this as well as the key.
 *
 * Usually the stem is the question and the options are just choices. For odd-one-out items
 * the words themselves are the question, so their set (in any order) is used instead.
 */
export function contentFingerprint(content: ItemContent): string {
  const { options, ...stem } = content;
  const question =
    content.kind === 'verbal' && content.format === 'odd-one-out'
      ? { ...stem, words: [...(options as string[])].sort() }
      : stem;
  return `content:${content.kind}:${hashString(JSON.stringify(question)).toString(36)}`;
}
