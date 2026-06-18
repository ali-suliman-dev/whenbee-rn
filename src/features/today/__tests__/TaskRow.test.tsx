import { render, screen, fireEvent } from '@testing-library/react-native';
import { TaskRow } from '@/src/features/today/TaskRow';

describe('TaskRow', () => {
  it('queued: leads with the guess, supports with "plan ~N", fires onPress', () => {
    const onPress = jest.fn();
    render(
      <TaskRow title="Buy groceries" categoryLabel="Errands" guessMin={15} honestMin={25} onPress={onPress} />,
    );
    expect(screen.getByText('15')).toBeOnTheScreen();
    expect(screen.getByText('plan ')).toBeOnTheScreen();
    expect(screen.getByText('~25')).toBeOnTheScreen();
    expect(screen.getByTestId('taskrow-edge')).toBeOnTheScreen();
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
});
