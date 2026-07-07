import { render, fireEvent } from '@testing-library/react-native';
import { TimelineEmptyState } from '@/src/features/today/TimelineEmptyState';

describe('TimelineEmptyState', () => {
  it('shows the pre-plan copy and fires onPlan', () => {
    const onPlan = jest.fn();
    const { getByText, getByTestId } = render(<TimelineEmptyState onPlan={onPlan} isPro />);
    expect(getByText('No plan for today yet')).toBeTruthy();
    fireEvent.press(getByTestId('plan-my-day-btn'));
    expect(onPlan).toHaveBeenCalled();
  });
});
