/**
 * useLearnedFocusWindow — unit test.
 *
 * Strategy: mock the three stores the hook reads (calibrationStore,
 * settingsStore, useCalibrationStore's statsByCategory) and inject a rich
 * morning-peak dataset (≥20 distinct days, 600–660 min cluster). Assert that
 * the returned LearnedFocusWindow has basis === 'revealed' and that the effect
 * writes the learned window into settingsStore.
 */
import { renderHook, act } from '@testing-library/react-native';
import { useLearnedFocusWindow } from '../useLearnedFocusWindow';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useSettingsStore } from '@/src/stores/settingsStore';

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a completed event. `startedAt` is computed from dayKey so the hook's
 * ageDays formula `(NOW_MS - startedAt) / 86_400_000` stays in the recency
 * halflife window (35 days).
 *
 * The engine learns focus-window from accuracy DIFFERENCES by time of day:
 * morning events must have different s (ln(honest/actual)) than afternoon.
 * We use: morning actual=14 (fast, s≈+0.76) vs afternoon actual=40 (slow, s≈−0.29).
 */
function makeEvent(localMinute: number, actualMin: number, dayKey: number) {
  return {
    category: 'admin',
    estimateMin: 30,
    actualMin,
    status: 'completed' as const,
    startedAt: dayKey * 86_400_000 + localMinute * 60_000,
    startLocalMinute: localMinute,
  };
}

/**
 * 20 days of events with a clear 10:00–10:30 morning focus peak.
 * Morning: fast (actual=14, s>0). Afternoon: slow (actual=40, s<0).
 * This produces a significant time-of-day signal the engine can detect.
 */
function buildRichPeakEvents() {
  const events = [];
  for (let d = 0; d < 20; d++) {
    // Strong morning cluster (10:00 and 10:30) — fast execution
    events.push(makeEvent(600, 14, d));
    events.push(makeEvent(630, 16, d));
    // Off-peak afternoon — slow execution
    events.push(makeEvent(900, 40, d));
  }
  return events;
}

const RICH_EVENTS = buildRichPeakEvents();

// ── mock: loadFocusEvents returns the rich dataset ────────────────────────────
beforeEach(() => {
  // Reset the settings store so each test starts clean
  useSettingsStore.getState().reset();

  // Patch loadFocusEvents on the calibration store. The `as unknown as ...`
  // cast is intentional: Zustand's setState merges partial state, but the
  // TypeScript overload requires the full shape. This is standard test practice.
  useCalibrationStore.setState({
    statsByCategory: {
      admin: { mEffective: 1.0, n: 25, sharpness: 50, tier: 'Ripening', fit: { a: 0, b: 1.0 } },
    },
    loadFocusEvents: async () => RICH_EVENTS,
  } as unknown as Parameters<typeof useCalibrationStore.setState>[0]);
});

afterEach(() => {
  // Restore to an empty state after each test
  useCalibrationStore.setState({
    statsByCategory: {},
    loadFocusEvents: async () => [],
  } as unknown as Parameters<typeof useCalibrationStore.setState>[0]);
});

// ── tests ─────────────────────────────────────────────────────────────────────

// Use a NOW_MS far enough in the future that all events have fresh ages.
// Events start at day d, NOW is at day 100 → ageDays ≈ 100-d (all recent enough).
// But to match the engine test pattern that works, we use NOW at day 20+1 so
// events at d=0..19 are 1..20 days old — well within the 35-day halflife.
const NOW_MS = 20 * 86_400_000; // "now" = day 20, events span d=0..19

/** Flush all pending micro-tasks and state updates. */
async function flushAsync(): Promise<void> {
  await act(async () => {
    // Two ticks: one for the promise resolution inside the effect, one for
    // the setState call that triggers a re-render.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
}

test('returns a revealed window for a rich morning-peak dataset', async () => {
  const { result } = renderHook(() => useLearnedFocusWindow(NOW_MS));
  await flushAsync();
  expect(result.current.basis).toBe('revealed');
});

test('writes the learned window into settingsStore when not user-set', async () => {
  const { result } = renderHook(() => useLearnedFocusWindow(NOW_MS));
  await flushAsync();

  expect(result.current.basis).toBe('revealed');
  // The effect should have written the window into the settings store
  const s = useSettingsStore.getState();
  expect(s.windowStartMin).not.toBeNull();
  expect(s.windowEndMin).not.toBeNull();
});

test('does NOT overwrite settings when focusWindowUserSet is true', async () => {
  // User already set their window manually
  useSettingsStore.getState().setFocusWindow(420, 540); // 07:00–09:00
  expect(useSettingsStore.getState().focusWindowUserSet).toBe(true);

  renderHook(() => useLearnedFocusWindow(NOW_MS));
  await act(async () => {
    await Promise.resolve();
  });

  // Should remain at the user-set window
  expect(useSettingsStore.getState().windowStartMin).toBe(420);
  expect(useSettingsStore.getState().windowEndMin).toBe(540);
});

test('returns forming basis when there is insufficient data', () => {
  useCalibrationStore.setState({
    statsByCategory: {
      admin: { mEffective: 1.0, n: 1, sharpness: 0, tier: 'Raw', fit: { a: 0, b: 1.0 } },
    },
    loadFocusEvents: async () => [makeEvent(600, 14, 0)],
  } as unknown as Parameters<typeof useCalibrationStore.setState>[0]);

  const { result } = renderHook(() => useLearnedFocusWindow(NOW_MS));
  expect(result.current.basis).toBe('forming');
});
