import { renderHook, act } from '@testing-library/react-native';
import { useTimer } from '../useTimer';
import { useTimerStore } from '@/src/stores/timerStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { createMemoryDatabase } from '@/src/db';

const mockReplace = jest.fn();
const mockDismiss = jest.fn();
jest.mock('expo-router', () => ({
  router: { replace: (...a: unknown[]) => mockReplace(...a), dismiss: (...a: unknown[]) => mockDismiss(...a), push: jest.fn() },
}));

const params = { taskId: undefined, label: 'Write proposal', category: 'Work', estimateMin: 30, guessMin: 25 };

describe('useTimer forgot-to-stop', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useCalibrationStore.getState().setDatabase(createMemoryDatabase());
    // Seed a running session started 32m ago so the hook attaches (no fresh start()).
    const startedAt = Date.now() - 32 * 60_000;
    useTimerStore.setState({ isRunning: true, isQuickStart: false, startedAt, taskLabel: 'Write proposal',
      category: 'Work', estimateMin: 30, guessMin: 25, taskId: null, suggestedHonestMin: 30, pausedAccumMs: 0, guardNudged: false } as never);
  });
  afterEach(() => jest.restoreAllMocks());

  it('onForgotStopAndLog logs a completed retro at the corrected finish and goes to reward', async () => {
    const spy = jest.spyOn(useCalibrationStore.getState(), 'applyLog');
    const { result } = renderHook(() => useTimer(params));
    const startedAt = useTimerStore.getState().startedAt as number;
    const finishMs = startedAt + 17 * 60_000; // "15 min ago" of a 32m elapsed

    await act(async () => { await result.current.onForgotStopAndLog(finishMs, 'preset'); });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed', source: 'retro', actualMin: 17, estimateMin: 25 }),
    );
    expect(mockReplace).toHaveBeenCalledWith('/(modals)/reward');
  });

  it('onForgotNotSure logs a partial retro and dismisses (no reward)', async () => {
    const spy = jest.spyOn(useCalibrationStore.getState(), 'applyLog');
    const { result } = renderHook(() => useTimer(params));

    await act(async () => { await result.current.onForgotNotSure(); });

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ status: 'partial', source: 'retro' }));
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockDismiss).toHaveBeenCalled();
  });
});
