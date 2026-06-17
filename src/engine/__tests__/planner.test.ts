import { planBackward, DEFAULT_BUFFER_MIN } from '../planner';
import type { PlanTaskInput, PlanVerdict } from '../../domain/types';

const MIN = 60_000;
// A fixed, readable reference deadline (epoch ms). All times are relative to it.
const DEADLINE = 8 * 60 * MIN; // arbitrary "08:00" anchor

const task = (id: string, durationMin: number): PlanTaskInput => ({
  id,
  label: `Task ${id}`,
  category: 'getting-ready',
  durationMin,
});

describe('planBackward — backward pass arithmetic', () => {
  it('places empty tasks as a perfect fit at the deadline (totalMin 0)', () => {
    const r = planBackward({ deadline: DEADLINE, tasks: [], nowMs: DEADLINE - 60 * MIN });
    expect(r.totalMin).toBe(0);
    expect(r.startBy).toBe(DEADLINE);
    expect(r.timeline).toEqual([]);
    expect(r.verdict).toEqual({ kind: 'fits', startBy: DEADLINE });
  });

  it('sums effective blocks (duration + buffer) into totalMin and startBy', () => {
    // two 20-min tasks, default +5 buffer → 25 + 25 = 50 effective minutes
    const r = planBackward({
      deadline: DEADLINE,
      tasks: [task('a', 20), task('b', 20)],
      nowMs: DEADLINE - 90 * MIN,
    });
    expect(r.totalMin).toBe(50);
    expect(r.startBy).toBe(DEADLINE - 50 * MIN);
  });

  it('builds a forward, contiguous, order-preserving timeline from startBy', () => {
    const r = planBackward({
      deadline: DEADLINE,
      tasks: [task('a', 10), task('b', 30)],
      bufferMin: 0,
      nowMs: DEADLINE - 120 * MIN,
    });
    expect(r.startBy).toBe(DEADLINE - 40 * MIN);
    expect(r.timeline.map((t) => t.id)).toEqual(['a', 'b']);
    // contiguous: each block starts where the previous ended
    expect(r.timeline[0]!.startAt).toBe(DEADLINE - 40 * MIN);
    expect(r.timeline[0]!.endAt).toBe(DEADLINE - 30 * MIN);
    expect(r.timeline[1]!.startAt).toBe(DEADLINE - 30 * MIN);
    expect(r.timeline[1]!.endAt).toBe(DEADLINE); // finishes exactly at deadline
  });
});

describe('planBackward — buffer chip variants', () => {
  const tasks = [task('a', 20), task('b', 10)];
  it.each([
    [0, 30],
    [5, 40],
    [10, 50],
    [20, 70],
  ])('bufferMin=%i → totalMin=%i', (bufferMin, expectedTotal) => {
    const r = planBackward({ deadline: DEADLINE, tasks, bufferMin, nowMs: DEADLINE - 999 * MIN });
    expect(r.totalMin).toBe(expectedTotal);
    expect(r.startBy).toBe(DEADLINE - expectedTotal * MIN);
  });

  it('defaults to +5 per task when bufferMin is omitted', () => {
    expect(DEFAULT_BUFFER_MIN).toBe(5);
    const r = planBackward({ deadline: DEADLINE, tasks, nowMs: DEADLINE - 999 * MIN });
    expect(r.totalMin).toBe(40); // (20+5) + (10+5)
  });
});

describe('planBackward — fits verdict', () => {
  it('fits when startBy is comfortably after now', () => {
    const r = planBackward({
      deadline: DEADLINE,
      tasks: [task('a', 10)],
      bufferMin: 0,
      nowMs: DEADLINE - 60 * MIN,
    });
    expect(r.verdict.kind).toBe('fits');
  });

  it('treats an exact fit (startBy === nowMs) as fits', () => {
    // total 30 effective → startBy = DEADLINE - 30; set now to exactly that
    const startBy = DEADLINE - 30 * MIN;
    const r = planBackward({
      deadline: DEADLINE,
      tasks: [task('a', 15), task('b', 15)],
      bufferMin: 0,
      nowMs: startBy,
    });
    expect(r.verdict).toEqual({ kind: 'fits', startBy });
  });
});

describe('planBackward — cut-one verdict', () => {
  it('names the single largest task when dropping it makes the plan fit', () => {
    // tasks (buffer 0): a=10, BIG=40, c=10 → total 60 → startBy = DEADLINE-60
    // now = DEADLINE-25. Dropping BIG (40) → remaining 20 → startBy DEADLINE-20 ≥ now. Fits.
    const r = planBackward({
      deadline: DEADLINE,
      tasks: [task('a', 10), task('BIG', 40), task('c', 10)],
      bufferMin: 0,
      nowMs: DEADLINE - 25 * MIN,
    });
    const v = r.verdict as Extract<PlanVerdict, { kind: 'cut-one' }>;
    expect(v.kind).toBe('cut-one');
    expect(v.cut).toEqual({ id: 'BIG', label: 'Task BIG' });
    expect(v.savedMin).toBe(40);
    expect(v.startBy).toBe(DEADLINE - 20 * MIN);
  });

  it('saves the effective block (incl. buffer) of the cut task', () => {
    // buffer +5: a=15, BIG=45, total 60 → startBy DEADLINE-60. now DEADLINE-20.
    // drop BIG (45) → remaining 15 → startBy DEADLINE-15 ≥ now.
    const r = planBackward({
      deadline: DEADLINE,
      tasks: [task('a', 10), task('BIG', 40)],
      nowMs: DEADLINE - 20 * MIN,
    });
    const v = r.verdict as Extract<PlanVerdict, { kind: 'cut-one' }>;
    expect(v.kind).toBe('cut-one');
    expect(v.cut.id).toBe('BIG');
    expect(v.savedMin).toBe(45); // 40 + 5 buffer
  });
});

