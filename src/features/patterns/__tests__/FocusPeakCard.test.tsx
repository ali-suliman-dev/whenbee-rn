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

const forming = {
  startMin: 540, endMin: 720, basis: 'prior' as const, confidence: 0,
  scoreByBin: Array.from({ length: 38 }, () => 0.3),
  sampleCount: 3, distinctDays: 2, held: false,
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

it('free + personal: shows a quiet Unlock link (no filled CTA), no exact window', () => {
  (useLearnedFocusWindow as jest.Mock).mockReturnValue(personal);
  (useEntitlement as unknown as jest.Mock).mockReturnValue(false);
  const { getByText, queryByText } = render(<FocusPeakCard />);
  expect(getByText('Unlock my focus window ›')).toBeTruthy();
  expect(queryByText('Unlock my focus window')).toBeNull();
  expect(queryByText('1:30 – 4:00 pm')).toBeNull();
});

it('forming + Pro: milestone shows, no PRO badge (already unlocked)', () => {
  (useLearnedFocusWindow as jest.Mock).mockReturnValue(forming);
  const { getByText, queryByText } = render(<FocusPeakCard />);
  expect(getByText('3')).toBeTruthy();
  expect(queryByText('PRO')).toBeNull();
});

it('forming + free: milestone shows the PRO coin pill (still gated)', () => {
  (useLearnedFocusWindow as jest.Mock).mockReturnValue(forming);
  (useEntitlement as unknown as jest.Mock).mockReturnValue(false);
  const { getByText } = render(<FocusPeakCard />);
  expect(getByText('3')).toBeTruthy();
  expect(getByText('PRO')).toBeTruthy();
});

// Sessions cleared (16 ≥ 15) but starts land on too few days → days is the real gate.
// Copy must switch to a days meter, never keep saying "log 15 sessions".
it('forming, sessions met but < 5 days: shows a days meter, not a sessions meter', () => {
  (useLearnedFocusWindow as jest.Mock).mockReturnValue({
    ...forming, sampleCount: 16, distinctDays: 2,
  });
  const { getByText, queryByText, getByTestId } = render(<FocusPeakCard />);
  expect(getByTestId('focus-maturity-days')).toBeTruthy();
  expect(getByText('2')).toBeTruthy();
  expect(getByText('/5')).toBeTruthy();
  expect(getByText(/across 5 different days/i)).toBeTruthy();
  expect(queryByText(/Log 15 timed sessions/i)).toBeNull();
});

// Both gates cleared but no significant peak (permutation gate) → honest "even so far".
it('forming, sessions + days met but no peak: shows the no-clear-peak copy, no meter', () => {
  (useLearnedFocusWindow as jest.Mock).mockReturnValue({
    ...forming, sampleCount: 20, distinctDays: 7,
  });
  const { getByText, queryByTestId, queryByText } = render(<FocusPeakCard />);
  expect(getByText(/no clear peak yet/i)).toBeTruthy();
  expect(queryByTestId('focus-maturity')).toBeNull();
  expect(queryByTestId('focus-maturity-days')).toBeNull();
  expect(queryByText(/Log 15 timed sessions/i)).toBeNull();
});
