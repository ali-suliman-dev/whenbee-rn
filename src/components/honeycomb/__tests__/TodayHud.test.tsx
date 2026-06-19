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

  it('shows the ritual invitation in the footer when the ritual is on', () => {
    render(
      <TodayHud
        cells={cells}
        stage={2}
        seed={1}
        onPress={() => {}}
        ritualEnabled
        ritualDone={false}
        onLogRitual={() => {}}
      />,
    );
    expect(screen.getByText('Log one honest thing')).toBeOnTheScreen();
  });

  it('renders no footer when the ritual is off', () => {
    render(<TodayHud cells={cells} stage={2} seed={1} onPress={() => {}} ritualEnabled={false} />);
    expect(screen.queryByText('Log one honest thing')).toBeNull();
  });

  it('tapping the honey top still routes to the hub', () => {
    const onPress = jest.fn();
    render(<TodayHud cells={cells} stage={2} seed={1} onPress={onPress} ritualEnabled />);
    fireEvent.press(screen.getByText('Setting'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
