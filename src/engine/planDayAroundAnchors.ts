/**
 * planDayAroundAnchors — backward scheduler that routes tasks around fixed
 * calendar event anchors (meetings, appointments). PURE TypeScript: no
 * Date/clock/RN/Expo. Callers pass all time values as epoch ms.
 *
 * Algorithm overview:
 *  1. Normalize + merge anchors (clip to [dayStartMs, deadline], sort, merge overlaps).
 *  2. Compute free windows = complement of merged anchors within [dayStartMs, deadline].
 *  3. Compute effective block per task (durationMin + bufferMin).
 *  4. Backward fill: right-to-left, placing each task into the latest slot ≤ cursor
 *     that fits fully inside a single free window; jump to the previous window's end
 *     when the current window runs out of space.
 *  5. Build timeline: placed tasks + anchor event items + intra-window breathers.
 *  6. Verdict: fits / cut-one / multi-cut / push-deadline (reuses cutLadder from planner.ts).
 */
import type {
  PlanResult,
  PlanTaskInput,
  PlanTimelineItem,
  PlanVerdict,
} from '../domain/types';
import {
  DEFAULT_BUFFER_MIN,
  effectiveBlockMin,
  smallestEffectiveMin,
} from './planner';
import type { EffectiveTask } from './planner';

const MS_PER_MIN = 60_000;

// ── Public interfaces ────────────────────────────────────────────────────────

/** A fixed calendar event anchor that the scheduler must route around. */
export interface PlanAnchor {
  id: string;
  label: string;
  /** epoch ms start of the event. */
  startMs: number;
  /** epoch ms end of the event. */
  endMs: number;
}

/** Input to planDayAroundAnchors. */
export interface PlanDayInput {
  /** epoch ms finish-by deadline. */
  deadline: number;
  /** epoch ms current time — judges feasibility. */
  nowMs: number;
  /** epoch ms start of the schedulable day. */
  dayStartMs: number;
  /** Ordered tasks to place. Order is preserved. */
  tasks: PlanTaskInput[];
  /** Fixed calendar events (read-only; never written to). */
  anchors: readonly PlanAnchor[];
  /** Per-task buffer appended after each task block (default DEFAULT_BUFFER_MIN). */
  bufferMin?: number;
  /** Gap inserted between two consecutive tasks within the same free window (minutes). */
  breatherMin?: number;
}

// ── Internal helpers ─────────────────────────────────────────────────────────

interface Window {
  start: number; // epoch ms
  end: number;   // epoch ms
}

/**
 * Clip each anchor to [dayStart, deadline], drop zero-length results, sort by
 * startMs, then merge overlapping/adjacent blocks into disjoint ranges.
 */
