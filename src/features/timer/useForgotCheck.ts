import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useTimerStore } from '@/src/stores/timerStore';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useForgotStore } from '@/src/stores/forgotStore';
import { cancelTimerDone, cancelGuardCheckIn } from '@/src/services/timerNotifications';
import { autoCloseDecision } from '@/src/engine';
import type { ForgotStepIn, PendingAutoClose } from '@/src/domain/types';

// The persisted timer snapshot shape (mirror of timerStore's PersistedTimer —
// re-declared here to keep the pure fn free of store internals).
interface Snap {
  taskLabel: string;
  category: string | null;
  estimateMin: number;
  startedAt: number;
  pausedAccumMs: number;
  pausedAt: number | null;
  guessMin: number;
  taskId: string | null;
  suggestedHonestMin: number;
  isQuickStart: boolean;
  guardNudged: boolean;
}

/** Active elapsed minutes, excluding paused spans. */
function activeElapsedMin(snap: Snap, nowMs: number): number {
  const pausedAccum =
    snap.pausedAt !== null ? snap.pausedAccumMs + (nowMs - snap.pausedAt) : snap.pausedAccumMs;
  return Math.max(0, Math.round((nowMs - snap.startedAt - pausedAccum) / 60_000));
}

/** PURE: decide whether a snapshot is a forgotten, auto-closable session. */
export function evaluateForgotten(input: {
  snap: Snap;
  nowMs: number;
  stepIn: ForgotStepIn;
}): PendingAutoClose | null {
  const { snap, nowMs, stepIn } = input;
  // Paused = intentional; quick-start / uncategorized = out of P0 auto-bank.
  if (snap.pausedAt !== null) return null;
  if (snap.isQuickStart || snap.category === null) return null;
  const honestMin = snap.suggestedHonestMin;
  const elapsedMin = activeElapsedMin(snap, nowMs);
  const { shouldAutoClose, recoveredActualMin } = autoCloseDecision({
    elapsedMin,
    honestMin,
    stepIn,
  });
  if (!shouldAutoClose) return null;
  return {
    taskLabel: snap.taskLabel,
    category: snap.category,
    guessMin: snap.guessMin,
    honestMin,
    startedAt: snap.startedAt,
    elapsedMin,
    recoveredActualMin,
    taskId: snap.taskId,
    estimateMin: snap.estimateMin,
    pausedAccumMs: snap.pausedAccumMs,
  };
}

/** Mount once at the app root. Runs on mount + every foreground. */
export function useForgotCheck(): void {
  useEffect(() => {
    const run = () => {
      // Already parked? don't double-detect.
      if (useForgotStore.getState().pending !== null) return;
      const snap = useTimerStore.getState().peekPersisted();
      if (snap === null) return;
      const stepIn = useSettingsStore.getState().forgotStepIn;
      const pending = evaluateForgotten({ snap: snap as Snap, nowMs: Date.now(), stepIn });
      if (pending === null) return;
      // Stop the runaway now; the ForgotCard writes the recovery log. Cancel this
      // session's scheduled pings here (feature layer) — mirrors the other stop
      // paths in useTimer; keeps the store free of a service-layer notification dep.
      useTimerStore.getState().stopSilently();
      void cancelTimerDone();
      void cancelGuardCheckIn();
      useForgotStore.getState().setPending(pending);
    };
    run(); // boot / mount
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') run();
    });
    return () => sub.remove();
  }, []);
}
