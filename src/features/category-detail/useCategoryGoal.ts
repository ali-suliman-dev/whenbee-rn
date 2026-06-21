import { useCallback, useState } from 'react';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import {
  accuracyToErrorBand,
  canSetGoal,
  goalProgress,
  presetsForAccuracy,
  recommendedPreset,
} from '@/src/engine';
import type { CategoryGoal } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// useCategoryGoal — the Goal card's view-model (Pro, no-guilt).
//
// Reads the category's live `sharpness`/`n` from the calibration store, reconciles
// the kv-stored goal on every read (so opening the screen advances the monotonic
// best), and exposes the picker presets + the set / aim-tighter / keep actions.
// All goal state lives off the training path — this hook only ever READS sharpness.
//
// `justMet` mirrors `justGraduated`: true while the goal is met AND the category
// isn't yet in the celebration ledger. `keep()` latches that ledger so the seal
// shows exactly once.
// ──────────────────────────────────────────────────────────────────────────────

export interface UseCategoryGoalResult {
  goal: CategoryGoal | null;
  /** Forward-only progress 0..1, driven by the monotonic best (never retreats). */
  progress: number;
  canSet: boolean;
  presets: number[];
  recommended: number;
  /** The current accuracy as a displayed "within X%" error band. */
  currentBand: number;
  /** True for the one celebration window: goal met, not yet acknowledged. */
  justMet: boolean;
  setGoal: (band: number) => void;
  aimTighter: (band: number) => void;
  keep: () => void;
}

export function useCategoryGoal(categoryId: string): UseCategoryGoalResult {
  const loadGoal = useCalibrationStore((s) => s.loadGoal);
  const setGoalStore = useCalibrationStore((s) => s.setGoal);
  const hasCelebrated = useCalibrationStore((s) => s.hasCelebratedGoal);
  const markCelebrated = useCalibrationStore((s) => s.markGoalCelebrated);
  const sharpness = useCalibrationStore((s) => s.statsByCategory[categoryId]?.sharpness ?? 0);
  const n = useCalibrationStore((s) => s.statsByCategory[categoryId]?.n ?? 0);

  // Local bump so set / aim / keep force a fresh render → fresh kv read (kv writes
  // don't notify the store). `version` is intentionally unused below; bumping it
  // just re-runs render, which re-reads the goal.
  const [, setVersion] = useState(0);

  // loadGoal is a cheap synchronous kv read that reconciles against the LIVE
  // sharpness on every call, so reading it each render keeps the monotonic best
  // current without a memo (which would mask the store-driven sharpness change).
  const goal = loadGoal(categoryId);

  const currentBand = accuracyToErrorBand(sharpness);
  const presets = presetsForAccuracy(sharpness);
  const recommended = recommendedPreset(sharpness);
  const canSet = canSetGoal(n);

  const justMet = !!goal?.met && !hasCelebrated(categoryId);

  const setGoal = useCallback(
    (band: number) => {
      setGoalStore(categoryId, band);
      setVersion((v) => v + 1);
    },
    [setGoalStore, categoryId],
  );
  const aimTighter = setGoal;
  const keep = useCallback(() => {
    markCelebrated(categoryId);
    setVersion((v) => v + 1);
  }, [markCelebrated, categoryId]);

  return {
    goal,
    progress: goal ? goalProgress(goal) : 0,
    canSet,
    presets,
    recommended,
    currentBand,
    justMet,
    setGoal,
    aimTighter,
    keep,
  };
}
