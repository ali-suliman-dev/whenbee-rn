import { render, screen, fireEvent } from '@testing-library/react-native';
import { TaskRow } from '@/src/features/today/TaskRow';

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

describe('TaskRow', () => {
  it('queued: leads with the honest estimate, supports with the guess, fires onPress', () => {
    const onPress = jest.fn();
    render(
      <TaskRow title="Buy groceries" categoryLabel="Errands" guessMin={15} honestMin={25} onPress={onPress} />,
    );
    expect(screen.getByText('~25')).toBeOnTheScreen();
    expect(screen.getByText('guessed 15')).toBeOnTheScreen();
    fireEvent.press(screen.getByText('Buy groceries'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('done: shows "took N min" lead + "guessed N" support, no edge', () => {
    render(
      <TaskRow title="Writing an email" categoryLabel="Admin & email" guessMin={20} honestMin={30} actualMin={35} done />,
    );
    expect(screen.getByText('took')).toBeOnTheScreen();
    expect(screen.getByText('35')).toBeOnTheScreen();
    expect(screen.getByText('guessed 20')).toBeOnTheScreen();
    expect(screen.queryByTestId('taskrow-edge')).toBeNull();
  });

  it('renders a Delete action that fires onDelete', () => {
    const onDelete = jest.fn();
    render(
      <TaskRow title="Buy groceries" categoryLabel="Errands" guessMin={15} honestMin={25} onDelete={onDelete} />,
    );
    fireEvent.press(screen.getByTestId('taskrow-delete'));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('fires onLongPress when the row is held', () => {
    const onLongPress = jest.fn();
    render(
      <TaskRow title="Buy groceries" categoryLabel="Errands" guessMin={15} honestMin={25} onPress={() => {}} onLongPress={onLongPress} />,
    );
    fireEvent(screen.getByText('Buy groceries'), 'longPress');
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('fires onLongPress on a done row (no onPress)', () => {
    const onLongPress = jest.fn();
    render(
      <TaskRow title="Tidy desk" categoryLabel="Admin & email" guessMin={10} honestMin={12} actualMin={11} done onLongPress={onLongPress} />,
    );
    fireEvent(screen.getByText('Tidy desk'), 'longPress');
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('carryover: shows "from Mon" tag when carriedFrom is set and row is queued', () => {
    render(
      <TaskRow
        title="Lingering task"
        categoryLabel="Admin & email"
        guessMin={10}
        honestMin={12}
        carriedFrom="2026-06-22"
      />,
    );
    expect(screen.getByText(/from/i)).toBeOnTheScreen();
  });

  it('carryover: no tag when carriedFrom is null', () => {
    render(
      <TaskRow
        title="Fresh task"
        categoryLabel="Admin & email"
        guessMin={10}
        honestMin={12}
        carriedFrom={null}
      />,
    );
    expect(screen.queryByText(/from/i)).toBeNull();
  });

  it('move: left action is rendered and calls onMove("tomorrow") when onMove is provided and not done', () => {
    const onMove = jest.fn();
    render(
      <TaskRow
        title="Buy groceries"
        categoryLabel="Errands"
        guessMin={15}
        honestMin={25}
        onMove={onMove}
      />,
    );
    fireEvent.press(screen.getByTestId('taskrow-move-tomorrow'));
    expect(onMove).toHaveBeenCalledWith('tomorrow');
  });

  it('move: no left action on a done row even when onMove is provided', () => {
    const onMove = jest.fn();
    render(
      <TaskRow
        title="Done task"
        categoryLabel="Errands"
        guessMin={15}
        honestMin={25}
        actualMin={20}
        done
        onMove={onMove}
      />,
    );
    expect(screen.queryByTestId('taskrow-move-tomorrow')).toBeNull();
  });

  it('carryover: no tag on a done row even when carriedFrom is set', () => {
    render(
      <TaskRow
        title="Done task"
        categoryLabel="Admin & email"
        guessMin={10}
        honestMin={12}
        actualMin={11}
        done
        carriedFrom="2026-06-22"
      />,
    );
    expect(screen.queryByText(/from/i)).toBeNull();
  });

  test('renders a custom coach label when provided', () => {
    render(
      <TaskRow title="Reply" categoryLabel="Email" guessMin={30} honestMin={35}
        onPress={() => {}} showCoachMark coachLabel="Press & hold for options" />,
    );
    expect(screen.getByText('Press & hold for options')).toBeTruthy();
  });

  test('defaults the coach label to the swipe hint', () => {
    render(
      <TaskRow title="Reply" categoryLabel="Email" guessMin={30} honestMin={35}
        onPress={() => {}} showCoachMark />,
    );
    expect(screen.getByText('← swipe to remove')).toBeTruthy();
  });
});
