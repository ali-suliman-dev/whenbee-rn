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
}));

const baseResult: LogResult = {
  counted: true,
  multiplier: 2.2,
  sharpness: 64,
  tierBefore: 'Setting',
  tierAfter: 'Ripening',
  leveledUp: false,
};

beforeEach(() => {
  mockDismiss.mockClear();
  mockPush.mockClear();
  useRewardStore.getState().clear();
  useCalibrationStore.setState({ logs: 0 });
});

describe('Reward screen', () => {
  it('renders the actual number, the "you guessed" sub, and the honey pct', () => {
    useRewardStore.getState().setReward({
      actualMin: 28,
      guessMin: 15,
      category: 'getting_ready',
      label: 'Leave for work',
      result: baseResult,
    });

    render(<Reward />);

    expect(screen.getByText('28')).toBeOnTheScreen();
    expect(screen.getByText('you guessed 15 — now we both know')).toBeOnTheScreen();
    expect(screen.getByText('64%')).toBeOnTheScreen();
    // Multiplier sub reads the category display name + multiplier.
    expect(
      screen.getByText('Getting ready now reads 2.2× · multiplier updated quietly.'),
    ).toBeOnTheScreen();
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
});
