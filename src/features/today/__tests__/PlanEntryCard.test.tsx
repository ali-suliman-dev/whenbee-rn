import { render, fireEvent } from '@testing-library/react-native';
import { PlanEntryCard } from '../PlanEntryCard';

it('shows the plain "Plan my day" CTA before planning', () => {
  const { getByText, queryByText } = render(
    <PlanEntryCard hasPlan={false} startByClock={null} reminderOn={false} onPress={jest.fn()} />,
  );
  expect(getByText('Plan my day')).toBeTruthy();
  expect(queryByText(/tap to view/)).toBeNull();
});

it('shows the live status card with the start-by clock and nudge-on state after planning', () => {
  const { getByText } = render(
    <PlanEntryCard hasPlan startByClock="12:35 PM" reminderOn onPress={jest.fn()} />,
  );
  expect(getByText("Today's plan")).toBeTruthy();
  expect(getByText('Start by 12:35 PM')).toBeTruthy();
  expect(getByText('nudge on')).toBeTruthy();
  expect(getByText('tap to view')).toBeTruthy();
});

it('reflects the nudge-off state', () => {
  const { getByText } = render(
    <PlanEntryCard hasPlan startByClock="12:35 PM" reminderOn={false} onPress={jest.fn()} />,
  );
  expect(getByText('no nudge')).toBeTruthy();
});

it('calls onPress when tapped', () => {
  const onPress = jest.fn();
  const { getByTestId } = render(
    <PlanEntryCard hasPlan={false} startByClock={null} reminderOn={false} onPress={onPress} />,
  );
  fireEvent.press(getByTestId('plan-entry-card'));
  expect(onPress).toHaveBeenCalled();
});
