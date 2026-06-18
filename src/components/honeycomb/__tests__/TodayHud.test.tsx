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

  it('shows the reclaim stat and the ritual invitation in the footer', () => {
    render(
      <TodayHud
        cells={cells}
        stage={2}
        seed={1}
        onPress={() => {}}
        reclaimMin={10}
        ritualEnabled
        ritualDone={false}
        onLogRitual={() => {}}
      />,
    );
    expect(screen.getByText('+10m')).toBeOnTheScreen();
    expect(screen.getByText('reclaimed today')).toBeOnTheScreen();
    expect(screen.getByText('Log one honest thing')).toBeOnTheScreen();
  });

  it('hides reclaim at 0 and renders no footer when ritual is off and reclaim is 0', () => {
    render(<TodayHud cells={cells} stage={2} seed={1} onPress={() => {}} reclaimMin={0} ritualEnabled={false} />);
    expect(screen.queryByText('reclaimed today')).toBeNull();
    expect(screen.queryByText('Log one honest thing')).toBeNull();
  });

  it('tapping the honey top still routes to the hub', () => {
    const onPress = jest.fn();
    render(<TodayHud cells={cells} stage={2} seed={1} onPress={onPress} reclaimMin={10} ritualEnabled />);
    fireEvent.press(screen.getByText('Setting'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
