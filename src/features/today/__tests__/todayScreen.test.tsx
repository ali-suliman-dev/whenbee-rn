import { render, screen } from '@testing-library/react-native';
import { ActionSheetIOS } from 'react-native';
import Today from '@/src/app/(tabs)/index';
import { useCalibrationStore, type ReclaimSummary } from '@/src/stores/calibrationStore';
import { useTasksStore } from '@/src/stores/tasksStore';

jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(() => {});

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (cb: () => void | (() => void)) => cb(),
}));

const T0 = 1_700_000_000_000;

function summary(over: Partial<{ lifetimeMin: number; lifetimeNectar: number; stage: number }>): ReclaimSummary {
  return {
    lifetimeMin: over.lifetimeMin ?? 0,
    byCategory: [],
    biggestArea: null,
    honestLogCount: 0,
    discoveryCount: 0,
    companion: {
      stage: (over.stage ?? 1) as ReclaimSummary['companion']['stage'],
      capability: 'finish_time' as unknown as ReclaimSummary['companion']['capability'],
      keeper: false,
      lifetimeNectar: over.lifetimeNectar ?? 0,
      driftHealth: 'settled',
      seed: 1,
      name: null,
    },
  };
}

beforeEach(() => {
  useTasksStore.setState({ tasks: [] });
  useCalibrationStore.setState({
    logs: 0,
    statsByCategory: {},
    hydrate: async () => {},
    loadTodayReclaimMin: async () => 0,
    loadReclaimSummary: async () => summary({ lifetimeMin: 0, lifetimeNectar: 0 }),
  });
});

describe('Today screen', () => {
  it('shows the first-run empty state when the user has never logged', async () => {
    render(<Today />);
    expect(await screen.findByText('Time your first task')).toBeOnTheScreen();
  });

  it('shows the daily empty state + lifetime reclaim for a returning user', async () => {
    useCalibrationStore.setState({
      loadReclaimSummary: async () => summary({ lifetimeMin: 860, lifetimeNectar: 12, stage: 2 }),
    });
    render(<Today />);
    expect(await screen.findByText("What's on today?")).toBeOnTheScreen();
    expect(screen.getByText('14h 20m reclaimed so far')).toBeOnTheScreen();
  });

  it('renders the focus card plan total + guess→plan gap for a focus task', () => {
    useCalibrationStore.setState({
      statsByCategory: {
        getting_ready: { mEffective: 2.0, n: 8, sharpness: 70, tier: 'Ripening' },
      },
    });
    useTasksStore
      .getState()
      .addTask({ label: 'Leave for work', category: 'getting_ready', guessMin: 15, nowMs: T0 });

    render(<Today />);

    expect(screen.getByText('Leave for work')).toBeOnTheScreen();
    expect(screen.getByText('~30')).toBeOnTheScreen();
    expect(screen.getByText('+15 learned')).toBeOnTheScreen();
    expect(screen.getByText('Start')).toBeOnTheScreen();
    // No empty-state copy when a task is present.
    expect(screen.queryByText('Time your first task')).toBeNull();
    expect(screen.queryByText("What's on today?")).toBeNull();
  });

  it('shows the guess as the lead figure and the plan support on up-next rows', async () => {
    useCalibrationStore.setState({
      statsByCategory: {
        getting_ready: { mEffective: 2.0, n: 8, sharpness: 70, tier: 'Ripening' },
      },
    });
    // First task becomes the focus card; second is an up-next row with guessMin 25.
    useTasksStore
      .getState()
      .addTask({ label: 'Leave for work', category: 'getting_ready', guessMin: 15, nowMs: T0 });
    useTasksStore
      .getState()
      .addTask({ label: 'Pack bag', category: 'getting_ready', guessMin: 25, nowMs: T0 + 1 });

    render(<Today />);

    // The up-next row should render "25" as the hero figure and "plan " as support.
    expect(await screen.findByText('25')).toBeOnTheScreen();
    expect(screen.getByText('plan ')).toBeOnTheScreen();
  });
});
