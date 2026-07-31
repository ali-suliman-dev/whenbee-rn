import { render } from '@testing-library/react-native';
import FocusWindowDetail from '../focus-window';
import { useLearnedFocusWindow } from '@/src/features/planner/useLearnedFocusWindow';
import { useFocusInsights } from '@/src/features/patterns/useFocusInsights';
import { useOnboardingStore } from '@/src/stores/onboardingStore';
import { FW_BIN_COUNT } from '@/src/engine';

jest.mock('@/src/features/planner/useLearnedFocusWindow');
jest.mock('@/src/features/patterns/useFocusInsights');
jest.mock('@/src/stores/onboardingStore');

const win = { startMin: 810, endMin: 960, basis: 'revealed' as const, confidence: 0.8,
  confidenceTier: 'steady' as const, coarseBlockLabel: 'Afternoons',
  scoreByBin: Array.from({ length: FW_BIN_COUNT }, (_, i) => (i === 9 ? 1 : 0.3)), sampleCount: 137, distinctDays: 21, held: false,
  gates: { sessions: { have: 137, need: 15 }, days: { have: 21, need: 5 } } };

beforeEach(() => {
  (useLearnedFocusWindow as jest.Mock).mockReturnValue(win);
  (useOnboardingStore as unknown as jest.Mock).mockImplementation(
    (selector: (s: { quizAnswers: { focus?: 'morning' | 'evening' | 'varies' } }) => unknown) =>
      selector({ quizAnswers: {} }),
  );
});

it('renders Tier-1 rows always; confidence is the meter, evidence a caption', () => {
  (useFocusInsights as jest.Mock).mockReturnValue({ peakMin: 882, troughMin: 555, troughStartMin: 540, troughEndMin: 600, contrast: null, accuracyBetterInWindow: null, durationLongerInWindow: null });
  const { getByText, queryByText } = render(<FocusWindowDetail />);
  expect(getByText('Peak focus')).toBeTruthy();
  expect(getByText('Steady')).toBeTruthy(); // header tier pill
  expect(getByText('Steady · locked to your rhythm')).toBeTruthy(); // meter label (tier steady)
  expect(getByText('137 sessions · 3 wks of evidence')).toBeTruthy();
  expect(queryByText('Confidence')).toBeNull(); // text row replaced by the meter
  expect(queryByText('Most accurate')).toBeNull(); // null Tier-2 hidden
});

it('foggiest stretch is a real span (trough bin bounds), never a single minute', () => {
  (useFocusInsights as jest.Mock).mockReturnValue({ peakMin: 882, troughMin: 570, troughStartMin: 540, troughEndMin: 600, contrast: null, accuracyBetterInWindow: null, durationLongerInWindow: null });
  const { getByText, queryByText } = render(<FocusWindowDetail />);
  expect(getByText('Foggiest stretch')).toBeTruthy();
  expect(getByText('9:00 – 10:00 am')).toBeTruthy();
  expect(queryByText('9:30 am')).toBeNull(); // the old point-in-time value
});

it('renders Tier-2 rows when available', () => {
  (useFocusInsights as jest.Mock).mockReturnValue({ peakMin: 882, troughMin: 555, troughStartMin: 540, troughEndMin: 600, contrast: 2.3, accuracyBetterInWindow: true, durationLongerInWindow: true });
  const { getByText } = render(<FocusWindowDetail />);
  expect(getByText('Sharper than your slump')).toBeTruthy();
  expect(getByText('Most accurate')).toBeTruthy();
});

