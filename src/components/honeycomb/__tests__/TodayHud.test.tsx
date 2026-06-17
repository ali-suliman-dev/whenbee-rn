import { render, screen, fireEvent } from '@testing-library/react-native';
import { TodayHud } from '@/src/components/honeycomb/TodayHud';
import type { HoneycombCell } from '@/src/components/honeycomb/Honeycomb';

const cells: HoneycombCell[] = [
  { categoryId: 'cleaning', label: 'Cleaning', sharpness: 50, tier: 'Setting' },
  { categoryId: 'email', label: 'Email', sharpness: 20, tier: 'Raw' },
];

describe('TodayHud', () => {
  it('shows the lead category tier and routes on press', () => {
    const onPress = jest.fn();
    render(<TodayHud cells={cells} stage={2} seed={1} onPress={onPress} />);
    // Lead = highest sharpness (Setting).
    expect(screen.getByText('Setting')).toBeOnTheScreen();
    fireEvent.press(screen.getByText('Setting'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('falls back to Raw when there are no cells', () => {
    render(<TodayHud cells={[]} stage={1} seed={1} onPress={() => {}} />);
    expect(screen.getByText('Raw')).toBeOnTheScreen();
  });
});
