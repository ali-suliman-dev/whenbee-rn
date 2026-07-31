import { render, screen, fireEvent } from '@testing-library/react-native';
import { PlanButton } from '@/src/features/today/PlanButton';

describe('PlanButton', () => {
  it('renders the start-by clock (no "Start" word) and fires onPress when a plan exists', () => {
    const onPress = jest.fn();
    render(<PlanButton hasPlan startByClock="15:00" onPress={onPress} />);
    expect(screen.getByText('15:00')).toBeOnTheScreen();
    expect(screen.queryByText(/plan/i)).toBeNull();
    fireEvent.press(screen.getByTestId('plan-button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders "Plan" and fires onPress when no plan exists yet', () => {
    const onPress = jest.fn();
    render(<PlanButton hasPlan={false} startByClock={null} onPress={onPress} />);
    expect(screen.getByText('Plan')).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('plan-button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  // Regression (Finding 3, 2026-07-30): a forward (start-anchored) plan's clock
  // is a derived first-block start, not a deadline — the a11y label must never
  // call it "Start by" in that case.
  it('words the a11y label "Starting" when the plan is anchored to the start', () => {
    render(
      <PlanButton hasPlan startByClock="15:00" planAnchor="start" onPress={() => {}} />,
    );
    expect(screen.getByLabelText('Plan. Starting 15:00. Tap to open.')).toBeOnTheScreen();
  });

  it('keeps the a11y label "Start by" when the plan is anchored to the finish', () => {
    render(
      <PlanButton hasPlan startByClock="15:00" planAnchor="finish" onPress={() => {}} />,
    );
    expect(screen.getByLabelText('Plan. Start by 15:00. Tap to open.')).toBeOnTheScreen();
  });
});
