import { render } from '@testing-library/react-native';
import FocusWindowDetail from '../focus-window';
import { useLearnedFocusWindow } from '@/src/features/planner/useLearnedFocusWindow';
import { useFocusInsights } from '@/src/features/patterns/useFocusInsights';

jest.mock('@/src/features/planner/useLearnedFocusWindow');
jest.mock('@/src/features/patterns/useFocusInsights');

const win = { startMin: 810, endMin: 960, basis: 'revealed' as const, confidence: 0.8,
  confidenceTier: 'steady' as const, coarseBlockLabel: 'Afternoons',
  scoreByBin: Array.from({ length: 38 }, (_, i) => (i === 19 ? 1 : 0.3)), sampleCount: 137, distinctDays: 21, held: false,
  gates: { sessions: { have: 137, need: 15 }, days: { have: 21, need: 5 } } };

beforeEach(() => (useLearnedFocusWindow as jest.Mock).mockReturnValue(win));

it('renders Tier-1 rows always', () => {
  (useFocusInsights as jest.Mock).mockReturnValue({ peakMin: 882, troughMin: 555, contrast: null, accuracyBetterInWindow: null, durationLongerInWindow: null });
  const { getByText, queryByText } = render(<FocusWindowDetail />);
  expect(getByText('Peak focus')).toBeTruthy();
  expect(getByText('Confidence')).toBeTruthy();
  expect(queryByText('Most accurate')).toBeNull(); // null Tier-2 hidden
});

it('renders Tier-2 rows when available', () => {
  (useFocusInsights as jest.Mock).mockReturnValue({ peakMin: 882, troughMin: 555, contrast: 2.3, accuracyBetterInWindow: true, durationLongerInWindow: true });
  const { getByText } = render(<FocusWindowDetail />);
  expect(getByText('Sharper than your slump')).toBeTruthy();
  expect(getByText('Most accurate')).toBeTruthy();
});

it('why-line lead matches the bucket for a non-afternoon peakMin', () => {
  // 620 min (10:20a) → "<660" bucket, not the afternoon "peak after lunch" copy.
  (useFocusInsights as jest.Mock).mockReturnValue({ peakMin: 620, troughMin: 555, contrast: null, accuracyBetterInWindow: null, durationLongerInWindow: null });
  const { getByText, queryByText } = render(<FocusWindowDetail />);
  expect(getByText(/You start sharp and fade after lunch/)).toBeTruthy();
  expect(queryByText(/Mornings warm up slow/)).toBeNull();
});
