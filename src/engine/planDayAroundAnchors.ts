/**
 * planDayAroundAnchors — scheduler that routes tasks around fixed calendar event
 * anchors (meetings, appointments). PURE TypeScript: no Date/clock/RN/Expo.
 * Callers pass all time values as epoch ms.
 *
 * The caller picks which end of the day is fixed (see PlanFill). Fixing the
 * finish fills backward and answers "how late can I start"; fixing the start
 * fills forward and answers "when does this actually finish". Backward is the
 * default so the historical single-direction callers are unaffected.
 *
 * Algorithm overview:
 *  1. Normalize + merge anchors (clip to [dayStartMs, deadline], sort, merge overlaps).
 *  2. Compute free windows = complement of merged anchors within [dayStartMs, deadline].
 *  3. Compute effective block per task (durationMin + bufferMin).
 *  4. Fill — backward: right-to-left from the deadline, placing each task into the
 *     latest slot ≤ cursor that fits fully inside a single free window; forward:
 *     left-to-right from the pinned start into the earliest such slot. Either way a
 *     block that no longer fits jumps whole to the adjacent window.
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
import { MIN_START_LEAD_MIN } from './constants';

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

/**
 * Which end of the day the user pinned, and therefore which direction the free
 * windows are walked.
 *
 * `backward` packs work as late as the deadline allows — the finish is the fixed
 * number and the start is derived. `forward` begins at `startAtMs` and lets the
 * finish fall where it falls. The two are not interchangeable: a number the user
 * set is a start, a number the engine derived is a deadline, and collapsing them
 * would turn a plan into a demand.
 */
export type PlanFill =
  | { direction: 'backward' }
  | { direction: 'forward'; startAtMs: number };

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
  /** Which end of the day is fixed. Defaults to backward (fill from the deadline). */
  fill?: PlanFill;
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
 *
 * Two passes, mirroring `forwardFill` (see its header for the full rationale):
 *  - Pass 1 walks the queue right-to-left holding a current-window index that
 *    only moves on a successful placement, so a task that fits nowhere never
 *    consumes the scan position of the tasks still ahead of it (i.e. earlier
 *    in the queue).
 *  - Pass 2 gap-fills whatever pass 1 left null by scanning every window
 *    reverse-chronologically. Placing a task out of queue order here is
 *    intended: it only happens to a task that would otherwise be reported as
 *    overflow, and an earlier free window is preferable to that.
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
  const breatherMs = breatherMin * MS_PER_MIN;

  // One cursor per window: the point up to which the next task placed in that
  // window must END. Starts at each window's own end.
  const cursors: number[] = freeWindows.map((w) => w.end);

  // ── Pass 1: order-preserving, non-poisoning ────────────────────────────────
  // `curWinIdx` only advances on a successful placement. On failure it is left
  // exactly where it was, so the tasks still ahead in the queue (earlier
  // indices, processed next) keep their full scan range.
  let curWinIdx = freeWindows.length - 1;
  // windowIdx the previously-processed task (i+1, i.e. later in the queue)
  // landed in, so we know whether this task needs a breather before it.
  let prevPlacedWindowIdx = -1;

  for (let i = effectives.length - 1; i >= 0; i--) {
    const eff = effectives[i]!;
    const blockMs = eff.effectiveMin * MS_PER_MIN;

    let tryIdx = curWinIdx;
    let didPlace = false;
    while (tryIdx >= 0) {
      const win = freeWindows[tryIdx]!;
      const needsBreather = prevPlacedWindowIdx === tryIdx;
      const totalBlockMs = blockMs + (needsBreather ? breatherMs : 0);

      const endAt = Math.min(cursors[tryIdx]!, win.end);
      const startAt = endAt - totalBlockMs;

      if (startAt >= win.start) {
        const taskEndAt = startAt + blockMs;
        placed[i] = { startAt, endAt: taskEndAt, windowIdx: tryIdx };
        cursors[tryIdx] = startAt;
        curWinIdx = tryIdx;
        prevPlacedWindowIdx = tryIdx;
        didPlace = true;
        break;
      }

      tryIdx -= 1;
    }

    if (!didPlace) {
      prevPlacedWindowIdx = -1;
    }
  }

  // ── Pass 2: gap-fill ────────────────────────────────────────────────────────
  // Anything still null gets one more chance, scanning every window
  // reverse-chronologically (independent of queue position).
  for (let i = 0; i < effectives.length; i++) {
    if (placed[i]) continue;
    const eff = effectives[i]!;
    const blockMs = eff.effectiveMin * MS_PER_MIN;

    for (let w = freeWindows.length - 1; w >= 0; w--) {
      const win = freeWindows[w]!;
      const endAt = cursors[w]!;
      const startAt = endAt - blockMs;

      if (startAt >= win.start) {
        placed[i] = { startAt, endAt: startAt + blockMs, windowIdx: w };
        cursors[w] = startAt;
        break;
      }
    }
  }

  return placed;
}

