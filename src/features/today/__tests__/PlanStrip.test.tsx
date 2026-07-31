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

  // Regression (Finding 3, 2026-07-30): a forward (start-anchored) plan's clock
  // is a derived first-block start, not a deadline — the strip must never
  // call it "Start by" in that case, in either the visible text or the a11y label.
  it('words the line "Starting" when the plan is anchored to the start', () => {
    render(
      <PlanStrip
        startByClock="12:35pm"
        doneByClock={null}
        reminderOn
        planAnchor="start"
        onPress={() => {}}
      />,
    );
    expect(screen.getByText('Starting 12:35pm')).toBeOnTheScreen();
    expect(screen.queryByText('Start by 12:35pm')).toBeNull();
    expect(
      screen.getByLabelText(/^Today's plan\. Starting 12:35pm\. Reminder on\./),
    ).toBeOnTheScreen();
  });

  it('keeps the line "Start by" when the plan is anchored to the finish', () => {
    render(
      <PlanStrip
        startByClock="12:35pm"
        doneByClock={null}
        reminderOn
        planAnchor="finish"
        onPress={() => {}}
      />,
    );
    expect(screen.getByText('Start by 12:35pm')).toBeOnTheScreen();
  });
});
