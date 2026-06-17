import { render, screen, fireEvent } from '@testing-library/react-native';
import { RetroLogChip } from '@/src/features/today/RetroLogChip';

describe('RetroLogChip', () => {
  it('renders its label and fires onPress', () => {
    const onPress = jest.fn();
    render(<RetroLogChip label="Or log something you finished" onPress={onPress} />);
    expect(screen.getByText('Or log something you finished')).toBeOnTheScreen();
    fireEvent.press(screen.getByText('Or log something you finished'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