/**
 * Forward fill: the mirror of backwardFill for a day whose START is pinned.
 * Walks the free windows left-to-right from `startMs`, placing each task at the
 * earliest slot ≥ cursor that fits fully inside a single free window; jumps to
 * the next window when the current one runs out of room. Returns an array
 * parallel to `effectives`, null for anything no remaining window can hold.
 *
 * A block never straddles an anchor: a meeting interrupts work, it does not
 * halve it. So an oversized task moves whole to the next window and leaves the
 * tail of the current one empty rather than being split around the event.
 *
 * The `breatherMin` gap is inserted BEFORE a task that shares a window with the
 * one preceding it — the same rule as the backward pass, viewed from the other
 * side. A window jump already provides separation.
 *
 * Two passes:
 *  - Pass 1 walks the queue left-to-right holding a current-window index that
 *    only moves forward on a successful placement. A task that fits nowhere
 *    ahead is left `null` and the current index is left exactly where it was —
 *    it must not consume the scan position of the tasks queued after it (that
 *    was the defect: a monotonic index that kept advancing past a failure
 *    left every later task scanning an already-exhausted window list).
 *  - Pass 2 gap-fills whatever is still `null` by scanning every window
 *    chronologically, independent of queue position. A task only reaches this
 *    pass because it would otherwise be reported as overflow, so landing in
 *    an earlier gap out of queue order is the intended, preferable outcome.
 */
function forwardFill(
  effectives: readonly EffectiveTask[],
  freeWindows: readonly Window[],
  breatherMin: number,
  startMs: number,
): (PlacedTask | null)[] {
  if (freeWindows.length === 0) {
    return effectives.map(() => null);
  }

  const placed: (PlacedTask | null)[] = new Array(effectives.length).fill(null);
  const breatherMs = breatherMin * MS_PER_MIN;

  // One cursor per window: the point from which the next task placed in that
  // window may START. Starts at each window's own start (floored to the
  // pinned start time — only matters for the window(s) at/before startMs).
  const cursors: number[] = freeWindows.map((w) => Math.max(w.start, startMs));

  // ── Pass 1: order-preserving, non-poisoning ────────────────────────────────
  // `curWinIdx` only advances on a successful placement. On failure it is left
  // exactly where it was, so the tasks still queued after this one keep their
  // full scan range instead of starting past the end of the window list.
  let curWinIdx = 0;
  // windowIdx the previously-processed task (i-1) landed in, so we know
  // whether this task needs a breather before it.
  let prevPlacedWindowIdx = -1;

  for (let i = 0; i < effectives.length; i++) {
    const eff = effectives[i]!;
    const blockMs = eff.effectiveMin * MS_PER_MIN;

    let tryIdx = curWinIdx;
    let didPlace = false;
    while (tryIdx < freeWindows.length) {
      const win = freeWindows[tryIdx]!;
      const needsBreather = prevPlacedWindowIdx === tryIdx;
      const gapMs = needsBreather ? breatherMs : 0;

      const startAt = Math.max(cursors[tryIdx]!, win.start) + gapMs;
      const endAt = startAt + blockMs;

      if (endAt <= win.end) {
        placed[i] = { startAt, endAt, windowIdx: tryIdx };
        cursors[tryIdx] = endAt;
        curWinIdx = tryIdx;
        prevPlacedWindowIdx = tryIdx;
        didPlace = true;
        break;
      }

      tryIdx += 1;
    }

    if (!didPlace) {
      prevPlacedWindowIdx = -1;
    }
  }

  // ── Pass 2: gap-fill ────────────────────────────────────────────────────────
  // Anything still null gets one more chance, scanning every window
  // chronologically (independent of queue position).
  for (let i = 0; i < effectives.length; i++) {
    if (placed[i]) continue;
    const eff = effectives[i]!;
    const blockMs = eff.effectiveMin * MS_PER_MIN;

    for (let w = 0; w < freeWindows.length; w++) {
      const win = freeWindows[w]!;
      const startAt = Math.max(cursors[w]!, win.start);
      const endAt = startAt + blockMs;

      if (endAt <= win.end) {
        placed[i] = { startAt, endAt, windowIdx: w };
        cursors[w] = endAt;
        break;
      }
    }
  }

  return placed;
}

/** One fill pass over this day's free windows, with the direction already bound. */
type FillPass = (
  effectives: readonly EffectiveTask[],
  breatherMin: number,
) => (PlacedTask | null)[];

/**
 * Bind the requested fill direction to this day's free windows.
 *
 * The forward pass is floored at `nowMs + MIN_START_LEAD_MIN`: a start the user
 * pinned this morning is still theirs to keep — we never rewrite their number —
 * but placing work in a slot that has already gone by would be a plan nobody can
 * act on. The floor moves the placement only; the anchor itself is untouched.
 */
