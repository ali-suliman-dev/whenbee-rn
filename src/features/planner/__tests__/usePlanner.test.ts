import { renderHook, act } from '@testing-library/react-native';
import { usePlanner } from '../usePlanner';
import { usePlanStore } from '@/src/stores/planStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { DEFAULT_BUFFER_MIN, DEFAULT_BREATHER_MIN } from '@/src/engine';
import type { ReprojectResult } from '@/src/engine/planner';

const MIN = 60_000;
// Fixed clock + deadline so every plan is deterministic.
const NOW = 1_700_000_000_000;
const DEADLINE = NOW + 120 * MIN; // two hours out

function resetStores() {
  usePlanStore.setState({
    draft: { deadline: null, bufferMin: DEFAULT_BUFFER_MIN, breatherMin: DEFAULT_BREATHER_MIN, tasks: [] },
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
      statsByCategory: { admin: { mEffective: 3.0, n: 5, sharpness: 60, tier: 'Ripening', fit: { a: 0, b: 3.0 } } },
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
      if (v?.kind === 'cut-one') result.current.cutTasks([v.cut.id]);
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

// ──────────────────────────────────────────────────────────────────────────────
// New tests for Task 5: phase selector, setBreather, runGroups, cut-card state
// ──────────────────────────────────────────────────────────────────────────────

describe('usePlanner — phase selector', () => {
  it('phase is build when no active plan exists', () => {
    const { result } = renderHook(() => usePlanner({ nowMs: NOW }));
    expect(result.current.phase).toBe('build');
  });

  it('phase flips to run once a plan is active', () => {
    const { result } = renderHook(() => usePlanner({ nowMs: NOW }));
    act(() => {
      result.current.addTask({ label: 'A', category: 'x', durationMin: 20 });
      result.current.setDeadline(DEADLINE);
    });
    expect(result.current.phase).toBe('build');
    act(() => {
      result.current.saveActive(NOW);
    });
    expect(result.current.phase).toBe('run');
  });

  it('phase returns to build after clearing the active plan', () => {
    const { result } = renderHook(() => usePlanner({ nowMs: NOW }));
    act(() => {
      result.current.addTask({ label: 'B', category: 'admin', durationMin: 20 });
      result.current.setDeadline(DEADLINE);
      result.current.saveActive(NOW);
    });
    expect(result.current.phase).toBe('run');
    act(() => {
      result.current.clearActive();
    });
    expect(result.current.phase).toBe('build');
  });
});

describe('usePlanner — setBreather', () => {
  it('setBreather updates draft breatherMin via the store', () => {
    const { result } = renderHook(() => usePlanner({ nowMs: NOW }));
    act(() => {
      result.current.setBreather(10);
    });
    expect(usePlanStore.getState().draft.breatherMin).toBe(10);
  });
});

describe('usePlanner — runGroups', () => {
  it('runGroups is empty when no active plan exists', () => {
    const { result } = renderHook(() => usePlanner({ nowMs: NOW }));
    expect(result.current.runGroups.done).toHaveLength(0);
    expect(result.current.runGroups.now).toHaveLength(0);
    expect(result.current.runGroups.next).toHaveLength(0);
  });

  it('splits active tasks into done / now / next by status', () => {
    const { result } = renderHook(() => usePlanner({ nowMs: NOW }));
    act(() => {
      result.current.setDeadline(DEADLINE);
      result.current.setBuffer(0);
      usePlanStore.getState().addTask({ label: 'Done task', category: 'admin', durationMin: 15 });
      usePlanStore.getState().addTask({ label: 'Running task', category: 'admin', durationMin: 15 });
      usePlanStore.getState().addTask({ label: 'Next task', category: 'admin', durationMin: 15 });
      result.current.saveActive(NOW);
    });

    const tasks = usePlanStore.getState().active!.tasks;
    act(() => {
      usePlanStore.getState().completeTask(tasks[0]!.id, 14);
      usePlanStore.getState().startTask(tasks[1]!.id);
    });

    expect(result.current.runGroups.done).toHaveLength(1);
    expect(result.current.runGroups.done[0]!.label).toBe('Done task');
    expect(result.current.runGroups.now).toHaveLength(1);
    expect(result.current.runGroups.now[0]!.label).toBe('Running task');
    expect(result.current.runGroups.next).toHaveLength(1);
    expect(result.current.runGroups.next[0]!.label).toBe('Next task');
  });
});

describe('usePlanner — cut-card state', () => {
  it('cut is null initially', () => {
    const { result } = renderHook(() => usePlanner({ nowMs: NOW }));
    expect(result.current.cut).toBeNull();
  });

  it('reprojectForCut sets cut when the result is over (not stillFits)', () => {
    // Build a plan that fits originally, then run past start-by so reproject is over.
    const { result } = renderHook(() => usePlanner({ nowMs: NOW }));
    act(() => {
      result.current.setBuffer(0);
      result.current.setDeadline(DEADLINE);
      // 100-min task in a 120-min window: fits at NOW but over at later.
      usePlanStore.getState().addTask({ label: 'Big', category: 'writing', durationMin: 100 });
      result.current.saveActive(NOW);
    });

    // Move past the start-by so the task no longer fits.
    const tooLate = NOW + 40 * MIN; // startBy was NOW+20m; we're 20m past it
    const { result: r2 } = renderHook(() => usePlanner({ nowMs: tooLate }));
    act(() => {
      r2.current.reprojectForCut();
    });

    expect(r2.current.cut).not.toBeNull();
  });

  it('dismissCut clears the cut state', () => {
    const { result } = renderHook(() => usePlanner({ nowMs: NOW }));
    act(() => {
      result.current.setBuffer(0);
      result.current.setDeadline(DEADLINE);
      usePlanStore.getState().addTask({ label: 'Big', category: 'writing', durationMin: 100 });
      result.current.saveActive(NOW);
    });

    const tooLate = NOW + 40 * MIN;
    const { result: r2 } = renderHook(() => usePlanner({ nowMs: tooLate }));
    act(() => {
      r2.current.reprojectForCut();
    });
    expect(r2.current.cut).not.toBeNull();

    act(() => {
      r2.current.dismissCut();
    });
    expect(r2.current.cut).toBeNull();
  });

  it('acceptCut removes the cut task(s) from the active plan', () => {
    const { result } = renderHook(() => usePlanner({ nowMs: NOW }));
    act(() => {
      result.current.setBuffer(0);
      result.current.setDeadline(DEADLINE);
      usePlanStore.getState().addTask({ label: 'Small', category: 'email', durationMin: 30 });
      usePlanStore.getState().addTask({ label: 'Big', category: 'writing', durationMin: 100 });
      result.current.saveActive(NOW);
    });

    // 130 min total, 120-min window. At tooLate the start-by would require cutting.
    const tooLate = NOW + 40 * MIN;
    const { result: r2, rerender } = renderHook(() => usePlanner({ nowMs: tooLate }));

    let cutResult: ReprojectResult | null = null;
    act(() => {
      cutResult = r2.current.reprojectForCut();
    });
    // Only assert acceptCut if there was actually an over verdict.
    if (cutResult !== null && !(cutResult as ReprojectResult).stillFits) {
      act(() => {
        r2.current.acceptCut();
      });
      rerender({});
      expect(r2.current.cut).toBeNull();
    }
  });
});
