import { renderHook, act } from '@testing-library/react-native';
import { usePlanner } from '../usePlanner';
import { usePlanStore } from '@/src/stores/planStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { DEFAULT_BUFFER_MIN } from '@/src/engine';

const MIN = 60_000;
// Fixed clock + deadline so every plan is deterministic.
const NOW = 1_700_000_000_000;
const DEADLINE = NOW + 120 * MIN; // two hours out

function resetStores() {
  usePlanStore.setState({
    draft: { deadline: null, bufferMin: DEFAULT_BUFFER_MIN, tasks: [] },
    active: null,
  });
  useCalibrationStore.setState({ logs: 0, statsByCategory: {} });
}

beforeEach(resetStores);

describe('usePlanner — duration pre-fill from learned data', () => {
  it('pre-fills a fresh task duration from the population prior when n=0', () => {
    const { result } = renderHook(() => usePlanner({ nowMs: NOW }));
    // cleaning prior = 2.0 → round5(15 × 2.0) = 30
    expect(result.current.suggestedDuration('cleaning')).toBe(30);
    act(() => {
      result.current.addTask({ label: 'Tidy', category: 'cleaning' });
    });
    expect(usePlanStore.getState().draft.tasks[0]?.durationMin).toBe(30);
  });

  it('pre-fills from personal stats when the category has enough logs', () => {
    useCalibrationStore.setState({
      statsByCategory: { admin: { mEffective: 3.0, n: 5, sharpness: 60, tier: 'Ripening' } },
    });
    const { result } = renderHook(() => usePlanner({ nowMs: NOW }));
    // round5(15 × 3.0) = 45
    expect(result.current.suggestedDuration('admin')).toBe(45);
  });
});

describe('usePlanner — build verdicts', () => {
  it('a plan that fits yields a fits verdict + a start-by headline value', () => {
    const { result, rerender } = renderHook(() => usePlanner({ nowMs: NOW }));
    act(() => {
      result.current.setBuffer(0);
      result.current.setDeadline(DEADLINE);
      // one 30-min task inside a 120-min window → fits with room
      usePlanStore.getState().addTask({ label: 'A', category: 'admin', durationMin: 30 });
    });
    rerender({});
    const r = result.current.result;
    expect(r).not.toBeNull();
    expect(r?.verdict.kind).toBe('fits');
    // startBy = deadline - 30m
    expect(r?.startBy).toBe(DEADLINE - 30 * MIN);
  });

  it('an overflowing plan yields cut-one naming the largest task', () => {
    const { result, rerender } = renderHook(() => usePlanner({ nowMs: NOW }));
    act(() => {
      result.current.setBuffer(0);
      result.current.setDeadline(DEADLINE);
      // total 150m > 120m window. Largest is "Big" (100m) → dropping it fits.
      usePlanStore.getState().addTask({ label: 'Small', category: 'email', durationMin: 50 });
      usePlanStore.getState().addTask({ label: 'Big', category: 'writing', durationMin: 100 });
    });
    rerender({});
    const v = result.current.result?.verdict;
    expect(v?.kind).toBe('cut-one');
    if (v?.kind === 'cut-one') expect(v.cut.label).toBe('Big');
  });

  it('applying the cut-one action removes that task and the rebuilt plan fits', () => {
    const { result, rerender } = renderHook(() => usePlanner({ nowMs: NOW }));
    act(() => {
      result.current.setBuffer(0);
      result.current.setDeadline(DEADLINE);
      usePlanStore.getState().addTask({ label: 'Small', category: 'email', durationMin: 50 });
      usePlanStore.getState().addTask({ label: 'Big', category: 'writing', durationMin: 100 });
    });
    rerender({});
    const v = result.current.result?.verdict;
    expect(v?.kind).toBe('cut-one');

    act(() => {
      if (v?.kind === 'cut-one') result.current.cut([v.cut.id]);
    });
    rerender({});

    expect(usePlanStore.getState().draft.tasks.map((t) => t.label)).toEqual(['Small']);
    expect(result.current.result?.verdict.kind).toBe('fits');
  });

  it('push-deadline action moves the finish to the feasible time', () => {
    const { result, rerender } = renderHook(() => usePlanner({ nowMs: NOW }));
    act(() => {
      result.current.setBuffer(0);
      result.current.setDeadline(DEADLINE);
      // a single task larger than the whole window → even one task won't fit
      usePlanStore.getState().addTask({ label: 'Marathon', category: 'creative', durationMin: 200 });
    });
    rerender({});
    const v = result.current.result?.verdict;
    expect(v?.kind).toBe('push-deadline');
    if (v?.kind === 'push-deadline') {
      // feasibleDeadline = now + 200m
      expect(v.feasibleDeadline).toBe(NOW + 200 * MIN);
      act(() => result.current.pushDeadline(v.feasibleDeadline));
      expect(usePlanStore.getState().draft.deadline).toBe(NOW + 200 * MIN);
    }
  });
});

describe('usePlanner — re-project produces a diff and only applies on confirm', () => {
  it('reproject returns old vs new without mutating the active plan', () => {
    // Build + save an active plan at NOW.
    const { result } = renderHook(() => usePlanner({ nowMs: NOW }));
    act(() => {
      result.current.setBuffer(0);
      result.current.setDeadline(DEADLINE);
      usePlanStore.getState().addTask({ label: 'A', category: 'admin', durationMin: 30 });
      result.current.saveActive(NOW);
    });

    // Re-mount the hook with a LATER clock — now 100m have passed.
    const later = NOW + 100 * MIN;
    const { result: r2 } = renderHook(() => usePlanner({ nowMs: later }));
    let diff: ReturnType<typeof r2.current.reproject> = null;
    act(() => {
      diff = r2.current.reproject();
    });

    expect(diff).not.toBeNull();
    // old startBy was at the original clock; new startBy reflects the later clock.
    expect(diff!.oldStartBy).toBe(DEADLINE - 30 * MIN);
    // The active plan is untouched by reproject (no silent reshuffle).
    expect(usePlanStore.getState().active?.deadline).toBe(DEADLINE);
    expect(usePlanStore.getState().active?.createdAt).toBe(NOW);
  });
});
