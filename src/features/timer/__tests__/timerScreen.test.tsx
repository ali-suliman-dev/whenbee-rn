import { render, screen, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import Timer from '@/src/app/(modals)/timer';
import { useTimerStore } from '@/src/stores/timerStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useDayTasksStore } from '@/src/stores/dayTasksStore';
import { useRewardStore } from '@/src/stores/rewardStore';
import type { LogResult, ReclaimSummary } from '@/src/stores/calibrationStore';
import { capabilityFor } from '@/src/engine';
import { kv } from '@/src/lib/kv';

// ── router + route params ─────────────────────────────────────────────────────
// `mock`-prefixed so jest's factory-hoisting allows referencing them.
const mockReplace = jest.fn();
const mockDismiss = jest.fn();
const mockRedirect = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  router: {
    replace: (...a: unknown[]) => mockReplace(...a),
    dismiss: (...a: unknown[]) => mockDismiss(...a),
  },
  Redirect: ({ href }: { href: string }) => {
    mockRedirect(href);
    return null;
  },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (cb: () => void | (() => void)) => cb(),
  useNavigation: () => ({
    isFocused: () => true,
    addListener: () => () => {},
  }),
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

let alertSpy: jest.SpyInstance;

beforeEach(() => {
  mockReplace.mockClear();
  mockDismiss.mockClear();
  mockRedirect.mockClear();
  kv.delete('whenbee.activeTimer');
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockParams = {
    taskId: 'task-1',
    label: 'Leave for work',
    category: 'getting_ready',
    estimateMin: '28',
    guessMin: '15',
    suggestedHonestMin: '28',
  };
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
    // Confirming a task switch calls promoteToFocus — stub it so it doesn't
    // hit the real (unavailable-in-tests) sqlite adapter.
    promoteToFocus: jest.fn(async () => {}),
  });
  useRewardStore.getState().clear();
  // Stub applyLog so we don't touch the DB; capture its calls. Also stub
  // loadReclaimSummary — the mount effect's first_task_started check calls it
  // fire-and-forget; without a stub it hits the real (unavailable-in-tests)
  // sqlite adapter and rejects, which a same-act() fresh mount (e.g. confirming
  // a task switch) surfaces as a failing act() call.
  useCalibrationStore.setState({
    applyLog: jest.fn(async () => okResult),
    loadReclaimSummary: jest.fn(async (): Promise<ReclaimSummary> => ({
      lifetimeMin: 0,
      byCategory: [],
      biggestArea: null,
      honestLogCount: 1,
      companion: {
        stage: 1,
        capability: capabilityFor(1),
        keeper: false,
        lifetimeNectar: 1,
        driftHealth: 'settled',
        seed: 1,
        name: null,
      },
      discoveryCount: 0,
    })),
  });
});

