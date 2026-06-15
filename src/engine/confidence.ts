// Calibration Confidence (Earned-Readiness). PURE TS — no RN/Expo/clock.
// A readiness axis SEPARATE from the monotonic honey Tier: it is derived from
// sample size + coefficient of variation of clamped ratios, and (unlike Tier)
// may move in either direction as the spread of the data changes.
import {
  CONFIDENCE_SETTING_MIN_LOGS,
  CONFIDENCE_HONEST_MIN_LOGS,
  CONFIDENCE_HONEST_MAX_CV,
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

interface RangeInput {
  honestMinutes: number;
  clampedRatios: number[];
}

function round5(min: number): number {
  return Math.max(5, Math.round(min / 5) * 5);
}

export function honestRangeFor({ honestMinutes, clampedRatios }: RangeInput): HonestRange {
  const cv = coefficientOfVariation(clampedRatios);
  const halfWidth = Math.min(RANGE_MAX_HALF_WIDTH, Math.max(RANGE_MIN_HALF_WIDTH, cv));
  const low = round5(Math.min(honestMinutes, honestMinutes * (1 - halfWidth)));
  const high = round5(Math.max(honestMinutes, honestMinutes * (1 + halfWidth)));
  return { lowMinutes: low, highMinutes: high };
}

export function reservePriceVisible(confidence: CalibrationConfidence): boolean {
  return confidence !== 'honest';
}
