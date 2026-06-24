import { render } from '@testing-library/react-native';
import { ProgressChart } from '../ProgressChart';

it('renders the up-state title, positive delta pill and aligning caption', () => {
  const { getByText } = render(
    <ProgressChart trend={{ points: [61, 64, 66, 69], deltaPts: 8 }} fallback={null} />,
  );
  expect(getByText('ACCURACY OVER TIME')).toBeTruthy();
  expect(getByText('Getting more accurate')).toBeTruthy();
  expect(getByText('+8% accuracy')).toBeTruthy();
  expect(getByText('Your guesses and actual time are aligning.')).toBeTruthy();
});

it('falls back to youVsPast (steady) when the trend is null', () => {
  const { getByText } = render(
    <ProgressChart trend={null} fallback={{ earlyAccuracy: 60, recentAccuracy: 60, delta: 0 }} />,
  );
  expect(getByText('Holding steady')).toBeTruthy();
  expect(getByText('steady')).toBeTruthy();
  expect(getByText('Your reads are consistent.')).toBeTruthy();
});

it('renders nothing when both inputs are null', () => {
  const { toJSON } = render(<ProgressChart trend={null} fallback={null} />);
  expect(toJSON()).toBeNull();
});
