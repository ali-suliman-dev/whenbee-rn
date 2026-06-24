/**
 * calibrationSeed — pure helpers for Task B2 (calibration-seeded step durations).
 *
 * When a step's category is selected, these functions derive a sensible starting
 * guess from the user's own learned data rather than the flat 15m default.
 *
 * Seeding strategy:
 *   - We target a ~15m honest number (the same as the current default honest
 *     output) and back-solve: seededGuess = round5(TARGET / mEffective).
 *   - This way the honest estimate shown for the new step stays close to 15m
 *     even for fast/slow categories, while the *guess* reflects the user's bias.
 *   - The caption shows the actual honest number for the seeded guess so the
 *     user immediately sees what Whenbee thinks the step will really take.
 *
 * Thresholds:
 *   - n >= PERSONAL_MIN_LOGS (3) → personal data is reliable enough to seed.
 *   - n < 3 → cold category; return the flat 15m default / null caption.
 *
 * Manual-edit guard: these are pure functions.  The component is responsible
 * for only applying the seeded guess when the step's guess is still at the
 * untouched default (DEFAULT_STEP_GUESS = 15).  Exported so tests can assert it.
 */

import { roundHonest, honestNumber } from '@/src/engine';
import { PERSONAL_MIN_LOGS } from '@/src/engine/constants';

/** The flat default when no calibration data is available. */
export const DEFAULT_STEP_GUESS = 15;

/** Calibration-backed typical honest target we reverse-engineer the guess from. */
const SEED_HONEST_TARGET = 15;

/**
 * A minimal subset of CachedStat used by these pure helpers so they stay
 * dependency-light (no full store import needed).
 */
export interface SeedableStat {
  mEffective: number;
  n: number;
}

/**
 * Returns the seeded guessMin for a new step in the given category.
 *
 * When the category has >= PERSONAL_MIN_LOGS learned events, returns
 * round5(SEED_HONEST_TARGET / mEffective), floored at 5.
 * Otherwise returns DEFAULT_STEP_GUESS (15).
 */
export function seedGuessForCategory(
  category: string,
  statsByCategory: Record<string, SeedableStat>,
): number {
  const stat = statsByCategory[category];
  if (!stat || stat.n < PERSONAL_MIN_LOGS) return DEFAULT_STEP_GUESS;

  const raw = SEED_HONEST_TARGET / stat.mEffective;
  return Math.max(5, roundHonest(raw));
}

/**
 * Returns a quiet caption string ("typical: Nm") for a step category that has
 * enough learned data, or null for cold categories.
 *
 * The caption shows the honest estimate for the seeded guess so the user sees
 * what Whenbee actually thinks the step will take.
 */
export function typicalCaptionForCategory(
  category: string,
  statsByCategory: Record<string, SeedableStat>,
): string | null {
  const stat = statsByCategory[category];
  if (!stat || stat.n < PERSONAL_MIN_LOGS) return null;

  const guess = seedGuessForCategory(category, statsByCategory);
  const honest = honestNumber(guess, stat.mEffective);
  return `typical: ${honest}m`;
}
