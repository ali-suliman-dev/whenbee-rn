/**
 * TDD test suite for planDayAroundAnchors.
 *
 * All times are epoch ms. We use a fixed day-start constant and a local `at(min)`
 * helper so case inputs are human-readable (minutes from day-start).
 */
import { planDayAroundAnchors } from '../planDayAroundAnchors';
import { planBackward } from '../planner';
import { MIN_START_LEAD_MIN } from '../constants';
import type { PlanAnchor } from '../planDayAroundAnchors';
import type { PlanTaskInput, PlanTimelineItem } from '../../domain/types';

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

// ===========================================================================
// Forward fill — the user pins the START of the day and Whenbee derives the
// finish. Every case below drives the public entry with
// `fill: { direction: 'forward', startAtMs }`; `backward` stays the default.
// ===========================================================================

/** Task items only, in chronological order (the timeline is already sorted). */
const taskItemsOf = (timeline: readonly { kind: string; id: string }[]) =>
  timeline.filter((i) => i.kind === 'task');

// ---------------------------------------------------------------------------
// Case 12: Forward, no anchors → tasks run back-to-back from the start anchor
// ---------------------------------------------------------------------------
describe('Case 12: Forward fill with no anchors', () => {
  it('packs tasks back-to-back starting at the anchor, not at the deadline', () => {
    // One free window [0,480]. Start pinned at 60. a=20, b=30, bufferMin=0.
    // Forward: a [60,80], b [80,110]. Backward would have put them at [430,480].
    const result = planDayAroundAnchors({
      deadline: at(480),
      nowMs: at(0),
      dayStartMs: DAY_START,
      tasks: [task('a', 20), task('b', 30)],
      anchors: [],
      bufferMin: 0,
      fill: { direction: 'forward', startAtMs: at(60) },
    });

    expect(result.verdict.kind).toBe('fits');
    expect(result.startBy).toBe(at(60));

    const items = taskItemsOf(result.timeline);
    expect(items.map((i) => i.id)).toEqual(['a', 'b']);
    expect(items[0]).toMatchObject({ startAt: at(60), endAt: at(80) });
    expect(items[1]).toMatchObject({ startAt: at(80), endAt: at(110) });
  });
});

// ---------------------------------------------------------------------------
// Case 13: Forward around one meeting → fills up to it, resumes after it
// ---------------------------------------------------------------------------
describe('Case 13: Forward fill around one meeting', () => {
  it('fills the window before the meeting then resumes at the meeting end', () => {
    // anchor [120,180]. Free windows [0,120] and [180,480]. Start pinned at 60.
    // a=30 fits [60,90]. b=60 needs 90→150, which would run into the meeting,
    // so it jumps to the next window and starts the moment the meeting ends.
    const result = planDayAroundAnchors({
      deadline: at(480),
      nowMs: at(0),
      dayStartMs: DAY_START,
      tasks: [task('a', 30), task('b', 60)],
      anchors: [anchor('mtg', 120, 180)],
      bufferMin: 0,
      fill: { direction: 'forward', startAtMs: at(60) },
    });

    expect(result.verdict.kind).toBe('fits');

    const items = taskItemsOf(result.timeline);
    expect(items[0]).toMatchObject({ id: 'a', startAt: at(60), endAt: at(90) });
    expect(items[1]).toMatchObject({ id: 'b', startAt: at(180), endAt: at(240) });
  });
});

// ---------------------------------------------------------------------------
// Case 14: A task too big for the current window jumps to the next one
// ---------------------------------------------------------------------------
describe('Case 14: Forward fill — oversized task jumps to the next window', () => {
  it('skips a window that cannot hold the whole block rather than splitting it', () => {
    // Free windows [0,120] and [180,480]. Start pinned at 60 → 60min of room
    // left before the meeting. A 100min task cannot be split, so it moves whole.
    const result = planDayAroundAnchors({
      deadline: at(480),
      nowMs: at(0),
      dayStartMs: DAY_START,
      tasks: [task('big', 100)],
      anchors: [anchor('mtg', 120, 180)],
      bufferMin: 0,
      fill: { direction: 'forward', startAtMs: at(60) },
    });

    const items = taskItemsOf(result.timeline);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ startAt: at(180), endAt: at(280) });
  });
});

