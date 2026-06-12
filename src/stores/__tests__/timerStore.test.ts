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
});
