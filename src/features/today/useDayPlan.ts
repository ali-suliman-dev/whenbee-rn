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
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useDayCapacity } from '@/src/features/today/useDayCapacity';
import { useLearnedFocusWindow } from '@/src/features/planner/useLearnedFocusWindow';
import { resolveSuggestion, seededPriorFor } from '@/src/engine';
import { orderForFocus } from '@/src/engine/focusOrder';
import { planDayAroundAnchors } from '@/src/engine/planDayAroundAnchors';
import type { PlanTaskInput, PlanResult } from '@/src/domain/types';
import type { PlanAnchor, PlanFill } from '@/src/engine/planDayAroundAnchors';
import type { PlanAnchorSide } from '@/src/stores/dayTasksStore';
import {
  WAKING_START_MIN,
  WAKING_END_MIN,
  MIN_START_LEAD_MIN,
} from '@/src/engine/constants';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MS_PER_MIN = 60_000;

/** Local midnight (epoch ms) for a 'YYYY-MM-DD' key. */
function localMidnight(dayKey: string): number {
  const [y, m, d] = dayKey.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}

/** When the last task block in a plan ends, or null if nothing was placed. */
function finishOf(plan: PlanResult | null): number | null {
  if (plan === null) return null;
  const ends = plan.timeline.filter((i) => i.kind === 'task').map((i) => i.endAt);
  return ends.length === 0 ? null : Math.max(...ends);
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
  /** The stored start minute-of-day, or null for the live "Now" anchor. */
  startAtMin: number | null;
  /** Pin a start minute, or null for "Use now". Also selects the start row. */
  setStartAt: (m: number | null) => void;
  /** Which end of the day is fixed. */
  planAnchor: PlanAnchorSide;
  /** Select which end is fixed without changing either value. */
  setPlanAnchor: (side: PlanAnchorSide) => void;
  /**
   * When the day finishes if the START is the fixed end — the start row's derived
   * clock. Computed even while the finish row is selected: the chooser shows the
   * unselected row's outcome too, so the choice is a comparison, not a guess.
   * Null when there is nothing to place.
   */
  derivedFinishMs: number | null;
  /**
   * The latest moment work can begin if the FINISH is the fixed end — the finish
   * row's derived clock. Also always computed. Null when there is nothing to place.
   */
  derivedStartByMs: number | null;
  /**
   * Where the forward plan actually begins: the pinned start, or now + the lead
   * floor when that start has already gone by. Reading "starting 14:20".
   */
  effectiveStartMs: number;
  /**
   * True when a pinned start is earlier than effectiveStartMs — the "09:30 has
   * passed · starting 14:20" case. Their minute is kept in state untouched; this
   * only tells the UI to state what is actually happening. Never true for the
   * live Now anchor, which cannot pass.
   */
  startHasPassed: boolean;
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
  const startAtMin = useDayTasksStore((s) => s.startAtMin);
  const planAnchor = useDayTasksStore((s) => s.planAnchor);
  const setStartAt = useDayTasksStore((s) => s.setStartAt);
  const setPlanAnchor = useDayTasksStore((s) => s.setPlanAnchor);

  // ── Calibration stats ────────────────────────────────────────────────────────
  const statsByCategory = useCalibrationStore((s) => s.statsByCategory);
  const archetypeSeed = useSettingsStore((s) => s.archetypeSeed);

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
        : { fit: { a: 0, b: seededPriorFor(t.category, archetypeSeed) }, n: 0 };
      const { honestMinutes } = resolveSuggestion({
        guessMinutes: t.guessMin,
        category: cat,
        recurring: null,
      });
      return { task: t, honestMin: honestMinutes };
    });
  }, [queuedTasks, statsByCategory, archetypeSeed]);

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

  // Earliest schedulable instant: the waking-window floor, or a short grace from
  // now if the day is already underway. MIN_START_LEAD_MIN keeps a start-by from
  // landing in the past between render and the user reading it.
  const dayStartMs = useMemo(
    () => Math.max(now + MIN_START_LEAD_MIN * 60_000, midnight + WAKING_START_MIN * 60_000),
    [now, midnight],
  );

  const deadlineMs = useMemo(() => {
    const doneByMin = dayMeta?.doneByMin ?? WAKING_END_MIN;
    return midnight + doneByMin * 60_000;
  }, [midnight, dayMeta?.doneByMin]);

  // ── The start anchor ──────────────────────────────────────────────────────
  // A pinned minute is theirs and is never rewritten; a null startAtMin is the
  // LIVE "Now" anchor and re-derives from the clock on every render. The floor
  // is only about where blocks land — the engine applies the same one, this
  // mirror exists so the UI can say which of the two numbers it used.
  const pinnedStartMs = startAtMin === null ? now : midnight + startAtMin * MS_PER_MIN;
  const startFloorMs = now + MIN_START_LEAD_MIN * MS_PER_MIN;
  const effectiveStartMs = Math.max(pinnedStartMs, startFloorMs);
  const startHasPassed = startAtMin !== null && pinnedStartMs < startFloorMs;

  // ── Run the engine, from BOTH ends ────────────────────────────────────────
  // Both passes always run: the chooser renders the unselected row's derived
  // clock alongside the selected one, so a single directional plan is not enough.
  const { backwardPlan, forwardPlan } = useMemo((): {
    backwardPlan: PlanResult | null;
    forwardPlan: PlanResult | null;
  } => {
    if (planTasks.length === 0) return { backwardPlan: null, forwardPlan: null };
    const base = {
      deadline: deadlineMs,
      nowMs: now,
      dayStartMs,
      tasks: planTasks,
      anchors,
    };
    const forwardFill: PlanFill = { direction: 'forward', startAtMs: pinnedStartMs };
    return {
      backwardPlan: planDayAroundAnchors({ ...base, fill: { direction: 'backward' } }),
      forwardPlan: planDayAroundAnchors({ ...base, fill: forwardFill }),
    };
  }, [planTasks, anchors, deadlineMs, now, dayStartMs, pinnedStartMs]);

  const plan = planAnchor === 'start' ? forwardPlan : backwardPlan;

  // ── setDoneBy: wraps the store action, no need for useCallback in a hook ───
  const setDoneBy = (m: number | null): void => {
    void storeSetDoneBy(m);
  };

  return {
    plan,
    status: plan === null ? 'empty' : 'ready',
    doneByMin: dayMeta?.doneByMin ?? null,
    setDoneBy,
    startAtMin,
    setStartAt,
    planAnchor,
    setPlanAnchor,
    derivedFinishMs: finishOf(forwardPlan),
    derivedStartByMs: backwardPlan?.startBy ?? null,
    effectiveStartMs,
    startHasPassed,
  };
}
