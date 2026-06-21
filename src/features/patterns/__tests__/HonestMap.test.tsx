import { render } from '@testing-library/react-native';
import { HonestMap } from '../CalibrationMap';

const rows = [
  { categoryId: 'c', categoryName: 'Cleaning', guessMin: 15, honestMin: 25, multiplier: 1.5, sampleSize: 1, confidence: 'setting' as const },
];

it('renders a category row with its honest number and readiness a11y label', () => {
  const { getByText, getByLabelText } = render(<HonestMap rows={rows} />);
  expect(getByText('Cleaning')).toBeTruthy();
  expect(getByText('~25')).toBeTruthy();
  expect(getByLabelText('Cleaning readiness: setting, 2 of 3')).toBeTruthy();
});