// ---------------------------------------------------------------------------
// Case 15: A task that fits no remaining window is left unplaced
// ---------------------------------------------------------------------------
describe('Case 15: Forward fill — task that fits no remaining window', () => {
  it('leaves the task unplaced instead of overlapping an anchor', () => {
    // Free windows [0,120] and [180,300]. Start pinned at 60 → 60min then 120min.
    // A 200min block fits neither, so nothing is placed and the day cannot fit.
    const result = planDayAroundAnchors({
      deadline: at(300),
      nowMs: at(0),
      dayStartMs: DAY_START,
      tasks: [task('huge', 200)],
      anchors: [anchor('mtg', 120, 180)],
      bufferMin: 0,
      fill: { direction: 'forward', startAtMs: at(60) },
    });

    expect(taskItemsOf(result.timeline)).toHaveLength(0);
    expect(result.verdict.kind).not.toBe('fits');
  });
});

// ---------------------------------------------------------------------------
// Case 16: MIN_START_LEAD_MIN floor — a pinned start that has already passed
// ---------------------------------------------------------------------------
describe('Case 16: Forward fill — the pinned start has already passed', () => {
  it('floors the fill at now + MIN_START_LEAD_MIN instead of scheduling in the past', () => {
    // The user pinned 60 this morning; it is now 300. Their number is theirs to
    // keep, but the work can only actually begin a lead-time after now.
    const nowMs = at(300);
    const result = planDayAroundAnchors({
      deadline: at(480),
      nowMs,
      dayStartMs: DAY_START,
      tasks: [task('a', 30)],
      anchors: [],
      bufferMin: 0,
      fill: { direction: 'forward', startAtMs: at(60) },
    });

    const expectedStart = nowMs + MIN_START_LEAD_MIN * MIN;
    expect(result.startBy).toBe(expectedStart);
    expect(taskItemsOf(result.timeline)[0]).toMatchObject({ startAt: expectedStart });
  });
});

// ---------------------------------------------------------------------------
// Case 17: Breathers still only separate tasks inside one window
// ---------------------------------------------------------------------------
describe('Case 17: Forward fill — breather within a window, none across a jump', () => {
  it('gaps two tasks in the same window and never across the meeting', () => {
    // anchor [120,180]. Start pinned at 10, comfortably clear of the lead floor.
    // a=30 [10,40], breather 10, b=30 [50,80] — same window. c=60 cannot fit
    // before 120 → jumps to 180, and the window change itself is the separation,
    // so no breather precedes it.
    const result = planDayAroundAnchors({
      deadline: at(480),
      nowMs: at(0),
      dayStartMs: DAY_START,
      tasks: [task('a', 30), task('b', 30), task('c', 60)],
      anchors: [anchor('mtg', 120, 180)],
      bufferMin: 0,
      breatherMin: 10,
      fill: { direction: 'forward', startAtMs: at(10) },
    });

    const items = taskItemsOf(result.timeline);
    expect(items[0]).toMatchObject({ id: 'a', startAt: at(10), endAt: at(40) });
    expect(items[1]).toMatchObject({ id: 'b', startAt: at(50), endAt: at(80) });
    expect(items[2]).toMatchObject({ id: 'c', startAt: at(180), endAt: at(240) });

    const breathers = result.timeline.filter((i) => i.kind === 'breather');
    expect(breathers).toHaveLength(1);
    expect(breathers[0]).toMatchObject({ startAt: at(40), endAt: at(50) });
  });
});

// ---------------------------------------------------------------------------
// Case 18: Backward stays the default — no existing caller changes behaviour
// ---------------------------------------------------------------------------
describe('Case 18: Backward is the default fill direction', () => {
  it('matches an explicit backward fill when the direction is omitted', () => {
    const base = {
      deadline: at(480),
      nowMs: at(0),
      dayStartMs: DAY_START,
      tasks: [task('a', 60), task('b', 60)],
      anchors: [anchor('mtg', 200, 260)],
      bufferMin: 0,
    };

    const implicit = planDayAroundAnchors(base);
    const explicit = planDayAroundAnchors({ ...base, fill: { direction: 'backward' } });

    expect(implicit).toEqual(explicit);
    // Backward still packs late: the last task ends at the deadline.
    expect(implicit.timeline.filter((i) => i.kind === 'task').at(-1)?.endAt).toBe(at(480));
  });
});

