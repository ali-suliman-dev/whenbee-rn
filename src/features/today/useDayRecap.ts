// src/features/today/useDayRecap.ts
// Computes a recap of the selected day — only meaningful for past days.
// Returns null when the selected day is today or in the future.
//
// No guilt. This is a recap, not a score.

import { useDayTasksStore } from '@/src/stores/dayTasksStore';
import { toLocalDayKey, compareDayKeys } from '@/src/lib/day';

export interface DayRecap {
  /** YYYY-MM-DD key of the day being recapped. */
  date: string;
  /** Number of tasks with status === 'done' on that day. */
  doneCount: number;
  /** Total tasks planned for the day (done + queued). */
  plannedCount: number;
  /** Sum of actualMin over done tasks (null actualMin → 0). */
  realFocusMin: number;
  /** Sum of (actualMin − guessMin) for done tasks where actualMin is known. */
  vsGuessMin: number;
}

/** Returns a banked recap for the selected day, or null if today/future. */
export function useDayRecap(): DayRecap | null {
  const selectedDate = useDayTasksStore((s) => s.selectedDate);
  const dayTasks = useDayTasksStore((s) => s.dayTasks);

  const today = toLocalDayKey(Date.now());

  // Only past days get a recap.
  if (compareDayKeys(selectedDate, today) >= 0) return null;

  const done = dayTasks.filter((t) => t.status === 'done');
  const doneCount = done.length;
  const plannedCount = dayTasks.length;

  const realFocusMin = done.reduce((sum, t) => sum + (t.actualMin ?? 0), 0);

  const vsGuessMin = done.reduce((sum, t) => {
    if (t.actualMin == null) return sum;
    return sum + (t.actualMin - t.guessMin);
  }, 0);

  return {
    date: selectedDate,
    doneCount,
    plannedCount,
    realFocusMin,
    vsGuessMin,
  };
}
