import { render, screen } from '@testing-library/react-native';
import Today from '@/src/app/(tabs)/index';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useTasksStore } from '@/src/stores/tasksStore';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  // useFocusEffect runs its effect immediately in tests (no navigation focus here).
  useFocusEffect: (cb: () => void | (() => void)) => cb(),
}));

const T0 = 1_700_000_000_000;

beforeEach(() => {
  useTasksStore.setState({ tasks: [] });
  useCalibrationStore.setState({
    logs: 0,
    statsByCategory: {},
    hydrate: async () => {},
    loadTodayReclaimMin: async () => 0,
  });
});

describe('Today screen', () => {
  it('renders the calm empty-state copy when nothing is tracked', () => {
    render(<Today />);
    expect(
      screen.getByText('Nothing tracked yet today — tap + when you start something.'),
    ).toBeOnTheScreen();
  });

  it('renders the focus card honest number + provenance for a focus task', () => {
    useCalibrationStore.setState({
      statsByCategory: {
        getting_ready: { mEffective: 2.0, n: 8, sharpness: 70, tier: 'Ripening' },
      },
    });
    useTasksStore
      .getState()
      .addTask({ label: 'Leave for work', category: 'getting_ready', guessMin: 15, nowMs: T0 });

    render(<Today />);

    // Task title + honest number (round_to_5(15 × 2.0) = 30) + provenance.
    expect(screen.getByText('Leave for work')).toBeOnTheScreen();
    expect(screen.getByText('~30')).toBeOnTheScreen();
    expect(screen.getByText('based on your last 8 times · learned on-device')).toBeOnTheScreen();
    // The empty copy must NOT show when a task is present.
    expect(
      screen.queryByText('Nothing tracked yet today — tap + when you start something.'),
    ).toBeNull();
  });
});
