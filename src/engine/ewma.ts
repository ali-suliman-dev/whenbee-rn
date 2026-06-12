import { ALPHA_BY_SPEED, RETRO_ALPHA_FACTOR } from './constants';
import type { AdaptSpeed, LogSource } from '../domain/types';

/** Effective α: base rate for the category's adapt_speed, halved for retro entries. */
export function alphaFor(speed: AdaptSpeed, source: LogSource): number {
  const base = ALPHA_BY_SPEED[speed];
  return source === 'retro' ? base * RETRO_ALPHA_FACTOR : base;
}

/**
 * One incremental EWMA step over ln(ratio).
 *   next = α·ln(r) + (1-α)·prev
 * With n=0 the caller passes prevEwma=0, so the first step seeds at α·ln(r1);
 * the prior still dominates M because blend uses k pseudo-counts (see multiplier.ts).
 */
export function updateEwma(prevEwma: number, clampedRatio: number, alpha: number): number {
  return alpha * Math.log(clampedRatio) + (1 - alpha) * prevEwma;
}
