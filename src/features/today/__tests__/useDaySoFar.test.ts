// src/features/today/__tests__/useDaySoFar.test.ts
// TDD for useDaySoFar — wires the pure visibility rule to live store state
// (useToday's done/upNext/totalCount, timerStore.isRunning, calibration stats),
// and derives two DELIBERATELY separate pieces of data:
//   - HONEY stat  = the OVERALL lead (most-ripened) category, same number the
//                   Today avatar ring / Whenbee hub show (leadHoney.ts).
//   - MILESTONE   = today's most recently completed log's category + its
//                   logsToNextTier.
// These can disagree (a category can be the day's most recent log without
// being the account's overall highest-sharpness category) — several tests
// below pin that distinction explicitly.

import { renderHook } from '@testing-library/react-native';
import { useDaySoFar } from '@/src/features/today/useDaySoFar';
import { useCalibrationStore, type ReclaimSummary } from '@/src/stores/calibrationStore';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import { useDayTasksStore } from '@/src/stores/dayTasksStore';
import { useTimerStore } from '@/src/stores/timerStore';
import type { DayTask } from '@/src/engine/daySelectors';
import { logsToNextTier } from '@/src/engine';

jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void | (() => void)) => cb(),
}));

const T0 = 1_700_000_000_000;

const defaultSummary: ReclaimSummary = {
  lifetimeMin: 0,
  byCategory: [],
  biggestArea: null,
  honestLogCount: 0,
  discoveryCount: 0,
  companion: {
    stage: 1 as const,
    capability: 'finish_time' as unknown as ReclaimSummary['companion']['capability'],
    keeper: false,
    lifetimeNectar: 0,
    driftHealth: 'settled' as const,
    seed: 1,
    name: null,
  },
};

function stubStoreEffects() {
  useCalibrationStore.setState({
    hydrate: async () => {},
    loadReclaimSummary: async () => defaultSummary,
  });
}

function makeDone(overrides: {
  id: string;
  label: string;
  category: string;
  guessMin: number;
  actualMin: number | null;
  completedAt: number;
}): DayTask {
  return {
    id: overrides.id,
    label: overrides.label,
    category: overrides.category,
    guessMin: overrides.guessMin,
    status: 'done',
    plannedDate: '2023-11-14',
    orderIndex: overrides.completedAt,
    doneByMin: null,
    createdAt: T0,
    completedAt: overrides.completedAt,
    actualMin: overrides.actualMin,
    fromRoutineId: null,
    calendarEventId: null,
    carriedFrom: null,
  };
}

function makeQueued(overrides: { id: string; label: string; category: string; guessMin: number }): DayTask {
  return {
    id: overrides.id,
    label: overrides.label,
    category: overrides.category,
    guessMin: overrides.guessMin,
    status: 'queued',
    plannedDate: '2023-11-14',
    orderIndex: T0,
    doneByMin: null,
    createdAt: T0,
    completedAt: null,
    actualMin: null,
    fromRoutineId: null,
    calendarEventId: null,
    carriedFrom: null,
  };
}

beforeEach(() => {
  useDayTasksStore.setState({ dayTasks: [], selectFocusTask: () => null });
  useCalibrationStore.setState({ logs: 0, statsByCategory: {} });
  useCategoriesStore.setState({ categories: [] });
  useTimerStore.getState().cancel();
  stubStoreEffects();
});

