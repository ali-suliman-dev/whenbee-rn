import { render, fireEvent, waitFor } from '@testing-library/react-native';
import Timer from '@/src/app/(modals)/timer';
import { useTimerStore } from '@/src/stores/timerStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { createMemoryDatabase } from '@/src/db';

const mockReplace = jest.fn();
const mockDismiss = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { replace: (...a: unknown[]) => mockReplace(...a), dismiss: (...a: unknown[]) => mockDismiss(...a), push: jest.fn() },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (cb: () => void | (() => void)) => cb(),
  Redirect: () => null,
}));

// PaceLabel's overrun gate is driven by a UI-thread reaction that never fires
// under jest's mocked reanimated (see FinishTime.test.tsx) — that gating is
// covered by PaceLabel's own unit test. This screen test only cares that the
// forgot affordance, when rendered, opens the sheet and logs a corrected retro;
// stub PaceLabel down to just the onForgotPress trigger it exposes.
jest.mock('@/src/features/timer/PaceLabel', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pressable, Text } = require('react-native');
  return {
    PaceLabel: ({ onForgotPress }: { onForgotPress?: () => void }) =>
      onForgotPress ? (
        <Pressable onPress={onForgotPress} accessibilityRole="button" accessibilityLabel="Forgot to stop the timer earlier">
          <Text>Forgot to stop?</Text>
        </Pressable>
      ) : null,
  };
});

describe('Timer screen — forgot-to-stop', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useCalibrationStore.getState().setDatabase(createMemoryDatabase());
    const startedAt = Date.now() - 32 * 60_000;
    mockParams = { label: 'Write proposal', category: 'Work', estimateMin: '30', guessMin: '25' };
    useTimerStore.setState({ isRunning: true, isQuickStart: false, startedAt, taskLabel: 'Write proposal',
      category: 'Work', estimateMin: 30, guessMin: 25, taskId: null, suggestedHonestMin: 30, pausedAccumMs: 0, guardNudged: false } as never);
  });

  it('opens the sheet from the link and logs a corrected retro on a preset', async () => {
    const spy = jest.spyOn(useCalibrationStore.getState(), 'applyLog');
    const { getByText } = render(<Timer />);
    fireEvent.press(getByText(/forgot to stop/i));
    fireEvent.press(getByText(/~15 min ago/));
    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed', source: 'retro', actualMin: 17 }));
      expect(mockReplace).toHaveBeenCalledWith('/(modals)/reward');
    });
  });

  it('hides the link on a quick-start session', () => {
    useTimerStore.setState({ isQuickStart: true } as never);
    mockParams = { quick: '1' };
    const { queryByText } = render(<Timer />);
    expect(queryByText(/forgot to stop/i)).toBeNull();
  });
});
