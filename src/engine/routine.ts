// Routine chain math (Pro). PURE TS — no RN/Expo/clock/db.
//
// A routine is an ordered list of steps. Each step learns its own bias through the
// existing recurring path; the WHOLE chain learns one extra "transition factor" —
// the seam time (transitions, re-starts) that never lives in any single step's
// estimate. The honest total is derived: sum(per-step honest) × transitionFactor.
//
// Reuse over reinvention: per-step honest minutes delegate to `honestNumber`; the
// only genuinely-new math here is the chain total + the clamped EWMA transition
// factor trained from the chain-level residual.

import {
  ROUTINE_PERSONAL_MIN_RUNS,
  TRANSITION_ALPHA,
  TRANSITION_CEIL,
  TRANSITION_FLOOR,
} from './constants';
import { honestNumber } from './multiplier';
import type { RoutineStepKey } from '../domain/types';

/** Per-step honest minutes for the chain: round5(guess × stepM), floored at 5.
 *  Delegates to `honestNumber` so a step learns exactly like a single task. */
export function stepHonestMinutes(guessMin: number, stepM: number): number {
  return honestNumber(guessMin, stepM);
}

/** The whole-chain honest total: sum the per-step honest numbers, apply the
 *  transition factor, round to 5. Floored at 5 so a routine is never zero. */
export function routineHonestTotal(
  perStepHonestMin: readonly number[],
  transitionFactor: number,
): number {
  const base = perStepHonestMin.reduce((sum, m) => sum + m, 0);
  return Math.max(5, Math.round((base * transitionFactor) / 5) * 5);
}

/** basis + label for the summary, parallel to resolveSuggestion's labelling. */
export function routineBasis(runCount: number): {
  basis: 'personal' | 'prior';
  label: string;
} {
  if (runCount >= ROUTINE_PERSONAL_MIN_RUNS) {
    return { basis: 'personal', label: `based on your last ${runCount} runs` };
  }
  return { basis: 'prior', label: 'based on typical patterns' };
}

/** Clamp the transition factor to its bounded range so one chaotic (or unusually
 *  fast) run can't poison the chain or claim faster-than-its-honest-steps. */
function clampFactor(factor: number): number {
  return Math.min(TRANSITION_CEIL, Math.max(TRANSITION_FLOOR, factor));
}

interface DistributeStep {
  stepKey: RoutineStepKey;
  guessMin: number;
  actualMin: number;
  /** The step's resolved multiplier BEFORE this run trains it. */
  stepMBefore: number;
}

interface DistributeInput {
  steps: DistributeStep[];
  priorFactor: number;
}

interface DistributeResult {
  /** One applyLog-ready payload per step (caller feeds each to the recurring path). */
  stepTrainings: { stepKey: RoutineStepKey; estimateMin: number; actualMin: number }[];
  /** The new clamped, EWMA'd transition factor to persist on the routine. */
  nextTransitionFactor: number;
}

/**
 * Distribute a whole-routine timed run: produce the per-step trainings and derive
 * the next transition factor. Pure — the caller passes the recorded per-step
 * actuals and the prior factor; this returns what to train.
 *
 * - Each step trains via the EXISTING recurring path with its own
 *   (estimateMin = guessMin, actualMin = recorded step actual).
 * - The transition factor is updated ONLY from the chain-level ratio:
 *     observedFactor = sum(stepActuals) / sum(stepHonestBaseline)
 *   where stepHonestBaseline = sum of stepHonestMinutes(guess, stepMBefore). It is
 *   clamped to [FLOOR, CEIL], EWMA'd with TRANSITION_ALPHA toward the prior factor,
 *   then clamped again. Comparing chain actual against the summed per-step BASELINE
 *   (not the summed step actuals) isolates the seam time so the per-step error and
 *   the chain residual never double-count each other.
 */
export function distributeRoutineRun(input: DistributeInput): DistributeResult {
  const stepTrainings = input.steps.map((s) => ({
    stepKey: s.stepKey,
    estimateMin: s.guessMin,
    actualMin: s.actualMin,
  }));

  const totalActual = input.steps.reduce((sum, s) => sum + s.actualMin, 0);
  const baseline = input.steps.reduce(
    (sum, s) => sum + stepHonestMinutes(s.guessMin, s.stepMBefore),
    0,
  );

  // No baseline (no steps / all-zero) → leave the factor untouched (clamped).
  if (baseline <= 0) {
    return { stepTrainings, nextTransitionFactor: clampFactor(input.priorFactor) };
  }

  const observed = clampFactor(totalActual / baseline);
  // EWMA toward the observed chain factor. The factor is a bounded ratio, so a
  // plain linear EWMA between prior and observed keeps it inside [FLOOR, CEIL]
  // without log-space gymnastics; clamp once more for safety.
  const blended = TRANSITION_ALPHA * observed + (1 - TRANSITION_ALPHA) * input.priorFactor;
  const nextTransitionFactor = clampFactor(blended);

  return { stepTrainings, nextTransitionFactor };
}