// ---------------------------------------------------------------------------
// Case 19: A task the fill cannot place is SHOWN, not silently dropped
// ---------------------------------------------------------------------------
describe('Case 19: Unplaced tasks surface as overflow blocks', () => {
  const overflowItemsOf = (timeline: readonly PlanTimelineItem[]) =>
    timeline.filter((i) => i.kind === 'overflow');

  /** Free window [0,60]. 'c' (40min) is the only block the backward pass can
   *  place; 'a' and 'b' have nowhere to go and used to vanish from the timeline. */
  const overflowingDay = () =>
    planDayAroundAnchors({
      deadline: at(60),
      nowMs: at(0),
      dayStartMs: DAY_START,
      tasks: [task('a', 200), task('b', 30), task('c', 40)],
      anchors: [],
      bufferMin: 0,
    });

  it('emits unplaced tasks as overflow blocks instead of dropping them', () => {
    const overflow = overflowItemsOf(overflowingDay().timeline);
    expect(overflow.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('starts the overflow chain AT the deadline so the overrun is real', () => {
    const overflow = overflowItemsOf(overflowingDay().timeline);
    // Starting at the done-by is what lets the UI read the boundary clock
    // straight off the first overflow row instead of re-deriving a deadline.
    expect(overflow[0]).toMatchObject({ startAt: at(60), endAt: at(260) });
  });

  it('chains further overflow blocks in queue order, each one further over', () => {
    const overflow = overflowItemsOf(overflowingDay().timeline);
    expect(overflow[1]).toMatchObject({ startAt: at(260), endAt: at(290) });
  });

  it('keeps an unplaced task at its QUEUE position, not shoved to the bottom', () => {
    // 'huge' is first in the queue and fits nowhere. It must still render first —
    // that is what lets a drop above the done-by line stick, with the boundary
    // moving up above it rather than the row snapping back down.
    const result = planDayAroundAnchors({
      deadline: at(120),
      nowMs: at(0),
      dayStartMs: DAY_START,
      tasks: [task('huge', 200), task('fits', 100)],
      anchors: [],
      bufferMin: 0,
    });

    const rows = result.timeline.filter(
      (i) => i.kind === 'task' || i.kind === 'overflow',
    );
    expect(rows.map((i) => i.id)).toEqual(['huge', 'fits']);
  });

  it('never loses a queued task, whatever the verdict', () => {
    const result = planDayAroundAnchors({
      deadline: at(60),
      nowMs: at(0),
      dayStartMs: DAY_START,
      tasks: [task('a', 50), task('b', 90), task('c', 120)],
      anchors: [anchor('mtg', 20, 40)],
      bufferMin: 0,
    });

    const rows = result.timeline.filter(
      (i) => i.kind === 'task' || i.kind === 'overflow',
    );
    expect(rows.map((i) => i.id).sort()).toEqual(['a', 'b', 'c']);
  });
});

// ---------------------------------------------------------------------------
// Case 20: A task that fits nowhere no longer poisons the tasks after it
// (Task 1 of the 2026-07-29 planner-fixes plan — per-window cursors + gap-fill.)
// ---------------------------------------------------------------------------
describe('Case 20: An unplaceable task does not block its neighbours', () => {
  it('forward: an unplaceable task does not block the tasks after it', () => {
    // Single free window [0,240] (08:00-12:00 in the brief). huge (300) fits
    // nowhere; tiny (30) must still land at the front of the window instead of
    // being pushed to overflow behind huge.
    const result = planDayAroundAnchors({
      deadline: at(240),
      nowMs: at(-1000), // well clear of MIN_START_LEAD_MIN so it never floors startAtMs
      dayStartMs: DAY_START,
      tasks: [task('huge', 300), task('tiny', 30)],
      anchors: [],
      bufferMin: 0,
      fill: { direction: 'forward', startAtMs: at(0) },
    });

    const taskItems = result.timeline.filter((i) => i.kind === 'task');
    const overflowItems = result.timeline.filter((i) => i.kind === 'overflow');

    expect(taskItems).toEqual([
      expect.objectContaining({ id: 'tiny', startAt: at(0), endAt: at(30) }),
    ]);
    expect(overflowItems.map((i) => i.id)).toEqual(['huge']);
  });

  it('backward: an unplaceable task does not block the tasks before it', () => {
    // Mirror of the forward case: single free window [0,240]. huge is LAST in
    // the queue (so backward fill tries it first) and fits nowhere; tiny is
    // FIRST in the queue and must still land at the back of the window.
    const result = planDayAroundAnchors({
      deadline: at(240),
      nowMs: at(0),
      dayStartMs: DAY_START,
      tasks: [task('tiny', 30), task('huge', 300)],
      anchors: [],
      bufferMin: 0,
      fill: { direction: 'backward' },
    });

    const taskItems = result.timeline.filter((i) => i.kind === 'task');
    const overflowItems = result.timeline.filter((i) => i.kind === 'overflow');

    expect(taskItems).toEqual([
      expect.objectContaining({ id: 'tiny', startAt: at(210), endAt: at(240) }),
    ]);
    expect(overflowItems.map((i) => i.id)).toEqual(['huge']);
  });

  it('forward: a task that fits nowhere ahead is placed in an earlier free window', () => {
    // Free windows [0,120] and [180,420] (meeting 10:00-11:00 on an 08:00-15:00
    // day). a(90) leaves an exact 30min gap at the tail of window0; b(240)
    // exactly fills window1, leaving c(30) nowhere to go AHEAD of it. Gap-fill
    // must place c in window0's leftover instead of reporting it as overflow.
    const result = planDayAroundAnchors({
      deadline: at(420),
      nowMs: at(-1000), // well clear of MIN_START_LEAD_MIN so it never floors startAtMs
      dayStartMs: DAY_START,
      tasks: [task('a', 90), task('b', 240), task('c', 30)],
      anchors: [anchor('mtg', 120, 180)],
      bufferMin: 0,
      fill: { direction: 'forward', startAtMs: at(0) },
    });

    const taskItems = result.timeline.filter((i) => i.kind === 'task');
    const overflowItems = result.timeline.filter((i) => i.kind === 'overflow');

    expect(overflowItems).toHaveLength(0);
    expect(taskItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'a', startAt: at(0), endAt: at(90) }),
        expect.objectContaining({ id: 'b', startAt: at(180), endAt: at(420) }),
        expect.objectContaining({ id: 'c', startAt: at(90), endAt: at(120) }),
      ]),
    );
  });

  it('backward: a task that fits nowhere behind it is placed in a later free window', () => {
    // Mirror: free windows [0,240] and [300,360] (meeting on a 0-360 day).
    // Backward walks the queue right-to-left, so 'a' (last in queue) is tried
    // first and takes the tail of window1, leaving an exact 30min gap; 'b'
    // (middle) exactly fills window0; 'c' (first in queue, tried last) then
    // has nowhere to go BEHIND b and must gap-fill into window1's leftover.
    const result = planDayAroundAnchors({
      deadline: at(360),
      nowMs: at(0),
      dayStartMs: DAY_START,
      tasks: [task('c', 30), task('b', 240), task('a', 30)],
      anchors: [anchor('mtg', 240, 300)],
      bufferMin: 0,
      fill: { direction: 'backward' },
    });

    const taskItems = result.timeline.filter((i) => i.kind === 'task');
    const overflowItems = result.timeline.filter((i) => i.kind === 'overflow');

    expect(overflowItems).toHaveLength(0);
    expect(taskItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'b', startAt: at(0), endAt: at(240) }),
        expect.objectContaining({ id: 'a', startAt: at(330), endAt: at(360) }),
        expect.objectContaining({ id: 'c', startAt: at(300), endAt: at(330) }),
      ]),
    );
  });

  it('breathers are still applied between two tasks sharing a window (regression)', () => {
    // Same shape as Case 10 (backward) — confirms the per-window cursor
    // rewrite did not disturb intra-window breather placement.
    const result = planDayAroundAnchors({
      deadline: at(200),
      nowMs: at(0),
      dayStartMs: DAY_START,
      tasks: [task('a', 30), task('b', 30)],
      anchors: [],
      bufferMin: 0,
      breatherMin: 10,
    });

    const items = result.timeline.filter((i) => i.kind === 'task');
    const breathers = result.timeline.filter((i) => i.kind === 'breather');
    expect(items).toEqual([
      expect.objectContaining({ id: 'a', startAt: at(130), endAt: at(160) }),
      expect.objectContaining({ id: 'b', startAt: at(170), endAt: at(200) }),
    ]);
    expect(breathers).toHaveLength(1);
  });

  it('no breather is applied across a window jump (regression)', () => {
    // Same shape as Case 17 (forward) — confirms the rewrite still treats a
    // window jump as its own gap, never doubling up with a breather.
    const result = planDayAroundAnchors({
      deadline: at(480),
      nowMs: at(0),
      dayStartMs: DAY_START,
      tasks: [task('a', 30), task('b', 30), task('c', 60)],
      anchors: [anchor('mtg', 120, 180)],
      bufferMin: 0,
      breatherMin: 10,
      fill: { direction: 'forward', startAtMs: at(10) },
    });

    const breathers = result.timeline.filter((i) => i.kind === 'breather');
    expect(breathers).toHaveLength(1);
    const cItem = result.timeline.find((i) => i.id === 'c');
    expect(cItem).toMatchObject({ startAt: at(180), endAt: at(240) });
  });
});

