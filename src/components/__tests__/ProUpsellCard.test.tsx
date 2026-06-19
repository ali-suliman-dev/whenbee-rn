import { render, screen, fireEvent } from '@testing-library/react-native';
import { ProUpsellCard } from '../ProUpsellCard';

describe('ProUpsellCard', () => {
  it('renders the title and note', () => {
    render(
      <ProUpsellCard
        title="Go deeper with Pro"
        note="Reviews, a shareable report, and a real read on what your day can hold."
        onPress={() => {}}
      />,
    );
    expect(screen.getByText('Go deeper with Pro')).toBeTruthy();
    expect(
      screen.getByText('Reviews, a shareable report, and a real read on what your day can hold.'),
    ).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    render(
      <ProUpsellCard
        title="Go deeper with Pro"
        note="note"
        onPress={onPress}
        accessibilityLabel="See what Whenbee Pro unlocks"
      />,
    );
    fireEvent.press(screen.getByLabelText('See what Whenbee Pro unlocks'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
