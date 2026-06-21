import { render } from '@testing-library/react-native';
import { ProgressChart } from '../ProgressChart';

it('renders the then-vs-now endpoints and a positive delta pill', () => {
  const { getByText } = render(
    <ProgressChart trend={{ points: [61, 64, 66, 69], deltaPts: 8 }} fallback={null} />,
  );
  expect(getByText('At first · 61%')).toBeTruthy();
  expect(getByText('Lately · 69%')).toBeTruthy();
  expect(getByText('+8 pts')).toBeTruthy();
});

it('falls back to youVsPast when the trend is null', () => {
  const { getByText } = render(
    <ProgressChart trend={null} fallback={{ earlyAccuracy: 60, recentAccuracy: 60, delta: 0 }} />,
  );
  expect(getByText('At first · 60%')).toBeTruthy();
});

it('renders nothing when both inputs are null', () => {
  const { toJSON } = render(<ProgressChart trend={null} fallback={null} />);
  expect(toJSON()).toBeNull();
});