// ---------------------------------------------------------------------------
// Case 21: Gap-fill (pass 2) still reserves breatherMin against a neighbour
// already placed in the same window — fix round 1 for Task 1.
// ---------------------------------------------------------------------------
describe('Case 21: Gap-filled tasks still respect breatherMin against a placed neighbour', () => {
  it('forward: a gap-filled task reserves breatherMin after the task already in that window', () => {
    // Windows [0,120] and [130,370] (a 10min meeting at [120,130]).
    // a(90) placed [0,90] in window0. b(240) cannot follow a with the
    // breather (100+240=340 > 120) so it jumps to window1, exactly filling it
    // ([130,370]) and leaving zero room after it. c(20) then fails pass 1
    // entirely (nowhere ahead fits) and must gap-fill into window0's leftover
    // — but that leftover already holds 'a', so c must land at [100,120]
    // (90 + the 10min breather), not flush at [90,110].
    const result = planDayAroundAnchors({
      deadline: at(370),
      nowMs: at(-1000), // clear of MIN_START_LEAD_MIN
      dayStartMs: DAY_START,
      tasks: [task('a', 90), task('b', 240), task('c', 20)],
      anchors: [anchor('mtg', 120, 130)],
      bufferMin: 0,
      breatherMin: 10,
      fill: { direction: 'forward', startAtMs: at(0) },
    });

    const taskItems = result.timeline.filter((i) => i.kind === 'task');
    const overflowItems = result.timeline.filter((i) => i.kind === 'overflow');

    expect(overflowItems).toHaveLength(0);
    expect(taskItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'a', startAt: at(0), endAt: at(90) }),
        expect.objectContaining({ id: 'b', startAt: at(130), endAt: at(370) }),
        expect.objectContaining({ id: 'c', startAt: at(100), endAt: at(120) }),
      ]),
    );
  });

  it('backward: a gap-filled task reserves breatherMin before the task already in that window', () => {
    // Mirror: windows [0,240] and [250,370] (a 10min meeting at [240,250]).
    // Backward tries 'a' first (last in queue) — lands at the tail of window1
    // [280,370]. 'b' (240) can't precede it with the breather, jumps to
    // window0 and exactly fills it ([0,240]). 'c' (first in queue, tried
    // last) then fails pass 1 entirely and must gap-fill into window1's
    // leftover before 'a' — landing at [250,270], not flush at [260,280].
    const result = planDayAroundAnchors({
      deadline: at(370),
      nowMs: at(0),
      dayStartMs: DAY_START,
      tasks: [task('c', 20), task('b', 240), task('a', 90)],
      anchors: [anchor('mtg', 240, 250)],
      bufferMin: 0,
      breatherMin: 10,
      fill: { direction: 'backward' },
    });

    const taskItems = result.timeline.filter((i) => i.kind === 'task');
    const overflowItems = result.timeline.filter((i) => i.kind === 'overflow');

    expect(overflowItems).toHaveLength(0);
    expect(taskItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'b', startAt: at(0), endAt: at(240) }),
        expect.objectContaining({ id: 'a', startAt: at(280), endAt: at(370) }),
        expect.objectContaining({ id: 'c', startAt: at(250), endAt: at(270) }),
      ]),
    );
  });
});