describe('Live Timer screen', () => {
  // NOTE: these assert the resulting store STATE rather than spying `start`.
  // jest.spyOn(store, 'start') doesn't reliably restore on this zustand singleton
  // (the spy leaks across tests and stops calling through), which would mask a
  // real fresh-start. Asserting the effect is both robust and what we care about.
  it('starts the timer store on mount with the full calibration params', () => {
    render(<Timer />);
    const st = useTimerStore.getState();
    expect(st.isRunning).toBe(true);
    expect(typeof st.startedAt).toBe('number');
    expect(st.taskLabel).toBe('Leave for work');
    expect(st.category).toBe('getting_ready');
    expect(st.estimateMin).toBe(28);
    expect(st.guessMin).toBe(15);
    expect(st.taskId).toBe('task-1');
    expect(st.suggestedHonestMin).toBe(28);
  });

  it('attaches to a running session instead of restarting (preserves startedAt)', () => {
    // A session is already running for this task (e.g. reopened from the bar).
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
    });
    render(<Timer />);
    // A restart would overwrite startedAt with Date.now(); attach keeps it.
    expect(useTimerStore.getState().startedAt).toBe(123456);
    expect(useTimerStore.getState().isRunning).toBe(true);
  });

  it('✕ minimizes: dismisses the sheet but keeps the timer running (no log)', () => {
    render(<Timer />);
    const applyLog = useCalibrationStore.getState().applyLog as jest.Mock;
    fireEvent.press(screen.getByLabelText('Minimize timer'));
    expect(mockDismiss).toHaveBeenCalled();
    expect(useTimerStore.getState().isRunning).toBe(true);
    expect(applyLog).not.toHaveBeenCalled();
  });

  it('renders the task title and the de-arrowed guess/honest ledger (honest = amber value)', () => {
    render(<Timer />);
    expect(screen.getByText('Leave for work')).toBeOnTheScreen();
    // Two separate ledger rows now — no arrow between them.
    expect(screen.getByText('Your guess')).toBeOnTheScreen();
    expect(screen.getByText('Honest')).toBeOnTheScreen();
    expect(screen.getByText('15m')).toBeOnTheScreen();
    expect(screen.getByText('~28m')).toBeOnTheScreen();
    // Finish row is present (Started/Finish clocks are dynamic, so assert labels).
    expect(screen.getByText('Started')).toBeOnTheScreen();
    expect(screen.getByText('Finish ~')).toBeOnTheScreen();
  });

  it('Stop & log: applyLog completed/timed with the GUESS (not honest), hands off, navigates to reward', async () => {
    render(<Timer />);
    const applyLog = useCalibrationStore.getState().applyLog as jest.Mock;

    fireEvent.press(screen.getByText('Stop & log'));
    // flush the async stop handler
    await Promise.resolve();
    await Promise.resolve();

    expect(applyLog).toHaveBeenCalledTimes(1);
    const arg = applyLog.mock.calls[0][0];
    expect(arg.status).toBe('completed');
    expect(arg.source).toBe('timed');
    // CRITICAL: calibration trains on the naïve GUESS (15), not the honest
    // estimate (28). ratio = actual / guess, so estimateMin passed to engine
    // must be guessMin. A guess=15, actual=30 produces mEffective≈2.0.
    expect(arg.estimateMin).toBe(15);
    // NOT 28 (the honest ring target) — that would corrupt the model.
    expect(arg.estimateMin).not.toBe(28);
    expect(arg.category).toBe('getting_ready');
    // The honest number the user SAW is banked for reclaim.
    expect(arg.suggestedHonestMin).toBe(28);
    // focus-window wiring: startedAt (session start epoch) must be passed so
    // startLocalMinute is populated; a missing/null value means no learning.
    expect(typeof arg.startedAt).toBe('number');
    expect(arg.startedAt).toBeGreaterThan(0);

    // Reward hand-off populated + task removed + navigation.
    expect(useRewardStore.getState().guessMin).toBe(15);
    expect(useRewardStore.getState().result).toEqual(okResult);
    expect(mockReplace).toHaveBeenCalledWith('/(modals)/reward');
  });

  it('suggestedHonestMin defaults to estimateMin when not passed as a route param', async () => {
    delete (mockParams as Record<string, string>).suggestedHonestMin;
    render(<Timer />);
    const applyLog = useCalibrationStore.getState().applyLog as jest.Mock;

    fireEvent.press(screen.getByText('Stop & log'));
    await Promise.resolve();
    await Promise.resolve();

    const arg = applyLog.mock.calls[0][0];
    // Falls back to estimateMin (the honest ring target = 28).
    expect(arg.suggestedHonestMin).toBe(28);
    // Calibration driver still uses the guess.
    expect(arg.estimateMin).toBe(15);
  });

  it('falls back to estimateMin as the guess when guessMin param is absent', async () => {
    delete (mockParams as Record<string, string>).guessMin;
    render(<Timer />);
    const applyLog = useCalibrationStore.getState().applyLog as jest.Mock;

    fireEvent.press(screen.getByText('Stop & log'));
    await Promise.resolve();
    await Promise.resolve();

    expect(applyLog.mock.calls[0][0].estimateMin).toBe(28); // fell back to estimate
  });

  // ── Bare deep-link opens (presence-notification body tap, widget, quick chips) ──
  // The route can arrive with NO params while a session runs. The store is the
  // source of truth for a running session: the screen must ATTACH with the
  // store's context, never restart with placeholder defaults (the exact bug:
  // notification tap replaced the running timer with a fresh untitled
  // "Focus session" and reset the clock).

  const runningSession = {
    taskLabel: 'Leave for work',
    category: 'errands',
    estimateMin: 28,
    guessMin: 15,
    taskId: 'task-1',
    suggestedHonestMin: 28,
    startedAt: 123456,
    pausedAccumMs: 0,
    pausedAt: null,
    isRunning: true,
    isQuickStart: false,
    guardNudged: false,
  };

  it('bare open (no params) while a session runs: attaches with the STORE context', () => {
    useTimerStore.setState(runningSession);
    mockParams = {};
    render(<Timer />);
    const st = useTimerStore.getState();
    // Not restarted: clock and session context intact.
    expect(st.startedAt).toBe(123456);
    expect(st.taskLabel).toBe('Leave for work');
    expect(st.category).toBe('errands');
    // The screen shows the REAL session, not the 'Focus session' placeholder.
    expect(screen.getByText('Leave for work')).toBeOnTheScreen();
    expect(screen.getByText('~28m')).toBeOnTheScreen();
    expect(screen.queryByText('Focus session')).toBeNull();
  });

  it('bare open attach: Stop & log trains the STORE category + guess, not defaults', async () => {
    useTimerStore.setState(runningSession);
    mockParams = {};
    render(<Timer />);
    const applyLog = useCalibrationStore.getState().applyLog as jest.Mock;

    fireEvent.press(screen.getByText('Stop & log'));
    await Promise.resolve();
    await Promise.resolve();

    const arg = applyLog.mock.calls[0][0];
    expect(arg.category).toBe('errands');
    expect(arg.estimateMin).toBe(15); // the guess, from the store — never the 15-min DEFAULT by luck: change store to prove
    expect(arg.label).toBe('Leave for work');
  });

  it('bare open while a QUICK session runs: attaches without overwriting it', () => {
    useTimerStore.setState({
      ...runningSession,
      taskLabel: '',
      category: null,
      estimateMin: 0,
      guessMin: 0,
      taskId: null,
      suggestedHonestMin: 0,
      isQuickStart: true,
    });
    mockParams = {};
    render(<Timer />);
    const st = useTimerStore.getState();
    expect(st.startedAt).toBe(123456);
    expect(st.isQuickStart).toBe(true);
  });

  it('bare open with NOTHING running: redirects to Today, never starts a phantom session', () => {
    mockParams = {};
    render(<Timer />);
    expect(mockRedirect).toHaveBeenCalledWith('/(tabs)');
    expect(useTimerStore.getState().isRunning).toBe(false);
  });

  it('bare open on COLD BOOT: restores the KV session and attaches to it', () => {
    // Session lives only in KV (app was killed); the store is empty.
    kv.set(
      'whenbee.activeTimer',
      JSON.stringify({
        taskLabel: 'Leave for work',
        category: 'errands',
        estimateMin: 28,
        startedAt: 123456,
        pausedAccumMs: 0,
        pausedAt: null,
        guessMin: 15,
        taskId: 'task-1',
        suggestedHonestMin: 28,
        isQuickStart: false,
        guardNudged: false,
      }),
    );
    mockParams = {};
    render(<Timer />);
    const st = useTimerStore.getState();
    expect(st.isRunning).toBe(true);
    expect(st.startedAt).toBe(123456);
    expect(screen.getByText('Leave for work')).toBeOnTheScreen();
  });

  it('explicit params for a DIFFERENT task while one runs: shows the switch-confirm sheet, store untouched', () => {
    useTimerStore.setState(runningSession);
    mockParams = {
      taskId: 'task-2',
      label: 'Write report',
      category: 'admin',
      estimateMin: '45',
      guessMin: '30',
    };
    render(<Timer />);
    // The running session's own label appears in the sheet copy — must not have
    // been silently replaced.
    expect(screen.getByText('Switch tasks?')).toBeOnTheScreen();
    const st = useTimerStore.getState();
    expect(st.taskId).toBe('task-1');
    expect(st.taskLabel).toBe('Leave for work');
  });

  it('confirming the switch stops the old session (no log) and mounts the new one', () => {
    useTimerStore.setState(runningSession);
    mockParams = {
      taskId: 'task-2',
      label: 'Write report',
      category: 'admin',
      estimateMin: '45',
      guessMin: '30',
    };
    render(<Timer />);

    fireEvent.press(screen.getByText('Yes, switch'));

    const st = useTimerStore.getState();
    expect(st.taskId).toBe('task-2');
    expect(st.taskLabel).toBe('Write report');
    expect(screen.getByText('Write report')).toBeOnTheScreen();
  });

  it('keeping going on the switch-confirm sheet opens the RUNNING task’s timer (never a dead end)', () => {
    useTimerStore.setState(runningSession);
    mockParams = {
      taskId: 'task-2',
      label: 'Write report',
      category: 'admin',
      estimateMin: '45',
      guessMin: '30',
    };
    render(<Timer />);

    fireEvent.press(screen.getByText('Keep going'));

    // Session untouched…
    const st = useTimerStore.getState();
    expect(st.taskId).toBe('task-1');
    expect(st.taskLabel).toBe('Leave for work');
    expect(st.startedAt).toBe(123456);
    expect(st.isRunning).toBe(true);
    // …and the user lands ON that running timer, not back on Today.
    expect(mockRedirect).not.toHaveBeenCalled();
    expect(screen.getByText('Leave for work')).toBeOnTheScreen();
    expect(screen.getByText('~28m')).toBeOnTheScreen();
  });

  it('keeping going while a QUICK session runs (FAB replace intent) attaches to it untouched', () => {
    useTimerStore.setState({
      ...runningSession,
      taskLabel: '',
      category: null,
      estimateMin: 0,
      guessMin: 0,
      taskId: null,
      suggestedHonestMin: 0,
      isQuickStart: true,
    });
    mockParams = { quick: '1', replace: '1' };
    render(<Timer />);

    fireEvent.press(screen.getByText('Keep going'));

    const st = useTimerStore.getState();
    expect(st.isQuickStart).toBe(true);
    expect(st.startedAt).toBe(123456);
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('action=stop with nothing running (stale notification): lands on Today, no blank screen', () => {
    mockParams = { action: 'stop' };
    render(<Timer />);
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });

  it('abandon path: applyLog with status abandoned, then dismiss', async () => {
    render(<Timer />);
    const applyLog = useCalibrationStore.getState().applyLog as jest.Mock;

    // The ✕ disc opens the confirm Alert; fire its destructive "Abandon" button.
    fireEvent.press(screen.getByLabelText('Abandon task'));
    const buttons = alertSpy.mock.calls.at(-1)?.[2] as
      | { text: string; onPress?: () => void }[]
      | undefined;
    const abandonBtn = buttons?.find((b) => b.text === 'Abandon');
    abandonBtn?.onPress?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(useTimerStore.getState().isRunning).toBe(false);
    expect(applyLog).toHaveBeenCalledTimes(1);
    expect(applyLog.mock.calls[0][0].status).toBe('abandoned');
    expect(mockDismiss).toHaveBeenCalled();
  });
});
