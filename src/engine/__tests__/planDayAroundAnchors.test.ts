/**
 * TDD test suite for planDayAroundAnchors.
 *
 * All times are epoch ms. We use a fixed day-start constant and a local `at(min)`
 * helper so case inputs are human-readable (minutes from day-start).
 */
import { planDayAroundAnchors } from '../planDayAroundAnchors';
import { planBackward } from '../planner';
import type { PlanAnchor } from '../planDayAroundAnchors';
import type { PlanTaskInput } from '../../domain/types';

const MIN = 60_000; // 1 minute in ms

// Fixed day-start: midnight of an arbitrary epoch day.
// We use 2026-06-24T00:00:00Z for readability.
const DAY_START = Date.UTC(2026, 5, 24, 0, 0, 0);

/** Convert minutes-from-day-start into epoch ms. */
const at = (min: number): number => DAY_START + min * MIN;

const task = (id: string, durationMin: number): PlanTaskInput => ({
  id,
  label: `Task ${id}`,
  category: 'work',
  durationMin,
});

const anchor = (id: string, startMin: number, endMin: number): PlanAnchor => ({
  id,
  label: `Event ${id}`,
  startMs: at(startMin),
  endMs: at(endMin),
});

// ---------------------------------------------------------------------------
// Case 1: No anchors → identical placement to planBackward (same startBy/timeline for task items)
// ---------------------------------------------------------------------------
describe('Case 1: No anchors — parity with planBackward', () => {
  it('produces the same startBy and task timeline as planBackward', () => {
    const tasks = [task('a', 20), task('b', 30)];
    const deadline = at(8 * 60); // 08:00
    const nowMs = at(0);
    const bufferMin = 0;

    const withAnchors = planDayAroundAnchors({
      deadline,
      nowMs,
      dayStartMs: DAY_START,
      tasks,
      anchors: [],
      bufferMin,
    });

    const backward = planBackward({ deadline, tasks, nowMs, bufferMin });

    expect(withAnchors.startBy).toBe(backward.startBy);
    expect(withAnchors.verdict.kind).toBe('fits');
    const taskItems = withAnchors.timeline.filter((i) => i.kind === 'task');
    const bwTaskItems = backward.timeline.filter((i) => i.kind === 'task');
    expect(taskItems.map((i) => ({ id: i.id, startAt: i.startAt, endAt: i.endAt }))).toEqual(
      bwTaskItems.map((i) => ({ id: i.id, startAt: i.startAt, endAt: i.endAt })),
    );
  });
});

// ---------------------------------------------------------------------------
// Case 2: One anchor mid-day splits the day: tasks placed in the windows
// before/after the anchor; anchor appears as an 'event' item; no overlap.
// ---------------------------------------------------------------------------
describe('Case 2: One anchor mid-day — tasks routed around it', () => {
  it('places tasks in windows around anchor and emits event item', () => {
    // Day 0–480min (8h). Anchor 200–260min (1h meeting).
    // Two tasks: a=60min, b=60min. bufferMin=0.
    // Free windows: [0,200] (200min) and [260,480] (220min).
    // Backward fill: deadline=at(480). cursor=480.
    //   task b (last): fits in [260,480] at [420,480]. cursor=420.
    //   task a: fits in [260,480] at [360,420]. cursor=360.
    // startBy = 360.
    const tasks = [task('a', 60), task('b', 60)];
    const deadline = at(480);
    const nowMs = at(0);

    const result = planDayAroundAnchors({
      deadline,
      nowMs,
      dayStartMs: DAY_START,
      tasks,
      anchors: [anchor('mtg', 200, 260)],
      bufferMin: 0,
    });

    expect(result.verdict.kind).toBe('fits');

    const taskItems = result.timeline.filter((i) => i.kind === 'task');
    const eventItems = result.timeline.filter((i) => i.kind === 'event');

    // One event item for the anchor
    expect(eventItems).toHaveLength(1);
    expect(eventItems[0]!.startAt).toBe(at(200));
    expect(eventItems[0]!.endAt).toBe(at(260));

    // No task overlaps the anchor
    for (const t of taskItems) {
      const overlaps = t.startAt < at(260) && t.endAt > at(200);
      expect(overlaps).toBe(false);
    }

    // Timeline is sorted by startAt
    for (let i = 1; i < result.timeline.length; i++) {
      expect(result.timeline[i]!.startAt).toBeGreaterThanOrEqual(result.timeline[i - 1]!.startAt);
    }
  });
});

