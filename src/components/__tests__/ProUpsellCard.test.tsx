import { render, screen, fireEvent } from '@testing-library/react-native';
import { ProUpsellCard } from '../ProUpsellCard';

describe('ProUpsellCard', () => {
  it('renders the title and note', () => {
    render(
      <ProUpsellCard
        title="Make my whole day honest"
        note="Auto-pad your calendar with your real buffers."
        onPress={() => {}}
      />,
    );
    expect(screen.getByText('Make my whole day honest')).toBeTruthy();
    expect(screen.getByText('Auto-pad your calendar with your real buffers.')).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    render(
      <ProUpsellCard
        title="Make my whole day honest"
        note="note"
        onPress={onPress}
        accessibilityLabel="Go Pro and make your whole day honest"
      />,
    );
    fireEvent.press(screen.getByLabelText('Go Pro and make your whole day honest'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
