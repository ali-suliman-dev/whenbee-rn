import { useCallback, useMemo, useState } from 'react';
import {
  planBackward,
  reproject as engineReproject,
  resolveSuggestion,
  priorFor,
  CATEGORY_NAMES,
} from '@/src/engine';
import type { ReprojectResult } from '@/src/engine/planner';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { analytics } from '@/src/services/analytics';
import { scheduleStartBy, cancelStartBy } from '@/src/services/timerNotifications';
import { usePlanStore, type PlanDraftTask, type ActivePlan } from '@/src/stores/planStore';
import type { PlanResult, PlanTaskInput, PlanVerdict } from '@/src/domain/types';

/** Whether the plan fits as-is. Anything but a clean `fits` is "over". */
function verdictStatus(verdict: PlanVerdict): 'fits' | 'over' {
  return verdict.kind === 'fits' ? 'fits' : 'over';
}

/** Minutes a verdict would free by cutting (0 when nothing needs cutting). */
function verdictFreedMin(verdict: PlanVerdict): number {
  if (verdict.kind === 'cut-one' || verdict.kind === 'multi-cut') return verdict.savedMin;
  if (verdict.kind === 'push-deadline') return verdict.overshootMin;
  return 0;
}

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

/** Grouped active-plan tasks by run lifecycle status. */
export interface RunGroups {
  done: PlanDraftTask[];
  now: PlanDraftTask[];
  next: PlanDraftTask[];
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
  const setBreatherRaw = usePlanStore((s) => s.setBreather);
  const addTaskRaw = usePlanStore((s) => s.addTask);
  const updateTaskDuration = usePlanStore((s) => s.updateTaskDuration);
  const removeTask = usePlanStore((s) => s.removeTask);
  const reorderTasks = usePlanStore((s) => s.reorderTasks);
  const saveActiveRaw = usePlanStore((s) => s.saveActive);
  const clearActiveRaw = usePlanStore((s) => s.clearActive);

  // ── Phase selector ──────────────────────────────────────────────────────────
  /** 'run' when an active plan is loaded; 'build' while composing the draft. */
  const phase: 'build' | 'run' = active !== null ? 'run' : 'build';

  // ── Cut-card state ──────────────────────────────────────────────────────────
  // Held locally: the pending over-verdict from reprojectForCut, shown as a card
  // until the user accepts (removes tasks) or dismisses (ignores).
  const [cut, setCut] = useState<ReprojectResult | null>(null);

  /** The learned honest duration for a fresh task in `category` (round5(guess×M)). */
  function suggestedDuration(category: string, guessMinutes = 15): number {
    const cached = statsByCategory[category];
    const cat = cached
      ? { fit: cached.fit, n: cached.n }
      : { fit: { a: 0, b: priorFor(category) }, n: 0 };
    return resolveSuggestion({ guessMinutes, category: cat, recurring: null }).honestMinutes;
  }

