import { clampRatio } from './ratio';
import { alphaRegFor } from './ewma';
import { roundHonest } from './multiplier';
import {
  affineHonestExact,
  solveAffine,
  updateAffineStats,
  CANONICAL_GUESS_MIN,
  type AffineStats,
  type AffineFit,
} from './affine';
import { reclaimDividendMinutes } from './reclaim';
import { sharpnessFromWindow } from './sharpness';
import { honeyMaturity } from './honeyMaturity';
import { confidenceFor } from './confidence';
import type { AdaptSpeed, LogSource, LogStatus } from '../domain/types';

interface RollingStat {
  stats: AffineStats;
  n: number;
}

export interface ApplyLogInput {
  estimateMin: number;
  actualMin: number;
  status: LogStatus;
  source: LogSource;
  adaptSpeed: AdaptSpeed;
  /** Cold-start anchor (population prior, optionally nudged by global bias). */
  prior: number;
  category: RollingStat & { anchor: number; sharpness: number; reclaimedMinutes: number };
  recurring: (RollingStat & { anchor: number }) | null;
  recentClampedRatios: number[];
  suggestedHonestMin: number | null;
}

export interface ApplyLogResult {
  ratioClamped: number;
  counted: boolean;
  category: { stats: AffineStats; n: number; mEffective: number; sharpness: number; reclaimedMinutes: number };
  categoryFit: AffineFit;
  recurring: (RollingStat & { mEffective: number }) | null;
  sharpnessDelta: number;
  reclaimDeltaMin: number;
}

/** Representative scalar multiplier at the canonical guess (for displays). */
const effectiveMultiplier = (fit: AffineFit): number =>
  affineHonestExact(fit, CANONICAL_GUESS_MIN) / CANONICAL_GUESS_MIN;

/**
 * Update order — do not reorder:
 *   1. abandoned (and partial unless 'done enough') → store log, return counted:false.
 *   2. r = clampRatio(estimate, actual).
 *   3. alpha = alphaRegFor(adaptSpeed, source)  — decoupled from EWMA alpha.
 *   4. catStats = updateAffineStats(prev, guess, trainedActual, alpha); catN += 1.
 *   5. catFit = solveAffine(catStats, anchor).
 *   6. if recurring: same updateAffineStats+solveAffine against its own anchor.
 *   7. sharpness = max(prev, sharpnessFromWindow(window ++ r))  // monotonic guard.
 */
export function applyLog(input: ApplyLogInput): ApplyLogResult {
  const ratioClamped = clampRatio(input.estimateMin, input.actualMin);

  if (input.status !== 'completed') {
    const fit = solveAffine(input.category.stats, input.category.anchor);
    return {
      ratioClamped,
      counted: false,
      category: {
        stats: input.category.stats,
        n: input.category.n,
        mEffective: effectiveMultiplier(fit),
        sharpness: input.category.sharpness,
        reclaimedMinutes: input.category.reclaimedMinutes,
      },
      categoryFit: fit,
      recurring: input.recurring
        ? {
            stats: input.recurring.stats,
            n: input.recurring.n,
            mEffective: effectiveMultiplier(solveAffine(input.recurring.stats, input.recurring.anchor)),
          }
        : null,
      sharpnessDelta: 0,
      reclaimDeltaMin: 0,
    };
  }

  // Decoupled regression forgetting factor (longer memory than EWMA alpha).
  const alpha = alphaRegFor(input.adaptSpeed, input.source);
  // Clamp the trained point's actual to the clamped ratio so one disaster can't
  // tilt the line (same robustness the EWMA had via clampRatio).
  const trainedActual = ratioClamped * input.estimateMin;

  const catStats = updateAffineStats(input.category.stats, input.estimateMin, trainedActual, alpha);
  const catN = input.category.n + 1;
  const catFit = solveAffine(catStats, input.category.anchor);

  let recurring = null as ApplyLogResult['recurring'];
  if (input.recurring) {
    const recStats = updateAffineStats(input.recurring.stats, input.estimateMin, trainedActual, alpha);
    const recFit = solveAffine(recStats, input.recurring.anchor);
    recurring = { stats: recStats, n: input.recurring.n + 1, mEffective: effectiveMultiplier(recFit) };
  }

  const window = [...input.recentClampedRatios, ratioClamped];
  const accuracy = sharpnessFromWindow(window);
  // Seal is earned: needs enough low-variance data, not just one accurate log.
  const sealEligible = confidenceFor({ n: catN, clampedRatios: window }) === 'honest';
  const sharpness = honeyMaturity({
    n: catN,
    accuracy,
    prevHoney: input.category.sharpness,
    sealEligible,
  });

  const honestShownMin =
    input.suggestedHonestMin ?? roundHonest(affineHonestExact(catFit, input.estimateMin));
  const reclaimDeltaMin = reclaimDividendMinutes(input.estimateMin, input.actualMin, honestShownMin);

  return {
    ratioClamped,
    counted: true,
    category: {
      stats: catStats,
      n: catN,
      mEffective: effectiveMultiplier(catFit),
      sharpness,
      reclaimedMinutes: input.category.reclaimedMinutes,
    },
    categoryFit: catFit,
    recurring,
    sharpnessDelta: sharpness - input.category.sharpness,
    reclaimDeltaMin,
  };
}
