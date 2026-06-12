import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  useSharedValue,
  useDerivedValue,
  useFrameCallback,
  useReducedMotion,
  type SharedValue,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { useTimerStore } from '@/src/stores/timerStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import { useTasksStore } from '@/src/stores/tasksStore';
import { useRewardStore } from '@/src/stores/rewardStore';
import { projectedFinish, formatClock } from '@/src/lib/time';
import type { AdaptSpeed } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// useTimer — the Live Timer's whole brain. Keeps timer.tsx thin.
//
// THE DRIVER (binding): the ticking value lives in a Reanimated shared value
// (`elapsedSec`) updated on the UI thread by `useFrameCallback` from
// (now - startedAt - pausedAccum). It is NEVER mirrored into React state per
// second, so no per-second re-render / layout pass happens. The ring offset,
// pace-dot rotation, amber latch, and the center numeral all read this shared
// value via useDerivedValue and animate on the UI thread. JS only learns the
// final `actualMin` at stop time (from timerStore.stop).
//
// GUESS vs HONEST ESTIMATE (binding): the calibration engine's ratio is
// actual / GUESS. The route's `estimateMin` is the *honest suggestion* shown on
// Today (guess × multiplier). We therefore pass the user's original GUESS to
// applyLog — read from the `guessMin` route param when present, else fall back to
// `estimateMin`. The RING still fills toward `estimateMin` (the honest target the
// user committed to), which is the right finish-time anchor.
// ──────────────────────────────────────────────────────────────────────────────

export interface TimerParams {
  taskId?: string;
  label: string;
  category: string;
  /** Honest suggestion (guess × multiplier) — what the ring fills toward. */
  estimateMin: number;
  /** Original user guess — drives calibration. Falls back to estimateMin. */
  guessMin: number;
}

export interface UseTimerResult {
  /** Whole active seconds since start, on the UI thread (the source of truth). */
  elapsedSec: SharedValue<number>;
  /** 1 while over the honest estimate, else 0 — drives every amber flip. */
  overProgress: SharedValue<number>;
  /** Latches to 1 exactly once when elapsed first crosses the estimate. */
  milestoneLatch: SharedValue<number>;
  estimateSec: number;
  startedAt: number;
  /** "Started 9:14" clock. */
  startedClock: string;
  /** Projected "Done ~9:42" clock = start + estimate. */
  finishClock: string;
  label: string;
  guessMin: number;
  reducedMotion: boolean;
  onStopAndLog: () => Promise<void>;
  onAbandon: () => Promise<void>;
}

export function useTimer(params: TimerParams): UseTimerResult {
  const { taskId, label, category, estimateMin, guessMin } = params;
  const reducedMotion = useReducedMotion();

  const start = useTimerStore((s) => s.start);
  const stop = useTimerStore((s) => s.stop);
  const cancel = useTimerStore((s) => s.cancel);
  const applyLog = useCalibrationStore((s) => s.applyLog);

  // Start the timer exactly once on mount. We read startedAt straight from the
  // store afterwards so the UI-thread driver and the persisted log agree.
  const started = useRef(false);
  if (!started.current) {
    start({ label, category, estimateMin });
    started.current = true;
  }
  const startedAt = useTimerStore.getState().startedAt ?? Date.now();

  const estimateSec = Math.max(0, Math.round(estimateMin * 60));

  // ── UI-thread elapsed driver ────────────────────────────────────────────────
  const elapsedSec = useSharedValue(0);
  const overProgress = useSharedValue(0);
  const milestoneLatch = useSharedValue(0);

  useFrameCallback(() => {
    'worklet';
    // Active seconds = wall time since start, minus any paused span. The Timer
    // screen has no pause UI in this cut, so pausedAccum stays 0; reading it from
    // the captured startedAt keeps the math correct if a pause is added later.
    const next = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    if (next !== elapsedSec.value) {
      elapsedSec.value = next;
      const over = next >= estimateSec ? 1 : 0;
      overProgress.value = over;
      if (over === 1 && milestoneLatch.value === 0) {
        milestoneLatch.value = 1; // single amber ripple, fired once at the guess
      }
    }
  }, true);

  // Derived clock anchors (computed in JS once — they don't tick).
  const startedClock = useMemo(() => formatClock(startedAt), [startedAt]);
  const finishClock = useMemo(
    () => formatClock(projectedFinish(startedAt, estimateMin)),
    [startedAt, estimateMin],
  );

  // Keep a derived value alive so the worklet graph is retained even if a
  // consumer forgets to read overProgress directly (defensive; no-op cost).
  useDerivedValue(() => overProgress.value, [overProgress]);

  const onStopAndLog = useCallback(async () => {
    const { actualMin } = stop(Date.now());

    const adaptSpeed: AdaptSpeed =
      useCategoriesStore.getState().categories.find((c) => c.id === category)?.adaptSpeed ??
      'balanced';

    // estimateMin here = the user's GUESS (ratio = actual / guess), NOT the
    // honest suggestion the ring filled toward.
    const result = await applyLog({
      category,
      estimateMin: guessMin,
      actualMin,
      status: 'completed',
      source: 'timed',
      adaptSpeed,
      label,
    });

    useRewardStore.getState().setReward({
      actualMin,
      guessMin,
      category,
      label,
      result,
    });

    if (taskId) useTasksStore.getState().removeTask(taskId);

    router.replace('/(modals)/reward');
  }, [stop, applyLog, category, guessMin, label, taskId]);

  const onAbandon = useCallback(async () => {
    cancel();
    const adaptSpeed: AdaptSpeed =
      useCategoriesStore.getState().categories.find((c) => c.id === category)?.adaptSpeed ??
      'balanced';
    // Logged for self-awareness but excluded from the model (engine drops it).
    await applyLog({
      category,
      estimateMin: guessMin,
      actualMin: 0,
      status: 'abandoned',
      source: 'timed',
      adaptSpeed,
      label,
    });
    router.dismiss();
  }, [cancel, applyLog, category, guessMin, label]);

  // Defensive: if the screen unmounts without a stop (hardware back), clear the
  // running timer so we don't leave a phantom active session persisted.
  useEffect(() => {
    return () => {
      if (useTimerStore.getState().isRunning) cancel();
    };
  }, [cancel]);

  return {
    elapsedSec,
    overProgress,
    milestoneLatch,
    estimateSec,
    startedAt,
    startedClock,
    finishClock,
    label,
    guessMin,
    reducedMotion,
    onStopAndLog,
    onAbandon,
  };
}
