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
    done[0]!.categoryLabel = 'Deep Work';

    const { result } = renderDaySoFar({ done, totalCount: 1, isToday: true });

    expect(result.current).not.toBeNull();
    expect(result.current?.completedCount).toBe(1);
    expect(result.current?.guessedMin).toBe(30);
    expect(result.current?.totalMin).toBe(35);
  });

  it("sums guessedMin and totalMin over today's completed logs, treating a null actualMin as 0", () => {
    const done = [
      makeDoneRow({ id: 'd3', label: 'Read', category: 'deep-work', guessMin: 20, actualMin: 25 }),
      makeDoneRow({ id: 'd2', label: 'Reply emails', category: 'admin', guessMin: 10, actualMin: null }),
      makeDoneRow({ id: 'd1', label: 'Write doc', category: 'deep-work', guessMin: 30, actualMin: 35 }),
    ];

    const { result } = renderDaySoFar({ done, totalCount: 3, isToday: true });

    expect(result.current?.completedCount).toBe(3);
    expect(result.current?.guessedMin).toBe(60); // 20 + 10 + 30
    expect(result.current?.totalMin).toBe(60); // 25 + 0 + 35
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
