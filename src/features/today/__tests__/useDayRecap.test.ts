// src/features/today/__tests__/useDayRecap.test.ts
// TDD for useDayRecap — verifies the computed fields for a past selected day
// and that null is returned for today or future.

import { renderHook } from '@testing-library/react-native';
import { createMemoryDatabase } from '@/src/db/memoryDatabase';
import { makeTasksRepo } from '@/src/db/repositories/tasksRepo';
import { makeDayTasksStore, useDayTasksStore } from '@/src/stores/dayTasksStore';
import { useDayRecap } from '@/src/features/today/useDayRecap';

// Pin the clock so "today" is always 2026-06-24 regardless of the real date.
// useDayRecap calls Date.now() internally to determine today vs. past.
const FIXED_NOW = new Date(2026, 5, 24, 12, 0, 0).getTime(); // local 2026-06-24 noon

beforeAll(() => {
  jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
});
afterAll(() => {
  (Date.now as jest.Mock).mockRestore();
});

// 2026-06-23 09:00 (yesterday relative to the test scenario)
const YESTERDAY_MS = new Date(2026, 5, 23, 9, 0, 0).getTime();
// 2026-06-24 09:00 (today in the test scenario)
const TODAY_MS = new Date(2026, 5, 24, 9, 0, 0).getTime();

function makeTestStore() {
  const db = createMemoryDatabase();
  const repo = makeTasksRepo(db);
  const flags = new Map<string, string>();
  return makeDayTasksStore({
    repo,
    kvGet: (k) => flags.get(k) ?? null,
    kvSet: (k, v) => { flags.set(k, v); },
  });
}

// Freeze the wall clock to the scenario's "today" so the recap's past/today/future
// comparison is deterministic regardless of the real date the suite runs on.
let nowSpy: jest.SpyInstance;

beforeEach(() => {
  nowSpy = jest.spyOn(Date, 'now').mockReturnValue(TODAY_MS);
  // Reset the bound singleton to a clean state between tests.
  useDayTasksStore.setState({ dayTasks: [], selectedDate: '2026-06-24' });
});

afterEach(() => {
  nowSpy.mockRestore();
});

describe('useDayRecap', () => {
  it('returns null when selected day is today', () => {
    useDayTasksStore.setState({ selectedDate: '2026-06-24', dayTasks: [] });
    const { result } = renderHook(() => useDayRecap());
    expect(result.current).toBeNull();
  });

  it('returns null when selected day is in the future', () => {
    useDayTasksStore.setState({ selectedDate: '2026-06-25', dayTasks: [] });
    const { result } = renderHook(() => useDayRecap());
    expect(result.current).toBeNull();
  });

  it('computes recap for a past day with done + queued tasks', async () => {
    const testStore = makeTestStore();
    await testStore.getState().init(TODAY_MS);

    // Add a done task (completed yesterday) — planned yesterday, completed yesterday.
    const t1 = await testStore.getState().addTask({
      label: 'Write doc',
      category: 'deep-work',
      guessMin: 60,
      date: '2026-06-23',
      nowMs: YESTERDAY_MS,
    });
    await testStore.getState().completeTask(t1.id, {
      completedAt: YESTERDAY_MS + 30 * 60_000,
      actualMin: 45,
      nowMs: YESTERDAY_MS,
    });

    // Add a second done task with a different actualMin/guessMin.
    const t2 = await testStore.getState().addTask({
      label: 'Stand-up',
      category: 'meetings',
      guessMin: 30,
      date: '2026-06-23',
      nowMs: YESTERDAY_MS,
    });
    await testStore.getState().completeTask(t2.id, {
      completedAt: YESTERDAY_MS + 60 * 60_000,
      actualMin: 20,
      nowMs: YESTERDAY_MS,
    });

    // Add a queued task on yesterday (undone, would show as plannedCount > doneCount).
    await testStore.getState().addTask({
      label: 'Deferred task',
      category: 'admin',
      guessMin: 20,
      date: '2026-06-23',
      nowMs: YESTERDAY_MS,
    });

    // Select yesterday so the store's dayTasks reflect that day.
    await testStore.getState().selectDate('2026-06-23');

    // Wire the bound store to the test store state so useDayRecap reads it.
    useDayTasksStore.setState({
      selectedDate: testStore.getState().selectedDate,
      dayTasks: testStore.getState().dayTasks,
    });

    const { result } = renderHook(() => useDayRecap());

    expect(result.current).not.toBeNull();
    // 2 done tasks.
    expect(result.current?.doneCount).toBe(2);
    // 2 done + 1 queued = 3 planned.
    expect(result.current?.plannedCount).toBe(3);
    // 45 + 20 = 65 real focus minutes.
    expect(result.current?.realFocusMin).toBe(65);
    // (45 - 60) + (20 - 30) = -15 + -10 = -25 (ran under guess).
    expect(result.current?.vsGuessMin).toBe(-25);
  });

  it('handles a past day with only done tasks and no queued', async () => {
    const testStore = makeTestStore();
    await testStore.getState().init(TODAY_MS);

    const t = await testStore.getState().addTask({
      label: 'Quick email',
      category: 'admin',
      guessMin: 10,
      date: '2026-06-23',
      nowMs: YESTERDAY_MS,
    });
    await testStore.getState().completeTask(t.id, {
      completedAt: YESTERDAY_MS + 12 * 60_000,
      actualMin: 12,
      nowMs: YESTERDAY_MS,
    });

    await testStore.getState().selectDate('2026-06-23');

    useDayTasksStore.setState({
      selectedDate: testStore.getState().selectedDate,
      dayTasks: testStore.getState().dayTasks,
    });

    const { result } = renderHook(() => useDayRecap());

    expect(result.current?.doneCount).toBe(1);
    expect(result.current?.plannedCount).toBe(1);
    expect(result.current?.realFocusMin).toBe(12);
    // 12 - 10 = +2.
    expect(result.current?.vsGuessMin).toBe(2);
  });

  it('returns zero realFocusMin for done tasks with no actualMin', async () => {
    const testStore = makeTestStore();
    await testStore.getState().init(TODAY_MS);

    const t = await testStore.getState().addTask({
      label: 'Untimed task',
      category: 'admin',
      guessMin: 20,
      date: '2026-06-23',
      nowMs: YESTERDAY_MS,
    });
    // Complete without actualMin.
    await testStore.getState().completeTask(t.id, {
      completedAt: YESTERDAY_MS + 10 * 60_000,
      nowMs: YESTERDAY_MS,
    });

    await testStore.getState().selectDate('2026-06-23');

    useDayTasksStore.setState({
      selectedDate: testStore.getState().selectedDate,
      dayTasks: testStore.getState().dayTasks,
    });

    const { result } = renderHook(() => useDayRecap());

    expect(result.current?.realFocusMin).toBe(0);
    // vsGuessMin: no actualMin → not counted.
    expect(result.current?.vsGuessMin).toBe(0);
  });

  it('returns a recap with doneCount=0 for an empty past day', () => {
    useDayTasksStore.setState({ selectedDate: '2026-06-23', dayTasks: [] });
    const { result } = renderHook(() => useDayRecap());

    expect(result.current).not.toBeNull();
    expect(result.current?.doneCount).toBe(0);
    expect(result.current?.plannedCount).toBe(0);
    expect(result.current?.realFocusMin).toBe(0);
    expect(result.current?.vsGuessMin).toBe(0);
  });
});
