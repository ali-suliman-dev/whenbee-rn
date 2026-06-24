// src/engine/daySelectors.ts
// PURE day-membership rules (no Date, no I/O). Decides which tasks appear on a
// selected day and tags carryover. See spec 2026-06-24 §4.2. No-guilt: carryover
// is a neutral tag (carriedFrom), never an "overdue" flag.

import type { Task } from '@/src/domain/types';
import { compareDayKeys } from '@/src/lib/day';

export interface DayTask extends Task {
  /** Original plannedDate when this queued task carried over onto today; else null. */
  carriedFrom: string | null;
}

export interface DaySelectorInput {
  tasks: readonly Task[];
  selectedDate: string;
  today: string;
}

function byOrder(a: Task, b: Task): number {
  return a.orderIndex - b.orderIndex;
}

export function tasksForSelectedDay({ tasks, selectedDate, today }: DaySelectorInput): DayTask[] {
  const cmp = compareDayKeys(selectedDate, today);

  if (cmp === 0) {
    // Today: queued with plannedDate <= today (carryover surfaces) + done planned today.
    const queued = tasks
      .filter((t) => t.status === 'queued' && t.plannedDate !== null && compareDayKeys(t.plannedDate, today) <= 0)
      .sort(byOrder)
      .map((t) => ({ ...t, carriedFrom: t.plannedDate !== today ? t.plannedDate : null }));
    const done = tasks
      .filter((t) => t.status === 'done' && t.plannedDate === today)
      .map((t) => ({ ...t, carriedFrom: null }));
    return [...queued, ...done];
  }

  if (cmp > 0) {
    // Future day: only tasks planned for exactly that day; never carryover.
    return tasks
      .filter((t) => t.plannedDate === selectedDate)
      .sort(byOrder)
      .map((t) => ({ ...t, carriedFrom: null }));
  }

  // Past day: tasks planned for that day (queued or done); no carryover tagging.
  return tasks
    .filter((t) => t.plannedDate === selectedDate)
    .sort(byOrder)
    .map((t) => ({ ...t, carriedFrom: null }));
}
