import { render } from '@testing-library/react-native';
import { OverflowBar } from '../OverflowBar';

test('shows guess and honest example values', () => {
  const { getByText } = render(<OverflowBar guessMin={15} honestMin={24} />);
  expect(getByText('15m')).toBeTruthy();
  expect(getByText('24m')).toBeTruthy();
  expect(getByText(/example/i)).toBeTruthy();
});
