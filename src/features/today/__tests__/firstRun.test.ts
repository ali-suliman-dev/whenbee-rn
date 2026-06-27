/**
 * First-run predicate tests
 *
 * The guided "Time your first thing" card is shown when and only when the user
 * has never completed a calibration (lifetimeNectar === 0 → hasEverLogged ===
 * false). These tests verify the predicate directly through the useToday hook,
 * which is the single source of truth for first-run detection in the Today tab.
 *
 * The index.tsx branching: `hasEverLogged ? 'daily' : 'first-run'`
 * ensures the guided card renders iff `hasEverLogged === false`.
 */

import { renderHook, waitFor } from '@testing-library/react-native';
import { useToday } from '@/src/features/today/useToday';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useDayTasksStore } from '@/src/stores/dayTasksStore';
import { useTimerStore } from '@/src/stores/timerStore';
import type { ReclaimSummary } from '@/src/stores/calibrationStore';

// useFocusEffect runs its effect immediately in tests (no real navigation focus).
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (cb: () => void | (() => void)) => cb(),
}));

/** Build a minimal ReclaimSummary with the given lifetimeNectar count. */
function reclaimWith(lifetimeNectar: number): ReclaimSummary {
  return {
    lifetimeMin: 0,
    byCategory: [],
    biggestArea: null,
    honestLogCount: 0,
    discoveryCount: 0,
    companion: {
      stage: 1,
      capability: 'finish_time' as unknown as ReclaimSummary['companion']['capability'],
      keeper: false,
      lifetimeNectar,
      driftHealth: 'settled',
      seed: 1,
      name: null,
    },
  };
}

beforeEach(() => {
  useDayTasksStore.setState({ dayTasks: [] });
  useCalibrationStore.setState({
    statsByCategory: {},
    hydrate: async () => {},
    loadReclaimSummary: async () => reclaimWith(0),
  });
  useTimerStore.getState().cancel();
});

describe('first-run predicate (hasEverLogged)', () => {
  it('isFirstRun is true when completedCalibrationCount === 0 (no lifetime nectar)', async () => {
    // Precondition: the user has never completed a calibration.
    useCalibrationStore.setState({
      loadReclaimSummary: async () => reclaimWith(0),
    });

    const { result } = renderHook(() => useToday());

    // hasEverLogged === false → in index.tsx the variant resolves to 'first-run',
    // which renders the guided "Time your first thing" card.
    await waitFor(() => expect(result.current.hasEverLogged).toBe(false));
  });

  it('isFirstRun is false when completedCalibrationCount > 0 (returning user, empty day)', async () => {
    // Returning user: has at least one prior calibration, but today is empty.
    useCalibrationStore.setState({
      loadReclaimSummary: async () => reclaimWith(1),
    });

    const { result } = renderHook(() => useToday());

    // hasEverLogged === true → variant resolves to 'daily', normal empty-day state.
    // The guided card must NOT appear for a returning user.
    await waitFor(() => expect(result.current.hasEverLogged).toBe(true));
  });

  it('after one completed calibration the guided card is no longer shown', async () => {
    // Simulate a user who just completed their first calibration: lifetimeNectar
    // ticks up from 0 to 1. The store now reports hasEverLogged === true,
    // switching the empty-state variant from 'first-run' to 'daily'.
    useCalibrationStore.setState({
      loadReclaimSummary: async () => reclaimWith(1),
    });

    const { result } = renderHook(() => useToday());

    await waitFor(() => expect(result.current.hasEverLogged).toBe(true));

    // Confirm the day has no tasks (empty day) — this is the case where the
    // variant choice between 'first-run' and 'daily' actually matters.
    expect(result.current.totalCount).toBe(0);

    // hasEverLogged === true with totalCount === 0 → 'daily' variant (not 'first-run').
    // The guided card headline "Time your first thing" must NOT appear.
  });
});
