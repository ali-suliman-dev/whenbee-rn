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
  gates: {
    sessions: { have: 137, need: 15 },
    days: { have: 21, need: 5 },
    peak: { have: 24, need: 6, confirming: false },
  },
};

// Early forming: only the sessions gate is active (0 of 3 unlocked).
const forming = {
  startMin: 540, endMin: 720, basis: 'prior' as const, confidence: 0,
  scoreByBin: Array.from({ length: 38 }, () => 0.3),
  sampleCount: 3, distinctDays: 2, held: false,
  gates: {
    sessions: { have: 3, need: 15 },
    days: { have: 2, need: 5 },
    peak: { have: 0, need: 6, confirming: false },
  },
};

// Sessions + days cleared, peak still counting up (2 of 3 unlocked).
const peakActive = {
  ...forming,
  sampleCount: 18, distinctDays: 6,
  gates: {
    sessions: { have: 18, need: 15 },
    days: { have: 6, need: 5 },
    peak: { have: 2, need: 6, confirming: false },
  },
};

// All counts met but the window hasn't certified yet — peak is confirming
// (still only 2 of 3 gates truly "unlocked"; the peak gate never counts as
// unlocked while forming).
const peakConfirming = {
  ...forming,
  sampleCount: 22, distinctDays: 8,
  gates: {
    sessions: { have: 22, need: 15 },
    days: { have: 8, need: 5 },
    peak: { have: 9, need: 6, confirming: true },
  },
};

// Days done from distinct-day count alone, sessions still short (e.g. one
// session/day for a week) — days must show DONE independent of the sessions
// gate, not "upcoming" with a raw "6/5".
const daysDoneSessionsShort = {
  ...forming,
  sampleCount: 8, distinctDays: 6,
  gates: {
    sessions: { have: 8, need: 15 },
    days: { have: 6, need: 5 },
    peak: { have: 0, need: 6, confirming: false },
  },
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

it('forming + Pro: sessions gate active, 0 of 3 unlocked, no PRO badge', () => {
  (useLearnedFocusWindow as jest.Mock).mockReturnValue(forming);
  const { getByText, queryByText } = render(<FocusPeakCard />);
  expect(getByText('Learning your focus hours')).toBeTruthy();
  expect(getByText('0 of 3 unlocked')).toBeTruthy();
  expect(getByText('3')).toBeTruthy(); // sessions "3/15" numerator node
  expect(getByText('/15')).toBeTruthy();
  expect(getByText('12 more timed sessions to go.')).toBeTruthy();
  expect(queryByText('PRO')).toBeNull();
});

it('forming + free: milestone shows the PRO coin pill (still gated)', () => {
  (useLearnedFocusWindow as jest.Mock).mockReturnValue(forming);
  (useEntitlement as unknown as jest.Mock).mockReturnValue(false);
  const { getByText } = render(<FocusPeakCard />);
  expect(getByText('3')).toBeTruthy();
  expect(getByText('PRO')).toBeTruthy();
});

it('forming: sessions + days done, peak active → 2 of 3 unlocked, "Almost there"', () => {
  (useLearnedFocusWindow as jest.Mock).mockReturnValue(peakActive);
  const { getByText } = render(<FocusPeakCard />);
  expect(getByText('2 of 3 unlocked')).toBeTruthy();
  expect(getByText('Almost there')).toBeTruthy();
  // two cleared gates carry a check
  expect(getByText('18 ✓')).toBeTruthy();
  expect(getByText('6 ✓')).toBeTruthy();
  // peak gate active with its have/need + locks-in copy
  expect(getByText('/6')).toBeTruthy();
  expect(getByText('4 more sessions in your busiest stretch and your peak locks in.')).toBeTruthy();
});

it('forming: days done from distinct-day count alone, sessions still short → days row is DONE, not upcoming', () => {
  (useLearnedFocusWindow as jest.Mock).mockReturnValue(daysDoneSessionsShort);
  const { getByText, queryByText } = render(<FocusPeakCard />);
  expect(getByText('1 of 3 unlocked')).toBeTruthy();
  // days gate reads DONE ("6 ✓"), never the raw "6/5" ratio
  expect(getByText('6 ✓')).toBeTruthy();
  expect(queryByText('6/5')).toBeNull();
  expect(queryByText('/5')).toBeNull();
  // sessions gate is the active row (8/15)
  expect(getByText('8')).toBeTruthy();
  expect(getByText('/15')).toBeTruthy();
});

it('forming: peak confirming → settling copy, not a "to go" line', () => {
  (useLearnedFocusWindow as jest.Mock).mockReturnValue(peakConfirming);
  const { getByText, queryByText } = render(<FocusPeakCard />);
  expect(getByText('2 of 3 unlocked')).toBeTruthy();
  expect(getByText('Confirming your peak — a session or two more will settle it.')).toBeTruthy();
  expect(queryByText(/your peak locks in/)).toBeNull();
});
