import { render } from '@testing-library/react-native';
import { FocusPeakCard } from '../FocusPeakCard';
import { useLearnedFocusWindow } from '@/src/features/planner/useLearnedFocusWindow';
import { useFocusInsights } from '@/src/features/patterns/useFocusInsights';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';

jest.mock('@/src/features/planner/useLearnedFocusWindow');
jest.mock('@/src/features/patterns/useFocusInsights');
jest.mock('@/src/features/paywall/useEntitlement');
jest.mock('@/src/stores/settingsStore', () => ({
  useSettingsStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ windowStartMin: 540, windowEndMin: 1320, setFocusWindow: jest.fn(), colorMode: 'light' }),
}));

// Revealed + steady confidence — the precise-window hero.
const revealedSteady = {
  startMin: 810, endMin: 960, basis: 'revealed' as const, confidence: 0.9,
  confidenceTier: 'steady' as const, coarseBlockLabel: 'Afternoons',
  scoreByBin: Array.from({ length: 19 }, (_, i) => (i === 9 ? 1 : 0.3)),
  sampleCount: 137, distinctDays: 21, held: false,
  gates: { sessions: { have: 137, need: 15 }, days: { have: 21, need: 5 } },
};

// Revealed but still low-confidence — coarse block reveal.
const revealedLow = {
  startMin: 480, endMin: 690, basis: 'revealed' as const, confidence: 0.4,
  confidenceTier: 'low' as const, coarseBlockLabel: 'Mornings',
  scoreByBin: Array(19).fill(0.5), sampleCount: 16, distinctDays: 5, held: false,
  gates: { sessions: { have: 16, need: 15 }, days: { have: 5, need: 5 } },
};

// Forming: only the sessions gate is active (0 of 2 unlocked).
const forming = {
  startMin: 540, endMin: 720, basis: 'forming' as const, confidence: 0,
  confidenceTier: 'low' as const, coarseBlockLabel: '',
  scoreByBin: Array.from({ length: 19 }, () => 0.3),
  sampleCount: 3, distinctDays: 2, held: false,
  gates: { sessions: { have: 3, need: 15 }, days: { have: 2, need: 5 } },
};

// Forming with a leaning coarse block already known.
const formingWithHint = {
  ...forming,
  coarseBlockLabel: 'Mornings',
};

// Sessions cleared, days still short (1 of 2 unlocked).
const daysActive = {
  ...forming,
  sampleCount: 16, distinctDays: 3,
  gates: { sessions: { have: 16, need: 15 }, days: { have: 3, need: 5 } },
};

beforeEach(() => {
  (useEntitlement as unknown as jest.Mock).mockReturnValue(true); // isPro selector
  (useFocusInsights as jest.Mock).mockReturnValue({
    peakMin: 882, troughMin: 555, contrast: 2.3, accuracyBetterInWindow: true, durationLongerInWindow: true,
  });
});

it('revealed + steady, Pro: shows window range in user clock + why-line + meter', () => {
  (useLearnedFocusWindow as jest.Mock).mockReturnValue(revealedSteady);
  const { getByText } = render(<FocusPeakCard />);
  expect(getByText('1:30 – 4:00 pm')).toBeTruthy();
  expect(getByText(/peak after lunch/i)).toBeTruthy();
  expect(getByText('Steady · locked to your rhythm')).toBeTruthy();
});

it('revealed + steady with null contrast: why-line drops the ratio clause', () => {
  (useLearnedFocusWindow as jest.Mock).mockReturnValue(revealedSteady);
  (useFocusInsights as jest.Mock).mockReturnValue({ peakMin: 882, troughMin: 555, contrast: null, accuracyBetterInWindow: null, durationLongerInWindow: null });
  const { queryByText } = render(<FocusPeakCard />);
  expect(queryByText(/× above your dip/)).toBeNull();
});

it('revealed low: shows coarse block name + confidence label, not the precise window', () => {
  (useLearnedFocusWindow as jest.Mock).mockReturnValue(revealedLow);
  const { getByText, queryByText } = render(<FocusPeakCard />);
  expect(getByText('Mornings')).toBeTruthy();
  expect(getByText('Still learning · sharpening')).toBeTruthy();
  expect(queryByText('Open ›')).toBeNull();
});

it('free + revealed: shows a quiet Unlock link (no filled CTA), no exact window', () => {
  (useLearnedFocusWindow as jest.Mock).mockReturnValue(revealedSteady);
  (useEntitlement as unknown as jest.Mock).mockReturnValue(false);
  const { getByText, queryByText } = render(<FocusPeakCard />);
  expect(getByText('Unlock my focus window ›')).toBeTruthy();
  expect(queryByText('Unlock my focus window')).toBeNull();
  expect(queryByText('1:30 – 4:00 pm')).toBeNull();
});

it('forming: header has no unlocked tag; ladder shows two rungs + the tag', () => {
  (useLearnedFocusWindow as jest.Mock).mockReturnValue(forming);
  const { getByText, queryAllByText } = render(<FocusPeakCard />);
  expect(getByText('0 of 2 unlocked')).toBeTruthy();
  expect(getByText('Timed sessions')).toBeTruthy();
  expect(getByText('Different days')).toBeTruthy();
  expect(queryAllByText(/of 3 unlocked/).length).toBe(0);
});

it('forming + Pro: no PRO badge in header', () => {
  (useLearnedFocusWindow as jest.Mock).mockReturnValue(forming);
  const { queryByText } = render(<FocusPeakCard />);
  expect(queryByText('PRO')).toBeNull();
});

it('forming + free: header shows the PRO coin pill (still gated)', () => {
  (useLearnedFocusWindow as jest.Mock).mockReturnValue(forming);
  (useEntitlement as unknown as jest.Mock).mockReturnValue(false);
  const { getByText } = render(<FocusPeakCard />);
  expect(getByText('PRO')).toBeTruthy();
});

it('forming with no coarse hint yet: falls back to the generic hint copy', () => {
  (useLearnedFocusWindow as jest.Mock).mockReturnValue(forming);
  const { getByText } = render(<FocusPeakCard />);
  expect(getByText("Keep timing and I'll find the hours you focus best.")).toBeTruthy();
});

it('forming with a leaning coarse block: shows the coarse hint line', () => {
  (useLearnedFocusWindow as jest.Mock).mockReturnValue(formingWithHint);
  const { getByText } = render(<FocusPeakCard />);
  expect(getByText(/Leaning toward mornings/)).toBeTruthy();
});

it('forming: sessions done, days active → 1 of 2 unlocked', () => {
  (useLearnedFocusWindow as jest.Mock).mockReturnValue(daysActive);
  const { getByText } = render(<FocusPeakCard />);
  expect(getByText('1 of 2 unlocked')).toBeTruthy();
  expect(getByText('16 ✓')).toBeTruthy();
});
