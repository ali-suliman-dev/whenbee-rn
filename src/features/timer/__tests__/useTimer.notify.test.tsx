/**
 * useTimer — notification scheduling wiring tests.
 *
 * Verifies three properties of the session-start notification block:
 *   1. presence inactive  → scheduleTimerDone IS called (banner is the only signal)
 *   2. presence available + activity active → scheduleTimerDone NOT called (ring carries it)
 *   3. guard threshold within 60 s of the honest anchor → scheduleGuardCheckIn NOT called
 *
 * Strategy: render the real Timer screen (same synchronous pattern as
 * useTimer.quickstart.test.tsx), then flush the microtask queue with
 * `await Promise.resolve()` chains so the async notify block has time to run.
 *
 * Mocks: timerNotifications (track calls), liveActivity (controllable state),
 * settingsStore (remindersEnabled + honestReachedEnabled), useEntitlement (isPro).
 */

import { render } from '@testing-library/react-native';
import Timer from '@/src/app/(modals)/timer';
import { useTimerStore } from '@/src/stores/timerStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useDayTasksStore } from '@/src/stores/dayTasksStore';
import { useRewardStore } from '@/src/stores/rewardStore';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import type { LogResult } from '@/src/stores/calibrationStore';
import { kv } from '@/src/lib/kv';

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

// ── engine mock (allows controlling guardrailThresholdMin) ───────────────────
// We need the real engine for most things but want to control guardrailThresholdMin
// so we can construct a guard-vs-honest collision that the real factors don't produce.
let mockGuardrailThresholdMin: number | null = null;
jest.mock('@/src/engine', () => {
  const real = jest.requireActual<typeof import('@/src/engine')>('@/src/engine');
  return {
    ...real,
    guardrailThresholdMin: () => mockGuardrailThresholdMin,
  };
});

// ── timerNotifications mock ───────────────────────────────────────────────────
// Declared with `mock` prefix to pass jest hoisting checks. Actual jest.fn()
// instances are taken from the module after mocking via requireMock in beforeEach.
jest.mock('@/src/services/timerNotifications', () => ({
  ensureNotificationPermission: jest.fn(async () => true),
  scheduleTimerDone: jest.fn(async () => {}),
  cancelTimerDone: jest.fn(async () => {}),
  scheduleGuardCheckIn: jest.fn(async () => {}),
  cancelGuardCheckIn: jest.fn(async () => {}),
  scheduleStartBy: jest.fn(async () => {}),
  cancelStartBy: jest.fn(async () => {}),
}));

// Resolved in beforeAll after the mocks are registered.
let mockScheduleTimerDone: jest.Mock;
let mockScheduleGuardCheckIn: jest.Mock;

// ── liveActivity mock (controllable per test) ─────────────────────────────────

const presence = { available: false, active: false };

jest.mock('@/src/services/liveActivity', () => ({
  presenceAvailable: () => presence.available,
  isFinishTimeActivityActive: () => presence.active,
  startFinishTimeActivity: jest.fn(),
  updateFinishTimeActivity: jest.fn(),
  endFinishTimeActivity: jest.fn(),
  publishWidgetSnapshot: jest.fn(),
  clearWidgetSnapshot: jest.fn(),
}));

// ── Shared fixtures ────────────────────────────────────────────────────────────

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

/** Route params for a normal timer session with a 30-min honest anchor. */
const NORMAL_PARAMS: Record<string, string> = {
  taskId: 'task-notify-1',
  label: 'Write test',
  category: 'work',
  estimateMin: '30',
  guessMin: '20',
  suggestedHonestMin: '30',
};

/** Flush the microtask queue (enough passes for the async notify IIFE). */
async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

/** Reset all stores and call-count tracking between each test. */
function resetAll(): void {
  mockScheduleTimerDone.mockClear();
  mockScheduleGuardCheckIn.mockClear();
  mockGuardrailThresholdMin = null; // guard not armed by default
  presence.available = false;
  presence.active = false;

  // The mocked KV store (jest.setup.js) is a module-level Map that survives
  // across tests in this file — a persisted session from a prior test's start()
  // would otherwise leak into the next test's TimerGate hydration (resumeFromKv).
  kv.delete('whenbee.activeTimer');

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

  useDayTasksStore.setState({ dayTasks: [] });
  useRewardStore.getState().clear();
  useCalibrationStore.setState({
    applyLog: jest.fn(async () => okResult),
  });

  // Enable notifications + honest-reached toggle so they're not the gatekeepers.
  useSettingsStore.setState({
    remindersEnabled: true,
    honestReachedEnabled: true,
    hyperfocusGuard: 'off',
  });

  // Default: not Pro (so guard doesn't arm unless the test enables it).
  useEntitlement.setState({ isPro: false });
}

