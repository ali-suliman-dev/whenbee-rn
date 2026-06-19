// Regularized affine calibration of actual ≈ a + b·guess, anchored to a
// multiplicative prior. PURE TS — no RN/Expo/clock. The calibration core that
// replaces the single-scalar multiplier.
// See docs/superpowers/specs/2026-06-19-affine-calibration-design.md.
import { AFFINE_PRIOR_PSEUDO } from './constants';

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

/** Canonical guess (minutes): the representative point for scalar displays, the
 *  slope-anchor scale, and the legacy seed. */
export const CANONICAL_GUESS_MIN = 15;

/** Intercept shrink (weight units): pulls a → 0 with the strength of the prior
 *  pseudo-count, so a fixed cost only appears when varied data earns it. */
const LAMBDA_A = AFFINE_PRIOR_PSEUDO;
/** Slope anchor (minutes² units): pulls b → anchor with the strength of the
 *  prior pseudo-count evaluated at the canonical guess. */
const LAMBDA_B = AFFINE_PRIOR_PSEUDO * CANONICAL_GUESS_MIN * CANONICAL_GUESS_MIN;

export const emptyAffineStats = (): AffineStats => ({ sw: 0, swx: 0, swy: 0, swxx: 0, swxy: 0 });

/**
 * Decay existing mass by (1 − alpha), then add the new (guess, actual) point at
 * weight 1. `alpha` is the recency rate chosen by the caller (the store maps it
 * from adapt_speed; smaller = longer memory).
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
 * Closed-form ridge solve. `anchor` is the prior multiplier m0. With empty stats
 * the fit is exactly { a: 0, b: anchor }. det ≥ LAMBDA_A·LAMBDA_B > 0 for
 * non-negative stats, so the division is always safe.
 */
export const solveAffine = (s: AffineStats, anchor: number): AffineFit => {
  const A = s.sw + LAMBDA_A;
  const B = s.swx;
  const C = s.swxx + LAMBDA_B;
  const P = s.swxy + LAMBDA_B * anchor;
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
 * Seed stats that make solveAffine(seed, anchor) return EXACTLY { a: 0, b: m }
 * — used to migrate a legacy row that only stored a scalar multiplier so its
 * honest number is unchanged right after migration. The anchor MUST be the same
 * value the row will be solved with (its priorMult). Derived from the ridge
 * normal equations for a single point of weight w at the canonical guess.
 */
export const seedAffineFromMultiplier = (
  multiplier: number,
  weight: number,
  anchor: number,
): AffineStats => {
  const x0 = CANONICAL_GUESS_MIN;
  const w = Math.max(0, weight);
  const swxx = w * x0 * x0;
  return {
    sw: w,
    swx: w * x0,
    swy: w * multiplier * x0,
    swxx,
    swxy: swxx * multiplier + LAMBDA_B * (multiplier - anchor),
  };
};