describe('planBackward — multi-cut verdict', () => {
  it('drops several largest tasks (largest-first) when one is not enough', () => {
    // buffer 0: a=30, b=30, c=10 → total 70 → startBy DEADLINE-70.
    // now = DEADLINE-15. Drop a(30)→40 still > 15 left; drop b(30)→10 → startBy DEADLINE-10 ≥ now.
    const r = planBackward({
      deadline: DEADLINE,
      tasks: [task('a', 30), task('b', 30), task('c', 10)],
      bufferMin: 0,
      nowMs: DEADLINE - 15 * MIN,
    });
    const v = r.verdict as Extract<PlanVerdict, { kind: 'multi-cut' }>;
    expect(v.kind).toBe('multi-cut');
    expect(v.cuts.map((c) => c.id)).toEqual(['a', 'b']);
    expect(v.savedMin).toBe(60);
    expect(v.startBy).toBe(DEADLINE - 10 * MIN);
  });

  it('breaks ties by original order when effective blocks are equal', () => {
    // three equal 20-min tasks, buffer 0 → total 60 → startBy DEADLINE-60.
    // now DEADLINE-20 → one cut leaves 40 (>20, no fit); two cuts leave 20 (=20, fits).
    // largest-first ties resolve to a, then b.
    const r = planBackward({
      deadline: DEADLINE,
      tasks: [task('a', 20), task('b', 20), task('c', 20)],
      bufferMin: 0,
      nowMs: DEADLINE - 20 * MIN,
    });
    const v = r.verdict as Extract<PlanVerdict, { kind: 'multi-cut' }>;
    expect(v.kind).toBe('multi-cut');
    expect(v.cuts.map((c) => c.id)).toEqual(['a', 'b']);
  });
});

describe('planBackward — push-deadline verdict', () => {
  it('pushes the deadline when even the smallest task alone will not fit', () => {
    // one huge task longer than the now→deadline window.
    // buffer 0: HUGE=120 → total 120 → startBy DEADLINE-120. now = DEADLINE-30.
    // keeping only the smallest (the sole task) still needs 120 > 30 → push.
    const nowMs = DEADLINE - 30 * MIN;
    const r = planBackward({
      deadline: DEADLINE,
      tasks: [task('HUGE', 120)],
      bufferMin: 0,
      nowMs,
    });
    const v = r.verdict as Extract<PlanVerdict, { kind: 'push-deadline' }>;
    expect(v.kind).toBe('push-deadline');
    // feasibleDeadline = now + smallest(120) min
    expect(v.feasibleDeadline).toBe(nowMs + 120 * MIN);
    // overshoot = ceil((now + total - deadline)/min) = (DEADLINE-30 + 120 - DEADLINE) = 90
    expect(v.overshootMin).toBe(90);
  });

  it('pushes when keeping only the smallest of several still will not fit', () => {
    // buffer 0: a=50, b=40, smallest=20 → total 110 → startBy DEADLINE-110.
    // now = DEADLINE-15. Dropping a and b leaves smallest=20 > 15 → push.
    const nowMs = DEADLINE - 15 * MIN;
    const r = planBackward({
      deadline: DEADLINE,
      tasks: [task('a', 50), task('b', 40), task('small', 20)],
      bufferMin: 0,
      nowMs,
    });
    const v = r.verdict as Extract<PlanVerdict, { kind: 'push-deadline' }>;
    expect(v.kind).toBe('push-deadline');
    expect(v.feasibleDeadline).toBe(nowMs + 20 * MIN); // smallest effective block
    expect(v.overshootMin).toBe(110 - 15); // 95
  });

  it('rounds overshoot up to the next whole minute', () => {
    // Introduce a sub-minute gap so the raw overshoot isn't an integer.
    const nowMs = DEADLINE - 30 * MIN + 30_000; // 30s into the window
    const r = planBackward({
      deadline: DEADLINE,
      tasks: [task('HUGE', 120)],
      bufferMin: 0,
      nowMs,
    });
    const v = r.verdict as Extract<PlanVerdict, { kind: 'push-deadline' }>;
    // raw = (nowMs + 120min - DEADLINE)/min = 90.5 → ceil → 91
    expect(v.overshootMin).toBe(91);
  });
});

