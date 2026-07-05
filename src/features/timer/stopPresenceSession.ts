// Stop + log the CURRENTLY RUNNING session using the timer store as the single
// source of truth (startedAt, category, guess, honest, label, taskId). This is the
// stop path for surfaces that carry NO session context — the lock-screen / widget
// "Stop & log" action and the guardrail "Wrap up" notification. Logging those from
// route params instead recorded the WRONG category/guess AND a ~0 elapsed (the
// timer screen restarted a fresh session because the deep link had no identity).
//
// Mirrors the non-quick-start branch of useTimer.onStopAndLog exactly — same
// applyLog inputs, reward, day-task + plan completion, and presence teardown — but
// reads every value from the store rather than a React hook's closure.
import { router } from 'expo-router';
import type { AdaptSpeed } from '@/src/domain/types';
import { useTimerStore } from '@/src/stores/timerStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import { useRewardStore } from '@/src/stores/rewardStore';
import { useDayTasksStore } from '@/src/stores/dayTasksStore';
import { usePlanStore } from '@/src/stores/planStore';
import { cancelTimerDone, cancelGuardCheckIn } from '@/src/services/timerNotifications';
import { endFinishTimeActivity } from '@/src/services/liveActivity';

export type PresenceStopResult = 'logged' | 'needs-capture' | 'none';

/**
 * Stop + log the running session from store context. Returns:
 * - 'logged'        — completed log written; caller should show the reward.
 * - 'needs-capture' — a quick-start session (no category) can't be auto-logged;
 *                     caller should open the timer so the capture sheet runs.
 * - 'none'          — nothing was running (already stopped elsewhere).
 */
export async function stopPresenceSessionAndLog(): Promise<PresenceStopResult> {
  // Cold boot from the notification: the session lives in KV, not yet in memory.
  if (!useTimerStore.getState().isRunning) useTimerStore.getState().resumeFromKv();

  const s = useTimerStore.getState();
  if (!s.isRunning || s.startedAt === null) return 'none';
  // Quick-start has no category — it must be named in the capture sheet, which a
  // notification can't show. Signal the caller to open the timer instead.
  if (s.isQuickStart) return 'needs-capture';

  // Snapshot every field BEFORE stop() clears the store.
  const category = s.category ?? 'getting_ready';
  const guessMin = s.guessMin;
  const suggestedHonestMin = s.suggestedHonestMin;
  const label = s.taskLabel ?? 'Focus session';
  const taskId = s.taskId;
  const startedAt = s.startedAt;

  // stop() computes actualMin from the REAL startedAt (folding any paused span),
  // then clears the store + persisted KV.
  const { actualMin } = s.stop(Date.now());

  void cancelTimerDone();
  void cancelGuardCheckIn();
  endFinishTimeActivity();

  const adaptSpeed: AdaptSpeed =
    useCategoriesStore.getState().categories.find((c) => c.id === category)?.adaptSpeed ?? 'balanced';

  // estimateMin = the user's GUESS (ratio = actual / guess), NOT the honest number.
  const result = await useCalibrationStore.getState().applyLog({
    category,
    estimateMin: guessMin,
    actualMin,
    status: 'completed',
    source: 'timed',
    adaptSpeed,
    label,
    suggestedHonestMin,
    startedAt,
  });

  useRewardStore.getState().setReward({ actualMin, guessMin, category, label, result });

  if (taskId) {
    useDayTasksStore.getState().completeTask(taskId, { completedAt: Date.now(), actualMin });
    void useDayTasksStore.getState().reload();
    const planActive = usePlanStore.getState().active;
    if (planActive !== null) {
      const planTask = planActive.tasks.find((t) => t.id === taskId);
      if (planTask?.status === 'running') usePlanStore.getState().completeTask(taskId, actualMin);
    }
  }

  return 'logged';
}

/** Run the presence stop and route to the right next screen. */
export async function handlePresenceStop(): Promise<void> {
  const outcome = await stopPresenceSessionAndLog();
  if (outcome === 'logged') router.replace('/(modals)/reward');
  else if (outcome === 'needs-capture') router.replace('/(modals)/timer?quick=1');
  else router.replace('/(tabs)');
}
