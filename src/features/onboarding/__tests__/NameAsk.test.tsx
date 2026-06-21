import { render, fireEvent } from '@testing-library/react-native';
import { NameAsk } from '../NameAsk';

it('passes a typed name on continue and undefined on skip', () => {
  const onContinue = jest.fn();
  const { getByLabelText, getByText, rerender } = render(<NameAsk onContinue={onContinue} />);
  fireEvent.changeText(getByLabelText('Your name'), 'Ali');
  fireEvent.press(getByText('Continue'));
  expect(onContinue).toHaveBeenCalledWith('Ali');

  const onContinue2 = jest.fn();
  rerender(<NameAsk onContinue={onContinue2} />);
  fireEvent.press(getByText('Skip'));
  expect(onContinue2).toHaveBeenCalledWith(undefined);
});
