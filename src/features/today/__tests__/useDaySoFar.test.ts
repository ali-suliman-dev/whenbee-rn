// src/features/today/__tests__/useDaySoFar.test.ts
// TDD for useDaySoFar — wires the pure visibility rule to live store state
// (timerStore.isRunning, calibration stats) plus params the ROUTE'S OWN
// `useToday()` call already computed (`done`, `totalCount`, `isToday`), and
// derives two DELIBERATELY separate pieces of data:
//   - HONEY stat  = the OVERALL lead (most-ripened) category, same number the
//                   Today avatar ring / Whenbee hub show (leadHoney.ts).
//   - MILESTONE   = today's most recently completed log's category + its
//                   logsToNextTier.
// These can disagree (a category can be the day's most recent log without
// being the account's overall highest-sharpness category) — several tests
// below pin that distinction explicitly.
//
// The hook intentionally does NOT call `useToday()` itself — that hook is
// side-effectful (fires `honest_suggestion_shown` once per surfacing, mounts
// `useWidgetPublisher`) and must only ever be mounted once per screen.

import { renderHook } from '@testing-library/react-native';
import { useDaySoFar, type UseDaySoFarParams } from '@/src/features/today/useDaySoFar';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import { useTimerStore } from '@/src/stores/timerStore';
import type { TodayRow } from '@/src/features/today/useToday';
import { logsToNextTier } from '@/src/engine';
import { analytics } from '@/src/services/analytics';

function makeDoneRow(overrides: {
  id: string;
  label: string;
  category: string;
  guessMin: number;
  honestMin?: number;
  actualMin: number | null;
}): TodayRow {
  return {
    id: overrides.id,
    label: overrides.label,
    category: overrides.category,
    categoryLabel: overrides.category,
    guessMin: overrides.guessMin,
    honestMin: overrides.honestMin ?? overrides.guessMin,
    done: true,
    actualMin: overrides.actualMin,
    carriedFrom: null,
  };
}

function renderDaySoFar(params: UseDaySoFarParams) {
  return renderHook(() => useDaySoFar(params));
}

beforeEach(() => {
  useCalibrationStore.setState({ statsByCategory: {} });
  useCategoriesStore.setState({ categories: [] });
  useTimerStore.getState().cancel();
});

describe('useDaySoFar', () => {
  it('returns null on a fresh day with zero logs', () => {
    const { result } = renderDaySoFar({ done: [], totalCount: 0, isToday: true });
    expect(result.current).toBeNull();
  });

  it('returns null while a task is still queued', () => {
    const done = [
      makeDoneRow({ id: 'd1', label: 'Write doc', category: 'deep-work', guessMin: 30, actualMin: 35 }),
    ];
    const { result } = renderDaySoFar({ done, totalCount: 2, isToday: true });
    expect(result.current).toBeNull();
  });

  it('returns null while a timer is running', () => {
    useTimerStore.setState({ isRunning: true, taskId: null });
    const done = [
      makeDoneRow({ id: 'd1', label: 'Write doc', category: 'deep-work', guessMin: 30, actualMin: 35 }),
    ];
    const { result } = renderDaySoFar({ done, totalCount: 1, isToday: true });
    expect(result.current).toBeNull();
  });

  it('returns null when the selected day is not today (past/future guard)', () => {
    const done = [
      makeDoneRow({ id: 'd1', label: 'Write doc', category: 'deep-work', guessMin: 30, actualMin: 35 }),
    ];
    const { result } = renderDaySoFar({ done, totalCount: 1, isToday: false });
    expect(result.current).toBeNull();
  });

  it('is visible with one completed log and nothing queued/running', () => {
    const done = [
      makeDoneRow({ id: 'd1', label: 'Write doc', category: 'deep-work', guessMin: 30, actualMin: 35 }),
    ];
    useCategoriesStore.setState({ categories: [{ id: 'deep-work', name: 'Deep Work', adaptSpeed: 'balanced' }] });
    useCalibrationStore.setState({ statsByCategory: { 'deep-work': { sharpness: 62, tier: 'Ripening', fit: { a: 0, b: 1 }, n: 4, mEffective: 1 } } });
    done[0]!.categoryLabel = 'Deep Work';

    const { result } = renderDaySoFar({ done, totalCount: 1, isToday: true });

    expect(result.current).not.toBeNull();
    expect(result.current?.completedCount).toBe(1);
    expect(result.current?.totalMin).toBe(35);
    expect(result.current?.honeyPct).toBe(62);
    expect(result.current?.leadCategoryLabel).toBe('Deep Work');
  });

  it('sums totalMin over all of today\'s completed logs, treating a null actualMin as 0', () => {
    const done = [
      makeDoneRow({ id: 'd3', label: 'Read', category: 'deep-work', guessMin: 20, actualMin: 25 }),
      makeDoneRow({ id: 'd2', label: 'Reply emails', category: 'admin', guessMin: 10, actualMin: null }),
      makeDoneRow({ id: 'd1', label: 'Write doc', category: 'deep-work', guessMin: 30, actualMin: 35 }),
    ];
    useCalibrationStore.setState({ statsByCategory: { 'deep-work': { sharpness: 40, tier: 'Setting', fit: { a: 0, b: 1 }, n: 2, mEffective: 1 } } });

    const { result } = renderDaySoFar({ done, totalCount: 3, isToday: true });

    expect(result.current?.completedCount).toBe(3);
    expect(result.current?.totalMin).toBe(60); // 25 + 0 + 35
  });

  it('MILESTONE tracks the most recently completed log, independent of the overall lead category (controller ruling)', () => {
    // `done` is already most-recent-first (useToday's contract): d2 (deep-work) first.
    const done = [
      makeDoneRow({ id: 'd2', label: 'Newer', category: 'deep-work', guessMin: 20, actualMin: 20 }),
      makeDoneRow({ id: 'd1', label: 'Older', category: 'admin', guessMin: 10, actualMin: 10 }),
    ];
    done[0]!.categoryLabel = 'Deep Work';
    done[1]!.categoryLabel = 'Admin';
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

    const { result } = renderDaySoFar({ done, totalCount: 2, isToday: true });

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
    const done = [
      makeDoneRow({ id: 'd1', label: 'First ever log', category: 'brand-new', guessMin: 10, actualMin: 10 }),
    ];
    done[0]!.categoryLabel = 'Brand New';
    const { result } = renderDaySoFar({ done, totalCount: 1, isToday: true });
    expect(result.current?.honeyPct).toBe(0);
    expect(result.current?.leadCategoryLabel).toBe('Brand New');
  });

  // Regression (second `useToday()` mount finding): `useDaySoFar` must be a
  // PURE derivation of its params + the three stat/category/timer stores it
  // reads directly — it must never call `useToday()` itself, because that
  // hook is side-effectful (fires `honest_suggestion_shown` once per
  // surfacing, mounts `useWidgetPublisher`). Two `useToday()` mounts on the
  // same screen (route + this hook) would double-fire both. Asserting no
  // analytics capture happens here is the strongest practical pin available
  // without rendering the full Today route (which needs a large store/native
  // mock surface not otherwise set up in this suite).
  it('never captures analytics itself (no independent useToday mount)', () => {
    const captureSpy = jest.spyOn(analytics, 'capture').mockImplementation(() => {});
    const done = [
      makeDoneRow({ id: 'd1', label: 'Write doc', category: 'deep-work', guessMin: 30, actualMin: 35 }),
    ];

    renderDaySoFar({ done, totalCount: 1, isToday: true });

    expect(captureSpy).not.toHaveBeenCalled();
    captureSpy.mockRestore();
  });
});
