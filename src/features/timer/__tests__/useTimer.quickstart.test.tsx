/**
 * Integration test: quick-start session survives navigation.
 *
 * Regression test for the bug where mounting the timer screen after
 * quickStart() + router.push('/(modals)/timer', { quick: '1' }) would
 * call start() via the mount effect (startedFresh=true), which set
 * isQuickStart=false and overwrote the bare session with placeholder
 * params — making the capture sheet never show on Stop.
 *
 * THE FIX: when isQuickNav=true and the store already has an
 * isRunning+isQuickStart session, useTimer attaches to it (no start() call).
 *
 * Strategy: render the full Timer screen (same as timerScreen.test.tsx) with
 * mockParams set to { quick: '1' } and no label/category/estimate params.
 * After mount, assert isQuickStart is still true in the store.
 */

import { render } from '@testing-library/react-native';
import Timer from '@/src/app/(modals)/timer';
import { useTimerStore } from '@/src/stores/timerStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useTasksStore } from '@/src/stores/tasksStore';
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
}));

// ── Other mocks (mirrors timerScreen.test.tsx) ────────────────────────────────

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

// ── Setup ─────────────────────────────────────────────────────────────────────

const QUICK_STARTED_AT = 1_700_000_000_000;

beforeEach(() => {
  mockReplace.mockClear();
  mockDismiss.mockClear();
  mockParams = {};
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
  });
  useTasksStore.setState({ tasks: [] });
  useRewardStore.getState().clear();
  useCalibrationStore.setState({
    applyLog: jest.fn(async () => okResult),
  });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('quick-start navigation regression', () => {
  it('REGRESSION: isQuickStart stays true after Timer mounts with quick=1', () => {
    // 1. Simulate quickStart() called before navigation (arc timer tap)
    useTimerStore.getState().quickStart(QUICK_STARTED_AT);

    expect(useTimerStore.getState().isQuickStart).toBe(true);
    expect(useTimerStore.getState().isRunning).toBe(true);
    expect(useTimerStore.getState().startedAt).toBe(QUICK_STARTED_AT);

    // 2. Simulate router.push({ pathname: '/(modals)/timer', params: { quick: '1' } })
    //    No label/category/estimate — they're absent from params (quick-start has no task context).
    mockParams = { quick: '1' };

    // 3. Mount the Timer screen (the mount effect runs useTimer with isQuickNav=true)
    render(<Timer />);

    // 4. THE CRITICAL ASSERTION: isQuickStart must still be true.
    //    Before the fix: startedFresh=true -> start() called -> isQuickStart=false.
    expect(useTimerStore.getState().isQuickStart).toBe(true);
    expect(useTimerStore.getState().isRunning).toBe(true);
    // startedAt must not be overwritten (attach, not restart)
    expect(useTimerStore.getState().startedAt).toBe(QUICK_STARTED_AT);
  });

  it('normal timer launch still starts a fresh session (no regression on normal path)', () => {
    // Normal launch: params have label + category + estimate, no quick flag
    mockParams = {
      taskId: 'task-1',
      label: 'Leave for work',
      category: 'getting_ready',
      estimateMin: '28',
      guessMin: '15',
      suggestedHonestMin: '28',
    };

    render(<Timer />);

    const st = useTimerStore.getState();
    expect(st.isRunning).toBe(true);
    expect(st.isQuickStart).toBe(false);
    expect(st.taskLabel).toBe('Leave for work');
    expect(st.category).toBe('getting_ready');
  });

  it('re-attaches to a running normal session without restarting it (existing behaviour preserved)', () => {
    // Simulate a running session (re-opened from ActiveTimerBar)
    useTimerStore.setState({
      taskLabel: 'Leave for work',
      category: 'getting_ready',
      estimateMin: 28,
      guessMin: 15,
      taskId: 'task-1',
      suggestedHonestMin: 28,
      startedAt: 123456,
      pausedAccumMs: 0,
      pausedAt: null,
      isRunning: true,
      isQuickStart: false,
    });

    mockParams = {
      taskId: 'task-1',
      label: 'Leave for work',
      category: 'getting_ready',
      estimateMin: '28',
      guessMin: '15',
      suggestedHonestMin: '28',
    };

    render(<Timer />);

    // Must attach: startedAt stays unchanged
    expect(useTimerStore.getState().startedAt).toBe(123456);
    expect(useTimerStore.getState().isRunning).toBe(true);
  });
});
