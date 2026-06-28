/**
 * TDD: first_task_started / first_task_completed gate logic.
 *
 * Verifies that:
 *  1. first_task_started fires when lifetimeNectar === 0 at session start.
 *  2. first_task_started does NOT fire when lifetimeNectar >= 1 (not the first task).
 *  3. first_task_completed fires when lifetimeNectar === 1 after a stop.
 *  4. first_task_completed does NOT fire when lifetimeNectar >= 2 (not the first task).
 *
 * Strategy: render the Timer screen (same pattern as useTimer.notify.test.tsx),
 * mock loadReclaimSummary on the calibrationStore to control lifetimeNectar,
 * and spy on analytics.capture to assert event emission.
 */

import { render, fireEvent } from '@testing-library/react-native';
import Timer from '@/src/app/(modals)/timer';
import { useTimerStore } from '@/src/stores/timerStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useDayTasksStore } from '@/src/stores/dayTasksStore';
import { useRewardStore } from '@/src/stores/rewardStore';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { analytics } from '@/src/services/analytics';
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

// ── service mocks ──────────────────────────────────────────────────────────────

jest.mock('@/src/services/timerNotifications', () => ({
  ensureNotificationPermission: jest.fn(async () => true),
  scheduleTimerDone: jest.fn(async () => {}),
  cancelTimerDone: jest.fn(async () => {}),
  scheduleGuardCheckIn: jest.fn(async () => {}),
  cancelGuardCheckIn: jest.fn(async () => {}),
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

// ── analytics spy ──────────────────────────────────────────────────────────────

const captureSpy = jest.spyOn(analytics, 'capture').mockImplementation(() => {});

// ── shared fixtures ────────────────────────────────────────────────────────────

const okResult: LogResult = {
  eventId: 'evt-first',
  counted: true,
  multiplier: 1.5,
  sharpness: 20,
  tierBefore: 'Raw',
  tierAfter: 'Setting',
  leveledUp: true,
  reclaimDeltaMin: 3,
  reclaimLifetimeMin: 3,
};

const TIMER_PARAMS: Record<string, string> = {
  taskId: 'task-first',
  label: 'First task ever',
  category: 'work',
  estimateMin: '25',
  guessMin: '20',
  suggestedHonestMin: '25',
};

/** Build a minimal ReclaimSummary stub with the given lifetimeNectar.
 * Return type is inferred (not annotated) to avoid strictness issues with
 * the CompanionCapability shape in the mock context — same pattern as the
 * existing useNotifSoftAsk.test.ts. */
function makeReclaimSummary(lifetimeNectar: number) {
  return {
    lifetimeMin: 0,
    byCategory: [],
    biggestArea: null,
    honestLogCount: lifetimeNectar,
    companion: {
      stage: 1 as const,
      capability: 'timer' as unknown,
      keeper: false,
      lifetimeNectar,
      driftHealth: 'settled' as const,
      seed: 1,
      name: null,
    },
    discoveryCount: 0,
  };
}

/** Flush microtasks so async analytics blocks resolve. */
async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

// ── setup / teardown ───────────────────────────────────────────────────────────

function resetStores(lifetimeNectarAtStart: number, lifetimeNectarAfterLog: number) {
  const mockApplyLog = jest.fn(async () => okResult);
  const mockLoadAtStart = jest.fn().mockResolvedValue(makeReclaimSummary(lifetimeNectarAtStart));
  // After stop the hook calls loadReclaimSummary again — return the post-log count.
  const mockLoadAfterLog = jest.fn().mockResolvedValue(makeReclaimSummary(lifetimeNectarAfterLog));

  // First call (on start) returns lifetimeNectarAtStart; second call (after stop) returns after.
  let callCount = 0;
  const mockLoad = jest.fn(async () => {
    callCount += 1;
    return callCount === 1
      ? mockLoadAtStart()
      : mockLoadAfterLog();
  });

  useTimerStore.setState({
    taskLabel: null,
    category: null,
    estimateMin: 0,
    startedAt: null,
    pausedAccumMs: 0,
    pausedAt: null,
    isRunning: false,
    guessMin: 0,
    taskId: null,
    suggestedHonestMin: 0,
    isQuickStart: false,
    guardNudged: false,
  });

  useDayTasksStore.setState({
    dayTasks: [],
    completeTask: jest.fn(async () => {}),
    reload: jest.fn(async () => {}),
  });
  useRewardStore.getState().clear();
  useCalibrationStore.setState({
    applyLog: mockApplyLog,
    loadReclaimSummary: mockLoad,
  });

  useSettingsStore.setState({
    remindersEnabled: false,
    honestReachedEnabled: false,
    hyperfocusGuard: 'off',
  });

  return { mockApplyLog, mockLoad };
}

beforeEach(() => {
  captureSpy.mockClear();
  mockParams = { ...TIMER_PARAMS };
});

afterAll(() => {
  captureSpy.mockRestore();
});

// ── tests ─────────────────────────────────────────────────────────────────────

describe('useTimer — first_task_started gate', () => {
  it('fires first_task_started when lifetimeNectar is 0 at session start', async () => {
    resetStores(0, 1);
    render(<Timer />);
    await flushMicrotasks();

    expect(captureSpy).toHaveBeenCalledWith('first_task_started');
  });

  it('does NOT fire first_task_started when lifetimeNectar is 1 (not first task)', async () => {
    resetStores(1, 2);
    render(<Timer />);
    await flushMicrotasks();

    const calls = captureSpy.mock.calls.map(([event]) => event);
    expect(calls).not.toContain('first_task_started');
  });

  it('does NOT fire first_task_started when lifetimeNectar is 5 (veteran user)', async () => {
    resetStores(5, 6);
    render(<Timer />);
    await flushMicrotasks();

    const calls = captureSpy.mock.calls.map(([event]) => event);
    expect(calls).not.toContain('first_task_started');
  });
});

describe('useTimer — first_task_completed gate', () => {
  it('fires first_task_completed when lifetimeNectar is 1 after stop (first completion)', async () => {
    resetStores(0, 1);
    const { getByText } = render(<Timer />);
    await flushMicrotasks();
    captureSpy.mockClear(); // ignore start-phase events

    // Tap the Stop button to trigger onStopAndLog.
    fireEvent.press(getByText('Stop & log'));
    await flushMicrotasks();

    expect(captureSpy).toHaveBeenCalledWith('first_task_completed');
  });

  it('does NOT fire first_task_completed when lifetimeNectar is 2 after stop (not first)', async () => {
    resetStores(1, 2);
    const { getByText } = render(<Timer />);
    await flushMicrotasks();
    captureSpy.mockClear();

    fireEvent.press(getByText('Stop & log'));
    await flushMicrotasks();

    const calls = captureSpy.mock.calls.map(([event]) => event);
    expect(calls).not.toContain('first_task_completed');
  });
});
