/** Fallback spacings: common slips such as off by ten. */
const GENERIC_SPACINGS = [10, 5, 3, 4, 6, 7, 8, 9, 12, 15, 20, 25];

/**
 * Choose number options as an evenly spaced run, `answer + (i − rank) × spacing`. Callers draw
 * the rank uniformly, once per item, so retries can't skew it. Every option then has the same neighbours, so neither
 * "pick the middle one" nor "pick the one closest to the others" beats chance. Spacings are
 * tried in order: each family offers ones that match a likely mistake (one step too many or
 * too few), and generic slips are the fallback. Returns null if nothing fits.
 */
export function pickSpacedOptions(
  answer: number,
  spacings: number[],
  count: number,
  rank: number,
  forbidden: ReadonlySet<number>,
): { options: number[]; answerIndex: number } | null {
  // Keep every option as "round" as the answer, so picking the roundest number doesn't help.
  const roundTo = answer % 10 === 0 ? 10 : answer % 5 === 0 ? 5 : 1;
  for (const raw of [...spacings, ...GENERIC_SPACINGS]) {
    if (!Number.isInteger(raw) || raw <= 0) continue;
    const g = Math.ceil(raw / roundTo) * roundTo;
    const options = Array.from({ length: count }, (_, i) => answer + (i - rank) * g);
    const valid = options.every((v) => v > 0 && v <= 9999 && (v === answer || !forbidden.has(v)));
    if (valid) return { options, answerIndex: rank };
  }
  return null;
}
