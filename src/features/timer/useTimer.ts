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
import { useSettingsStore } from '@/src/stores/settingsStore';
import { usePlanStore } from '@/src/stores/planStore';
import { projectedFinish, formatClock } from '@/src/lib/time';
import { analytics } from '@/src/services/analytics';
import {
  ensureNotificationPermission,
  scheduleTimerDone,
  cancelTimerDone,
} from '@/src/services/timerNotifications';
import {
  startFinishTimeActivity,
  endFinishTimeActivity,
  updateFinishTimeActivity,
} from '@/src/services/liveActivity';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
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
  /**
   * The honest number the user actually SAW before starting the timer.
   * Banked as the reclaim anchor. Defaults to `estimateMin` (the ring target)
   * when absent — this covers the case where estimateMin IS the honest number
   * passed from Today or Add-Task.
   */
  suggestedHonestMin?: number;
}

export interface UseTimerResult {
  /** Whole active seconds since start, on the UI thread (the source of truth). */
  elapsedSec: SharedValue<number>;
  /** 1 while over the honest estimate, else 0 — drives every amber flip. */
  overProgress: SharedValue<number>;
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
  const { taskId, label, category, estimateMin, guessMin, suggestedHonestMin = estimateMin } =
    params;
  const reducedMotion = useReducedMotion();

  const start = useTimerStore((s) => s.start);
  const stop = useTimerStore((s) => s.stop);
  const cancel = useTimerStore((s) => s.cancel);
  const applyLog = useCalibrationStore((s) => s.applyLog);

  // ATTACH vs RESTART: if a session is already running for THIS task (reopened from
  // the active-timer bar, or restored at boot), attach to its existing startedAt —
  // calling start() again would reset the clock and lose elapsed time. Only start a
  // fresh session when none is running for this task.
  //
  // Resolve startedAt SYNCHRONOUSLY (render needs it for the frame callback +
  // clocks) but DO NOT write the store mid-render: a store write here updates the
  // ActiveTimerBar mounted under this modal, which React forbids during render
  // ("Cannot update a component while rendering a different component"). The fresh
  // session is committed to the store in the effect below, after commit.
  const startedFresh = useRef(false);
  const overrunTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAtRef = useRef<number | null>(null);
  if (startedAtRef.current === null) {
    const s = useTimerStore.getState();
    const sameTask = taskId ? s.taskId === taskId : s.taskLabel === label;
    if (s.isRunning && sameTask && s.startedAt !== null) {
      startedAtRef.current = s.startedAt; // attach to the running session
    } else {
      startedAtRef.current = Date.now(); // fresh session — store write deferred below
      startedFresh.current = true;
    }
  }
  const startedAt = startedAtRef.current;

