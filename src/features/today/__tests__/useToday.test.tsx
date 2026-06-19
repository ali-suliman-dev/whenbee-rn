import { renderHook, waitFor } from '@testing-library/react-native';
import { useToday } from '@/src/features/today/useToday';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useTasksStore } from '@/src/stores/tasksStore';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (cb: () => void | (() => void)) => cb(),
}));

function summary(over: Partial<{ lifetimeMin: number; lifetimeNectar: number; stage: number; seed: number }>) {
  return {
    lifetimeMin: over.lifetimeMin ?? 0,
    byCategory: [],
    biggestArea: null,
    honestLogCount: 0,
    discoveryCount: 0,
    companion: {
      stage: over.stage ?? 1,
      capability: 'finish_time',
      keeper: false,
      lifetimeNectar: over.lifetimeNectar ?? 0,
      driftHealth: 'settled',
      seed: over.seed ?? 1,
      name: null,
    },
  };
}

beforeEach(() => {
  useTasksStore.setState({ tasks: [] });
  useCalibrationStore.setState({
    statsByCategory: {},
    hydrate: async () => {},
    loadReclaimSummary: async () => summary({ lifetimeMin: 0, lifetimeNectar: 0 }),
  });
});

describe('useToday companion + reclaim', () => {
  it('reports a first-run user (no lifetime nectar)', async () => {
    const { result } = renderHook(() => useToday());
    await waitFor(() => expect(result.current.hasEverLogged).toBe(false));
    expect(result.current.reclaimLifetimeMin).toBe(0);
  });

  it('reports a returning user with lifetime reclaim + stage', async () => {
    useCalibrationStore.setState({
      loadReclaimSummary: async () => summary({ lifetimeMin: 860, lifetimeNectar: 12, stage: 3, seed: 7 }),
    });
    const { result } = renderHook(() => useToday());
    await waitFor(() => expect(result.current.hasEverLogged).toBe(true));
    expect(result.current.reclaimLifetimeMin).toBe(860);
    expect(result.current.companionStage).toBe(3);
    expect(result.current.companionSeed).toBe(7);
  });
});