beforeAll(() => {
  // Resolve the jest.fn() instances from the registered module mock.
  const notifyMod = jest.requireMock('@/src/services/timerNotifications') as {
    scheduleTimerDone: jest.Mock;
    scheduleGuardCheckIn: jest.Mock;
  };
  mockScheduleTimerDone = notifyMod.scheduleTimerDone;
  mockScheduleGuardCheckIn = notifyMod.scheduleGuardCheckIn;
});

beforeEach(resetAll);
afterEach(() => jest.clearAllMocks());

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useTimer notification scheduling', () => {
  /**
   * Case 1: no presence → banner is the only way to know the honest time is up.
   * scheduleTimerDone MUST be called.
   */
  it('schedules the honest-reached banner when Live Activity is not active', async () => {
    presence.available = false;
    presence.active = false;
    mockParams = { ...NORMAL_PARAMS };

    render(<Timer />);
    await flushMicrotasks();

    expect(mockScheduleTimerDone).toHaveBeenCalledTimes(1);
  });

  /**
   * Case 2: presence available AND activity active → the Live Activity ring is
   * already signalling the moment; the banner would be redundant. Skip it.
   */
  it('suppresses the honest-reached banner when Live Activity is carrying the moment', async () => {
    presence.available = true;
    presence.active = true;
    mockParams = { ...NORMAL_PARAMS };

    render(<Timer />);
    await flushMicrotasks();

    expect(mockScheduleTimerDone).toHaveBeenCalledTimes(0);
  });

  /**
   * Case 3: guard threshold within 60 s of the honest anchor → skip the guard ping.
   *
   * The real engine factors (1.5×, 2×, 3×) always place the guard AFTER the honest
   * anchor, so a natural collision can't be constructed with real params. We instead
   * mock guardrailThresholdMin to return exactly suggestedHonestMin (30 min) — a
   * zero-second gap, well within the 60 s threshold — then confirm no guard call.
   * This tests the wiring in useTimer rather than the engine's math (which has its
   * own unit tests in notifyTiming.test.ts).
   */
  it('skips the guard ping when it collides with the honest-reached anchor', async () => {
    presence.available = false;
    presence.active = false;

    const HONEST_MIN = 30;
    mockParams = {
      taskId: 'task-notify-2',
      label: 'Write test',
      category: 'work',
      estimateMin: `${HONEST_MIN}`,
      guessMin: '20',
      suggestedHonestMin: `${HONEST_MIN}`,
    };

    useSettingsStore.setState({
      remindersEnabled: true,
      honestReachedEnabled: true,
      hyperfocusGuard: '1.5x',
    });

    // Arm Pro so the guard block executes.
    useEntitlement.setState({ isPro: true });

    // Make the engine return a guard threshold equal to the honest anchor →
    // zero-second gap → guaranteed collision.
    mockGuardrailThresholdMin = HONEST_MIN;

    render(<Timer />);
    await flushMicrotasks();

    // Guard ping should be skipped due to collision.
    expect(mockScheduleGuardCheckIn).toHaveBeenCalledTimes(0);
    // Honest banner should still fire (guard suppression is independent).
    expect(mockScheduleTimerDone).toHaveBeenCalledTimes(1);
  });

  /**
   * Case 4: a FREE user (not Pro) still gets the gentle forgot-to-stop nudge,
   * armed off the `forgotStepIn` preset rather than the Pro `hyperfocusGuard`.
   * 'balanced' factor is 1.5x, so a 60-min honest anchor arms at 90 min —
   * comfortably clear of the honest-reached collision window.
   */
  it('arms the free forgot-to-stop nudge for a non-Pro user at the forgotStepIn threshold', async () => {
    presence.available = false;
    presence.active = false;

    mockParams = {
      taskId: 'task-notify-free',
      label: 'Write test',
      category: 'work',
      estimateMin: '60',
      guessMin: '40',
      suggestedHonestMin: '60',
    };

    useSettingsStore.setState({
      remindersEnabled: true,
      honestReachedEnabled: true,
      hyperfocusGuard: 'off',
      forgotStepIn: 'balanced',
    });

    // Not Pro — the Pro guardrail path must not be the one that arms.
    useEntitlement.setState({ isPro: false });

    render(<Timer />);
    await flushMicrotasks();

    // The free nudge is armed and scheduled at the forgotStepIn threshold (90 min).
    expect(mockScheduleGuardCheckIn).toHaveBeenCalledTimes(1);
    expect(mockScheduleGuardCheckIn).toHaveBeenCalledWith(
      expect.objectContaining({ thresholdMin: 90 }),
    );
  });
});
