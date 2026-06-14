import { render, screen, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import Timer from '@/src/app/(modals)/timer';
import { useTimerStore } from '@/src/stores/timerStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useTasksStore } from '@/src/stores/tasksStore';
import { useRewardStore } from '@/src/stores/rewardStore';
import type { LogResult } from '@/src/stores/calibrationStore';

// ── router + route params ─────────────────────────────────────────────────────
// `mock`-prefixed so jest's factory-hoisting allows referencing them.
const mockReplace = jest.fn();
const mockDismiss = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  router: {
    replace: (...a: unknown[]) => mockReplace(...a),
    dismiss: (...a: unknown[]) => mockDismiss(...a),
  },
  useLocalSearchParams: () => mockParams,
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
  });
  useTasksStore.setState({ tasks: [] });
  useRewardStore.getState().clear();
  // Stub applyLog so we don't touch the DB; capture its calls.
  useCalibrationStore.setState({
    applyLog: jest.fn(async () => okResult),
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

  it('renders the task name and the guess→honest reframe (honest = amber number)', () => {
    render(<Timer />);
    expect(screen.getByText('Leave for work')).toBeOnTheScreen();
    expect(screen.getByText('guessed 15m')).toBeOnTheScreen();
    expect(screen.getByText('~28m')).toBeOnTheScreen();
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
