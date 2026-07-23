// src/features/today/useDaySoFar.ts
// Data assembly for the Today "Your day so far" recap card. Route stays thin —
// this hook derives the card's data from values the route's OWN `useToday()`
// call already computed (see index.tsx). It does NOT call `useToday()` itself:
// that hook is side-effectful (fires `honest_suggestion_shown` once per
// surfacing, mounts `useWidgetPublisher`) and must only ever be mounted once
// per screen — a second instance here would double-fire both.

import { useTimerStore } from '@/src/stores/timerStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import { logsToNextTier } from '@/src/engine';
import { daySoFarVisible } from '@/src/features/today/daySoFar';
import { leadHoney } from '@/src/features/today/leadHoney';
import type { HoneycombCell } from '@/src/components/honeycomb/Honeycomb';
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
  /** Sum of actualMin over today's completed logs. */
  totalMin: number;
  /** Honey ripeness (0..100) of the OVERALL lead category — the same
   * most-ripened-cell number the Today avatar ring / Whenbee hub show
   * (`leadHoney.ts`), NOT necessarily today's most recent log's category. */
  honeyPct: number;
  /** Display name of the milestone category — today's most recently completed
   * log's category. Deliberately separate from the HONEY stat above. */
  leadCategoryLabel: string;
  /** Logs still needed to cross the milestone category into its next tier; 0
   * at the top tier. */
  logsToNextTier: number;
}

/** Returns the recap data, or null when the card isn't visible right now. */
export function useDaySoFar({ done, totalCount, isToday }: UseDaySoFarParams): DaySoFar | null {
  const isTimerRunning = useTimerStore((s) => s.isRunning);
  const statsByCategory = useCalibrationStore((s) => s.statsByCategory);
  const categories = useCategoriesStore((s) => s.categories);

  if (!isToday) return null;

  const completedCount = done.length;
  // `upNext` only holds queued rows AFTER the current focus task, so the true
  // pending count is everything not yet done — totalCount minus done.length.
  const unfinishedCount = totalCount - completedCount;

  if (!daySoFarVisible(isTimerRunning, unfinishedCount, completedCount)) return null;

  // Milestone category = today's most recently completed log's category
  // (`done` is sorted most-recent-first by useToday). Separate from the HONEY
  // stat, which reads the overall lead cell below.
  const milestoneRow = done[0];
  if (milestoneRow === undefined) return null; // unreachable given the visibility gate above, satisfies noUncheckedIndexedAccess

  const totalMin = done.reduce((sum, row) => sum + (row.actualMin ?? 0), 0);

  // HONEY stat = the OVERALL lead (most-ripened) cell across every tracked
  // category — the same number the Today header ring / Whenbee hub show. Built
  // the same way index.tsx builds its honeyCells for TodayHeaderRing, so the
  // two numbers can never drift apart.
  const honeyCells: HoneycombCell[] = categories.map((c) => {
    const stat = statsByCategory[c.id];
    return {
      categoryId: c.id,
      label: c.name,
      sharpness: stat?.sharpness ?? 0,
      tier: stat?.tier ?? 'Raw',
    };
  });
  const honeyPct = leadHoney(honeyCells).sharpness;

  return {
    completedCount,
    totalMin,
    honeyPct,
    leadCategoryLabel: milestoneRow.categoryLabel,
    logsToNextTier: logsToNextTier(statsByCategory[milestoneRow.category]?.sharpness ?? 0),
  };
}

