import { render, screen, fireEvent } from '@testing-library/react-native';
import { RetroLogChip } from '@/src/features/today/RetroLogChip';

describe('RetroLogChip', () => {
  it('renders firstText and secondText, and fires onPress', () => {
    const onPress = jest.fn();
    render(
      <RetroLogChip
        firstText="Finished something? "
        secondText="Log it too"
        onPress={onPress}
      />
    );
    expect(screen.getByText('Finished something? ')).toBeOnTheScreen();
    expect(screen.getByText('Log it too')).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText('Finished something? Log it too'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders the plus-coin', () => {
    const onPress = jest.fn();
    render(
      <RetroLogChip firstText="Or log something " secondText="you finished" onPress={onPress} />
    );
    // The coin contains a "+" text
    expect(screen.getByText('+')).toBeOnTheScreen();
  });
});
