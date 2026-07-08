/**
 * useDayPlan — resolves the selected day's queued tasks into a backward schedule
 * around fixed calendar event anchors (meetings).
 *
 * Orchestrates:
 *   1. Honest-minute resolution (same pattern as useDayCapacity / useToday).
 *   2. Focus-aware ordering via orderForFocus (deep tasks surface first so the
 *      backward pass tends to land them in the learned focus window).
 *   3. Calendar anchor extraction from useDayCapacity's timed events.
 *   4. planDayAroundAnchors (pure engine).
 *
 * isDeep definition: a task whose honest estimate is at least 30% over the
 * user's guess (honestMin >= guessMin * 1.3), meaning the calibration engine
 * expects the task to be a real time sink — worth prioritising early in the day.
 *
 * Layer rule: this hook reads stores + services only; no direct db imports.
 */

import { useMemo } from 'react';
import { useDayTasksStore } from '@/src/stores/dayTasksStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useDayCapacity } from '@/src/features/today/useDayCapacity';
import { useLearnedFocusWindow } from '@/src/features/planner/useLearnedFocusWindow';
import { resolveSuggestion, priorFor } from '@/src/engine';
import { orderForFocus } from '@/src/engine/focusOrder';
import { planDayAroundAnchors } from '@/src/engine/planDayAroundAnchors';
import type { PlanTaskInput, PlanResult } from '@/src/domain/types';
import type { PlanAnchor } from '@/src/engine/planDayAroundAnchors';
import { WAKING_START_MIN, WAKING_END_MIN } from '@/src/engine/constants';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Local midnight (epoch ms) for a 'YYYY-MM-DD' key. */
function localMidnight(dayKey: string): number {
  const [y, m, d] = dayKey.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseDayPlanResult {
  /** The computed plan, or null when there are no queued tasks (status 'empty'). */
  plan: PlanResult | null;
  /** 'empty' when no queued tasks; 'ready' when the plan has been computed. */
  status: 'empty' | 'ready';
  /** The stored "done by" minute-of-day for the selected date, or null. */
  doneByMin: number | null;
  /** Write a new "done by" target for the selected date (persisted via the store). */
  setDoneBy: (m: number | null) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Compute a focus-aware backward schedule for the selected day.
 *
 * @param nowMs - Current epoch ms. Defaults to Date.now(). Exposed for testing.
 */
export function useDayPlan(nowMs?: number): UseDayPlanResult {
  const now = nowMs ?? Date.now();

  // ── Store reads ─────────────────────────────────────────────────────────────
  const selectedDate = useDayTasksStore((s) => s.selectedDate);
  const dayTasks = useDayTasksStore((s) => s.dayTasks);
  const dayMeta = useDayTasksStore((s) => s.dayMeta);
  const hasManualOrder = useDayTasksStore((s) => s.hasManualOrder);
  const storeSetDoneBy = useDayTasksStore((s) => s.setDoneBy);

  // ── Calibration stats ────────────────────────────────────────────────────────
  const statsByCategory = useCalibrationStore((s) => s.statsByCategory);

  // ── Calendar anchors (timed events only — all-day events are NOT anchors) ───
  // We pass nowMs through so tests can override the clock.
  const capacity = useDayCapacity(now);

  // ── Learned focus window ──────────────────────────────────────────────────
  const focusWindow = useLearnedFocusWindow(now);

  // ── Queued tasks only ────────────────────────────────────────────────────
  const queuedTasks = useMemo(
    () => dayTasks.filter((t) => t.status === 'queued'),
    [dayTasks],
  );

  // ── Resolve honest minutes for each queued task ───────────────────────────
  // Same pattern as useDayCapacity and useToday: guess × M_eff via resolveSuggestion.
  const resolvedTasks = useMemo(() => {
    return queuedTasks.map((t) => {
      const cached = statsByCategory[t.category];
      const cat = cached
        ? { fit: cached.fit, n: cached.n }
        : { fit: { a: 0, b: priorFor(t.category) }, n: 0 };
      const { honestMinutes } = resolveSuggestion({
        guessMinutes: t.guessMin,
        category: cat,
        recurring: null,
      });
      return { task: t, honestMin: honestMinutes };
    });
  }, [queuedTasks, statsByCategory]);

  // ── Ordering: manual drag order wins, else focus-aware ordering ───────────
  // When the day has a user-set manual order (Task 4: drag-to-reorder), honor
  // it verbatim (sorted by orderIndex) and SKIP the deep-first reshuffle below
  // — the user has already decided the sequence.
  // Otherwise: isDeep = honestMin >= guessMin * 1.3 (the engine estimates the
  // task is a real time sink — at least 30% over the user's guess). Deep tasks
  // surface first so the backward pass tends to place them in the focus window.
  const orderedResolved = useMemo(() => {
    if (hasManualOrder) {
      return resolvedTasks.slice().sort((a, b) => a.task.orderIndex - b.task.orderIndex);
    }
    return orderForFocus(resolvedTasks, {
      focusWindowStartMin: focusWindow.startMin,
      focusWindowEndMin: focusWindow.endMin,
      isDeep: (r) => r.honestMin >= r.task.guessMin * 1.3,
    });
  }, [resolvedTasks, hasManualOrder, focusWindow.startMin, focusWindow.endMin]);

  // ── Build PlanTaskInput[] ─────────────────────────────────────────────────
  const planTasks = useMemo((): PlanTaskInput[] => {
    return orderedResolved.map((r) => ({
      id: r.task.id,
      label: r.task.label,
      category: r.task.category,
      durationMin: r.honestMin,
    }));
  }, [orderedResolved]);

  // ── Build anchors from timed calendar events ──────────────────────────────
  const anchors = useMemo((): PlanAnchor[] => {
    return capacity.events.map((e) => ({
      id: e.id,
      label: e.title,
      startMs: e.startMs,
      endMs: e.endMs,
    }));
  }, [capacity.events]);

  // ── Compute timing bounds ──────────────────────────────────────────────────
  const midnight = useMemo(() => localMidnight(selectedDate), [selectedDate]);

  const dayStartMs = useMemo(
    () => Math.max(now, midnight + WAKING_START_MIN * 60_000),
    [now, midnight],
  );

  const deadlineMs = useMemo(() => {
    const doneByMin = dayMeta?.doneByMin ?? WAKING_END_MIN;
    return midnight + doneByMin * 60_000;
  }, [midnight, dayMeta?.doneByMin]);

  // ── Run the engine ────────────────────────────────────────────────────────
  const plan = useMemo((): PlanResult | null => {
    if (planTasks.length === 0) return null;

    return planDayAroundAnchors({
      deadline: deadlineMs,
      nowMs: now,
      dayStartMs,
      tasks: planTasks,
      anchors,
    });
  }, [planTasks, anchors, deadlineMs, now, dayStartMs]);

  // ── setDoneBy: wraps the store action, no need for useCallback in a hook ───
  const setDoneBy = (m: number | null): void => {
    void storeSetDoneBy(m);
  };

  return {
    plan,
    status: plan === null ? 'empty' : 'ready',
    doneByMin: dayMeta?.doneByMin ?? null,
    setDoneBy,
  };
}
