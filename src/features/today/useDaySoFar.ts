// src/features/today/useDaySoFar.ts
// Data assembly for the Today "Your day so far" recap card. Route stays thin —
// this hook is the only place that reads the day-tasks + calibration stores for
// the card; DaySoFarCard itself only receives resolved values.

import { useToday } from '@/src/features/today/useToday';
import { useTimerStore } from '@/src/stores/timerStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import { logsToNextTier } from '@/src/engine';
import { daySoFarVisible } from '@/src/features/today/daySoFar';
import { leadHoney } from '@/src/features/today/leadHoney';
import type { HoneycombCell } from '@/src/components/honeycomb/Honeycomb';

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
export function useDaySoFar(): DaySoFar | null {
  const { done, totalCount } = useToday();
  const isTimerRunning = useTimerStore((s) => s.isRunning);
  const statsByCategory = useCalibrationStore((s) => s.statsByCategory);
  const categories = useCategoriesStore((s) => s.categories);

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

