/**
 * Regression: the timer sheet must not become a zombie when the running session is
 * cleared EXTERNALLY (useForgotCheck.stopSilently() firing on unlock past the
 * forgot-close threshold).
 *
 * The clock is driven off a captured startedAtRef + a self-arming frame callback,
 * so without this guard the mounted sheet keeps ticking after stopSilently() clears
 * the store, occludes the recovery ForgotCard, and its "Stop & log" writes a FAKE
 * 1-min completion (stop() against a cleared store → actualMin = 1) — optimistic
 * bias, the opposite of the feature, plus a double-log of a session already parked
 * for recovery.
 *
 * THE FIX: useTimer subscribes to the store's own startedAt. A transition to null
 * that this screen did NOT initiate tears down cleanly (stop ticking, cancel pings,
 * dismiss the route) WITHOUT calling applyLog — the ForgotCard owns the recovery log.
 *
 * Strategy: mount the real Timer attached to a pre-set running session (so mount
 * does NOT call start()), then call stopSilently() inside act() to simulate the
 * external clear, and assert (a) applyLog was never called and (b) the route was
 * dismissed.
 */

import { render, act, fireEvent, waitFor } from '@testing-library/react-native';
import Timer from '@/src/app/(modals)/timer';
import { useTimerStore } from '@/src/stores/timerStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useDayTasksStore } from '@/src/stores/dayTasksStore';
import { useRewardStore } from '@/src/stores/rewardStore';
import type { LogResult } from '@/src/stores/calibrationStore';

// ── router + route params ─────────────────────────────────────────────────────

const mockReplace = jest.fn();
const mockDismiss = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  router: {
    replace: (...a: unknown[]) => mockReplace(...a),
    dismiss: (...a: unknown[]) => mockDismiss(...a),
    push: jest.fn(),
  },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (cb: () => void | (() => void)) => cb(),
}));

// Keep the suite hermetic: stub the native-backed services the teardown + stop
// paths touch (no real expo-notifications require, no Live Activity bridge).
jest.mock('@/src/services/timerNotifications', () => ({
  ensureNotificationPermission: jest.fn(async () => true),
  scheduleTimerDone: jest.fn(async () => {}),
  cancelTimerDone: jest.fn(async () => {}),
  scheduleGuardCheckIn: jest.fn(async () => {}),
  cancelGuardCheckIn: jest.fn(async () => {}),
  scheduleStartBy: jest.fn(async () => {}),
  cancelStartBy: jest.fn(async () => {}),
}));

jest.mock('@/src/services/liveActivity', () => ({
  presenceAvailable: () => false,
  isFinishTimeActivityActive: () => false,
  startFinishTimeActivity: jest.fn(),
  updateFinishTimeActivity: jest.fn(),
  endFinishTimeActivity: jest.fn(),
  publishWidgetSnapshot: jest.fn(),
  clearWidgetSnapshot: jest.fn(),
}));

const okResult: LogResult = {
  eventId: 'evt-test',
  counted: true,
  multiplier: 2,
  sharpness: 50,
  tierBefore: 'Setting',
  tierAfter: 'Ripening',
  leveledUp: true,
  reclaimDeltaMin: 0,
  reclaimLifetimeMin: 0,
};

const STARTED_AT = 1_700_000_000_000;
let mockApplyLog: jest.Mock;

beforeEach(() => {
  mockReplace.mockClear();
  mockDismiss.mockClear();
  mockApplyLog = jest.fn(async () => okResult);

  // A running, CATEGORISED session already in the store — the timer ATTACHES to it
  // (mount does not call start()), matching a session reopened from the timer bar.
  useTimerStore.setState({
    taskLabel: 'Deep work',
    category: 'work',
    estimateMin: 30,
    startedAt: STARTED_AT,
    pausedAccumMs: 0,
    pausedAt: null,
    isRunning: true,
    guessMin: 20,
    taskId: 'task-forgot-1',
    suggestedHonestMin: 30,
    isQuickStart: false,
    guardNudged: false,
  });

  mockParams = {
    taskId: 'task-forgot-1',
    label: 'Deep work',
    category: 'work',
    estimateMin: '30',
    guessMin: '20',
    suggestedHonestMin: '30',
  };

  useDayTasksStore.setState({
    dayTasks: [],
    completeTask: jest.fn(async () => {}),
    reload: jest.fn(async () => {}),
  });
  useRewardStore.getState().clear();
  useCalibrationStore.setState({ applyLog: mockApplyLog });
});

describe('useTimer — external stopSilently teardown', () => {
  it('dismisses the sheet and writes NO log when the session is cleared externally', () => {
    render(<Timer />);

    // Sanity: attached, nothing logged yet.
    expect(mockApplyLog).not.toHaveBeenCalled();
    expect(mockDismiss).not.toHaveBeenCalled();

    // Simulate useForgotCheck detecting the runaway and stopping it silently.
    act(() => {
      useTimerStore.getState().stopSilently();
    });

    // The screen must tear down (dismiss) WITHOUT training a fake/double log.
    expect(mockDismiss).toHaveBeenCalledTimes(1);
    expect(mockApplyLog).not.toHaveBeenCalled();
    // The store stays cleared — no zombie session revived by the screen.
    expect(useTimerStore.getState().startedAt).toBeNull();
  });

  it('routes a normal local Stop to reward and never fires the external-clear dismiss', async () => {
    const { getByText } = render(<Timer />);

    fireEvent.press(getByText('Stop & log'));

    // The local stop logs and routes to reward; the store clears as part of stop(),
    // but stoppingLocallyRef keeps the external-clear guard from also dismissing.
    await waitFor(() => {
      expect(mockApplyLog).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith('/(modals)/reward');
    });
    expect(mockDismiss).not.toHaveBeenCalled();
  });
});