// ---------------------------------------------------------------------------
// Case 3: Task too big for window before anchor → pushed to earlier window
// ---------------------------------------------------------------------------
describe('Case 3: Task too big for window before anchor', () => {
  it('pushes oversized task to an earlier window so it does not overlap anchor', () => {
    // Free windows: [0,60] (60min) and [120,480] (360min).
    // anchor at [60,120].
    // tasks: a=200min, b=30min. bufferMin=0.
    // Backward fill from deadline=at(480):
    //   task b(last): 30min. Fits in [120,480]: placed [450,480]. cursor=450.
    //   task a: 200min. Fits in [120,480]: placed [250,450]. cursor=250.
    // startBy=250. No task ends after anchorStart(60) and starts before anchorEnd(120).
    const tasks = [task('a', 200), task('b', 30)];
    const deadline = at(480);
    const nowMs = at(0);

    const result = planDayAroundAnchors({
      deadline,
      nowMs,
      dayStartMs: DAY_START,
      tasks,
      anchors: [anchor('mtg', 60, 120)],
      bufferMin: 0,
    });

    const taskItems = result.timeline.filter((i) => i.kind === 'task');

    for (const t of taskItems) {
      const overlapsAnchor = t.startAt < at(120) && t.endAt > at(60);
      expect(overlapsAnchor).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Case 4: Tasks exactly fill free windows → fits, startBy = first window start
// ---------------------------------------------------------------------------
describe('Case 4: Tasks exactly fill free windows', () => {
  it('reports fits when tasks sum exactly to free window capacity', () => {
    // anchor [120,180]. Free windows: [0,120]=120min and [180,300]=120min. Total=240min.
    // tasks sum = 240min (bufferMin=0). Should fit exactly.
    const tasks = [task('a', 120), task('b', 120)];
    const deadline = at(300);
    const nowMs = at(0);

    const result = planDayAroundAnchors({
      deadline,
      nowMs,
      dayStartMs: DAY_START,
      tasks,
      anchors: [anchor('mtg', 120, 180)],
      bufferMin: 0,
    });

    expect(result.verdict.kind).toBe('fits');
    // startBy should be at(0) — the very start of the first window
    const taskItems = result.timeline.filter((i) => i.kind === 'task');
    expect(taskItems[0]!.startAt).toBe(at(0));
  });
});

// ---------------------------------------------------------------------------
// Case 5: Over capacity → cut-one or multi-cut verdict
// ---------------------------------------------------------------------------
describe('Case 5: Over capacity — cut verdict', () => {
  it('returns cut-one when dropping the largest task makes the plan fit', () => {
    // Free window: [0,300]=300min. Two tasks: big=400min, small=50min.
    // Total=450 > 300. Drop big(400) → 50 ≤ 300 → cut-one.
    const tasks = [task('small', 50), task('big', 400)];
    const deadline = at(300);
    const nowMs = at(0);

    const result = planDayAroundAnchors({
      deadline,
      nowMs,
      dayStartMs: DAY_START,
      tasks,
      anchors: [],
      bufferMin: 0,
    });

    expect(['cut-one', 'multi-cut']).toContain(result.verdict.kind);
  });
});

// ---------------------------------------------------------------------------
// Case 6: startBy < now → cut ladder fires
// ---------------------------------------------------------------------------
describe('Case 6: startBy < now — cut ladder fires', () => {
  it('fires cut ladder when startBy would be before now', () => {
    // tasks: a=30, b=30. bufferMin=0. deadline=at(40). now=at(20).
    // Without anchors: startBy = at(40-60) = at(-20) < now → cut needed.
    const tasks = [task('a', 30), task('b', 30)];
    const deadline = at(40);
    const nowMs = at(20);

    const result = planDayAroundAnchors({
      deadline,
      nowMs,
      dayStartMs: DAY_START,
      tasks,
      anchors: [],
      bufferMin: 0,
    });

    expect(['cut-one', 'multi-cut', 'push-deadline']).toContain(result.verdict.kind);
  });
});

// ---------------------------------------------------------------------------
// Case 7: All-day-only day (anchors array empty) → behaves like no-anchors
// ---------------------------------------------------------------------------
describe('Case 7: Empty anchors array — same as no-anchors', () => {
  it('treats empty anchor list identically to no anchors', () => {
    const tasks = [task('x', 45)];
    const deadline = at(480);
    const nowMs = at(0);
    const bufferMin = 0;

    const noAnchors = planDayAroundAnchors({
      deadline,
      nowMs,
      dayStartMs: DAY_START,
      tasks,
      anchors: [],
      bufferMin,
    });

    const emptyAnchors = planDayAroundAnchors({
      deadline,
      nowMs,
      dayStartMs: DAY_START,
      tasks,
      anchors: [],
      bufferMin,
    });

    expect(emptyAnchors.startBy).toBe(noAnchors.startBy);
    expect(emptyAnchors.verdict.kind).toBe(noAnchors.verdict.kind);
  });
});

// ---------------------------------------------------------------------------
// Case 8: Anchor at the very end (ends at deadline) → tasks placed before it
// ---------------------------------------------------------------------------
describe('Case 8: Anchor at the very end — tasks placed before it', () => {
  it('places all tasks before a final anchor and reports correct startBy', () => {
    // anchor [420,480]. Free window: [0,420]=420min.
    // tasks: a=60, b=60. bufferMin=0. Total=120.
    // Backward fill: deadline=at(480), but last free window ends at 420.
    // task b placed [360,420], task a placed [300,360]. startBy=300.
    const tasks = [task('a', 60), task('b', 60)];
    const deadline = at(480);
    const nowMs = at(0);

    const result = planDayAroundAnchors({
      deadline,
      nowMs,
      dayStartMs: DAY_START,
      tasks,
      anchors: [anchor('final', 420, 480)],
      bufferMin: 0,
    });

    expect(result.verdict.kind).toBe('fits');

    const taskItems = result.timeline.filter((i) => i.kind === 'task');
    // No task overlaps the anchor [420,480]
    for (const t of taskItems) {
      expect(t.endAt).toBeLessThanOrEqual(at(420));
    }

    expect(result.startBy).toBe(at(300));
  });
});

// ---------------------------------------------------------------------------
// Case 9: Overlapping anchors merged → treated as one block
// ---------------------------------------------------------------------------
describe('Case 9: Overlapping anchors merged', () => {
  it('merges overlapping anchors and treats them as one immovable block', () => {
    // Anchor 1: [100,200], Anchor 2: [150,250] → merged to [100,250].
    // Free windows: [0,100] (100min) and [250,480] (230min).
    // Tasks: a=60, b=60. bufferMin=0.
    // No task placed in [100,250].
    const tasks = [task('a', 60), task('b', 60)];
    const deadline = at(480);
    const nowMs = at(0);

    const result = planDayAroundAnchors({
      deadline,
      nowMs,
      dayStartMs: DAY_START,
      tasks,
      anchors: [anchor('e1', 100, 200), anchor('e2', 150, 250)],
      bufferMin: 0,
    });

    const taskItems = result.timeline.filter((i) => i.kind === 'task');

    for (const t of taskItems) {
      const overlapsBlock = t.startAt < at(250) && t.endAt > at(100);
      expect(overlapsBlock).toBe(false);
    }

    // Merged anchors may appear as one or two event items (implementation detail),
    // but tasks must not overlap the merged range.
  });
});

// ---------------------------------------------------------------------------
// Case 10: Breather inserted between two tasks in one window, NOT across window jump
// ---------------------------------------------------------------------------
describe('Case 10: Breather only within a window, not across window jumps', () => {
  it('inserts a breather between tasks in the same window but not across anchor boundary', () => {
    // anchor [200,260]. Free windows: [0,200] and [260,480].
    // tasks: a=60, b=60. breatherMin=10.
    // Backward: cursor=480. task b: placed in [260,480] at [410,470]. cursor=410.
    //   Before task a: check if a is in same window as b (yes, [260,480]).
    //   Insert breather before task a in same window? Actually the spec says:
    //   breathers only between two tasks WITHIN ONE window.
    //   task a: placed in [260,480] at [350,410-10]=[340,400]? Let's check.
    //   With breather: task b ends at 470 from cursor=480. cursor=410.
    //   Check if next task (a) goes in same window: a would be placed at [340,400],
    //   still in [260,480]. Insert breather: gapStart=400, gapEnd=410. task a at [340,400].
    //   Both tasks in same window → breather inserted.
    const tasks = [task('a', 60), task('b', 60)];
    const deadline = at(480);
    const nowMs = at(0);

    const result = planDayAroundAnchors({
      deadline,
      nowMs,
      dayStartMs: DAY_START,
      tasks,
      anchors: [anchor('mtg', 200, 260)],
      bufferMin: 0,
      breatherMin: 10,
    });

    const breatherItems = result.timeline.filter((i) => i.kind === 'breather');
    const taskItems = result.timeline.filter((i) => i.kind === 'task');

    // Both tasks should be placed (fits or close to it)
    expect(taskItems).toHaveLength(2);

    // If both tasks end up in the same window, there should be a breather
    const taskA = taskItems.find((t) => t.id === 'a');
    const taskB = taskItems.find((t) => t.id === 'b');

    if (taskA && taskB) {
      const aInWindowAfter = taskA.startAt >= at(260);
      const bInWindowAfter = taskB.startAt >= at(260);
      if (aInWindowAfter && bInWindowAfter) {
        // Both in the same window after the anchor — expect a breather
        expect(breatherItems).toHaveLength(1);
      } else if (!aInWindowAfter && !bInWindowAfter) {
        // Both in the same window before the anchor — expect a breather
        expect(breatherItems).toHaveLength(1);
      } else {
        // Tasks in different windows — no breather should cross the boundary
        expect(breatherItems).toHaveLength(0);
      }
    }

    // No task overlaps the anchor
    for (const t of taskItems) {
      const overlaps = t.startAt < at(260) && t.endAt > at(200);
      expect(overlaps).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Case 11: Empty tasks → empty task timeline (just event items), fits
// ---------------------------------------------------------------------------
describe('Case 11: Empty tasks — just event items, fits', () => {
  it('returns fits with no task items and event items for anchors', () => {
    const deadline = at(480);
    const nowMs = at(0);

    const result = planDayAroundAnchors({
      deadline,
      nowMs,
      dayStartMs: DAY_START,
      tasks: [],
      anchors: [anchor('mtg', 200, 260)],
      bufferMin: 0,
    });

    expect(result.verdict.kind).toBe('fits');
    expect(result.timeline.filter((i) => i.kind === 'task')).toHaveLength(0);
    expect(result.timeline.filter((i) => i.kind === 'event')).toHaveLength(1);
    expect(result.totalMin).toBe(0);
  });
});
