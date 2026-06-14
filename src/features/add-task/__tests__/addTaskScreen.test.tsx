import { render, screen, fireEvent } from '@testing-library/react-native';
import AddTask from '@/src/app/(modals)/add-task';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useTasksStore } from '@/src/stores/tasksStore';
import { useCategoriesStore } from '@/src/stores/categoriesStore';

const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    replace: (...a: unknown[]) => mockReplace(...a),
    back: (...a: unknown[]) => mockBack(...a),
  },
}));

beforeEach(() => {
  mockReplace.mockClear();
  mockBack.mockClear();
  useTasksStore.setState({ tasks: [] });
  useCategoriesStore.setState({
    categories: [{ id: 'getting_ready', name: 'Getting ready', adaptSpeed: 'balanced' }],
  });
  // Cached learned multiplier 2.0 for getting_ready (n=8 → personal basis).
  useCalibrationStore.setState({
    hydrate: async () => {},
    statsByCategory: {
      getting_ready: { mEffective: 2.0, n: 8, sharpness: 70, tier: 'Ripening' },
    },
  });
});

describe('Add Task screen', () => {
  it('shows a live honest preview reflecting the cached multiplier', () => {
    render(<AddTask />);
    fireEvent.press(screen.getByText('Getting ready'));
    // default guess 15 × cached 2.0 = round5(30) = 30; honey card shows the honest
    // number as the hero on one line.
    expect(screen.getByText('~30')).toBeOnTheScreen();
    expect(screen.getByText('Honestly')).toBeOnTheScreen();
    expect(screen.getByText('+15m')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Honest estimate about 30 minutes, 15 more than your guess'),
    ).toBeOnTheScreen();
  });

  it('Add to today: addTask with the guess + shows the toast', () => {
    render(<AddTask />);
    fireEvent.changeText(screen.getByLabelText('Task title'), 'Reply to email');
    fireEvent.press(screen.getByText('Getting ready'));

    fireEvent.press(screen.getByText('Add to today'));

    const tasks = useTasksStore.getState().tasks;
    expect(tasks).toHaveLength(1);
    const added = tasks[0]!;
    expect(added.label).toBe('Reply to email');
    expect(added.category).toBe('getting_ready');
    expect(added.guessMin).toBe(15);
    // Toast shows before the deferred dismiss.
    expect(screen.getByText('Added to today')).toBeOnTheScreen();
  });

  it('Add & start: navigates to timer with guessMin + honest estimateMin + suggestedHonestMin params', () => {
    render(<AddTask />);
    fireEvent.changeText(screen.getByLabelText('Task title'), 'Leave for work');
    fireEvent.press(screen.getByText('Getting ready'));

    fireEvent.press(screen.getByText('Add & start timer'));

    const task = useTasksStore.getState().tasks[0]!;
    expect(task).toBeDefined();
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/(modals)/timer',
      params: {
        taskId: task.id,
        label: 'Leave for work',
        category: 'getting_ready',
        estimateMin: '30', // honest = round5(15 × 2.0)
        guessMin: '15',
        // suggestedHonestMin = the honest number shown in the Add-Task sheet
        // so reclaim banks against the exact number the user saw.
        suggestedHonestMin: '30',
      },
    });
  });

  it('gates the actions until a title + category are set', () => {
    render(<AddTask />);
    // No title, no category → pressing Add & start does nothing.
    fireEvent.press(screen.getByText('Add & start timer'));
    expect(mockReplace).not.toHaveBeenCalled();
    expect(useTasksStore.getState().tasks).toHaveLength(0);
  });
});
