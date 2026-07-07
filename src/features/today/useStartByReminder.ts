// Layer rule: this hook reads a store + a service only; no direct db imports.
import { useEffect } from 'react';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useDayTasksStore } from '@/src/stores/dayTasksStore';
import { scheduleStartBy, cancelStartBy } from '@/src/services/timerNotifications';
import type { PlanResult } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// useStartByReminder — fires the "start by" nudge for the live day plan.
//
// Schedules a local notification at the plan's start-by time so the user starts
// in time to finish honestly by the deadline. Cancels it whenever there's nothing
// to fire: no plan, no task in it, or either reminder toggle is off. The service
// itself no-ops without the native module and silently skips a start-by that is
// already in the past — so a same-day plan whose start has passed simply clears
// any stale notification instead of firing late.
//
// Opt-in via `startByEnabled` alone (default off) — the plan surface owns this
// reminder; the global reminders master no longer gates it. Keyed on primitive
// values (start-by ms, first-task label, deadline ms, plus the joined task's
// id/category/guess/honest minutes) so it only re-schedules when the moment
// actually moves — not on every clock tick that recomputes `plan` into a new
// object.
// ──────────────────────────────────────────────────────────────────────────────
export function useStartByReminder(plan: PlanResult | null): void {
  const startByEnabled = useSettingsStore((s) => s.startByEnabled);
  const dayTasks = useDayTasksStore((s) => s.dayTasks);

  const enabled = startByEnabled;
  const startByMs = plan?.startBy ?? null;
  const firstTask = plan?.timeline.find((i) => i.kind === 'task') ?? null;
  const firstTaskLabel = firstTask?.label ?? null;
  const deadlineMs = plan ? plan.timeline.reduce((max, i) => Math.max(max, i.endAt), 0) : null;

  // Honest estimate the plan used for this block = its duration in minutes.
  const honestMin = firstTask ? Math.round((firstTask.endAt - firstTask.startAt) / 60000) : null;
  // Join the timeline item's id back to the source task for guess + category.
  const sourceTask = firstTask ? (dayTasks.find((t) => t.id === firstTask.id) ?? null) : null;
  const taskId = firstTask?.id ?? null;
  const guessMin = sourceTask?.guessMin ?? null;
  const category = sourceTask?.category ?? null;

  useEffect(() => {
    if (!enabled || startByMs === null || firstTaskLabel === null || deadlineMs === null) {
      void cancelStartBy();
      return;
    }
    void scheduleStartBy({
      startByMs,
      firstTaskLabel,
      deadlineMs,
      taskId,
      category: category ?? undefined,
      guessMin: guessMin ?? undefined,
      honestMin: honestMin ?? undefined,
    });
    // Keyed on primitives so it only re-schedules when a value actually moves.
  }, [enabled, startByMs, firstTaskLabel, deadlineMs, taskId, category, guessMin, honestMin]);
}
