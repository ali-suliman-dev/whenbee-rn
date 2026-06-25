// src/engine/daySelectors.ts
// PURE day-membership rules (no Date, no I/O). Decides which tasks appear on a
// selected day and tags carryover. See spec 2026-06-24 §4.2. No-guilt: carryover
// is a neutral tag (carriedFrom), never an "overdue" flag.
//
// C1 contract: done tasks are ALREADY scoped to the selected day by the caller
// (completedAt window) and are included as-is. The selector applies plannedDate
// rules only to the `queued` set. This means a done task belongs to the local
// day of its completedAt, regardless of plannedDate.

import type { Task } from '@/src/domain/types';
import { compareDayKeys } from '@/src/lib/day';

export interface DayTask extends Task {
  /** Original plannedDate when this queued task carried over onto today; else null. */
  carriedFrom: string | null;
}

export interface DaySelectorInput {
  /** Candidate queued tasks — plannedDate rules applied to this set. */
  queued: readonly Task[];
  /** Done tasks ALREADY scoped to the selected day by the caller (completedAt window). Included as-is. */
  done: readonly Task[];
  selectedDate: string;
  today: string;
}

function byOrder(a: Task, b: Task): number {
  return a.orderIndex - b.orderIndex;
}

export function tasksForSelectedDay({ queued, done, selectedDate, today }: DaySelectorInput): DayTask[] {
  const cmp = compareDayKeys(selectedDate, today);
  const doneItems: DayTask[] = done.map((t) => ({ ...t, carriedFrom: null }));

  if (cmp === 0) {
    // Today: queued with plannedDate <= today (carryover surfaces). Done appended as-is.
    const queuedItems = queued
      .filter((t) => t.plannedDate !== null && compareDayKeys(t.plannedDate, today) <= 0)
      .sort(byOrder)
      .map((t) => ({ ...t, carriedFrom: t.plannedDate !== today ? t.plannedDate : null }));
    return [...queuedItems, ...doneItems];
  }

  if (cmp > 0) {
    // Future day: only queued tasks planned for exactly that day; never carryover. Done appended as-is.
    const queuedItems = queued
      .filter((t) => t.plannedDate === selectedDate)
      .sort(byOrder)
      .map((t) => ({ ...t, carriedFrom: null }));
    return [...queuedItems, ...doneItems];
  }

  // Past day: queued tasks planned for that day; no carryover tagging. Done appended as-is.
  const queuedItems = queued
    .filter((t) => t.plannedDate === selectedDate)
    .sort(byOrder)
    .map((t) => ({ ...t, carriedFrom: null }));
  return [...queuedItems, ...doneItems];
}
