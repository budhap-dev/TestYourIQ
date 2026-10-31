// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  BLUEPRINTS,
  selectCandidate,
  totalItems,
  totalSeconds,
  type Candidate,
  type SectionPlan,
} from '../../src/engine/assembly';
import { GENERATORS, paramKey, templateKey } from '../../src/engine/generators';
import { assessQuality, lz, type QualityResponse } from '../../src/engine/quality';
import { DIFFICULTIES, type Difficulty } from '../../src/engine/types';

const candidates: Candidate[] = DIFFICULTIES.map((d) => ({
  id: `d${d}`,
  difficulty: d,
  irt: { a: 1.2, b: d - 3 },
}));
const adultPattern = BLUEPRINTS.adult[0] as SectionPlan;
const juniorPattern = BLUEPRINTS.junior[0] as SectionPlan;

describe('blueprint', () => {
  it('gives both tracks four 8-item sections, one per area, within 25–35 minutes', () => {
    for (const track of ['adult', 'junior'] as const) {
      expect(BLUEPRINTS[track].map((s) => s.area)).toEqual([
        'pattern',
        'numerical',
        'spatial',
        'verbal',
      ]);
      expect(totalItems(track)).toBe(32);
      expect(totalSeconds(track) / 60).toBeGreaterThanOrEqual(25);
      expect(totalSeconds(track) / 60).toBeLessThanOrEqual(35);
    }
  });

  it('only names item sources that exist', () => {
    for (const s of [...BLUEPRINTS.adult, ...BLUEPRINTS.junior]) {
      for (const src of s.sources) {
        if (!src.startsWith('verbal-')) expect(GENERATORS[src]).toBeDefined();
      }
    }
  });
});

describe('adaptive selection', () => {
  it('uses the fixed opening difficulties first', () => {
    expect(selectCandidate(adultPattern, 0, [], 2.5, candidates)?.difficulty).toBe(2);
    expect(selectCandidate(adultPattern, 1, [2], 2.5, candidates)?.difficulty).toBe(3);
    expect(selectCandidate(juniorPattern, 0, [], 2.5, candidates)?.difficulty).toBe(1);
  });

  it('then picks the most informative difficulty for the current estimate', () => {
    expect(selectCandidate(adultPattern, 2, [2, 3], 2, candidates)?.difficulty).toBe(5);
    expect(selectCandidate(adultPattern, 2, [2, 3], -2, candidates)?.difficulty).toBe(1);
    expect(selectCandidate(adultPattern, 2, [2, 3], 0.1, candidates)?.difficulty).toBe(3);
  });

  it('caps repeats of one difficulty per section', () => {
    const used: Difficulty[] = [2, 3, 5, 5, 5];
    expect(selectCandidate(adultPattern, 5, used, 3, candidates)?.difficulty).toBe(4);
  });

  it('keeps junior items at difficulty 4 or below', () => {
    expect(selectCandidate(juniorPattern, 4, [1, 2], 3, candidates)?.difficulty).toBe(4);
  });

  it('returns null when nothing is left', () => {
    expect(selectCandidate(adultPattern, 3, [], 0, [])).toBeNull();
  });
});

describe('parameter keys', () => {
  it('groups generated items by template and keeps bank items separate', () => {
    expect(paramKey('gen:matrix:v1:d3:12345')).toBe('gen:matrix:v1:d3');
    expect(templateKey('series', 1, 2)).toBe('gen:series:v1:d2');
    expect(paramKey('bank:a-an-001')).toBe('bank:a-an-001');
    expect(() => paramKey('nonsense')).toThrow();
  });
});

describe('response quality', () => {
  const make = (n: number, f: (i: number) => Partial<QualityResponse>): QualityResponse[] =>
    Array.from({ length: n }, (_, i) => ({
      a: 1.2,
      b: -2 + (4 * i) / (n - 1),
      correct: true,
      answerIndex: i % 4,
      responseMs: 12000,
      presented: true,
      ...f(i),
    }));

  it('passes an ordinary attempt', () => {
    const r = make(32, (i) => ({ correct: i < 18 }));
    expect(assessQuality(r, 0.3).flags).toEqual([]);
  });

  it('flags a median under 3 seconds per item', () => {
    expect(
      assessQuality(
        make(32, () => ({ responseMs: 2000 })),
        0,
      ).flags,
    ).toContain('too_fast');
  });

  it('flags choosing the same position almost every time', () => {
    expect(
      assessQuality(
        make(32, () => ({ answerIndex: 0 })),
        0,
      ).flags,
    ).toContain('same_position');
  });

  it('flags hard items right and easy ones wrong', () => {
    const reversed = make(32, (i) => ({ correct: i >= 16 }));
    expect(lz(reversed, 0)).toBeLessThan(-2.5);
    expect(assessQuality(reversed, 0).flags).toContain('aberrant_pattern');
  });

  it('ignores items that were never shown', () => {
    const r = make(32, (i) =>
      i > 20 ? { presented: false, responseMs: null, answerIndex: null, correct: false } : {},
    );
    expect(assessQuality(r, 1).medianMs).toBe(12000);
  });
});