describe('breatherMin inserts', () => {
  const deadline = Date.UTC(2026, 5, 17, 22, 52); // 22:52
  const nowMs = Date.UTC(2026, 5, 17, 18, 0); // 18:00 — plenty of time
  const base = {
    deadline,
    nowMs,
    bufferMin: 0,
    tasks: [
      { id: 'a', label: 'A', category: 'x', durationMin: 30 },
      { id: 'b', label: 'B', category: 'x', durationMin: 30 },
      { id: 'c', label: 'C', category: 'x', durationMin: 30 },
    ],
  };

  it('no breathers when breatherMin is 0', () => {
    const r = planBackward({ ...base, breatherMin: 0 });
    expect(r.timeline.filter((i) => i.kind === 'breather')).toHaveLength(0);
    expect(r.timeline.filter((i) => i.kind === 'task')).toHaveLength(3);
  });

  it('no breathers when breatherMin is absent', () => {
    const r = planBackward({ ...base });
    expect(r.timeline.filter((i) => i.kind === 'breather')).toHaveLength(0);
  });

  it('single task: no breather emitted (N-1 = 0 gaps)', () => {
    const r = planBackward({
      deadline,
      nowMs,
      bufferMin: 0,
      breatherMin: 10,
      tasks: [{ id: 'only', label: 'Only', category: 'x', durationMin: 30 }],
    });
    expect(r.timeline.filter((i) => i.kind === 'breather')).toHaveLength(0);
    expect(r.timeline).toHaveLength(1);
  });

  it('two tasks with breatherMin=5 → one breather, startBy 5min earlier', () => {
    const twoTasks = [
      { id: 'a', label: 'A', category: 'x', durationMin: 30 },
      { id: 'b', label: 'B', category: 'x', durationMin: 30 },
    ];
    const noBreather = planBackward({ deadline, nowMs, bufferMin: 0, tasks: twoTasks });
    const withBreather = planBackward({ deadline, nowMs, bufferMin: 0, breatherMin: 5, tasks: twoTasks });

    expect(noBreather.startBy - withBreather.startBy).toBe(5 * 60_000);
    expect(withBreather.timeline.filter((i) => i.kind === 'breather')).toHaveLength(1);
  });

  it('three tasks with breatherMin=10 → two breather items, startBy 20min earlier', () => {
    const noBreather = planBackward({ ...base, breatherMin: 0 });
    const withBreather = planBackward({ ...base, breatherMin: 10 });

    expect(noBreather.startBy - withBreather.startBy).toBe(20 * 60_000);
    expect(withBreather.timeline.filter((i) => i.kind === 'breather')).toHaveLength(2);
  });

  it('breather items have correct start/end times sandwiched between tasks', () => {
    const twoTasks = [
      { id: 'a', label: 'A', category: 'x', durationMin: 20 },
      { id: 'b', label: 'B', category: 'x', durationMin: 20 },
    ];
    const r = planBackward({ deadline, nowMs, bufferMin: 0, breatherMin: 5, tasks: twoTasks });
    // timeline should be: task-a, breather, task-b (3 items total)
    expect(r.timeline).toHaveLength(3);
    const [taskA, breather, taskB] = r.timeline;
    expect(taskA!.kind).toBe('task');
    expect(breather!.kind).toBe('breather');
    expect(taskB!.kind).toBe('task');
    // contiguous: taskA ends where breather starts, breather ends where taskB starts
    expect(breather!.startAt).toBe(taskA!.endAt);
    expect(taskB!.startAt).toBe(breather!.endAt);
    // breather spans exactly 5 minutes
    expect(breather!.endAt - breather!.startAt).toBe(5 * 60_000);
    // taskB ends exactly at deadline
    expect(taskB!.endAt).toBe(deadline);
  });

  it('matches the brief example: 3 tasks × 10min breather → 2 gaps push startBy 20min earlier', () => {
    const noBreather = planBackward({ ...base, breatherMin: 0 });
    const withBreather = planBackward({ ...base, breatherMin: 10 });

    expect(noBreather.startBy - withBreather.startBy).toBe(20 * 60_000);
    expect(withBreather.timeline.filter((i) => i.kind === 'breather')).toHaveLength(2);
  });
});

describe('planBackward — purity', () => {
  it('does not mutate the input tasks array or its elements', () => {
    const tasks = [task('a', 30), task('b', 30)];
    const snapshot = JSON.parse(JSON.stringify(tasks));
    planBackward({ deadline: DEADLINE, tasks, bufferMin: 10, nowMs: DEADLINE - 5 * MIN });
    expect(tasks).toEqual(snapshot);
  });

  it('always exposes startBy + timeline even on the cut/push branches', () => {
    const r = planBackward({
      deadline: DEADLINE,
      tasks: [task('HUGE', 120)],
      bufferMin: 0,
      nowMs: DEADLINE - 10 * MIN,
    });
    expect(r.startBy).toBe(DEADLINE - 120 * MIN);
    expect(r.timeline).toHaveLength(1);
    expect(r.verdict.kind).toBe('push-deadline');
  });
});
