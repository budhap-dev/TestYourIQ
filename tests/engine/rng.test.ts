// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createRng, isSeed } from '../../src/engine/rng';

describe('createRng', () => {
  it('is deterministic for a seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    expect(Array.from({ length: 20 }, () => a.next())).toEqual(
      Array.from({ length: 20 }, () => b.next()),
    );
  });

  it('gives unrelated streams for adjacent seeds', () => {
    expect(createRng(1).next()).not.toBeCloseTo(createRng(2).next(), 3);
  });

  it('keeps int() within bounds and covers them', () => {
    const rng = createRng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const n = rng.int(3, 6);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(6);
      seen.add(n);
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
  });

  it('shuffles into a permutation without mutating the input', () => {
    const input = [1, 2, 3, 4, 5, 6];
    const out = createRng(9).shuffle(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...out].sort()).toEqual(input);
  });

  it('validates seeds', () => {
    expect(isSeed(0)).toBe(true);
    expect(isSeed(0xffffffff)).toBe(true);
    expect(isSeed(-1)).toBe(false);
    expect(isSeed(1.5)).toBe(false);
    expect(isSeed(2 ** 32)).toBe(false);
  });
});
