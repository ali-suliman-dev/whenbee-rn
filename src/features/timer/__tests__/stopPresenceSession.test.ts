/**
 * Regression test for the presence "Stop & log" / guardrail "Wrap up" bug:
 * stopping from a notification logged ~0 elapsed against the WRONG category/guess,
 * because the deep link carried no session context and the timer screen restarted
 * a fresh session. The fix logs the running session straight from the STORE.
 */
import { stopPresenceSessionAndLog } from '@/src/features/timer/stopPresenceSession';
import { useTimerStore } from '@/src/stores/timerStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import { useRewardStore } from '@/src/stores/rewardStore';
import { useDayTasksStore } from '@/src/stores/dayTasksStore';
import type { LogResult } from '@/src/stores/calibrationStore';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ router: { replace: (...a: unknown[]) => mockReplace(...a) } }));
jest.mock('@/src/services/timerNotifications', () => ({
  cancelTimerDone: jest.fn(async () => {}),
  cancelGuardCheckIn: jest.fn(async () => {}),
}));
jest.mock('@/src/services/liveActivity', () => ({ endFinishTimeActivity: jest.fn() }));

const okResult: LogResult = {
  eventId: 'evt-1', counted: true, multiplier: 2, sharpness: 50,
  tierBefore: 'Setting', tierAfter: 'Ripening', leveledUp: false,
  reclaimDeltaMin: 0, reclaimLifetimeMin: 0,
};

const STARTED_AT = 1_700_000_000_000;
const applyLogMock = jest.fn(async () => okResult);
const setRewardMock = jest.fn();

beforeEach(() => {
  mockReplace.mockClear();
  applyLogMock.mockClear();
  setRewardMock.mockClear();
  jest.spyOn(Date, 'now').mockReturnValue(STARTED_AT + 10 * 60_000); // +10 min elapsed
  useCalibrationStore.setState({ applyLog: applyLogMock });
  useRewardStore.setState({ setReward: setRewardMock });
  useCategoriesStore.setState({
    categories: [{ id: 'deep_work', name: 'Deep work', adaptSpeed: 'balanced', icon: '', builtIn: false }],
  } as never);
  useDayTasksStore.setState({ completeTask: jest.fn(async () => {}), reload: jest.fn(async () => {}) } as never);
});

afterEach(() => jest.restoreAllMocks());

function seedRunningSession(over: Partial<ReturnType<typeof useTimerStore.getState>> = {}) {
  useTimerStore.setState({
    taskLabel: 'Write report', category: 'deep_work', estimateMin: 20,
    startedAt: STARTED_AT, pausedAccumMs: 0, pausedAt: null, isRunning: true,
    guessMin: 15, taskId: 'task-1', suggestedHonestMin: 20, isQuickStart: false,
    guardNudged: false, ...over,
  });
}

describe('stopPresenceSessionAndLog', () => {
  it('logs REAL elapsed (10m), not ~0, with the running session category + guess', async () => {
    seedRunningSession();
    const outcome = await stopPresenceSessionAndLog();

    expect(outcome).toBe('logged');
    expect(applyLogMock).toHaveBeenCalledTimes(1);
    expect(applyLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actualMin: 10,            // real elapsed, NOT 0
        estimateMin: 15,          // the GUESS, not a default 15-min honest
        category: 'deep_work',    // the running category, not 'getting_ready'
        suggestedHonestMin: 20,
        status: 'completed',
        source: 'timed',
        startedAt: STARTED_AT,
      }),
    );
    // reward reflects the real numbers
    expect(setRewardMock).toHaveBeenCalledWith(
      expect.objectContaining({ actualMin: 10, guessMin: 15, category: 'deep_work', label: 'Write report' }),
    );
    // session cleared
    expect(useTimerStore.getState().isRunning).toBe(false);
  });

  it('folds a paused span into elapsed (does not over-count)', async () => {
    // Paused for 4 of the 10 wall-clock minutes → 6 active minutes.
    seedRunningSession({ pausedAccumMs: 4 * 60_000, pausedAt: null });
    await stopPresenceSessionAndLog();
    expect(applyLogMock).toHaveBeenCalledWith(expect.objectContaining({ actualMin: 6 }));
  });

  it('returns needs-capture for a quick-start session (cannot auto-log without a category)', async () => {
    seedRunningSession({ isQuickStart: true, category: null, taskLabel: '' });
    const outcome = await stopPresenceSessionAndLog();
    expect(outcome).toBe('needs-capture');
    expect(applyLogMock).not.toHaveBeenCalled();
    expect(useTimerStore.getState().isRunning).toBe(true); // untouched
  });

  it('returns none when nothing is running', async () => {
    useTimerStore.setState({ isRunning: false, startedAt: null });
    const outcome = await stopPresenceSessionAndLog();
    expect(outcome).toBe('none');
    expect(applyLogMock).not.toHaveBeenCalled();
  });
});
