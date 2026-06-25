/**
 * B-Task 1 — the running timer's honest finish RANGE.
 *
 * At session start useTimer resolves the running category's calibration
 * `confidence` + honest `range` from the cached stats (statsByCategory), so the
 * timer can show "Done {low}–{high}" (Pro, Surface C) instead of the point
 * finish. An unknown / empty category has no usable spread → range is null and
 * the timer degrades to the point finish.
 */

import { renderHook } from '@testing-library/react-native';
import { useTimer, type TimerParams } from '@/src/features/timer/useTimer';
import { useTimerStore } from '@/src/stores/timerStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import type { CachedStat } from '@/src/stores/calibrationStore';

// expo-router is pulled in transitively; stub the navigation surface useTimer uses.
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), dismiss: jest.fn(), push: jest.fn() },
}));

function makeStat(over: Partial<CachedStat> = {}): CachedStat {
  return {
    mEffective: 1.6,
    n: 10,
    sharpness: 60,
    tier: 'Setting',
    fit: { a: 0, b: 1.6 },
    // A wide, still-noisy spread (CV > 0.35) → 'setting' confidence: enough logs
    // to draw a band, not yet tight enough to settle to 'honest'.
    clampedRatios: [0.8, 2.4, 1.1, 2.0, 0.7, 2.6, 1.3, 2.2, 0.9, 2.5],
    priorMult: 1.5,
    ...over,
  };
}

const baseParams: TimerParams = {
  taskId: 'task-range',
  label: 'Write report',
  category: 'deep_work',
  estimateMin: 48,
  guessMin: 30,
  suggestedHonestMin: 48,
};

beforeEach(() => {
  useTimerStore.setState({
    taskLabel: null,
    category: null,
    estimateMin: 0,
    startedAt: null,
    pausedAccumMs: 0,
    pausedAt: null,
    isRunning: false,
    guessMin: 0,
    taskId: null,
    suggestedHonestMin: 0,
    isQuickStart: false,
  });
  useCalibrationStore.setState({ statsByCategory: {} });
});

describe('useTimer — honest range (Surface C)', () => {
  it('brackets the honest suggestion for a learning category', () => {
    useCalibrationStore.setState({ statsByCategory: { deep_work: makeStat() } });

    const { result } = renderHook(() => useTimer(baseParams));

    expect(result.current.range).not.toBeNull();
    const { lowMinutes, highMinutes } = result.current.range!;
    // The band always contains the honest point number the timer fills toward.
    expect(lowMinutes).toBeLessThanOrEqual(baseParams.suggestedHonestMin!);
    expect(highMinutes).toBeGreaterThanOrEqual(baseParams.suggestedHonestMin!);
    // A real spread, low strictly under high.
    expect(lowMinutes).toBeLessThan(highMinutes);
    // Confidence comes straight off the cached spread.
    expect(result.current.confidence).toBe('setting');
  });

  it('returns range null for an unknown / untracked category', () => {
    // statsByCategory has no entry for this category.
    const { result } = renderHook(() =>
      useTimer({ ...baseParams, category: 'mystery_category' }),
    );

    expect(result.current.range).toBeNull();
  });

  it('returns range null for an empty (n=0, no ratios) category', () => {
    useCalibrationStore.setState({
      statsByCategory: { deep_work: makeStat({ n: 0, clampedRatios: [] }) },
    });

    const { result } = renderHook(() => useTimer(baseParams));

    expect(result.current.range).toBeNull();
    // A cold category reads as raw confidence.
    expect(result.current.confidence).toBe('raw');
  });
});