  /** Add a task with its duration pre-filled from learned data (editable later). */
  function addTask(input: { label: string; category: string; guessMinutes?: number; durationMin?: number }): PlanDraftTask {
    return addTaskRaw({
      label: input.label,
      category: input.category,
      durationMin: input.durationMin ?? suggestedDuration(input.category, input.guessMinutes ?? 15),
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
      // C2: breatherMin must be passed so build-view feedback reflects breathers.
      breatherMin: draft.breatherMin,
      nowMs: now,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.deadline, draft.bufferMin, draft.breatherMin, JSON.stringify(tasks), now]);

  /**
   * Apply a "cut" verdict: remove the named task(s) and let the draft rebuild.
   * Passes one id for `cut-one`; several for `multi-cut`. Pure store edits — the
   * next render recomputes `result` and the plan should now fit.
   */
  function cutTasks(ids: string[]): void {
    // Capture the freed minutes from the CURRENT verdict before the cut mutates
    // the draft (the next result is what the cut produced, not what it freed).
    const freedMin = result ? verdictFreedMin(result.verdict) : 0;
    for (const id of ids) removeTask(id);
    analytics.capture('plan_cut_one', {
      n_tasks: draft.tasks.length - ids.length,
      status: 'fits',
      freed_min: freedMin,
    });
  }

  /** Apply a "push-deadline" verdict: move the finish to the feasible time. */
  function pushDeadline(feasibleDeadline: number): void {
    setDeadline(feasibleDeadline);
  }

  /** Freeze the current draft into the active plan and record that a plan was
   *  built (the §2 funnel event). `freed_min` is 0 at build time — nothing has
   *  been cut yet; status reflects whether the built plan fits. */
  const saveActive = useCallback(
    (nowMs?: number) => {
      saveActiveRaw(nowMs);
      if (!result) return;
      analytics.capture('plan_built', {
        n_tasks: draft.tasks.length,
        status: verdictStatus(result.verdict),
        freed_min: 0,
      });
      // G17 — schedule the "start by" nudge (opt-in; off unless reminders are on
      // and the start-by ping type is enabled). Reads non-reactively at save time.
      const settings = useSettingsStore.getState();
      const first = result.timeline[0];
      if (settings.remindersEnabled && settings.startByEnabled && first && draft.deadline !== null) {
        void scheduleStartBy({
          startByMs: result.startBy,
          firstTaskLabel: first.label,
          deadlineMs: draft.deadline,
        });
      }
    },
    [saveActiveRaw, result, draft.tasks.length, draft.deadline],
  );

  // Clearing the active plan cancels its pending start-by nudge.
  const clearActive = useCallback(() => {
    void cancelStartBy();
    clearActiveRaw();
  }, [clearActiveRaw]);

  /** Delegate to the store's setBreather; nowMs is a hook boundary concern. */
  function setBreather(min: number): void {
    setBreatherRaw(min);
  }

  // ── Run-phase task groups ───────────────────────────────────────────────────
  /** Tasks from the active plan split by run lifecycle status. */
  const runGroups: RunGroups = useMemo(() => {
    if (!active) return { done: [], now: [], next: [] };
    return active.tasks.reduce<RunGroups>(
      (groups, task) => {
        if (task.status === 'done') groups.done.push(task);
        else if (task.status === 'running') groups.now.push(task);
        else groups.next.push(task);
        return groups;
      },
      { done: [], now: [], next: [] },
    );
  }, [active]);

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
    analytics.capture('plan_reprojected', {
      n_tasks: activePlan.tasks.length,
      status: verdictStatus(newResult.verdict),
      freed_min: verdictFreedMin(newResult.verdict),
    });
    return {
      oldStartBy: oldResult.startBy,
      oldTimeline: oldResult.timeline,
      newResult,
    };
  }

  // ── Cut-card: engine reproject → cut state ─────────────────────────────────
  /**
   * Run the engine's `reproject` over the active plan's incomplete tasks.
   * If the result is not `stillFits`, captures the verdict into `cut` state so
   * the UI can show a cut card. Returns the raw ReprojectResult for callers that
   * want to inspect it immediately (e.g. tests).
   *
   * `nowMs` is supplied at the hook boundary; the engine stays pure.
   */
  function reprojectForCut(activePlan: ActivePlan | null = active): ReprojectResult | null {
    if (!activePlan) return null;
    const reprojectResult = engineReproject({
      deadline: activePlan.deadline,
      tasks: activePlan.tasks,
      bufferMin: activePlan.bufferMin,
      breatherMin: activePlan.breatherMin,
      nowMs: now,
    });
    if (!reprojectResult.stillFits) {
      setCut(reprojectResult);
    }
    return reprojectResult;
  }

  /**
   * Apply the pending cut: remove the task(s) the verdict named from the active
   * plan's task list, then clear the cut state. The store's task removal drives
   * re-render; the plan will rebuild on the next reproject call.
   */
  const acceptCut = useCallback(() => {
    if (!cut) return;
    const verdict = cut.verdict;
    if (verdict.kind === 'cut-one') {
      removeTask(verdict.cut.id);
    } else if (verdict.kind === 'multi-cut') {
      for (const c of verdict.cuts) removeTask(c.id);
    }
    setCut(null);
  }, [cut, removeTask]);

  /** Clear the pending cut card without applying any task removals. */
  function dismissCut(): void {
    setCut(null);
  }

  return {
    // phase
    phase,
    // state
    draft,
    active,
    result,
    now,
    // run-phase groups
    runGroups,
    // cut-card state
    cut,
    // composition actions
    setDeadline,
    setBuffer,
    setBreather,
    addTask,
    updateTaskDuration,
    removeTask,
    reorderTasks,
    suggestedDuration,
    // verdict actions (build phase)
    cutTasks,
    pushDeadline,
    // persistence + re-projection
    saveActive,
    clearActive,
    reproject,
    // cut-card actions (run phase)
    reprojectForCut,
    acceptCut,
    dismissCut,
    // helpers
    categoryName,
  };
}
