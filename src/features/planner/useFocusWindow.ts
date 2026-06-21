import { useCallback, useMemo, useState } from 'react';
import { fitFocusWindow, promoteIntoWindow } from '@/src/engine';
import type { FocusWindowResult } from '@/src/domain/types';
import { usePlanStore } from '@/src/stores/planStore';
import { useTasksStore } from '@/src/stores/tasksStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { resolveHonestTasks } from './resolveHonestTasks';

// ──────────────────────────────────────────────────────────────────────────────
// useFocusWindow — composes the pure focus-window engine with the planning stores.
//
// Resolves the deduped union of plan-draft + Today tasks to honest minutes (in
// draft order = priority), drops done tasks, then packs them into the user's
// fixed focus window. Returns null while the window is unset (the invite state).
// `promote` runs the pure eviction promote and holds the result in local state so
// the UI reflects the bump immediately — no store write, nothing logged/trained.
// ──────────────────────────────────────────────────────────────────────────────

export interface UseFocusWindowResult {
  /** The packed fit, or null when the window is unset (invite state). */
  result: FocusWindowResult | null;
  /** True once both window bounds are set. */
  hasWindow: boolean;
  /** Persist the window (two minute-of-day integers). */
  setWindow: (startMin: number, endMin: number) => void;
  /** Promote a spilled task into the window (local overlay; no store write). */
  promote: (taskId: string) => void;
}

export function useFocusWindow(): UseFocusWindowResult {
  const draftTasks = usePlanStore((s) => s.draft.tasks);
  const todayTasks = useTasksStore((s) => s.tasks);
  const statsByCategory = useCalibrationStore((s) => s.statsByCategory);
  const windowStartMin = useSettingsStore((s) => s.windowStartMin);
  const windowEndMin = useSettingsStore((s) => s.windowEndMin);
  const setFocusWindow = useSettingsStore((s) => s.setFocusWindow);

  const hasWindow = windowStartMin !== null && windowEndMin !== null;

  // A local overlay holding the post-promote result. Cleared whenever the base
  // fit recomputes (a new fit means the bump no longer applies).
  const [overlay, setOverlay] = useState<FocusWindowResult | null>(null);

  const baseResult = useMemo<FocusWindowResult | null>(() => {
    if (windowStartMin === null || windowEndMin === null) return null;
    const resolved = resolveHonestTasks({ draftTasks, todayTasks, statsByCategory });
    const active = resolved.tasks.filter((task) => !task.done);
    return fitFocusWindow(
      {
        tasks: active.map((task) => ({ id: task.id, label: task.label, honestMin: task.honestMin })),
        windowStartMin,
        windowEndMin,
      },
      resolved.basis,
    );
  }, [draftTasks, todayTasks, statsByCategory, windowStartMin, windowEndMin]);

  // Drop a stale overlay when its underlying fit no longer matches (identity
  // changed → the promote was against a different task set).
  const baseSignature = useMemo(
    () =>
      baseResult
        ? `${baseResult.windowMin}|${baseResult.inWindow.map((p) => p.id).join(',')}|${baseResult.spilled
            .map((p) => p.id)
            .join(',')}`
        : '',
    [baseResult],
  );
  const [overlaySignature, setOverlaySignature] = useState('');
  const result = overlay !== null && overlaySignature === baseSignature ? overlay : baseResult;

  const setWindow = useCallback(
    (startMin: number, endMin: number) => {
      setFocusWindow(startMin, endMin);
      setOverlay(null);
    },
    [setFocusWindow],
  );

  const promote = useCallback(
    (taskId: string) => {
      if (!baseResult) return;
      const next = promoteIntoWindow(result ?? baseResult, taskId);
      setOverlay(next);
      setOverlaySignature(baseSignature);
    },
    [baseResult, result, baseSignature],
  );

  return { result, hasWindow, setWindow, promote };
}
