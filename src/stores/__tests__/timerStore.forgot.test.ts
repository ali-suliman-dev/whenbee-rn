import { useTimerStore } from '../timerStore';

describe('timerStore forgot-to-stop helpers', () => {
  beforeEach(() => useTimerStore.getState().cancel());

  it('peekPersisted returns the running snapshot without clearing state', () => {
    useTimerStore.getState().start(
      { label: 'Deep work', category: 'Work', estimateMin: 45, guessMin: 40, suggestedHonestMin: 50 },
      1_000_000,
    );
    const snap = useTimerStore.getState().peekPersisted();
    expect(snap?.category).toBe('Work');
    expect(snap?.suggestedHonestMin).toBe(50);
    // still running (peek must not clear)
    expect(useTimerStore.getState().startedAt).toBe(1_000_000);
  });

  it('stopSilently clears state + kv and writes no log', () => {
    useTimerStore.getState().start(
      { label: 'Deep work', category: 'Work', estimateMin: 45 },
      1_000_000,
    );
    useTimerStore.getState().stopSilently();
    expect(useTimerStore.getState().startedAt).toBeNull();
    expect(useTimerStore.getState().peekPersisted()).toBeNull();
  });

  it('reopen restores a running session at the original startedAt', () => {
    useTimerStore.getState().reopen({
      taskLabel: 'Deep work',
      category: 'Work',
      estimateMin: 45,
      startedAt: 2_000_000,
      guessMin: 40,
      taskId: null,
      suggestedHonestMin: 50,
      isQuickStart: false,
    });
    const s = useTimerStore.getState();
    expect(s.isRunning).toBe(true);
    expect(s.startedAt).toBe(2_000_000);
    expect(s.suggestedHonestMin).toBe(50);
  });
});
