import { render, screen, fireEvent } from '@testing-library/react-native';
import { PlanStrip } from '@/src/features/today/PlanStrip';

describe('PlanStrip', () => {
  it('shows start-by, an on-nudge segment, and done-by', () => {
    render(<PlanStrip startByClock="12:35pm" doneByClock="1:00pm" reminderOn onPress={() => {}} />);
    expect(screen.getByText('Start by 12:35pm')).toBeOnTheScreen();
    expect(screen.getByText('nudge on')).toBeOnTheScreen();
    expect(screen.getByText('done by 1:00pm')).toBeOnTheScreen();
  });

  it('shows an off-nudge segment and omits done-by when null', () => {
    render(<PlanStrip startByClock="12:35pm" doneByClock={null} reminderOn={false} onPress={() => {}} />);
    expect(screen.getByText('nudge off')).toBeOnTheScreen();
    expect(screen.queryByText(/done by/)).toBeNull();
  });

  it('fires onPress when tapped', () => {
    const onPress = jest.fn();
    render(<PlanStrip startByClock="12:35pm" doneByClock={null} reminderOn onPress={onPress} />);
    fireEvent.press(screen.getByTestId('plan-strip'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
