import { act, render } from '@testing-library/react-native';
import { ActiveTimerBar } from '../ActiveTimerBar';
import { useTimerStore } from '@/src/stores/timerStore';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

function setRunning(overrides: Partial<ReturnType<typeof useTimerStore.getState>> = {}) {
  useTimerStore.setState({
    isRunning: true,
    startedAt: Date.now(),
    taskLabel: 'Email',
    category: 'work',
    estimateMin: 20,
    guessMin: 20,
    taskId: null,
    suggestedHonestMin: 20,
    isQuickStart: false,
    ...overrides,
  });
}

describe('ActiveTimerBar — overrun amber + over-count', () => {
  afterEach(() => {
    act(() => {
      useTimerStore.setState({ isRunning: false, startedAt: null });
    });
  });

  it('shows no over-label before the honest number is reached', () => {
    // startedAt "now" means elapsedMin is 0, well under a 20min honest estimate.
    setRunning({ suggestedHonestMin: 20 });
    const { queryByText } = render(<ActiveTimerBar />);
    expect(queryByText(/over$/)).toBeNull();
  });

  it('shows the amber "+Nm over" label once elapsed passes the honest number', () => {
    const startedAt = Date.now() - 27 * 60_000; // 27 min ago
    setRunning({ startedAt, suggestedHonestMin: 20 });
    const { getByText } = render(<ActiveTimerBar />);
    expect(getByText('+7m over')).toBeTruthy();
  });
});
