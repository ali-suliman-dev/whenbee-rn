import { useMemo } from 'react';
import { planBackward, resolveSuggestion, priorFor, CATEGORY_NAMES } from '@/src/engine';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { usePlanStore, type PlanDraftTask, type ActivePlan } from '@/src/stores/planStore';
import type { PlanResult, PlanTaskInput } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// usePlanner — composes the plan store + the pure backward-pass engine.
//
// Read-only consumer of the calibration engine: it never writes logs/stats. It
// resolves a learned honest duration for each new task (round5(guess × M)) and
// runs planBackward against an explicit nowMs so the screen stays deterministic
// and testable. Cut/push verdict actions and re-projection are surfaced here as
// pure functions over the store; nothing reshuffles without an explicit call.
// ──────────────────────────────────────────────────────────────────────────────

/** Title-case a custom-category slug (e.g. "deep_work" → "Deep Work"). */
function titleCaseSlug(slug: string): string {
  return slug
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function categoryName(id: string): string {
  return CATEGORY_NAMES[id] ?? titleCaseSlug(id);
}

/** A snapshot the diff sheet shows: old vs new startBy + per-task timeline. */
export interface ReprojectDiff {
  oldStartBy: number;
  newResult: PlanResult;
  oldTimeline: { id: string; label: string; startAt: number; endAt: number }[];
}

interface UsePlannerArgs {
  /** Inject a fixed clock for deterministic tests; defaults to Date.now(). */
  nowMs?: number;
}

export function usePlanner(args: UsePlannerArgs = {}) {
  const now = args.nowMs ?? Date.now();

  const statsByCategory = useCalibrationStore((s) => s.statsByCategory);
  const draft = usePlanStore((s) => s.draft);
  const active = usePlanStore((s) => s.active);

  const setDeadline = usePlanStore((s) => s.setDeadline);
  const setBuffer = usePlanStore((s) => s.setBuffer);
  const addTaskRaw = usePlanStore((s) => s.addTask);
  const updateTaskDuration = usePlanStore((s) => s.updateTaskDuration);
  const removeTask = usePlanStore((s) => s.removeTask);
  const reorderTasks = usePlanStore((s) => s.reorderTasks);
  const saveActive = usePlanStore((s) => s.saveActive);
  const clearActive = usePlanStore((s) => s.clearActive);

  /** The learned honest duration for a fresh task in `category` (round5(guess×M)). */
  function suggestedDuration(category: string, guessMinutes = 15): number {
    const cached = statsByCategory[category];
    const cat = cached
      ? { mEffective: cached.mEffective, n: cached.n }
      : { mEffective: priorFor(category), n: 0 };
    return resolveSuggestion({ guessMinutes, category: cat, recurring: null }).honestMinutes;
  }

  /** Add a task with its duration pre-filled from learned data (editable later). */
  function addTask(input: { label: string; category: string; guessMinutes?: number }): PlanDraftTask {
    return addTaskRaw({
      label: input.label,
      category: input.category,
      durationMin: suggestedDuration(input.category, input.guessMinutes ?? 15),
    });
  }

  const tasks: PlanTaskInput[] = draft.tasks.map((t) => ({
    id: t.id,
    label: t.label,
    category: t.category,
    durationMin: t.durationMin,
  }));

  /** Build the plan from the current draft, or null until a deadline is set. */
  const result: PlanResult | null = useMemo(() => {
    if (draft.deadline === null) return null;
    return planBackward({
      deadline: draft.deadline,
      tasks,
      bufferMin: draft.bufferMin,
      nowMs: now,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.deadline, draft.bufferMin, JSON.stringify(tasks), now]);

  /**
   * Apply a "cut" verdict: remove the named task(s) and let the draft rebuild.
   * `cut-one` passes one id; `multi-cut` passes several. Pure store edits — the
   * next render recomputes `result` and the plan should now fit.
   */
  function cut(ids: string[]): void {
    for (const id of ids) removeTask(id);
  }

  /** Apply a "push-deadline" verdict: move the finish to the feasible time. */
  function pushDeadline(feasibleDeadline: number): void {
    setDeadline(feasibleDeadline);
  }

  /**
   * Re-project the active plan against `now` WITHOUT applying it. Returns the
   * old startBy + old timeline alongside a freshly computed result so the UI can
   * render a diff + confirm. Applying is the caller's explicit job (applyReproject).
   */
  function reproject(activePlan: ActivePlan | null = active): ReprojectDiff | null {
    if (!activePlan) return null;
    const oldResult = planBackward({
      deadline: activePlan.deadline,
      tasks: activePlan.tasks,
      bufferMin: activePlan.bufferMin,
      nowMs: activePlan.createdAt,
    });
    const newResult = planBackward({
      deadline: activePlan.deadline,
      tasks: activePlan.tasks,
      bufferMin: activePlan.bufferMin,
      nowMs: now,
    });
    return {
      oldStartBy: oldResult.startBy,
      oldTimeline: oldResult.timeline,
      newResult,
    };
  }

  return {
    // state
    draft,
    active,
    result,
    now,
    // composition actions
    setDeadline,
    setBuffer,
    addTask,
    updateTaskDuration,
    removeTask,
    reorderTasks,
    suggestedDuration,
    // verdict actions
    cut,
    pushDeadline,
    // persistence + re-projection
    saveActive,
    clearActive,
    reproject,
    // helpers
    categoryName,
  };
}
