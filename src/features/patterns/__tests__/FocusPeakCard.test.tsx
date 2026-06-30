import { render } from '@testing-library/react-native';
import { FocusPeakCard } from '../FocusPeakCard';
import { useLearnedFocusWindow } from '@/src/features/planner/useLearnedFocusWindow';
import { useFocusInsights } from '@/src/features/patterns/useFocusInsights';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';

jest.mock('@/src/features/planner/useLearnedFocusWindow');
jest.mock('@/src/features/patterns/useFocusInsights');
jest.mock('@/src/features/paywall/useEntitlement');

const personal = {
  startMin: 810, endMin: 960, basis: 'personal' as const, confidence: 0.8,
  scoreByBin: Array.from({ length: 38 }, (_, i) => (i === 19 ? 1 : 0.3)),
  sampleCount: 137, distinctDays: 21, held: false,
};

beforeEach(() => {
  (useEntitlement as unknown as jest.Mock).mockReturnValue(true); // isPro selector
  (useFocusInsights as jest.Mock).mockReturnValue({ peakMin: 882, troughMin: 555, contrast: 2.3, accuracyBetterInWindow: true, durationLongerInWindow: true });
});

it('Pro personal: shows window in user clock + why-line', () => {
  (useLearnedFocusWindow as jest.Mock).mockReturnValue(personal);
  const { getByText } = render(<FocusPeakCard />);
  expect(getByText('1:30 – 4:00 pm')).toBeTruthy();
  expect(getByText(/peak after lunch/i)).toBeTruthy();
});

it('Pro personal with null contrast: why-line drops the ratio clause', () => {
  (useLearnedFocusWindow as jest.Mock).mockReturnValue(personal);
  (useFocusInsights as jest.Mock).mockReturnValue({ peakMin: 882, troughMin: 555, contrast: null, accuracyBetterInWindow: null, durationLongerInWindow: null });
  const { queryByText } = render(<FocusPeakCard />);
  expect(queryByText(/× above your dip/)).toBeNull();
});

it('free + personal: shows exactly one Unlock CTA, no exact window', () => {
  (useLearnedFocusWindow as jest.Mock).mockReturnValue(personal);
  (useEntitlement as unknown as jest.Mock).mockReturnValue(false);
  const { getByText, queryByText } = render(<FocusPeakCard />);
  expect(getByText('Unlock my focus window')).toBeTruthy();
  expect(queryByText('1:30 – 4:00 pm')).toBeNull();
});
