// Layer rule: this hook reads a store + a service only; no direct db imports.
import { useEffect } from 'react';
import { useSettingsStore } from '@/src/stores/settingsStore';
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
// Opt-in twice over: master `remindersEnabled` (off by default) AND the per-type
// `startByEnabled`. Keyed on primitive values (start-by ms, first-task label,
// deadline ms) so it only re-schedules when the moment actually moves — not on
// every clock tick that recomputes `plan` into a new object.
// ──────────────────────────────────────────────────────────────────────────────
export function useStartByReminder(plan: PlanResult | null): void {
  const remindersEnabled = useSettingsStore((s) => s.remindersEnabled);
  const startByEnabled = useSettingsStore((s) => s.startByEnabled);

  const enabled = remindersEnabled && startByEnabled;
  const startByMs = plan?.startBy ?? null;
  const firstTaskLabel = plan?.timeline.find((i) => i.kind === 'task')?.label ?? null;
  const deadlineMs = plan ? plan.timeline.reduce((max, i) => Math.max(max, i.endAt), 0) : null;

  useEffect(() => {
    if (!enabled || startByMs === null || firstTaskLabel === null || deadlineMs === null) {
      void cancelStartBy();
      return;
    }
    void scheduleStartBy({ startByMs, firstTaskLabel, deadlineMs });
  }, [enabled, startByMs, firstTaskLabel, deadlineMs]);
}