function normalizeAnchors(
  anchors: readonly PlanAnchor[],
  dayStart: number,
  deadline: number,
): Window[] {
  const clipped: Window[] = [];
  for (const a of anchors) {
    const s = Math.max(a.startMs, dayStart);
    const e = Math.min(a.endMs, deadline);
    if (e > s) clipped.push({ start: s, end: e });
  }
  if (clipped.length === 0) return [];

  clipped.sort((a, b) => a.start - b.start);

  const merged: Window[] = [{ ...clipped[0]! }];
  for (let i = 1; i < clipped.length; i++) {
    const cur = clipped[i]!;
    const last = merged[merged.length - 1]!;
    if (cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end);
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

/**
 * Compute the complement of `anchorBlocks` within [dayStart, deadline].
 * Returns sorted, non-empty windows only.
 */
function computeFreeWindows(
  anchorBlocks: readonly Window[],
  dayStart: number,
  deadline: number,
): Window[] {
  const windows: Window[] = [];
  let cursor = dayStart;

  for (const block of anchorBlocks) {
    if (block.start > cursor) {
      windows.push({ start: cursor, end: block.start });
    }
    cursor = Math.max(cursor, block.end);
  }
  if (deadline > cursor) {
    windows.push({ start: cursor, end: deadline });
  }
  return windows;
}

/** Total free minutes available in the given windows. */
function totalFreeMin(windows: readonly Window[]): number {
  return windows.reduce((sum, w) => sum + (w.end - w.start) / MS_PER_MIN, 0);
}

/**
 * Backward fill: places `effectives` (in their original order, but filled
 * right-to-left) into the free windows. Returns an array parallel to
 * `effectives`: each entry is either `{ startAt, endAt, windowIdx }` or null
 * if it could not be placed.
 *
 * The `breatherMin` gap is inserted between two consecutive tasks that land in
 * the SAME window. A window jump already provides separation.
 */
interface PlacedTask {
  startAt: number;
  endAt: number;
  windowIdx: number; // which free window this task landed in
}

function backwardFill(
  effectives: readonly EffectiveTask[],
  freeWindows: readonly Window[],
  breatherMin: number,
): (PlacedTask | null)[] {
  if (freeWindows.length === 0) {
    return effectives.map(() => null);
  }

  const placed: (PlacedTask | null)[] = new Array(effectives.length).fill(null);

  // We fill from last task to first (right-to-left), tracking cursor in ms.
  // cursor = the point up to which subsequent tasks must END.
  let cursor: number = freeWindows[freeWindows.length - 1]!.end;
  let winIdx: number = freeWindows.length - 1;

  // Track what windowIdx the NEXT task (i+1) landed in, so we know whether to
  // add a breather.
  let prevWindowIdx: number = -1;

  for (let i = effectives.length - 1; i >= 0; i--) {
    const eff = effectives[i]!;
    const blockMs = eff.effectiveMin * MS_PER_MIN;

    // Breather needed if the task placed AFTER this one (i+1) is in the same window.
    // We add breather to the block we need to find space for.
    const needsBreather = prevWindowIdx !== -1 && prevWindowIdx === winIdx;
    const totalBlockMs = blockMs + (needsBreather ? breatherMin * MS_PER_MIN : 0);

    // Try to fit in current window and earlier windows.
    let found = false;
    while (winIdx >= 0) {
      const win = freeWindows[winIdx]!;

      // The task must end at or before cursor (and cursor ≤ win.end).
      const endAt = Math.min(cursor, win.end);
      const startAt = endAt - totalBlockMs;

      if (startAt >= win.start) {
        // Task fits. Place it (the breather gap is the space AFTER this task up to cursor).
        const taskEndAt = startAt + blockMs;
        placed[i] = { startAt, endAt: taskEndAt, windowIdx: winIdx };
        cursor = startAt;
        prevWindowIdx = winIdx;
        found = true;
        break;
      }

      // Doesn't fit in this window — move to the previous window.
      winIdx -= 1;
      if (winIdx >= 0) {
        cursor = freeWindows[winIdx]!.end;
        // Moving to a different window; the next task (i) and whatever is at i+1
        // are now in different windows, so no breather needed for placement of i.
        // But we still need to check if the NEW winIdx matches prevWindowIdx for
        // the NEXT iteration. Reset for the retry.
      }
    }

    if (!found) {
      placed[i] = null;
    }
  }

  return placed;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Backward scheduler that fragments the day around fixed calendar anchors and
 * fills free windows with the given tasks.
 *
 * @param input - See PlanDayInput.
 * @returns PlanResult — startBy, timeline (tasks + events + breathers), verdict, totalMin.
 */
export function planDayAroundAnchors(input: PlanDayInput): PlanResult {
  const {
    deadline,
    nowMs,
    dayStartMs,
    tasks,
    anchors,
  } = input;
  const bufferMin = input.bufferMin ?? DEFAULT_BUFFER_MIN;
  const breatherMin = Math.max(0, input.breatherMin ?? 0);

  // Step 1: Normalize + merge anchors.
  const mergedAnchors = normalizeAnchors(anchors, dayStartMs, deadline);

  // Step 2: Free windows.
  const freeWindows = computeFreeWindows(mergedAnchors, dayStartMs, deadline);

  // Step 3: Effective blocks.
  const effectives: EffectiveTask[] = tasks.map((t) => ({
    task: t,
    effectiveMin: effectiveBlockMin(t.durationMin, bufferMin),
  }));

  // Empty task list: emit event items and return fits.
  if (effectives.length === 0) {
    const eventItems: PlanTimelineItem[] = mergedAnchors.map((a, idx) => ({
      id: `event-${idx}`,
      label: findAnchorLabel(anchors, a),
      startAt: a.start,
      endAt: a.end,
      kind: 'event' as const,
    }));
    eventItems.sort((a, b) => a.startAt - b.startAt);
    return {
      startBy: deadline,
      timeline: eventItems,
      verdict: { kind: 'fits', startBy: deadline },
      totalMin: 0,
    };
  }

  // Step 4: Backward fill.
  const placedArr = backwardFill(effectives, freeWindows, breatherMin);

  // Check if all tasks were placed.
  const allPlaced = placedArr.every((p) => p !== null);

  // Compute total free capacity.
  const freeCapacityMin = totalFreeMin(freeWindows);
  const taskTotalMin = effectives.reduce((sum, e) => sum + e.effectiveMin, 0);

  // Step 5: Build timeline items.
  if (allPlaced) {
    const startBy = effectives.reduce((min, _, i) => {
      const p = placedArr[i];
      return p ? Math.min(min, p.startAt) : min;
    }, Infinity);

    if (startBy >= nowMs) {
      // Fits — build full timeline.
      const timeline = buildTimeline(effectives, placedArr as PlacedTask[], mergedAnchors, anchors, breatherMin);
      const totalMin = computeTotalMin(effectives, placedArr as PlacedTask[], breatherMin);
      return { startBy, timeline, verdict: { kind: 'fits', startBy }, totalMin };
    }
  }

  // Step 6: Verdict — not all fit or startBy < nowMs.
  // Re-examine: if capacity is enough but startBy < now, or capacity is insufficient.
  if (freeCapacityMin >= taskTotalMin && allPlaced) {
    // Capacity fine but we'd need to start in the past. Run cut ladder on free-window space.
    const verdict = cutLadderForWindows(deadline, nowMs, freeWindows, effectives);
    const startBy = placedArr.reduce((min, p) => p ? Math.min(min, p.startAt) : min, Infinity);
    const timeline = buildTimeline(effectives, placedArr as PlacedTask[], mergedAnchors, anchors, breatherMin);
    const totalMin = computeTotalMin(effectives, placedArr as PlacedTask[], breatherMin);
    return { startBy, timeline, verdict, totalMin };
  }

  // Capacity insufficient (can't fit even with perfect placement).
  const verdict = cutLadderForWindows(deadline, nowMs, freeWindows, effectives);
  // Build a best-effort timeline for display.
  const startBy = placedArr.reduce((min, p) => p ? Math.min(min, p.startAt) : min, Infinity);
  const safeStartBy = Number.isFinite(startBy) ? startBy : deadline;
  const timeline = buildTimeline(effectives, placedArr as (PlacedTask | null)[], mergedAnchors, anchors, breatherMin);
  const totalMin = taskTotalMin;
  return { startBy: safeStartBy, timeline, verdict, totalMin };
}

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * Find the original anchor label for a merged window (best-effort match by overlap).
 */
function findAnchorLabel(anchors: readonly PlanAnchor[], merged: Window): string {
  for (const a of anchors) {
    if (a.startMs <= merged.end && a.endMs >= merged.start) return a.label;
  }
  return 'Event';
}

/**
 * Build the sorted merged timeline from placed tasks, event anchor blocks, and
 * intra-window breathers.
 */
function buildTimeline(
  effectives: readonly EffectiveTask[],
  placed: (PlacedTask | null)[],
  mergedAnchors: readonly Window[],
  originalAnchors: readonly PlanAnchor[],
  breatherMin: number,
): PlanTimelineItem[] {
  const items: PlanTimelineItem[] = [];
  const breatherMs = breatherMin * MS_PER_MIN;

  // Add task items.
  for (let i = 0; i < effectives.length; i++) {
    const p = placed[i];
    if (!p) continue;
    const eff = effectives[i]!;
    items.push({
      id: eff.task.id,
      label: eff.task.label,
      startAt: p.startAt,
      endAt: p.endAt,
      kind: 'task' as const,
    });
  }

  // Add intra-window breathers: a breather exists between two adjacent tasks
  // that are placed in the same window.
  if (breatherMs > 0) {
    for (let i = 0; i < effectives.length - 1; i++) {
      const pCur = placed[i];
      const pNext = placed[i + 1];
      if (!pCur || !pNext) continue;
      if (pCur.windowIdx === pNext.windowIdx) {
        // Breather fills the gap between task[i].endAt and task[i+1].startAt.
        const gapStart = pCur.endAt;
        const gapEnd = pNext.startAt;
        if (gapEnd > gapStart) {
          items.push({
            id: `breather-${i}`,
            label: '',
            startAt: gapStart,
            endAt: gapEnd,
            kind: 'breather' as const,
          });
        }
      }
    }
  }

  // Add event items for merged anchor blocks.
  for (let idx = 0; idx < mergedAnchors.length; idx++) {
    const w = mergedAnchors[idx]!;
    items.push({
      id: `event-${idx}`,
      label: findAnchorLabel(originalAnchors, w),
      startAt: w.start,
      endAt: w.end,
      kind: 'event' as const,
    });
  }

  items.sort((a, b) => a.startAt - b.startAt);
  return items;
}

/** Compute total effective minutes including intra-window breathers. */
function computeTotalMin(
  effectives: readonly EffectiveTask[],
  placed: PlacedTask[],
  breatherMin: number,
): number {
  const taskMin = effectives.reduce((sum, e) => sum + e.effectiveMin, 0);
  let breatherCount = 0;
  for (let i = 0; i < effectives.length - 1; i++) {
    const pCur = placed[i];
    const pNext = placed[i + 1];
    if (pCur && pNext && pCur.windowIdx === pNext.windowIdx) {
      breatherCount += 1;
    }
  }
  return taskMin + breatherCount * breatherMin;
}

/**
 * Runs the cut ladder adapted for window-constrained scheduling.
 * The "startBy" concept here means: the first free-window slot ≥ nowMs
 * that can accommodate the remaining tasks.
 *
 * We use deadline as the anchor for startByFor — if all remaining tasks fit
 * within free windows with startBy ≥ nowMs, it's feasible.
 */
function cutLadderForWindows(
  deadline: number,
  nowMs: number,
  freeWindows: readonly Window[],
  effectives: readonly EffectiveTask[],
): PlanVerdict {
  const freeMin = totalFreeMin(freeWindows);

  // Sort by largest effective block first for the cut ladder.
  const byLargest = effectives
    .map((e, index) => ({ ...e, index }))
    .sort((a, b) => b.effectiveMin - a.effectiveMin || a.index - b.index);

  const dropped: typeof byLargest = [];
  let remainingMin = effectives.reduce((sum, e) => sum + e.effectiveMin, 0);

  for (let i = 0; i < byLargest.length - 1; i++) {
    const candidate = byLargest[i];
    if (!candidate) continue;
    dropped.push(candidate);
    remainingMin -= candidate.effectiveMin;

    // Check: does the remainder fit in the free windows AND start ≥ nowMs?
    const remainingEffectives = effectives.filter(
      (_, idx) => !dropped.some((d) => d.index === idx),
    );
    const refilled = backwardFill(remainingEffectives, freeWindows, 0);
    const allRefitPlaced = refilled.every((p) => p !== null);

    if (allRefitPlaced && remainingMin <= freeMin) {
      const startBy = refilled.reduce((min, p) => p ? Math.min(min, p.startAt) : min, Infinity);
      const safeStartBy = Number.isFinite(startBy) ? startBy : deadline;
      if (safeStartBy >= nowMs) {
        const cuts = dropped.map((d) => ({ id: d.task.id, label: d.task.label }));
        const savedMin = dropped.reduce((sum, d) => sum + d.effectiveMin, 0);
        const first = cuts[0];
        if (cuts.length === 1 && first) {
          return { kind: 'cut-one', startBy: safeStartBy, cut: first, savedMin };
        }
        return { kind: 'multi-cut', startBy: safeStartBy, cuts, savedMin };
      }
    }
  }

  // Even the smallest task alone won't fit → push deadline.
  const smallestMin = smallestEffectiveMin(effectives);
  const totalTaskMin = effectives.reduce((sum, e) => sum + e.effectiveMin, 0);
  const overshootMin = Math.ceil((nowMs + totalTaskMin * MS_PER_MIN - deadline) / MS_PER_MIN);
  return {
    kind: 'push-deadline',
    feasibleDeadline: nowMs + smallestMin * MS_PER_MIN,
    overshootMin,
  };
}
