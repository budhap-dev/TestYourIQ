/**
 * Two-parameter logistic (2PL) item response model and EAP ability estimation.
 *
 * P(correct | θ) = 1 / (1 + e^(−a(θ − b)))
 *
 * θ is on a standard-normal scale. EAP takes the mean of the posterior over θ (prior N(0, 1)),
 * computed by quadrature on a fine grid; the standard error is the posterior SD.
 */

export interface Response {
  a: number;
  b: number;
  /** Skipped and timed-out items count as incorrect. */
  correct: boolean;
}

export interface Estimate {
  theta: number;
  se: number;
}

export function probability(theta: number, a: number, b: number): number {
  return 1 / (1 + Math.exp(-a * (theta - b)));
}

/** Fisher information of one item at θ: a² · P · (1 − P). */
export function information(theta: number, a: number, b: number): number {
  const p = probability(theta, a, b);
  return a * a * p * (1 - p);
}

const GRID_MIN = -5;
const GRID_MAX = 5;
const GRID_STEP = 0.02;
const GRID = Array.from(
  { length: Math.round((GRID_MAX - GRID_MIN) / GRID_STEP) + 1 },
  (_, i) => GRID_MIN + i * GRID_STEP,
);

/** log P(response) without overflow, for any a(θ − b). */
function logLikelihood(theta: number, r: Response): number {
  const z = r.a * (theta - r.b);
  // log σ(z) = −log(1 + e^−z); log(1 − σ(z)) = −log(1 + e^z)
  const softplus = (x: number) => (x > 30 ? x : Math.log1p(Math.exp(x)));
  return r.correct ? -softplus(-z) : -softplus(z);
}

export function estimateAbility(
  responses: readonly Response[],
  prior = { mean: 0, sd: 1 },
): Estimate {
  const logPost = GRID.map((theta) => {
    const z = (theta - prior.mean) / prior.sd;
    return -0.5 * z * z + responses.reduce((sum, r) => sum + logLikelihood(theta, r), 0);
  });
  const max = Math.max(...logPost);
  const weights = logPost.map((lp) => Math.exp(lp - max));
  const total = weights.reduce((a, b) => a + b, 0);
  const theta = GRID.reduce((sum, t, i) => sum + t * (weights[i] as number), 0) / total;
  const variance =
    GRID.reduce((sum, t, i) => sum + (t - theta) ** 2 * (weights[i] as number), 0) / total;
  return { theta, se: Math.sqrt(variance) };
}
