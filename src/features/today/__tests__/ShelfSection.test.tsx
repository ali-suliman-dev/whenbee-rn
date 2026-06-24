import { render, screen, fireEvent } from '@testing-library/react-native';
import { ShelfSection } from '@/src/features/today/ShelfSection';
import type { DayTask } from '@/src/engine/daySelectors';

// Swipeable requires gesture-handler internals; stub it out so the test runner
// doesn't need native modules.
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  const Mock = ({ children, renderRightActions, renderLeftActions }: any) => (
    <View>
      {renderLeftActions ? renderLeftActions(0, 0, { close: () => {} }) : null}
      {renderRightActions ? renderRightActions(0, 0, { close: () => {} }) : null}
      {children}
    </View>
  );
  return { __esModule: true, default: Mock };
});

function makeTask(label: string): DayTask {
  const now = Date.now();
  return {
    id: `id-${label}`,
    label,
    category: 'admin',
    guessMin: 20,
    plannedDate: null,
    status: 'queued',
    orderIndex: now,
    doneByMin: null,
    createdAt: now,
    completedAt: null,
    actualMin: null,
    fromRoutineId: null,
    calendarEventId: null,
    carriedFrom: null,
  };
}

describe('ShelfSection', () => {
  it('renders nothing when shelfTasks is empty', () => {
    const { toJSON } = render(<ShelfSection shelfTasks={[]} onMoveTask={() => {}} />);
    expect(toJSON()).toBeNull();
  });

  it('shows the task count in the collapsed header', () => {
    const tasks = [makeTask('Idea A'), makeTask('Idea B')];
    render(<ShelfSection shelfTasks={tasks} onMoveTask={() => {}} />);
    // Header shows "No day yet · 2"
    expect(screen.getByText(/No day yet\s*·\s*2/)).toBeOnTheScreen();
  });

  it('list is collapsed by default; expands on header press', () => {
    const tasks = [makeTask('Idea A')];
    render(<ShelfSection shelfTasks={tasks} onMoveTask={() => {}} />);
    // Task label should not be visible before expanding
    expect(screen.queryByText('Idea A')).toBeNull();
    // Press the header to expand
    fireEvent.press(screen.getByText(/No day yet/));
    expect(screen.getByText('Idea A')).toBeOnTheScreen();
  });

  it('fires onMoveTask when the move-tomorrow swipe action is triggered', () => {
    const onMoveTask = jest.fn();
    const tasks = [makeTask('Floating')];
    render(<ShelfSection shelfTasks={tasks} onMoveTask={onMoveTask} />);
    // Expand the section first
    fireEvent.press(screen.getByText(/No day yet/));
    // Trigger the "Tomorrow" swipe action rendered by TaskRow
    const moveBtn = screen.getByTestId('taskrow-move-tomorrow');
    fireEvent.press(moveBtn);
    expect(onMoveTask).toHaveBeenCalledWith('id-Floating', 'tomorrow');
  });
});