describe('useDaySoFar', () => {
  it('returns null on a fresh day with zero logs', () => {
    const { result } = renderHook(() => useDaySoFar());
    expect(result.current).toBeNull();
  });

  it('returns null while a task is still queued', () => {
    useDayTasksStore.setState({
      dayTasks: [
        makeDone({ id: 'd1', label: 'Write doc', category: 'deep-work', guessMin: 30, actualMin: 35, completedAt: T0 + 1000 }),
        makeQueued({ id: 'q1', label: 'Stand-up', category: 'meetings', guessMin: 15 }),
      ],
    });
    const { result } = renderHook(() => useDaySoFar());
    expect(result.current).toBeNull();
  });

  it('returns null while a timer is running', () => {
    useDayTasksStore.setState({
      dayTasks: [
        makeDone({ id: 'd1', label: 'Write doc', category: 'deep-work', guessMin: 30, actualMin: 35, completedAt: T0 + 1000 }),
      ],
    });
    useTimerStore.setState({ isRunning: true, taskId: null });
    const { result } = renderHook(() => useDaySoFar());
    expect(result.current).toBeNull();
  });

  it('is visible with one completed log and nothing queued/running', () => {
    useDayTasksStore.setState({
      dayTasks: [
        makeDone({ id: 'd1', label: 'Write doc', category: 'deep-work', guessMin: 30, actualMin: 35, completedAt: T0 + 1000 }),
      ],
    });
    useCategoriesStore.setState({ categories: [{ id: 'deep-work', name: 'Deep Work', adaptSpeed: 'balanced' }] });
    useCalibrationStore.setState({ statsByCategory: { 'deep-work': { sharpness: 62, tier: 'Ripening', fit: { a: 0, b: 1 }, n: 4, mEffective: 1 } } });

    const { result } = renderHook(() => useDaySoFar());

    expect(result.current).not.toBeNull();
    expect(result.current?.completedCount).toBe(1);
    expect(result.current?.totalMin).toBe(35);
    expect(result.current?.honeyPct).toBe(62);
    expect(result.current?.leadCategoryLabel).toBe('Deep Work');
  });

  it('sums totalMin over all of today\'s completed logs, treating a null actualMin as 0', () => {
    useDayTasksStore.setState({
      dayTasks: [
        makeDone({ id: 'd1', label: 'Write doc', category: 'deep-work', guessMin: 30, actualMin: 35, completedAt: T0 + 1000 }),
        makeDone({ id: 'd2', label: 'Reply emails', category: 'admin', guessMin: 10, actualMin: null, completedAt: T0 + 2000 }),
        makeDone({ id: 'd3', label: 'Read', category: 'deep-work', guessMin: 20, actualMin: 25, completedAt: T0 + 3000 }),
      ],
    });
    useCalibrationStore.setState({ statsByCategory: { 'deep-work': { sharpness: 40, tier: 'Setting', fit: { a: 0, b: 1 }, n: 2, mEffective: 1 } } });

    const { result } = renderHook(() => useDaySoFar());

    expect(result.current?.completedCount).toBe(3);
    expect(result.current?.totalMin).toBe(60); // 35 + 0 + 25
  });

  it('MILESTONE tracks the most recently completed log, independent of the overall lead category (controller ruling)', () => {
    useDayTasksStore.setState({
      dayTasks: [
        makeDone({ id: 'd1', label: 'Older', category: 'admin', guessMin: 10, actualMin: 10, completedAt: T0 + 1000 }),
        makeDone({ id: 'd2', label: 'Newer', category: 'deep-work', guessMin: 20, actualMin: 20, completedAt: T0 + 9000 }),
      ],
    });
    useCategoriesStore.setState({
      categories: [
        { id: 'admin', name: 'Admin', adaptSpeed: 'balanced' },
        { id: 'deep-work', name: 'Deep Work', adaptSpeed: 'balanced' },
      ],
    });
    useCalibrationStore.setState({
      statsByCategory: {
        admin: { sharpness: 90, tier: 'Honest', fit: { a: 0, b: 1 }, n: 20, mEffective: 1 },
        'deep-work': { sharpness: 30, tier: 'Setting', fit: { a: 0, b: 1 }, n: 1, mEffective: 1 },
      },
    });

    const { result } = renderHook(() => useDaySoFar());

    // MILESTONE: the most recently COMPLETED log is d2 (deep-work) — the
    // milestone category + its logsToNextTier follow that, not the highest-
    // sharpness category overall.
    expect(result.current?.leadCategoryLabel).toBe('Deep Work');
    expect(result.current?.logsToNextTier).toBe(logsToNextTier(30));
    // HONEY: the OVERALL lead cell is admin (90 > 30) — same number leadHoney.ts
    // (and the Today header ring) would report. This must NOT read 30
    // (deep-work, the milestone category) — that was the pre-ruling bug.
    expect(result.current?.honeyPct).toBe(90);
  });

  it('defaults honeyPct to 0 for an untracked category with no cached stat yet', () => {
    useDayTasksStore.setState({
      dayTasks: [
        makeDone({ id: 'd1', label: 'First ever log', category: 'brand-new', guessMin: 10, actualMin: 10, completedAt: T0 + 1000 }),
      ],
    });
    const { result } = renderHook(() => useDaySoFar());
    expect(result.current?.honeyPct).toBe(0);
    expect(result.current?.leadCategoryLabel).toBe('Brand New');
  });
});
