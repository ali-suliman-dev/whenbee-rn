import { render, screen } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import Reward from '@/src/app/(modals)/reward';
import { useRewardStore } from '@/src/stores/rewardStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import type { LogResult } from '@/src/stores/calibrationStore';

const mockDismiss = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    dismiss: (...a: unknown[]) => mockDismiss(...a),
    push: (...a: unknown[]) => mockPush(...a),
  },
}));

const baseResult: LogResult = {
  eventId: 'evt-test',
  counted: true,
  multiplier: 2.2,
  sharpness: 64,
  tierBefore: 'Setting',
  tierAfter: 'Ripening',
  leveledUp: false,
  reclaimDeltaMin: 0,
  reclaimLifetimeMin: 0,
};

beforeEach(() => {
  mockDismiss.mockClear();
  mockPush.mockClear();
  useRewardStore.getState().clear();
  useCalibrationStore.setState({ logs: 0 });
});

describe('Reward screen', () => {
  it('renders the actual number, the delta chip, and the honey pct', () => {
    useRewardStore.getState().setReward({
      actualMin: 28,
      guessMin: 15,
      category: 'getting_ready',
      label: 'Leave for work',
      result: baseResult,
    });

    render(<Reward />);

    expect(screen.getByText('28')).toBeOnTheScreen();
    // The gray "you guessed…" sentence is now a glanceable delta chip.
    expect(screen.getByText('13 min over your guess')).toBeOnTheScreen();
    expect(screen.getByText('64%')).toBeOnTheScreen();
    // Multiplier sub reads the category display name + multiplier (jargon trimmed).
    expect(screen.getByText('Getting ready now reads 2.2×')).toBeOnTheScreen();
  });

  it('renders a deterministic timed headline from the rotating set', () => {
    useCalibrationStore.setState({ logs: 0 });
    useRewardStore.getState().setReward({
      actualMin: 10,
      guessMin: 10,
      category: 'email',
      label: null,
      result: baseResult,
    });
    render(<Reward />);
    // logs % 4 === 0 → first headline.
    expect(screen.getByText('Logged. Nice one.')).toBeOnTheScreen();
  });

  it('shows the cap eyebrow + seal ritual when the cell ripens to Honest', () => {
    useRewardStore.getState().setReward({
      actualMin: 12,
      guessMin: 15,
      category: 'email',
      label: null,
      result: { ...baseResult, sharpness: 95, tierAfter: 'Honest', leveledUp: true },
    });
    render(<Reward />);
    expect(screen.getByText("Honey ripened · this cell's now Honest")).toBeOnTheScreen();
    expect(
      screen.getByText("New honest cell — and there's no streak to lose it."),
    ).toBeOnTheScreen();
  });

  it('renders the graceful fallback when there is no reward (deep-linked)', () => {
    // store is cleared in beforeEach → result is null.
    render(<Reward />);
    expect(screen.getByText('Nothing to celebrate yet')).toBeOnTheScreen();
    expect(screen.getByText('Back to today')).toBeOnTheScreen();
    // No crash, no honey row.
    expect(screen.queryByText('HONEY')).toBeNull();
  });

  it('renders the reclaim deposit beat (chip + count-up target) when minutes were banked', () => {
    useRewardStore.getState().setReward({
      actualMin: 32,
      guessMin: 15,
      category: 'cleaning',
      label: null,
      result: { ...baseResult, reclaimDeltaMin: 15, reclaimLifetimeMin: 200 },
    });
    render(<Reward />);
    // The amber chip reads the minutes this log banked.
    expect(screen.getByText('+15m reclaimed')).toBeOnTheScreen();
    // The count-up lands on the new lifetime total: formatReclaim(200) → "3h 20m".
    // (The numeral is an AnimatedTextInput; its formatted total surfaces on the
    // beat's accessibility label.)
    expect(screen.getByLabelText('Reclaimed 15 minutes, 3h 20m banked')).toBeOnTheScreen();
    // The two exits read the redesigned labels.
    expect(screen.getByText('See my Reclaim')).toBeOnTheScreen();
    expect(screen.getByText('Back to today')).toBeOnTheScreen();
  });

  it('renders NO reclaim element when nothing was banked (never a "+0m")', () => {
    useRewardStore.getState().setReward({
      actualMin: 12,
      guessMin: 12,
      category: 'email',
      label: null,
      result: { ...baseResult, reclaimDeltaMin: 0, reclaimLifetimeMin: 40 },
    });
    render(<Reward />);
    // No chip at all — not "+0m", and the whole beat is absent.
    expect(screen.queryByText('+0m reclaimed')).toBeNull();
    expect(screen.queryByText(/reclaimed$/)).toBeNull();
    expect(screen.queryByLabelText(/banked$/)).toBeNull();
  });

  it('reduce-motion: renders the final reclaim values without crashing', () => {
    const spy = jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
    try {
      useRewardStore.getState().setReward({
        actualMin: 32,
        guessMin: 15,
        category: 'cleaning',
        label: null,
        result: { ...baseResult, reclaimDeltaMin: 15, reclaimLifetimeMin: 200 },
      });
      render(<Reward />);
      expect(screen.getByText('+15m reclaimed')).toBeOnTheScreen();
      expect(screen.getByLabelText('Reclaimed 15 minutes, 3h 20m banked')).toBeOnTheScreen();
    } finally {
      spy.mockRestore();
    }
  });

  it('shows the over-run reason row when the run ran well past the guess', () => {
    // 32 vs 15 → ratio ~2.1, past the 0.25 gate → over-run chips.
    useRewardStore.getState().setReward({
      actualMin: 32,
      guessMin: 15,
      category: 'cleaning',
      label: null,
      result: baseResult,
    });
    render(<Reward />);
    expect(screen.getByText('Where did the time go?')).toBeOnTheScreen();
    expect(screen.getByText('Got interrupted')).toBeOnTheScreen();
    // The two exits are still present — the row never blocks them.
    expect(screen.getByText('See my Reclaim')).toBeOnTheScreen();
    expect(screen.getByText('Back to today')).toBeOnTheScreen();
  });

  it('shows the under-run reason row when the run came in well under the guess', () => {
    // 8 vs 30 → ratio ~0.27, past the gate on the under side → under-run chips.
    useRewardStore.getState().setReward({
      actualMin: 8,
      guessMin: 30,
      category: 'email',
      label: null,
      result: baseResult,
    });
    render(<Reward />);
    expect(screen.getByText('What made it quick?')).toBeOnTheScreen();
    expect(screen.getByText('In the zone')).toBeOnTheScreen();
  });

  it('hides the reason row when the run landed close to the guess', () => {
    // 16 vs 15 → ratio ~1.07, inside the gate → no chips.
    useRewardStore.getState().setReward({
      actualMin: 16,
      guessMin: 15,
      category: 'email',
      label: null,
      result: baseResult,
    });
    render(<Reward />);
    expect(screen.queryByText('Where did the time go?')).toBeNull();
    expect(screen.queryByText('What made it quick?')).toBeNull();
  });
});
