import { render, screen, fireEvent, act } from '@testing-library/react-native';
import AddTask from '@/src/app/(modals)/add-task';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useDayTasksStore } from '@/src/stores/dayTasksStore';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import type { Task } from '@/src/domain/types';

const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: {
    replace: (...a: unknown[]) => mockReplace(...a),
    back: (...a: unknown[]) => mockBack(...a),
  },
  useLocalSearchParams: () => mockParams,
}));

// Capture tasks added via the async addTask mock so tests can assert on them.
let capturedTasks: Task[] = [];

// The screen derives "today" from the wall clock; freeze it to the day the
// mocked selectedDate ('2026-06-24') represents so the toast/label logic is
// deterministic regardless of the real date the suite runs on.
const TODAY_MS = new Date(2026, 5, 24, 9, 0, 0).getTime();
let nowSpy: jest.SpyInstance;

beforeEach(() => {
  nowSpy = jest.spyOn(Date, 'now').mockReturnValue(TODAY_MS);
  mockReplace.mockClear();
  mockBack.mockClear();
  mockParams = {};
  capturedTasks = [];

  // Mock useDayTasksStore so addTask is async and returns a Task.
  useDayTasksStore.setState({
    selectedDate: '2026-06-24',
    addTask: jest.fn(async (input: { label: string; category: string; guessMin: number; date?: string | null }) => {
      const task: Task = {
        id: `task-${Date.now()}`,
        label: input.label,
        category: input.category,
        guessMin: input.guessMin,
        plannedDate: input.date ?? '2026-06-24',
        status: 'queued',
        orderIndex: Date.now(),
        doneByMin: null,
        createdAt: Date.now(),
        completedAt: null,
        actualMin: null,
        fromRoutineId: null,
        calendarEventId: null,
      };
      capturedTasks.push(task);
      return task;
    }),
  } as unknown as Parameters<typeof useDayTasksStore.setState>[0]);

  useCategoriesStore.setState({
    categories: [{ id: 'getting_ready', name: 'Getting ready', adaptSpeed: 'balanced' }],
  });
  // Cached learned multiplier 2.0 for getting_ready (n=8 → personal basis).
  useCalibrationStore.setState({
    hydrate: async () => {},
    statsByCategory: {
      getting_ready: { mEffective: 2.0, n: 8, sharpness: 70, tier: 'Ripening', fit: { a: 0, b: 2.0 } },
    },
  });
});

afterEach(() => {
  nowSpy.mockRestore();
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

  it('Add to today: calls dayTasksStore.addTask with selectedDate and shows toast', async () => {
    render(<AddTask />);
    fireEvent.changeText(screen.getByLabelText('Task title'), 'Reply to email');
    fireEvent.press(screen.getByText('Getting ready'));

    await act(async () => {
      fireEvent.press(screen.getByText('Add to today'));
    });

    expect(capturedTasks).toHaveLength(1);
    const added = capturedTasks[0]!;
    expect(added.label).toBe('Reply to email');
    expect(added.category).toBe('getting_ready');
    expect(added.guessMin).toBe(15);
    expect(added.plannedDate).toBe('2026-06-24');
    // Toast shows before the deferred dismiss.
    expect(screen.getByText('Added to today')).toBeOnTheScreen();
  });

  it('Add & start: navigates to timer with guessMin + honest estimateMin + suggestedHonestMin params', async () => {
    render(<AddTask />);
    fireEvent.changeText(screen.getByLabelText('Task title'), 'Leave for work');
    fireEvent.press(screen.getByText('Getting ready'));

    await act(async () => {
      fireEvent.press(screen.getByText('Add & start timer'));
    });

    expect(capturedTasks).toHaveLength(1);
    const task = capturedTasks[0]!;
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

  it('gates the actions until a title + category are set', async () => {
    render(<AddTask />);
    // No title, no category → pressing Add & start does nothing.
    await act(async () => {
      fireEvent.press(screen.getByText('Add & start timer'));
    });
    expect(mockReplace).not.toHaveBeenCalled();
    expect(capturedTasks).toHaveLength(0);
  });
});

describe('edit mode', () => {
  const editing: Task = {
    id: 'edit-1', label: 'Reply to Marcus', category: 'admin', guessMin: 30,
    plannedDate: '2026-06-24', status: 'queued', orderIndex: 1, doneByMin: null,
    createdAt: 1, completedAt: null, actualMin: null, fromRoutineId: null, calendarEventId: null,
  };
  const updateSpy = jest.fn(async () => {});

  beforeEach(() => {
    mockParams = { editId: 'edit-1' };
    useDayTasksStore.setState({
      getTaskById: jest.fn(async () => editing),
      updateTask: updateSpy,
    } as unknown as Parameters<typeof useDayTasksStore.setState>[0]);
    updateSpy.mockClear();
  });
  afterEach(() => { mockParams = {}; });

  test('renders Edit-task chrome and prefilled title', async () => {
    render(<AddTask />);
    expect(await screen.findByText('Edit task')).toBeTruthy();
    expect(screen.getByText('Save')).toBeTruthy();
    expect(screen.getByDisplayValue('Reply to Marcus')).toBeTruthy();
  });

  test('Save patches via updateTask', async () => {
    render(<AddTask />);
    await screen.findByText('Edit task');
    // Wait for the async prefill (title/category) to fully settle — findByText
    // above can resolve on the very first synchronous render (the heading
    // doesn't depend on the load), which is too early: the button's onPress
    // wiring isn't reliably committed yet if the store's async load and the
    // targetDate-adopt effect are still mid-flight. Polling for the loaded
    // title value forces RTL to flush those pending updates before we press.
    await screen.findByDisplayValue('Reply to Marcus');
    await act(async () => { fireEvent.press(screen.getByText('Save')); });
    expect(updateSpy).toHaveBeenCalledWith(
      'edit-1',
      expect.objectContaining({ label: 'Reply to Marcus', category: 'admin', guessMin: 30 }),
    );
  });
});
