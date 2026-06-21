import { GOAL_PRESETS, GOAL_MIN_LOGS, GOAL_RECOMMEND_STEP } from './constants';
import type { CategoryGoal } from '../domain/types';

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** Display band: accuracy 75 → "within 25%". Inverse of accuracy, clamped 0..100. */
export function accuracyToErrorBand(accuracy: number): number {
  return clamp(Math.round(100 - accuracy), 0, 100);
}

/** "within X%" target → required accuracy. e.g. 25 → 75. */
export function errorBandToAccuracy(errorBand: number): number {
  return clamp(100 - errorBand, 0, 100);
}

/** Forward-only progress 0..1 from baseline → target, driven by MONOTONIC best. */
export function goalProgress(
  goal: Pick<CategoryGoal, 'baselineAccuracy' | 'targetAccuracy' | 'bestAccuracy'>,
): number {
  const span = goal.targetAccuracy - goal.baselineAccuracy;
  if (span <= 0) return 1;
  return clamp((goal.bestAccuracy - goal.baselineAccuracy) / span, 0, 1);
}

/** True once best has ever reached target. */
export function isGoalMet(goal: Pick<CategoryGoal, 'targetAccuracy' | 'bestAccuracy'>): boolean {
  return goal.bestAccuracy >= goal.targetAccuracy;
}

/** Fold a fresh accuracy into a goal: best is max-latched; met latches and never clears. Pure. */
export function reconcileGoal(goal: CategoryGoal, currentAccuracy: number): CategoryGoal {
  const bestAccuracy = Math.max(goal.bestAccuracy, currentAccuracy);
  return { ...goal, bestAccuracy, met: goal.met || bestAccuracy >= goal.targetAccuracy };
}

/** Whether this category can have a goal yet. */
export function canSetGoal(n: number): boolean {
  return n >= GOAL_MIN_LOGS;
}

/** Preset "within X%" bands strictly tighter than current; falls back to the tightest. */
export function presetsForAccuracy(currentAccuracy: number): number[] {
  const currentBand = accuracyToErrorBand(currentAccuracy);
  const tighter = GOAL_PRESETS.filter((band) => band < currentBand);
  return tighter.length > 0 ? tighter : [GOAL_PRESETS[GOAL_PRESETS.length - 1] as number];
}

/** Recommended (pre-selected) preset: easiest band >= GOAL_RECOMMEND_STEP tighter than current. */
export function recommendedPreset(currentAccuracy: number): number {
  const options = presetsForAccuracy(currentAccuracy);
  const currentBand = accuracyToErrorBand(currentAccuracy);
  const realStep = options.find((band) => currentBand - band >= GOAL_RECOMMEND_STEP);
  return realStep ?? (options[0] as number);
}