// ---------------------------------------------------------------------------
// Case 22: Pass 3 — pull a later-placed task forward into an earlier window
// that pass 1/2 left empty, so a wasted hour next to the pinned start/deadline
// gets used instead of sitting idle while the queue's tail is packed later.
// ---------------------------------------------------------------------------
describe('Case 22: A later task is pulled into an otherwise-empty earlier window', () => {
  it('forward: a later short task is pulled into the gap before a meeting', () => {
    // Day 08:00-18:00 (0-600min), meeting 10:00-11:00 (120-180min).
    // Windows: [0,120] and [180,600]. big(180) doesn't fit window0, jumps to
    // window1; small(30) never reconsiders window0 in pass 1 (curWinIdx
    // already ratcheted to window1) and lands right after big. Pass 3 must
    // pull 'small' back into window0 since it's the last-placed occupant of
    // window1 and fits there whole; 'big' must stay put at 11:00.
    const result = planDayAroundAnchors({
      deadline: at(600),
      nowMs: at(-1000),
      dayStartMs: DAY_START,
      tasks: [task('big', 180), task('small', 30)],
      anchors: [anchor('mtg', 120, 180)],
      bufferMin: 0,
      fill: { direction: 'forward', startAtMs: at(0) },
    });

    const taskItems = result.timeline.filter((i) => i.kind === 'task');
    expect(taskItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'small', startAt: at(0), endAt: at(30) }),
        expect.objectContaining({ id: 'big', startAt: at(180), endAt: at(360) }),
      ]),
    );
  });

  it('nothing is pulled before the pinned start', () => {
    // Same day/anchor as above but startAtMs pinned to 09:00 (60min) instead
    // of 08:00 — the [0,60] slice before the pinned start must stay empty;
    // pass 3 must never place a task before the fill's own start bound.
    const result = planDayAroundAnchors({
      deadline: at(600),
      nowMs: at(-1000),
      dayStartMs: DAY_START,
      tasks: [task('big', 180), task('small', 30)],
      anchors: [anchor('mtg', 120, 180)],
      bufferMin: 0,
      fill: { direction: 'forward', startAtMs: at(60) },
    });

    const taskItems = result.timeline.filter((i) => i.kind === 'task');
    expect(taskItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'small', startAt: at(60), endAt: at(90) }),
        expect.objectContaining({ id: 'big', startAt: at(180), endAt: at(360) }),
      ]),
    );
  });

  it('the pass terminates on a day where nothing can move (fully packed day)', () => {
    // Single window [0,110], two tasks that exactly fill it back-to-back —
    // there is no remaining room anywhere for pass 3 to pull anything into,
    // so the timeline must come out identical to pass 1/2's placement.
    const before = planDayAroundAnchors({
      deadline: at(110),
      nowMs: at(-1000),
      dayStartMs: DAY_START,
      tasks: [task('a', 80), task('b', 30)],
      anchors: [],
      bufferMin: 0,
      fill: { direction: 'forward', startAtMs: at(0) },
    });

    const taskItems = before.timeline.filter((i) => i.kind === 'task');
    expect(taskItems).toEqual([
      expect.objectContaining({ id: 'a', startAt: at(0), endAt: at(80) }),
      expect.objectContaining({ id: 'b', startAt: at(80), endAt: at(110) }),
    ]);
  });

  it('backward fill mirrors the pull', () => {
    // Day 0-600min, meeting 480-540 (near the deadline). Windows: [0,480] and
    // [540,600]. Queue order [small, big] means backward tries 'big' (last in
    // queue) first: it doesn't fit window1 (60min), jumps to window0; 'small'
    // (tried second) never reconsiders window1 (curWinIdx already ratcheted
    // to window0) and lands right before big. Pass 3 must pull 'small'
    // forward into window1's leftover since it's the last-placed occupant of
    // window0 and fits there whole; 'big' must stay put ending at 480.
    const result = planDayAroundAnchors({
      deadline: at(600),
      nowMs: at(0),
      dayStartMs: DAY_START,
      tasks: [task('small', 30), task('big', 180)],
      anchors: [anchor('mtg', 480, 540)],
      bufferMin: 0,
      fill: { direction: 'backward' },
    });

    const taskItems = result.timeline.filter((i) => i.kind === 'task');
    expect(taskItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'small', startAt: at(570), endAt: at(600) }),
        expect.objectContaining({ id: 'big', startAt: at(300), endAt: at(480) }),
      ]),
    );
  });
});

