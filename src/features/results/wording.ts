import type { IqResult } from '../../engine/scoring';

/** "people aged 25–34", "people aged 10", "people aged 75 and over". */
export const peopleAged = (ageBand: string) => `people aged ${ageBand.replace(/^age /, '')}`;

export function rangeText(score: Pick<IqResult, 'low' | 'high'>): string {
  if (score.low === score.high) return `likely around ${score.low}`;
  return `likely between ${score.low} and ${score.high}`;
}

export function percentileText(score: Pick<IqResult, 'percentile'>, ageBand: string): string {
  const who = peopleAged(ageBand);
  if (score.percentile >= 99.5) return `Higher than more than 99% of ${who}.`;
  if (score.percentile < 0.5) return `Lower than most ${who}: around the lowest 1%.`;
  return `Higher than about ${Math.round(score.percentile)}% of ${who}.`;
}
