import type { FocusWindowResult, FocusWindowPlacement } from '../domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// focusWindow — the Pro focus-window first-fit packer (PURE).
//
// The user marks the hours their head works best (a fixed time-of-day band). The
// app packs their honest-numbered tasks into that band IN PRIORITY ORDER (the
// caller supplies the order = the user's draft order) and lists what spills past
// it. First-fit: a task that doesn't fit is skipped and we keep trying later,
// smaller tasks, so the window stays full while top priorities keep their place.
//
// No clock, no Date.now(), no mutation of inputs — every time-of-day value is a
// plain integer the caller passes in. Amber-never-red by construction.
// ──────────────────────────────────────────────────────────────────────────────

export interface FocusWindowTask {
  id: string;
  label: string;
  /** Resolved honest number (round5(guess × M)); never the raw guess. */
  honestMin: number;
}

export interface FocusWindowInput {
  /** Tasks in PRIORITY order (caller supplies the order = the user's draft order). */
  tasks: readonly FocusWindowTask[];
  /** Minutes-after-midnight, window start. */
  windowStartMin: number;
  /** Minutes-after-midnight, window end (> start). */
  windowEndMin: number;
}

/** Window length in minutes, floored at 0 (handles start ≥ end defensively). */
export function focusWindowMinutes(input: {
  windowStartMin: number;
  windowEndMin: number;
}): number {
  return Math.max(0, input.windowEndMin - input.windowStartMin);
}

function place(task: FocusWindowTask, inWindow: boolean): FocusWindowPlacement {
  return { id: task.id, label: task.label, honestMin: task.honestMin, inWindow };
}

function buildResult(
  windowMin: number,
  inWindow: FocusWindowPlacement[],
  spilled: FocusWindowPlacement[],
  basis: 'personal' | 'prior',
): FocusWindowResult {
  const packedMin = inWindow.reduce((sum, p) => sum + p.honestMin, 0);
  return {
    windowMin,
    packedMin,
    inWindow,
    spilled,
    verdict: spilled.length > 0 ? 'spills' : 'fits',
    fitCount: inWindow.length,
    totalCount: inWindow.length + spilled.length,
    basis,
  };
}

/**
 * First-fit pack in priority order: a task goes in-window if it fits the
 * remaining space, else it spills (and we keep trying later, smaller tasks).
 * Order-preserving within each list. Pure — never mutates inputs.
 */
export function fitFocusWindow(
  input: FocusWindowInput,
  basis: 'personal' | 'prior',
): FocusWindowResult {
  const windowMin = focusWindowMinutes(input);
  let remaining = windowMin;
  const inWindow: FocusWindowPlacement[] = [];
  const spilled: FocusWindowPlacement[] = [];
  for (const task of input.tasks) {
    if (task.honestMin <= remaining) {
      inWindow.push(place(task, true));
      remaining -= task.honestMin;
    } else {
      spilled.push(place(task, false));
    }
  }
  return buildResult(windowMin, inWindow, spilled, basis);
}

/** Index of the smallest in-window placement; ties → later-in-order (so earlier
 *  priorities survive eviction). Returns -1 when the list is empty. */
function smallestEvictableIndex(inWindow: readonly FocusWindowPlacement[]): number {
  if (inWindow.length === 0) return -1;
  let evictIdx = 0;
  for (let i = 1; i < inWindow.length; i += 1) {
    const candidate = inWindow[i] as FocusWindowPlacement;
    const best = inWindow[evictIdx] as FocusWindowPlacement;
    if (candidate.honestMin < best.honestMin || candidate.honestMin === best.honestMin) {
      // Strictly-smaller wins; on a tie, prefer the later index (i > evictIdx).
      if (candidate.honestMin < best.honestMin || i > evictIdx) evictIdx = i;
    }
  }
  return evictIdx;
}

/**
 * Promote a spilled task into the window, evicting the SMALLEST in-window
 * task(s) (ties → later-in-order first) until it fits. Returns a NEW result;
 * pure. An unknown id, or a task too large to fit even an empty window, leaves
 * the result unchanged (we never tell the user a needed task is "impossible").
 */
export function promoteIntoWindow(
  res: FocusWindowResult,
  taskId: string,
): FocusWindowResult {
  const target = res.spilled.find((p) => p.id === taskId);
  if (!target) return res;
  if (target.honestMin > res.windowMin) return res;

  const inWindow = [...res.inWindow];
  const spilled = res.spilled.filter((p) => p.id !== taskId);
  let free = res.windowMin - inWindow.reduce((sum, p) => sum + p.honestMin, 0);

  while (target.honestMin > free && inWindow.length > 0) {
    const evictIdx = smallestEvictableIndex(inWindow);
    const [evicted] = inWindow.splice(evictIdx, 1);
    if (evicted) {
      spilled.unshift({ ...evicted, inWindow: false });
      free += evicted.honestMin;
    }
  }
  inWindow.push({ ...target, inWindow: true });
  return buildResult(res.windowMin, inWindow, spilled, res.basis);
}