// ---------------------------------------------------------------------------
// Case 21: Overflow chain never reports clocks in the past; startBy is null
// when nothing could be placed at all.
// (Task 3 of the 2026-07-29 planner-fixes plan.)
// ---------------------------------------------------------------------------
describe('Case 23: Overflow blocks never start in the past', () => {
  /** Single free window [0,60]. 'c' (40min) is the only block that fits;
   *  'a' and 'b' overflow, exactly mirroring Case 19's `overflowingDay`. */
  const overflowingDay = (nowMs: number) =>
    planDayAroundAnchors({
      deadline: at(60),
      nowMs,
      dayStartMs: DAY_START,
      tasks: [task('a', 200), task('b', 30), task('c', 40)],
      anchors: [],
      bufferMin: 0,
    });

  it('overflow blocks still start at the deadline when the deadline is ahead', () => {
    // now(0) is well before the deadline(60) — unaffected by the nowMs floor.
    const overflow = overflowingDay(at(0)).timeline.filter((i) => i.kind === 'overflow');
    expect(overflow[0]).toMatchObject({ startAt: at(60), endAt: at(260) });
  });

  it('overflow blocks start at now when the deadline has passed', () => {
    // now(200) is well past the deadline(60) — the chain must not read as
    // clocks already in the past.
    const nowMs = at(200);
    const overflow = overflowingDay(nowMs).timeline.filter((i) => i.kind === 'overflow');
    expect(overflow[0]).toMatchObject({ startAt: nowMs, endAt: nowMs + 200 * MIN });
    expect(overflow[1]).toMatchObject({ startAt: nowMs + 200 * MIN, endAt: nowMs + 230 * MIN });
  });

  it('startBy is null when nothing could be placed', () => {
    // Anchor spans the entire schedulable day → zero free windows → nothing
    // to place at all, so there is no honest clock to fabricate a start from.
    const result = planDayAroundAnchors({
      deadline: at(100),
      nowMs: at(0),
      dayStartMs: DAY_START,
      tasks: [task('a', 30)],
      anchors: [anchor('all-day-meeting', 0, 100)],
      bufferMin: 0,
    });

    expect(result.timeline.filter((i) => i.kind === 'task')).toHaveLength(0);
    expect(result.startBy).toBeNull();
  });

  it('startBy is null on the empty-task-list early return', () => {
    const result = planDayAroundAnchors({
      deadline: at(480),
      nowMs: at(0),
      dayStartMs: DAY_START,
      tasks: [],
      anchors: [],
      bufferMin: 0,
    });

    expect(result.startBy).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Case 24: backwardFill recomputes the breather against the window it actually
// lands in, not the one it started the retry loop against.
// (Task 4 of the 2026-07-29 planner-fixes plan.)
// ---------------------------------------------------------------------------
describe('Case 24: Backward fill recomputes the breather after a window jump', () => {
  it('backward: a task that jumps to an earlier window does not reserve a breather', () => {
    // Day 08:00-18:00 (480-1080min), meeting 13:00-14:00 (780-840min),
    // breatherMin 15, tasks [a 60, b 60, c 180].
    // Windows: [480,780] and [840,1080]. Backward tries 'c' first (last in
    // queue) — fills the tail of window1: [900,1080]. 'b' is tried next; it
    // reserves a breather against window1 first (prevPlacedWindowIdx===1) but
    // that reservation must be dropped the moment it retries window0 — a
    // window it never shared with 'c'. If the breather leaked across the
    // jump, 'b' would end at 12:45 instead of 13:00.
    const result = planDayAroundAnchors({
      deadline: at(1080),
      nowMs: at(0),
      dayStartMs: at(480),
      tasks: [task('a', 60), task('b', 60), task('c', 180)],
      anchors: [anchor('mtg', 780, 840)],
      bufferMin: 0,
      breatherMin: 15,
      fill: { direction: 'backward' },
    });

    const taskItems = result.timeline.filter((i) => i.kind === 'task');
    expect(taskItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'a', startAt: at(645), endAt: at(705) }),
        expect.objectContaining({ id: 'b', startAt: at(720), endAt: at(780) }),
        expect.objectContaining({ id: 'c', startAt: at(900), endAt: at(1080) }),
      ]),
    );

    const breathers = result.timeline.filter((i) => i.kind === 'breather');
    expect(breathers).toHaveLength(1);
    expect(breathers[0]).toMatchObject({ startAt: at(705), endAt: at(720) });
  });

  it('backward: two tasks in the same window still get their breather', () => {
    // Pins the unchanged behaviour: when a window jump is NOT involved, the
    // breather is still reserved between two tasks that land in the same
    // window.
    const result = planDayAroundAnchors({
      deadline: at(200),
      nowMs: at(0),
      dayStartMs: DAY_START,
      tasks: [task('a', 30), task('b', 30)],
      anchors: [],
      bufferMin: 0,
      breatherMin: 15,
      fill: { direction: 'backward' },
    });

    const taskItems = result.timeline.filter((i) => i.kind === 'task');
    expect(taskItems).toEqual([
      expect.objectContaining({ id: 'a', startAt: at(125), endAt: at(155) }),
      expect.objectContaining({ id: 'b', startAt: at(170), endAt: at(200) }),
    ]);

    const breathers = result.timeline.filter((i) => i.kind === 'breather');
    expect(breathers).toHaveLength(1);
    expect(breathers[0]).toMatchObject({ startAt: at(155), endAt: at(170) });
  });
});

