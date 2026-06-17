// src/features/today/__tests__/TaskRow.test.tsx
import { render, screen, fireEvent } from '@testing-library/react-native';
import { TaskRow } from '@/src/features/today/TaskRow';

describe('TaskRow', () => {
  it('queued: shows ink estimate, an interactive edge, and fires onPress', () => {
    const onPress = jest.fn();
    render(<TaskRow title="Buy groceries" categoryLabel="Errands" honestMin={25} onPress={onPress} />);
    expect(screen.getByText('~25')).toBeOnTheScreen();
    expect(screen.getByText('min')).toBeOnTheScreen();
    expect(screen.getByTestId('taskrow-edge')).toBeOnTheScreen();
    fireEvent.press(screen.getByText('Buy groceries'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('done: shows a "took N min" receipt with no strikethrough and no edge', () => {
    render(<TaskRow title="Writing an email" categoryLabel="Admin & email" honestMin={30} actualMin={35} done />);
    expect(screen.getByText('took')).toBeOnTheScreen();
    expect(screen.getByText('35')).toBeOnTheScreen();
    expect(screen.queryByTestId('taskrow-edge')).toBeNull();
    const title = screen.getByText('Writing an email');
    const flat = (Array.isArray(title.props.style) ? title.props.style : [title.props.style]).flat() as (Record<string, unknown> | null | undefined)[];
    expect(flat.some((s) => s != null && (s as Record<string, unknown>).textDecorationLine === 'line-through')).toBe(false);
  });
});
