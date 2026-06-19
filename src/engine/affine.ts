// Recency-weighted ridge regression of actual ≈ a + b·guess, anchored to a
// multiplicative prior. PURE TS — no RN/Expo/clock. The calibration core that
// replaces the single-scalar multiplier.
// See docs/superpowers/specs/2026-06-19-affine-calibration-design.md.
import { GLOBAL_PRIOR, RIDGE_INTERCEPT_LAMBDA, RIDGE_SLOPE_LAMBDA } from './constants';

/** Recency-weighted sufficient statistics for the affine fit. */
export interface AffineStats {
  sw: number; // Σ wᵢ
  swx: number; // Σ wᵢ·xᵢ
  swy: number; // Σ wᵢ·yᵢ
  swxx: number; // Σ wᵢ·xᵢ²
  swxy: number; // Σ wᵢ·xᵢ·yᵢ
}

/** A solved line: actual ≈ a + b·guess. */
export interface AffineFit {
  a: number;
  b: number;
}

/** The canonical guess (minutes) used as the representative point everywhere a
 *  single scalar multiplier is still needed (displays, legacy seed). */
export const CANONICAL_GUESS_MIN = 15;

export const emptyAffineStats = (): AffineStats => ({ sw: 0, swx: 0, swy: 0, swxx: 0, swxy: 0 });

/**
 * Decay existing mass by (1 − alpha), then add the new (guess, actual) point at
 * weight 1. `alpha` is the recency rate (alphaFor: adapt_speed, halved for retro).
 */
export const updateAffineStats = (
  prev: AffineStats,
  guess: number,
  actual: number,
  alpha: number,
): AffineStats => {
  const d = 1 - alpha;
  return {
    sw: d * prev.sw + 1,
    swx: d * prev.swx + guess,
    swy: d * prev.swy + actual,
    swxx: d * prev.swxx + guess * guess,
    swxy: d * prev.swxy + guess * actual,
  };
};

/**
 * Closed-form ridge solve. `anchor` is the prior multiplier m0; with empty stats
 * the fit is exactly { a: 0, b: anchor } — cold start equals today's guess×prior.
 * det ≥ λ_a·λ_b > 0 for non-negative stats, so the division is always safe.
 */
export const solveAffine = (s: AffineStats, anchor: number): AffineFit => {
  const A = s.sw + RIDGE_INTERCEPT_LAMBDA;
  const B = s.swx;
  const C = s.swxx + RIDGE_SLOPE_LAMBDA;
  const P = s.swxy + RIDGE_SLOPE_LAMBDA * anchor;
  const det = A * C - B * B;
  return {
    a: (C * s.swy - B * P) / det,
    b: (A * P - B * s.swy) / det,
  };
};

/** Exact (unrounded) honest minutes for a fit at a guess. Rounding/flooring is
 *  the caller's job (see roundHonest in multiplier.ts). */
export const affineHonestExact = (fit: AffineFit, guess: number): number => fit.a + fit.b * guess;

/**
 * Seed stats that make solveAffine return exactly { a: 0, b: multiplier } for
 * any weight w — used to migrate legacy rows that only stored a scalar. The
 * sufficient stats are set so the ridge normal equations solve to (0, multiplier)
 * when the global prior is used as the anchor.
 */
export const seedAffineFromMultiplier = (multiplier: number, weight: number): AffineStats => {
  const x0 = CANONICAL_GUESS_MIN;
  const w = Math.max(0, weight);
  const swx = w * x0;
  const swxx = w * x0 * x0;
  // swy = swx*m satisfies the intercept normal equation (a=0 ⟹ swy = swx*b = swx*m)
  const swy = swx * multiplier;
  // swxy must satisfy the slope normal equation:
  // (swxx + λ_b)*m = swxy + λ_b*anchor → swxy = swxx*m + λ_b*(m - GLOBAL_PRIOR)
  const swxy = swxx * multiplier + RIDGE_SLOPE_LAMBDA * (multiplier - GLOBAL_PRIOR);
  return { sw: w, swx, swy, swxx, swxy };
};
