// src/features/today/useDaySoFar.ts
// Data assembly for the Today "Your day so far" recap card. Route stays thin —
// this hook derives the card's data from values the route's OWN `useToday()`
// call already computed (see index.tsx). It does NOT call `useToday()` itself:
// that hook is side-effectful (fires `honest_suggestion_shown` once per
// surfacing, mounts `useWidgetPublisher`) and must only ever be mounted once
// per screen — a second instance here would double-fire both.

import { useTimerStore } from '@/src/stores/timerStore';
import { daySoFarVisible } from '@/src/features/today/daySoFar';
import type { TodayRow } from '@/src/features/today/useToday';

export interface UseDaySoFarParams {
  /** Today's completed rows, most-recent-first — the route's `useToday().done`. */
  done: TodayRow[];
  /** Total tasks on the selected day — the route's `useToday().totalCount`. */
  totalCount: number;
  /** True only when the selected day IS today. The recap never shows on a
   * past or future day, so callers viewing another day should pass false. */
  isToday: boolean;
}

export interface DaySoFar {
  /** Number of tasks completed today. */
  completedCount: number;
  /** Sum of the original guesses over today's completed logs (minutes). */
  guessedMin: number;
  /** Sum of actualMin over today's completed logs — the honest total (minutes). */
  totalMin: number;
}

/** Returns the recap data, or null when the card isn't visible right now. */
export function useDaySoFar({ done, totalCount, isToday }: UseDaySoFarParams): DaySoFar | null {
  const isTimerRunning = useTimerStore((s) => s.isRunning);

  if (!isToday) return null;

  const completedCount = done.length;
  // `upNext` only holds queued rows AFTER the current focus task, so the true
  // pending count is everything not yet done — totalCount minus done.length.
  const unfinishedCount = totalCount - completedCount;

  if (!daySoFarVisible(isTimerRunning, unfinishedCount, completedCount)) return null;

  // Guessed = the sum of the user's original guesses; honest = what it really
  // took (actualMin, null treated as 0). The card puts these two side by side —
  // that comparison is the whole point of the recap.
  const guessedMin = done.reduce((sum, row) => sum + row.guessMin, 0);
  const totalMin = done.reduce((sum, row) => sum + (row.actualMin ?? 0), 0);

  return { completedCount, guessedMin, totalMin };
}

