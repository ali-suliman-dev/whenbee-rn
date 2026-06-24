import { render, screen } from '@testing-library/react-native';
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
  useFocusEffect: (cb: () => void | (() => void)) => cb(),
  useNavigation: () => ({
    isFocused: () => true,
    addListener: () => () => {},
  }),
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
    // Honey pct: number + muted unit suffix render as separate nodes now.
    expect(screen.getByText('64')).toBeOnTheScreen();
    // Multiplier folded into the HONEY header as a quiet "· 2.2×" meta.
    expect(screen.getByText('· 2.2×')).toBeOnTheScreen();
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

  it('renders the reworded nectar headline at rotation index 3', () => {
    useCalibrationStore.setState({ logs: 3 });
    useRewardStore.getState().setReward({
      actualMin: 10,
      guessMin: 10,
      category: 'email',
      label: null,
      result: baseResult,
    });
    render(<Reward />);
    // logs % 4 === 3 → fourth headline (the de-twee'd one).
    expect(screen.getByText("That's one more, logged.")).toBeOnTheScreen();
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
    expect(screen.getByText('Honest cell sealed')).toBeOnTheScreen();
    expect(
      screen.getByText('New honest cell. Nothing to keep up.'),
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

  it('renders the hub CTA button with the new label', () => {
    useRewardStore.getState().setReward({
      actualMin: 32,
      guessMin: 15,
      category: 'cleaning',
      label: null,
      result: { ...baseResult, reclaimDeltaMin: 15, reclaimLifetimeMin: 200 },
    });
    render(<Reward />);
    // No reclaim chip — the beat is gone.
    expect(screen.queryByText(/reclaimed/)).toBeNull();
    expect(screen.queryByLabelText(/banked/)).toBeNull();
    // The primary CTA now reads "See your bee".
    expect(screen.getByText('See your bee')).toBeOnTheScreen();
    expect(screen.getByText('Back to today')).toBeOnTheScreen();
  });

  it('shows no reclaim element regardless of reclaimDeltaMin', () => {
    useRewardStore.getState().setReward({
      actualMin: 12,
      guessMin: 12,
      category: 'email',
      label: null,
      result: { ...baseResult, reclaimDeltaMin: 0, reclaimLifetimeMin: 40 },
    });
    render(<Reward />);
    expect(screen.queryByText(/reclaimed/)).toBeNull();
    expect(screen.queryByLabelText(/banked/)).toBeNull();
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
    expect(screen.getByText('Paused')).toBeOnTheScreen();
    // The two exits are still present — the row never blocks them.
    expect(screen.getByText('See your bee')).toBeOnTheScreen();
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
    expect(screen.getByText('Flow')).toBeOnTheScreen();
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
