// Calibration Confidence (Earned-Readiness). PURE TS — no RN/Expo/clock.
// A readiness axis SEPARATE from the monotonic honey Tier: it is derived from
// sample size + coefficient of variation of clamped ratios, and (unlike Tier)
// may move in either direction as the spread of the data changes.
import {
  BLEND_PSEUDO_COUNT,
  CONFIDENCE_SETTING_MIN_LOGS,
  CONFIDENCE_HONEST_MIN_LOGS,
  CONFIDENCE_HONEST_MAX_CV,
  PRIOR_BAND_HALF_WIDTH,
  QUANTILE_MIN_N,
  RANGE_MIN_HALF_WIDTH,
  RANGE_MAX_HALF_WIDTH,
} from './constants';
import type { CalibrationConfidence, HonestRange } from '../domain/types';

interface ConfidenceInput {
  n: number;
  clampedRatios: number[];
}

function coefficientOfVariation(ratios: number[]): number {
  if (ratios.length < 2) return 0;
  const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  if (mean === 0) return 0;
  const variance = ratios.reduce((sum, r) => sum + (r - mean) ** 2, 0) / ratios.length;
  return Math.sqrt(variance) / mean;
}

export function confidenceFor({ n, clampedRatios }: ConfidenceInput): CalibrationConfidence {
  if (n < CONFIDENCE_SETTING_MIN_LOGS) return 'raw';
  const settled = coefficientOfVariation(clampedRatios) <= CONFIDENCE_HONEST_MAX_CV;
  if (n >= CONFIDENCE_HONEST_MIN_LOGS && settled) return 'honest';
  return 'setting';
}

/**
 * Type-7 (R default) linear-interpolated quantile of an ASCENDING-sorted array.
 * `q` in [0,1]. Empty array returns 0; a single value returns that value.
 */
export function quantile(sorted: number[], q: number): number {
  const len = sorted.length;
  if (len === 0) return 0;
  if (len === 1) return sorted[0] as number;
  const pos = (len - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const frac = pos - lo;
  const a = sorted[lo] as number;
  const b = sorted[hi] as number;
  return a + (b - a) * frac;
}

interface RangeInput {
  honestMinutes: number;
  /** The current guess — the band is a percentile of ratios applied to THIS guess. */
  guessMinutes: number;
  clampedRatios: number[];
  /** Category prior multiplier — present for the contract; the low-n band uses a
   *  fixed log-space prior half-width (the prior multiplier shifts the point, not
   *  the spread). Kept in the signature so callers always pass the category prior. */
  prior: number;
}

function floor5(min: number): number {
  return Math.max(5, Math.floor(min / 5) * 5);
}

function ceil5(min: number): number {
  return Math.max(5, Math.ceil(min / 5) * 5);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * The honest band as the P25–P75 of the user's OWN log-ratio distribution,
 * applied to the live guess. Working in log space keeps the band multiplicative
 * and symmetric in ratio terms (a task is as likely to run 1.5× as 0.67×).
 *
 * - n ≥ QUANTILE_MIN_N: pure empirical P25–P75.
 * - 1 ≤ n < QUANTILE_MIN_N: empirical half-width blended toward the prior band by
 *   a pseudo-count, so a fresh category never shows a falsely tight band.
 * - n = 0: the prior band only.
 *
 * The final half-width is floored/ceiled so the band is never absurdly tight
 * (false precision) nor absurdly wide (useless), and the result is bracketed so
 * it always contains the honest point number.
 */
export function honestRangeFor({ honestMinutes, guessMinutes, clampedRatios }: RangeInput): HonestRange {
  const logs = clampedRatios.map(Math.log).sort((a, b) => a - b);
  const n = logs.length;

  // Empirical band center + half-width in log space (P25–P75). With no data the
  // band centers on the guess (centerL = 0) so the prior noise sits symmetrically
  // around guess·1.
  const p25 = quantile(logs, 0.25);
  const p75 = quantile(logs, 0.75);
  const centerL = n === 0 ? 0 : (p25 + p75) / 2;
  const empiricalHalfWidthL = n === 0 ? 0 : (p75 - p25) / 2;

  // Blend the empirical half-width toward the prior band until there is enough
  // data. At n = 0 this is purely the prior; at n ≥ QUANTILE_MIN_N it is purely
  // empirical.
  const k = BLEND_PSEUDO_COUNT;
  const blendedHalfWidthL =
    n >= QUANTILE_MIN_N
      ? empiricalHalfWidthL
      : (n * empiricalHalfWidthL + k * PRIOR_BAND_HALF_WIDTH) / (n + k);

  const halfWidthL = clamp(blendedHalfWidthL, RANGE_MIN_HALF_WIDTH, RANGE_MAX_HALF_WIDTH);

  // The band's central minutes. With data it is the guess scaled by the empirical
  // log-center (≈ the honest number); with no data it centers on the honest number
  // itself (which already folds in the category prior).
  const baseMinutes = n === 0 ? honestMinutes : guessMinutes * Math.exp(centerL);
  const low = baseMinutes * Math.exp(-halfWidthL);
  const high = baseMinutes * Math.exp(halfWidthL);

  // Bracket the honest point so the band always contains it — the EWMA point can
  // sit just outside the raw percentile band.
  const lowMinutes = Math.min(floor5(honestMinutes), floor5(low));
  const highMinutes = Math.max(ceil5(honestMinutes), ceil5(high));
  return { lowMinutes, highMinutes };
}

export function reservePriceVisible(confidence: CalibrationConfidence): boolean {
  return confidence !== 'honest';
}
