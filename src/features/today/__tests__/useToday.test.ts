import { renderHook } from '@testing-library/react-native';
import { useToday } from '../useToday';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useTasksStore } from '@/src/stores/tasksStore';

// useFocusEffect runs its effect immediately in tests (no real navigation focus).
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void | (() => void)) => cb(),
}));

const T0 = 1_700_000_000_000;

/** Replace the db-touching store actions with no-ops so the hook's mount/focus
 *  effects don't clobber the cache we seed by hand or hit the database. */
function stubStoreEffects() {
  useCalibrationStore.setState({
    hydrate: async () => {},
    loadTodayReclaimMin: async () => 0,
  });
}

beforeEach(() => {
  useTasksStore.setState({ tasks: [] });
  useCalibrationStore.setState({ logs: 0, statsByCategory: {} });
  stubStoreEffects();
});

describe('useToday', () => {
  it('returns null focus + null summary on a quiet/empty day', () => {
    const { result } = renderHook(() => useToday());
    expect(result.current.focus).toBeNull();
    expect(result.current.summary).toBeNull();
  });

  it('falls back to the population prior (basis "prior") when the category has n=0', () => {
    // No cached stat for this category → prior fallback, label = typical patterns.
    useTasksStore
      .getState()
      .addTask({ label: 'Tidy up', category: 'cleaning', guessMin: 15, nowMs: T0 });

    const { result } = renderHook(() => useToday());
    expect(result.current.focus?.label).toBe('Tidy up');
    expect(result.current.summary?.basis).toBe('prior');
    expect(result.current.summary?.label).toBe('based on typical patterns');
  });

  it('uses personal stats (basis "personal") and rounds honest to 5 when n>=3', () => {
    useCalibrationStore.setState({
      statsByCategory: {
        cleaning: { mEffective: 2.0, n: 3, sharpness: 50, tier: 'Setting' },
      },
    });
    useTasksStore
      .getState()
      .addTask({ label: 'Deep clean', category: 'cleaning', guessMin: 15, nowMs: T0 });

    const { result } = renderHook(() => useToday());
    // honest = round_to_5(15 × 2.0) = 30
    expect(result.current.summary?.honestMinutes).toBe(30);
    expect(result.current.summary?.basis).toBe('personal');
    expect(result.current.summary?.label).toBe('based on your last 3 times');
  });

  it('title-cases custom category slugs', () => {
    const { result } = renderHook(() => useToday());
    expect(result.current.categoryName('getting_ready')).toBe('Getting ready');
    expect(result.current.categoryName('deep_work')).toBe('Deep Work');
  });
});
