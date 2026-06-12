import { clampRatio } from './ratio';
import { alphaFor, updateEwma } from './ewma';
import { blendWithPrior, honestNumber } from './multiplier';
import { reclaimDividendMinutes } from './reclaim';
import { sharpnessFromWindow } from './sharpness';
import type { AdaptSpeed, CategoryStats, LogSource, LogStatus } from '../domain/types';

interface RollingStat {
  n: number;
  logEwma: number;
  mEffective: number;
}

export interface ApplyLogInput {
  estimateMin: number;
  actualMin: number;
  status: LogStatus;
  source: LogSource;
  adaptSpeed: AdaptSpeed;
  prior: number;
  category: RollingStat & { sharpness: number; reclaimedMinutes: number };
  recurring: RollingStat | null;
  /** last SHARPNESS_WINDOW clamped ratios for this category, newest last, BEFORE this log */
  recentClampedRatios: number[];
  /** honest number shown to the user at plan-time; null falls back to honestNumber(estimate, M_before) */
  suggestedHonestMin: number | null;
}

export interface ApplyLogResult {
  ratioClamped: number; // frozen onto the log row
  counted: boolean; // false for abandoned/partial — log stored, model untouched
  category: CategoryStats;
  recurring: RollingStat | null;
  sharpnessDelta: number;
  reclaimDeltaMin: number; // minutes saved vs naive guess; 0 when not counted
}

/**
 * Update order — do not reorder:
 *   1. abandoned (and partial unless 'done enough') → store log, return counted:false.
 *   2. r = clampRatio(estimate, actual).
 *   3. α = alphaFor(adaptSpeed, source).
 *   4. category.logEwma = updateEwma(...); category.n += 1.
 *   5. category.mEffective = blendWithPrior(n, logEwma, prior).
 *   6. if recurring: same EWMA+blend against the SAME prior (its category's).
 *   7. sharpness = max(prev, sharpnessFromWindow(window ++ r))  // monotonic guard.
 */
export function applyLog(input: ApplyLogInput): ApplyLogResult {
  const ratioClamped = clampRatio(input.estimateMin, input.actualMin);

  // Step 1: only 'completed' (or partial marked done-enough, normalized to 'completed'
  // by the caller) trains the model. Abandoned is self-awareness data only.
  if (input.status !== 'completed') {
    return {
      ratioClamped,
      counted: false,
      category: { ...input.category, categoryId: '' } as CategoryStats,
      recurring: input.recurring,
      sharpnessDelta: 0,
      reclaimDeltaMin: 0,
    };
  }

  const alpha = alphaFor(input.adaptSpeed, input.source);

  const catEwma = updateEwma(input.category.logEwma, ratioClamped, alpha);
  const catN = input.category.n + 1;
  const catM = blendWithPrior(catN, catEwma, input.prior);

  let recurring = input.recurring;
  if (recurring) {
    const recEwma = updateEwma(recurring.logEwma, ratioClamped, alpha);
    const recN = recurring.n + 1;
    recurring = { n: recN, logEwma: recEwma, mEffective: blendWithPrior(recN, recEwma, input.prior) };
  }

  const window = [...input.recentClampedRatios, ratioClamped];
  const rawSharpness = sharpnessFromWindow(window);
  const sharpness = Math.max(input.category.sharpness, rawSharpness); // never decreases

  // Use the honest number shown at plan-time; fall back to what the engine would have
  // shown using M_before (pre-log multiplier), since that's what the user saw.
  const honestShownMin =
    input.suggestedHonestMin ?? honestNumber(input.estimateMin, input.category.mEffective);
  const reclaimDeltaMin = reclaimDividendMinutes(input.estimateMin, input.actualMin, honestShownMin);

  return {
    ratioClamped,
    counted: true,
    category: { categoryId: '', n: catN, logEwma: catEwma, mEffective: catM, sharpness, reclaimedMinutes: input.category.reclaimedMinutes },
    recurring,
    sharpnessDelta: sharpness - input.category.sharpness,
    reclaimDeltaMin,
  };
}
