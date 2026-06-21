import { renderHook } from '@testing-library/react-native';
import { useToday } from '../useToday';
import { useCalibrationStore, type ReclaimSummary } from '@/src/stores/calibrationStore';
import { useTasksStore } from '@/src/stores/tasksStore';
import { useTimerStore } from '@/src/stores/timerStore';

// useFocusEffect runs its effect immediately in tests (no real navigation focus).
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

/** Replace the db-touching store actions with no-ops so the hook's mount/focus
 *  effects don't clobber the cache we seed by hand or hit the database. */
function stubStoreEffects() {
  useCalibrationStore.setState({
    hydrate: async () => {},
    loadReclaimSummary: async () => defaultSummary,
  });
}

beforeEach(() => {
  useTasksStore.setState({ tasks: [] });
  useCalibrationStore.setState({ logs: 0, statsByCategory: {} });
  useTimerStore.getState().cancel();
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
        cleaning: { mEffective: 2.0, n: 3, sharpness: 50, tier: 'Setting', fit: { a: 0, b: 2.0 } },
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

  it('focusPreEstimate is true for a cold category (n=0)', () => {
    // No cached stat → prior fallback → focusPreEstimate = true.
    useTasksStore
      .getState()
      .addTask({ label: 'Cold task', category: 'cleaning', guessMin: 15, nowMs: T0 });

    const { result } = renderHook(() => useToday());
    expect(result.current.focusPreEstimate).toBe(true);
  });

  it('focusPreEstimate is false when the category has n>=3 personal logs', () => {
    useCalibrationStore.setState({
      statsByCategory: {
        cleaning: { mEffective: 2.0, n: 3, sharpness: 50, tier: 'Setting', fit: { a: 0, b: 2.0 } },
      },
    });
    useTasksStore
      .getState()
      .addTask({ label: 'Personal task', category: 'cleaning', guessMin: 15, nowMs: T0 });

    const { result } = renderHook(() => useToday());
    expect(result.current.focusPreEstimate).toBe(false);
  });

  describe('while a timer is running', () => {
    function seedThreeQueued() {
      const store = useTasksStore.getState();
      const a = store.addTask({ label: 'TEST', category: 'admin', guessMin: 15, nowMs: T0 });
      const b = store.addTask({ label: 'TEST 2', category: 'admin', guessMin: 5, nowMs: T0 + 1 });
      const c = store.addTask({ label: 'TEST 3', category: 'admin', guessMin: 15, nowMs: T0 + 2 });
      return { a, b, c };
    }

    it('keeps the running task out of up-next (no duplicate) and never hides the oldest task', () => {
      const { a, b, c } = seedThreeQueued();
      // Timer running on the newest task (the "Add & start timer" flow).
      useTimerStore.setState({ isRunning: true, taskId: c.id, taskLabel: c.label });

      const { result } = renderHook(() => useToday());
      const upNextIds = result.current.upNext.map((r) => r.id);

      // Running task must NOT appear in up-next…
      expect(upNextIds).not.toContain(c.id);
      // …and the previously-focused oldest task must stay visible.
      expect(upNextIds).toContain(a.id);
      expect(upNextIds).toContain(b.id);
      expect(upNextIds).toHaveLength(2);
    });

    it('hides nothing from up-next for a quick-start (untracked) session', () => {
      const { a, b, c } = seedThreeQueued();
      // Quick-start: a live timer with no taskId.
      useTimerStore.setState({ isRunning: true, taskId: null, taskLabel: '' });

      const { result } = renderHook(() => useToday());
      const upNextIds = result.current.upNext.map((r) => r.id);

      expect(upNextIds).toEqual([a.id, b.id, c.id]);
    });
  });

  it('title-cases custom category slugs', () => {
    const { result } = renderHook(() => useToday());
    expect(result.current.categoryName('getting_ready')).toBe('Getting ready');
    expect(result.current.categoryName('deep_work')).toBe('Deep Work');
  });
});
