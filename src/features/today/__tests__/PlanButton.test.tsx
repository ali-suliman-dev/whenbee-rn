import { render, screen, fireEvent } from '@testing-library/react-native';
import { PlanButton } from '@/src/features/today/PlanButton';

describe('PlanButton', () => {
  it('renders "plan {startByClock}" and fires onPress when a plan exists', () => {
    const onPress = jest.fn();
    render(<PlanButton hasPlan startByClock="15:00" onPress={onPress} />);
    expect(screen.getByText('plan 15:00')).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('plan-button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders "plan my day" and fires onPress when no plan exists yet', () => {
    const onPress = jest.fn();
    render(<PlanButton hasPlan={false} startByClock={null} onPress={onPress} />);
    expect(screen.getByText('plan my day')).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('plan-button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