function fillPassFor(fill: PlanFill, freeWindows: readonly Window[], nowMs: number): FillPass {
  if (fill.direction === 'backward') {
    return (effectives, breatherMin) => backwardFill(effectives, freeWindows, breatherMin);
  }
  const earliestStart = Math.max(fill.startAtMs, nowMs + MIN_START_LEAD_MIN * MS_PER_MIN);
  return (effectives, breatherMin) =>
    forwardFill(effectives, freeWindows, breatherMin, earliestStart);
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Scheduler that fragments the day around fixed calendar anchors and fills the
 * free windows with the given tasks, from whichever end the caller pinned.
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
  const fill: PlanFill = input.fill ?? { direction: 'backward' };

  // Step 1: Normalize + merge anchors.
  const mergedAnchors = normalizeAnchors(anchors, dayStartMs, deadline);

  // Step 2: Free windows.
  const freeWindows = computeFreeWindows(mergedAnchors, dayStartMs, deadline);
  const runFill = fillPassFor(fill, freeWindows, nowMs);

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

  // Step 4: Fill, from the pinned end.
  const placedArr = runFill(effectives, breatherMin);

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
      const timeline = buildTimeline(effectives, placedArr as PlacedTask[], mergedAnchors, anchors, breatherMin, deadline);
      const totalMin = computeTotalMin(effectives, placedArr as PlacedTask[], breatherMin);
      return { startBy, timeline, verdict: { kind: 'fits', startBy }, totalMin };
    }
  }

  // Step 6: Verdict — not all fit or startBy < nowMs.
  // Re-examine: if capacity is enough but startBy < now, or capacity is insufficient.
  if (freeCapacityMin >= taskTotalMin && allPlaced) {
    // Capacity fine but we'd need to start in the past. Run cut ladder on free-window space.
    const verdict = cutLadderForWindows(deadline, nowMs, freeWindows, effectives, runFill);
    const startBy = placedArr.reduce((min, p) => p ? Math.min(min, p.startAt) : min, Infinity);
    const timeline = buildTimeline(effectives, placedArr as PlacedTask[], mergedAnchors, anchors, breatherMin, deadline);
    const totalMin = computeTotalMin(effectives, placedArr as PlacedTask[], breatherMin);
    return { startBy, timeline, verdict, totalMin };
  }

  // Capacity insufficient (can't fit even with perfect placement).
  const verdict = cutLadderForWindows(deadline, nowMs, freeWindows, effectives, runFill);
  // Build a best-effort timeline for display.
  const startBy = placedArr.reduce((min, p) => p ? Math.min(min, p.startAt) : min, Infinity);
  const safeStartBy = Number.isFinite(startBy) ? startBy : deadline;
  const timeline = buildTimeline(effectives, placedArr as (PlacedTask | null)[], mergedAnchors, anchors, breatherMin, deadline);
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
  deadline: number,
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
  return withOverflowTasks(items, effectives, placed, deadline);
}

/**
 * Put every task the fill could not place back on the timeline as an `overflow`
 * block, rather than dropping it. A queued task that is simply missing from the
 * plan is the one outcome the user cannot act on.
 *
 * Clocks continue past the deadline in queue order, so each block's
 * `endAt - deadline` is a real number of minutes over. Position, though, comes
 * from the QUEUE, not from those clocks: an unplaced task sits directly after the
 * task that precedes it in the user's own order. That is what lets a task dragged
 * above the done-by boundary stay where it was dropped even when it still does not
 * fit — the boundary moves up above it instead of the row snapping back down.
 */
function withOverflowTasks(
  items: PlanTimelineItem[],
  effectives: readonly EffectiveTask[],
  placed: readonly (PlacedTask | null)[],
  deadline: number,
): PlanTimelineItem[] {
  const withOverflow = [...items];
  let cursor = placed.reduce((latest, p) => (p ? Math.max(latest, p.endAt) : latest), deadline);

  for (let i = 0; i < effectives.length; i++) {
    if (placed[i]) continue;
    const eff = effectives[i]!;
    const endAt = cursor + eff.effectiveMin * MS_PER_MIN;
    withOverflow.splice(overflowSlot(withOverflow, effectives, i), 0, {
      id: eff.task.id,
      label: eff.task.label,
      startAt: cursor,
      endAt,
      kind: 'overflow' as const,
    });
    cursor = endAt;
  }

  return withOverflow;
}

/**
 * Where an unplaced task belongs in the rendered order: straight after the row of
 * the nearest earlier task in the queue, or at the very top when it is the first
 * queued task.
 */
function overflowSlot(
  items: readonly PlanTimelineItem[],
  effectives: readonly EffectiveTask[],
  queueIndex: number,
): number {
  for (let prev = queueIndex - 1; prev >= 0; prev--) {
    const prevId = effectives[prev]!.task.id;
    const at = items.findIndex((item) => item.id === prevId);
    if (at !== -1) return at + 1;
  }
  return 0;
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
  runFill: FillPass,
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
    // Re-fill from the same end the user pinned — a cut proposed against the
    // other direction would land the survivors somewhere the plan never shows.
    const refilled = runFill(remainingEffectives, 0);
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