it('low confidence: honest early-read copy, coarse block hero, tier-true meter', () => {
  (useLearnedFocusWindow as jest.Mock).mockReturnValue({
    ...win, confidence: 0.4, confidenceTier: 'low' as const, coarseBlockLabel: 'Mornings',
    sampleCount: 26, distinctDays: 14,
  });
  (useFocusInsights as jest.Mock).mockReturnValue(null);
  const { getByText, queryByText } = render(<FocusWindowDetail />);
  expect(getByText(/An early read from 26 sessions/)).toBeTruthy();
  expect(queryByText(/sessions agree/)).toBeNull();
  expect(queryByText(/has held for/)).toBeNull();
  // Coarse hero: block name leads, precise range demotes to an "around" subline.
  expect(getByText('Mornings')).toBeTruthy();
  expect(getByText(/^around /)).toBeTruthy();
  expect(getByText('Still learning')).toBeTruthy(); // header tier pill
  // Meter label must match the engine's pinned tier, not the raw number —
  // a coarse window at confidence 0.55 is 'low', never "Building".
  expect(getByText('Still learning · sharpening')).toBeTruthy();
  expect(queryByText(/Building/)).toBeNull();
});

it('why-line lead matches the bucket for a non-afternoon peakMin', () => {
  // 620 min (10:20a) → "<660" bucket, not the afternoon "peak after lunch" copy.
  (useFocusInsights as jest.Mock).mockReturnValue({ peakMin: 620, troughMin: 555, contrast: null, accuracyBetterInWindow: null, durationLongerInWindow: null });
  const { getByText, queryByText } = render(<FocusWindowDetail />);
  expect(getByText(/You start sharp and fade after lunch/)).toBeTruthy();
  expect(queryByText(/Mornings warm up slow/)).toBeNull();
});

describe('stated focus block (no logged evidence yet)', () => {
  it('shows the stated block + honest caveat when sampleCount is 0 and the quiz answer is morning', () => {
    (useLearnedFocusWindow as jest.Mock).mockReturnValue({ ...win, sampleCount: 0, distinctDays: 0 });
    (useOnboardingStore as unknown as jest.Mock).mockImplementation(
      (selector: (s: { quizAnswers: { focus?: 'morning' | 'evening' | 'varies' } }) => unknown) =>
        selector({ quizAnswers: { focus: 'morning' } }),
    );
    (useFocusInsights as jest.Mock).mockReturnValue(null);
    const { getByText } = render(<FocusWindowDetail />);
    expect(getByText('You said mornings')).toBeTruthy();
    expect(getByText("I'll check that against your timers.")).toBeTruthy();
  });

  it('never shows the stated block once there is logged evidence — the engine read wins', () => {
    (useLearnedFocusWindow as jest.Mock).mockReturnValue({ ...win, sampleCount: 3, distinctDays: 2, confidenceTier: 'low' as const });
    (useOnboardingStore as unknown as jest.Mock).mockImplementation(
      (selector: (s: { quizAnswers: { focus?: 'morning' | 'evening' | 'varies' } }) => unknown) =>
        selector({ quizAnswers: { focus: 'morning' } }),
    );
    (useFocusInsights as jest.Mock).mockReturnValue(null);
    const { queryByText } = render(<FocusWindowDetail />);
    expect(queryByText('You said mornings')).toBeNull();
    expect(queryByText("I'll check that against your timers.")).toBeNull();
  });

  it('shows the existing no-data coarse state (not a stated block) when the quiz answer was "varies"', () => {
    (useLearnedFocusWindow as jest.Mock).mockReturnValue({
      ...win, sampleCount: 0, distinctDays: 0, confidenceTier: 'low' as const,
    });
    (useOnboardingStore as unknown as jest.Mock).mockImplementation(
      (selector: (s: { quizAnswers: { focus?: 'morning' | 'evening' | 'varies' } }) => unknown) =>
        selector({ quizAnswers: { focus: 'varies' } }),
    );
    (useFocusInsights as jest.Mock).mockReturnValue(null);
    const { queryByText, getByText } = render(<FocusWindowDetail />);
    expect(queryByText('You said mornings')).toBeNull();
    expect(queryByText("I'll check that against your timers.")).toBeNull();
    // falls back to today's existing coarse hero (the engine's own coarseBlockLabel)
    expect(getByText(win.coarseBlockLabel)).toBeTruthy();
  });
});