// ---------------------------------------------------------------------------
// Case 25: A gap-filled task can land next to a QUEUE-DISTANT neighbour in the
// same window. `buildTimeline`'s breather rows and `computeTotalMin` used to
// only look at queue-adjacent pairs (effectives[i], effectives[i+1]) sharing a
// window — but pass 2 (gap-fill) and pass 3 (pull-back) both place tasks by
// actual clock position, not queue order, so a breather the fill genuinely
// reserved between two clock-adjacent-but-queue-distant tasks rendered as an
// unexplained hole with no row, and totalMin silently dropped those minutes.
// (Finding 2 of the 2026-07-30 final review.)
// ---------------------------------------------------------------------------
describe('Case 25: Breather rows and totalMin follow ACTUAL placement order, not queue order', () => {
  it('forward: a gap-filled task lands between two queue-distant occupants of the same window — the reserved gap gets a row', () => {
    // Windows [0,120] and [130,370] (a 10min meeting at [120,130]).
    // a(90) placed [0,90] in window0 (pass 1). b(240) jumps to window1,
    // exactly filling it ([130,370]). c(20) gap-fills into window0's
    // leftover, landing at [100,120] — right after 'a', but 'a' and 'c' are
    // NOT queue-adjacent (b sits between them in the queue). The fill still
    // reserved the 10min breather between them (cursor arithmetic), so the
    // rendered timeline has a real, silent gap from 90 to 100 without this fix.
    const result = planDayAroundAnchors({
      deadline: at(370),
      nowMs: at(-1000),
      dayStartMs: DAY_START,
      tasks: [task('a', 90), task('b', 240), task('c', 20)],
      anchors: [anchor('mtg', 120, 130)],
      bufferMin: 0,
      breatherMin: 10,
      fill: { direction: 'forward', startAtMs: at(0) },
    });

    const breathers = result.timeline.filter((i) => i.kind === 'breather');
    // One breather between 'a' and 'c' (same window, clock-adjacent). None
    // between 'c' and 'b', or 'a'/'b' — those are window jumps.
    expect(breathers).toHaveLength(1);
    expect(breathers[0]).toMatchObject({ startAt: at(90), endAt: at(100) });

    // totalMin must include the reserved breather: 90 + 240 + 20 + 10 = 360.
    expect(result.totalMin).toBe(360);
  });

  it('backward: a gap-filled task lands between two queue-distant occupants of the same window — the reserved gap gets a row', () => {
    // Mirror of Case 21's backward gap-fill: windows [0,240] and [250,370]
    // (a 10min meeting at [240,250]). Queue [c(20), b(240), a(90)]. 'a' (last
    // in queue, tried first) lands at the tail of window1: [280,370]. 'b'
    // jumps to window0, exactly filling it: [0,240]. 'c' (first in queue,
    // tried last) gap-fills into window1's leftover before 'a': [250,270] —
    // 'c' and 'a' share window1 but are NOT queue-adjacent ('b' sits between
    // them), and the reserved 10min gap needs a row exactly like a
    // queue-adjacent pair would get.
    const result = planDayAroundAnchors({
      deadline: at(370),
      nowMs: at(0),
      dayStartMs: DAY_START,
      tasks: [task('c', 20), task('b', 240), task('a', 90)],
      anchors: [anchor('mtg', 240, 250)],
      bufferMin: 0,
      breatherMin: 10,
      fill: { direction: 'backward' },
    });

    const breathers = result.timeline.filter((i) => i.kind === 'breather');
    expect(breathers).toHaveLength(1);
    expect(breathers[0]).toMatchObject({ startAt: at(270), endAt: at(280) });

    expect(result.totalMin).toBe(360);
  });
});
