// src/features/today/useDaySoFar.ts
// Data assembly for the Today "Your day so far" recap card. Route stays thin —
// this hook is the only place that reads the day-tasks + calibration stores for
// the card; DaySoFarCard itself only receives resolved values.

import { useToday } from '@/src/features/today/useToday';
import { useTimerStore } from '@/src/stores/timerStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { logsToNextTier } from '@/src/engine';
import { daySoFarVisible } from '@/src/features/today/daySoFar';

export interface DaySoFar {
  /** Number of tasks completed today. */
  completedCount: number;
  /** Sum of actualMin over today's completed logs. */
  totalMin: number;
  /** Honey ripeness (0..100) of the lead category — today's most recently
   * completed log's category. */
  honeyPct: number;
  /** Display name of the lead category. */
  leadCategoryLabel: string;
  /** Logs still needed to cross the lead category into its next tier; 0 at the
   * top tier. */
  logsToNextTier: number;
}

/** Returns the recap data, or null when the card isn't visible right now. */
export function useDaySoFar(): DaySoFar | null {
  const { done, totalCount } = useToday();
  const isTimerRunning = useTimerStore((s) => s.isRunning);
  const statsByCategory = useCalibrationStore((s) => s.statsByCategory);

  const completedCount = done.length;
  // `upNext` only holds queued rows AFTER the current focus task, so the true
  // pending count is everything not yet done — totalCount minus done.length.
  const unfinishedCount = totalCount - completedCount;

  if (!daySoFarVisible(isTimerRunning, unfinishedCount, completedCount)) return null;

  // Lead category = today's most recently completed log's category (`done` is
  // sorted most-recent-first by useToday).
  const lead = done[0];
  if (lead === undefined) return null; // unreachable given the visibility gate above, satisfies noUncheckedIndexedAccess

  const totalMin = done.reduce((sum, row) => sum + (row.actualMin ?? 0), 0);
  const stat = statsByCategory[lead.category];
  const honeyPct = stat?.sharpness ?? 0;

  return {
    completedCount,
    totalMin,
    honeyPct,
    leadCategoryLabel: lead.categoryLabel,
    logsToNextTier: logsToNextTier(honeyPct),
  };
}

