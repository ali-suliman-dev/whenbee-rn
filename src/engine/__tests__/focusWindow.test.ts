import { fitFocusWindow, promoteIntoWindow, focusWindowMinutes } from '../focusWindow';

const tasks = (...mins: [string, number][]) =>
  mins.map(([id, honestMin]) => ({ id, label: id, honestMin }));
const win = (
  tasksList: { id: string; label: string; honestMin: number }[],
  windowStartMin: number,
  windowEndMin: number,
) => fitFocusWindow({ tasks: tasksList, windowStartMin, windowEndMin }, 'personal');

describe('focusWindowMinutes', () => {
  it('is end - start, floored at 0', () => {
    expect(focusWindowMinutes({ windowStartMin: 540, windowEndMin: 720 })).toBe(180);
    expect(focusWindowMinutes({ windowStartMin: 720, windowEndMin: 540 })).toBe(0);
  });
});

describe('fitFocusWindow', () => {
  it('1: empty → fits, nothing packed', () => {
    const r = win([], 540, 720);
    expect(r.verdict).toBe('fits');
    expect(r.packedMin).toBe(0);
    expect(r.inWindow).toEqual([]);
    expect(r.spilled).toEqual([]);
  });
  it('2: all fit', () => {
    const r = win(tasks(['a', 90], ['b', 40], ['c', 20]), 540, 720); // 150 ≤ 180
    expect(r.verdict).toBe('fits');
    expect(r.packedMin).toBe(150);
    expect(r.spilled).toEqual([]);
  });
  it('3: exact fit', () => {
    const r = win(tasks(['a', 90], ['b', 40], ['c', 20]), 540, 690); // window 150
    expect(r.verdict).toBe('fits');
    expect(r.packedMin).toBe(150);
  });
  it('4: spill in order', () => {
    const r = win(tasks(['a', 90], ['b', 40], ['c', 50]), 540, 670); // window 130
    expect(r.verdict).toBe('spills');
    expect(r.inWindow.map((p) => p.id)).toEqual(['a', 'b']);
    expect(r.spilled.map((p) => p.id)).toEqual(['c']);
  });
  it('5: first-fit keeps trying smaller later tasks', () => {
    const r = win(tasks(['a', 50], ['b', 90], ['c', 40]), 540, 670); // window 130
    expect(r.inWindow.map((p) => p.id)).toEqual(['a', 'c']); // 50 fits, 90 spills, 40 fits
    expect(r.spilled.map((p) => p.id)).toEqual(['b']);
  });
  it('6: first task bigger than window', () => {
    const r = win(tasks(['a', 200], ['b', 10]), 540, 720); // window 180
    expect(r.inWindow.map((p) => p.id)).toEqual(['b']);
    expect(r.spilled.map((p) => p.id)).toEqual(['a']);
  });
  it('7: zero-length window spills all', () => {
    const r = win(tasks(['a', 30]), 600, 600);
    expect(r.verdict).toBe('spills');
    expect(r.windowMin).toBe(0);
  });
  it('8: start>end floors window to 0', () => {
    const r = win(tasks(['a', 30]), 700, 600);
    expect(r.windowMin).toBe(0);
    expect(r.spilled.length).toBe(1);
  });
  it('counts + basis', () => {
    const r = win(tasks(['a', 30], ['b', 30]), 540, 720);
    expect(r.fitCount).toBe(2);
    expect(r.totalCount).toBe(2);
    expect(r.basis).toBe('personal');
  });
});

describe('promoteIntoWindow', () => {
  it('9: promote with free space, no eviction', () => {
    const spillBase = win(tasks(['a', 90], ['b', 50], ['c', 60]), 540, 670); // window 130
    // a(90) in (rem 40); b(50) spill; c(60) spill.
    expect(spillBase.inWindow.map((p) => p.id)).toEqual(['a']);
  });
  it('10: promote needs eviction → smallest in-window bumped', () => {
    // window 100: a(60) in (rem 40); b(50) spills (>40); c(20) in (rem 20).
    const base = win(tasks(['a', 60], ['b', 50], ['c', 20]), 540, 640);
    expect(base.inWindow.map((p) => p.id)).toEqual(['a', 'c']);
    const r = promoteIntoWindow(base, 'b'); // need 50, free 20, evict smallest (c=20) → free 40 <50, evict a(60) → free 100
    expect(r.inWindow.some((p) => p.id === 'b')).toBe(true);
    expect(r.spilled.some((p) => p.id === 'c')).toBe(true); // smallest bumped first
  });
  it('11: promote evicts only as many as needed (minimal eviction)', () => {
    const base = win(tasks(['a', 30], ['b', 30], ['c', 70]), 540, 660); // window 120: a,b in (60); c(70) spills
    expect(base.spilled.map((p) => p.id)).toEqual(['c']);
    const r = promoteIntoWindow(base, 'c'); // need 70, free 60, evict ONE 30 (later=b) → free 90 ≥70
    expect(r.inWindow.map((p) => p.id)).toEqual(['a', 'c']); // a survives, only b bumped
    expect(r.spilled.map((p) => p.id)).toEqual(['b']);
  });
  it('11b: ties on smallest evict the later one when only one must go', () => {
    // window 110: a(30) in (rem 80); b(30) in (rem 50); c(60) spills (>50).
    const base = win(tasks(['a', 30], ['b', 30], ['c', 60]), 540, 650);
    expect(base.inWindow.map((p) => p.id)).toEqual(['a', 'b']);
    const r = promoteIntoWindow(base, 'c'); // need 60, free 50, evict one 30 → later (b) first → free 80
    expect(r.inWindow.some((p) => p.id === 'c')).toBe(true);
    expect(r.inWindow.some((p) => p.id === 'a')).toBe(true); // earlier priority survives
    expect(r.spilled.some((p) => p.id === 'b')).toBe(true);
  });
  it('12: unknown id → unchanged', () => {
    const base = win(tasks(['a', 40]), 540, 720);
    expect(promoteIntoWindow(base, 'zzz')).toEqual(base);
  });
  it('13: promoting a task larger than the whole window → unchanged', () => {
    const base = win(tasks(['a', 40], ['b', 200]), 540, 720); // window 180: a in, b spills
    expect(promoteIntoWindow(base, 'b')).toEqual(base);
  });
  it('15: inputs not mutated', () => {
    const list = tasks(['a', 40], ['b', 30]);
    const frozen = Object.freeze(list.map((x) => Object.freeze({ ...x })));
    expect(() =>
      fitFocusWindow(
        { tasks: frozen as never, windowStartMin: 540, windowEndMin: 720 },
        'personal',
      ),
    ).not.toThrow();
  });
});
