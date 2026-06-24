import { useTimerStore } from '../timerStore';

const T0 = 1_000_000_000_000; // fixed epoch ms for determinism
const MIN = 60_000;

function reset() {
  useTimerStore.getState().cancel();
}

describe('timerStore', () => {
  beforeEach(reset);

  it('start then stop computes whole active minutes', () => {
    const s = useTimerStore.getState();
    s.start({ label: 'Vacuum', category: 'cleaning', estimateMin: 15 }, T0);
    const { actualMin } = useTimerStore.getState().stop(T0 + 30 * MIN);
    expect(actualMin).toBe(30);
  });

  it('start records task + isRunning', () => {
    const s = useTimerStore.getState();
    s.start({ label: 'Vacuum', category: 'cleaning', estimateMin: 15 }, T0);
    const state = useTimerStore.getState();
    expect(state.isRunning).toBe(true);
    expect(state.taskLabel).toBe('Vacuum');
    expect(state.category).toBe('cleaning');
    expect(state.estimateMin).toBe(15);
    expect(state.startedAt).toBe(T0);
  });

  it('pause/resume excludes the paused span from active minutes', () => {
    const s = useTimerStore.getState();
    s.start({ label: 'Vacuum', category: 'cleaning', estimateMin: 15 }, T0);
    // run 10 min, pause for 5 min, resume, run another 10 min
    useTimerStore.getState().pause(T0 + 10 * MIN);
    useTimerStore.getState().resume(T0 + 15 * MIN);
    const { actualMin } = useTimerStore.getState().stop(T0 + 25 * MIN);
    // wall = 25 min, paused = 5 min → active = 20 min
    expect(actualMin).toBe(20);
  });

  it('stop returns a minimum of 1 active minute', () => {
    const s = useTimerStore.getState();
    s.start({ label: 'Quick', category: 'admin', estimateMin: 5 }, T0);
    const { actualMin } = useTimerStore.getState().stop(T0 + 1000); // 1 second
    expect(actualMin).toBe(1);
  });

  it('stop clears state', () => {
    const s = useTimerStore.getState();
    s.start({ label: 'Vacuum', category: 'cleaning', estimateMin: 15 }, T0);
    useTimerStore.getState().stop(T0 + 30 * MIN);
    const state = useTimerStore.getState();
    expect(state.isRunning).toBe(false);
    expect(state.startedAt).toBeNull();
    expect(state.taskLabel).toBeNull();
  });

  it('cancel clears state', () => {
    const s = useTimerStore.getState();
    s.start({ label: 'Vacuum', category: 'cleaning', estimateMin: 15 }, T0);
    useTimerStore.getState().cancel();
    const state = useTimerStore.getState();
    expect(state.isRunning).toBe(false);
    expect(state.startedAt).toBeNull();
    expect(state.taskLabel).toBeNull();
    expect(state.pausedAccumMs).toBe(0);
  });

  it('start defaults guessMin/suggestedHonestMin to estimateMin and taskId to null', () => {
    useTimerStore.getState().start({ label: 'X', category: 'admin', estimateMin: 20 }, T0);
    const st = useTimerStore.getState();
    expect(st.guessMin).toBe(20);
    expect(st.suggestedHonestMin).toBe(20);
    expect(st.taskId).toBeNull();
  });

  it('start records the full calibration params when provided', () => {
    useTimerStore.getState().start(
      { label: 'Leave', category: 'getting_ready', estimateMin: 28, guessMin: 15, taskId: 'task-1', suggestedHonestMin: 28 },
      T0,
    );
    const st = useTimerStore.getState();
    expect(st.guessMin).toBe(15);
    expect(st.taskId).toBe('task-1');
    expect(st.suggestedHonestMin).toBe(28);
  });

  it('resumeFromKv restores guessMin, taskId, and suggestedHonestMin (full fidelity)', () => {
    useTimerStore.getState().start(
      { label: 'Leave', category: 'getting_ready', estimateMin: 28, guessMin: 15, taskId: 'task-1', suggestedHonestMin: 28 },
      T0,
    );
    // wipe in-memory state but leave kv intact
    useTimerStore.getState().cancel();
    // cancel also clears kv, so re-persist by starting + manually restoring kv is
    // not possible; instead persist then wipe ONLY the in-memory store.
    useTimerStore.getState().start(
      { label: 'Leave', category: 'getting_ready', estimateMin: 28, guessMin: 15, taskId: 'task-1', suggestedHonestMin: 28 },
      T0,
    );
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
    useTimerStore.getState().resumeFromKv();
    const st = useTimerStore.getState();
    expect(st.guessMin).toBe(15);
    expect(st.taskId).toBe('task-1');
    expect(st.suggestedHonestMin).toBe(28);
    expect(st.startedAt).toBe(T0);
  });

  it('resumeFromKv rehydrates a running timer that was persisted', () => {
    const s = useTimerStore.getState();
    s.start({ label: 'Vacuum', category: 'cleaning', estimateMin: 15 }, T0);
    // wipe in-memory state but leave kv intact
    useTimerStore.setState({
      taskLabel: null,
      category: null,
      estimateMin: 0,
      startedAt: null,
      pausedAccumMs: 0,
      pausedAt: null,
      isRunning: false,
    });
    useTimerStore.getState().resumeFromKv();
    const state = useTimerStore.getState();
    expect(state.isRunning).toBe(true);
    expect(state.startedAt).toBe(T0);
    expect(state.taskLabel).toBe('Vacuum');
  });

  it('quickStart runs a bare timer flagged as quick-start', () => {
    useTimerStore.getState().quickStart(T0);
    const s = useTimerStore.getState();
    expect(s.isRunning).toBe(true);
    expect(s.isQuickStart).toBe(true);
    expect(s.category).toBeNull();
    expect(s.taskLabel).toBe('');
    expect(s.estimateMin).toBe(0);
    const { actualMin } = useTimerStore.getState().stop(T0 + 5 * MIN);
    expect(actualMin).toBe(5);
  });

  it('normal start is not flagged quick-start', () => {
    useTimerStore.getState().start({ label: 'Emails', category: 'admin', estimateMin: 40 }, T0);
    expect(useTimerStore.getState().isQuickStart).toBe(false);
  });

  it('cancel clears isQuickStart', () => {
    useTimerStore.getState().quickStart(T0);
    useTimerStore.getState().cancel();
    expect(useTimerStore.getState().isQuickStart).toBe(false);
  });

  it('starting a session leaves guardNudged false', () => {
    useTimerStore.getState().start({ label: 'X', category: 'admin', estimateMin: 20 }, T0);
    expect(useTimerStore.getState().guardNudged).toBe(false);
  });

  it('markGuardNudged latches guardNudged true', () => {
    useTimerStore.getState().start({ label: 'X', category: 'admin', estimateMin: 20 }, T0);
    useTimerStore.getState().markGuardNudged();
    expect(useTimerStore.getState().guardNudged).toBe(true);
  });

  it('stop clears guardNudged back to false', () => {
    useTimerStore.getState().start({ label: 'X', category: 'admin', estimateMin: 20 }, T0);
    useTimerStore.getState().markGuardNudged();
    useTimerStore.getState().stop(T0 + 30 * MIN);
    expect(useTimerStore.getState().guardNudged).toBe(false);
  });

  it('cancel clears guardNudged back to false', () => {
    useTimerStore.getState().quickStart(T0);
    useTimerStore.getState().markGuardNudged();
    useTimerStore.getState().cancel();
    expect(useTimerStore.getState().guardNudged).toBe(false);
  });

  it('resumeFromKv round-trips guardNudged', () => {
    useTimerStore.getState().start({ label: 'X', category: 'admin', estimateMin: 20 }, T0);
    useTimerStore.getState().markGuardNudged();
    // wipe in-memory state but leave kv intact (the persisted snapshot has guardNudged true)
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
    useTimerStore.getState().resumeFromKv();
    expect(useTimerStore.getState().guardNudged).toBe(true);
  });

  it('resumeFromKv round-trips isQuickStart flag', () => {
    useTimerStore.getState().quickStart(T0);
    // wipe in-memory state but leave kv intact
    useTimerStore.setState({
      taskLabel: null,
      category: null,
      estimateMin: 0,
      startedAt: null,
      pausedAccumMs: 0,
      pausedAt: null,
      isRunning: false,
      isQuickStart: false,
      guessMin: 0,
      taskId: null,
      suggestedHonestMin: 0,
    });
    useTimerStore.getState().resumeFromKv();
    const st = useTimerStore.getState();
    expect(st.isRunning).toBe(true);
    expect(st.isQuickStart).toBe(true);
    expect(st.category).toBeNull();
  });
});