  // Commit a FRESH session AFTER render (never during it). Also schedules the local
  // "estimate is up" ping (so the timer works backgrounded/closed), the Lock-Screen
  // finish ring, and asks notification permission gently the first time. Attaching
  // to an existing session is a no-op here — its store row, notification, and Live
  // Activity already exist.
  useEffect(() => {
    if (!startedFresh.current) return;
    start(
      { label, category, estimateMin, guessMin, taskId: taskId ?? null, suggestedHonestMin },
      startedAt,
    );
    // task_started: the timer opened a fresh session. `guess_min` is the user's raw
    // guess (drives calibration), not the honest ring target.
    analytics.capture('task_started', { category, guess_min: guessMin, source: 'today' });
    // Lock-Screen / Dynamic Island finish-time ring counts down to the HONEST
    // finish (the number the user saw), not the raw guess. No-op in Expo Go.
    startFinishTimeActivity({
      taskLabel: label,
      finishEpoch: Math.round(projectedFinish(startedAt, suggestedHonestMin) / 1000),
      startEpoch: Math.round(startedAt / 1000),
      isProRich: useEntitlement.getState().isPro,
    });
    // Schedule the overrun flip for when wall-clock crosses the honest finish.
    // If the timer somehow starts already past the finish (e.g. a resumed session),
    // delay is 0 and the flip happens on the next JS turn — still correct.
    const finishMs = projectedFinish(startedAt, suggestedHonestMin);
    const delay = Math.max(0, finishMs - Date.now());
    if (overrunTimerRef.current) clearTimeout(overrunTimerRef.current);
    overrunTimerRef.current = setTimeout(() => {
      updateFinishTimeActivity({ isOverrun: true });
    }, delay);
    // Only schedule the "estimate is up" ping when the user has opted into
    // reminders (off by default). Read non-reactively — this effect runs once.
    if (useSettingsStore.getState().remindersEnabled) {
      void (async () => {
        const granted = await ensureNotificationPermission();
        if (granted) await scheduleTimerDone({ label, startedAt, estimateMin });
      })();
    }
    // Runs exactly once for a fresh session; route params are stable for the
    // component's lifetime, so an empty dep list is correct here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const estimateSec = Math.max(0, Math.round(estimateMin * 60));

  // ── UI-thread elapsed driver ────────────────────────────────────────────────
  const elapsedSec = useSharedValue(0);
  const overProgress = useSharedValue(0);

  useFrameCallback(() => {
    'worklet';
    // Active seconds = wall time since start, minus any paused span. The Timer
    // screen has no pause UI in this cut, so pausedAccum stays 0; reading it from
    // the captured startedAt keeps the math correct if a pause is added later.
    const next = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    if (next !== elapsedSec.value) {
      elapsedSec.value = next;
      overProgress.value = next >= estimateSec ? 1 : 0;
    }
  }, true);

  // Derived clock anchors (computed in JS once — they don't tick). Format follows
  // the system 24h toggle via the app-wide default set at boot (see lib/time).
  const startedClock = useMemo(() => formatClock(startedAt), [startedAt]);
  const finishClock = useMemo(
    () => formatClock(projectedFinish(startedAt, estimateMin)),
    [startedAt, estimateMin],
  );

  // Keep a derived value alive so the worklet graph is retained even if a
  // consumer forgets to read overProgress directly (defensive; no-op cost).
  useDerivedValue(() => overProgress.value, [overProgress]);

  const clearOverrunTimer = useCallback(() => {
    if (overrunTimerRef.current) {
      clearTimeout(overrunTimerRef.current);
      overrunTimerRef.current = null;
    }
  }, []);

  // Cancel any pending overrun flip when the component unmounts (minimize/reopen
  // path). The timer is NOT stopped on unmount — only on explicit stop/abandon —
  // but if a new sheet instance mounts it will schedule its own flip.
  useEffect(() => () => clearOverrunTimer(), [clearOverrunTimer]);

  const onStopAndLog = useCallback(async () => {
    clearOverrunTimer();
    const { actualMin } = stop(Date.now());
    void cancelTimerDone();
    endFinishTimeActivity();

    const adaptSpeed: AdaptSpeed =
      useCategoriesStore.getState().categories.find((c) => c.id === category)?.adaptSpeed ??
      'balanced';

    // estimateMin here = the user's GUESS (ratio = actual / guess), NOT the
    // honest suggestion the ring filled toward.
    // suggestedHonestMin = the honest number the user SAW (defaults to estimateMin
    // which IS the honest number passed from Today / Add-Task).
    const result = await applyLog({
      category,
      estimateMin: guessMin,
      actualMin,
      status: 'completed',
      source: 'timed',
      adaptSpeed,
      label,
      suggestedHonestMin,
    });

    useRewardStore.getState().setReward({
      actualMin,
      guessMin,
      category,
      label,
      result,
    });

    // Keep the task on Today — flip it to done (checked off) so the day shows
    // progress instead of the row vanishing. actualMin powers the "took N" receipt.
    if (taskId) useTasksStore.getState().completeTask(taskId, { actualMin });

    // If this task is the active plan's running task, mark it done in the plan
    // run-state (pure UI bookkeeping — calibration already happened via applyLog above).
    if (taskId) {
      const planStore = usePlanStore.getState();
      const planActive = planStore.active;
      if (planActive !== null) {
        const planTask = planActive.tasks.find((t) => t.id === taskId);
        if (planTask?.status === 'running') {
          planStore.completeTask(taskId, actualMin);
        }
      }
    }

    router.replace('/(modals)/reward');
  }, [stop, applyLog, category, guessMin, label, taskId, suggestedHonestMin, clearOverrunTimer]);

  const onAbandon = useCallback(async () => {
    clearOverrunTimer();
    cancel();
    void cancelTimerDone();
    endFinishTimeActivity();
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
  }, [cancel, applyLog, category, guessMin, label, clearOverrunTimer]);

  // NOTE: no destroy-on-dismiss. Closing the sheet MINIMIZES the timer — a running
  // session is cleared ONLY by an explicit Stop (onStopAndLog) or Abandon
  // (onAbandon), never by unmount. The persisted snapshot + ActiveTimerBar let the
  // user reopen it; the local notification still fires when the estimate elapses.

  return {
    elapsedSec,
    overProgress,
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
