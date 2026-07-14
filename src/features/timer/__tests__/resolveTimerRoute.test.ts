import { resolveTimerRoute } from '../resolveTimerRoute';
import type { TimerStoreSnapshot } from '../resolveTimerRoute';

const idle: TimerStoreSnapshot = {
  isRunning: false,
  startedAt: null,
  isQuickStart: false,
  taskId: null,
  taskLabel: null,
  category: null,
  estimateMin: 0,
  guessMin: 0,
  suggestedHonestMin: 0,
};

const runningTask: TimerStoreSnapshot = {
  isRunning: true,
  startedAt: 123456,
  isQuickStart: false,
  taskId: 'task-1',
  taskLabel: 'Leave for work',
  category: 'errands',
  estimateMin: 28,
  guessMin: 15,
  suggestedHonestMin: 28,
};

const runningQuick: TimerStoreSnapshot = {
  isRunning: true,
  startedAt: 123456,
  isQuickStart: true,
  taskId: null,
  taskLabel: '',
  category: null,
  estimateMin: 0,
  guessMin: 0,
  suggestedHonestMin: 0,
};

describe('resolveTimerRoute', () => {
  it('bare open (presence-notification body tap) while a task runs → attaches with STORE context', () => {
    const r = resolveTimerRoute({}, runningTask);
    expect(r).toEqual({
      kind: 'session',
      session: {
        taskId: 'task-1',
        label: 'Leave for work',
        category: 'errands',
        estimateMin: 28,
        guessMin: 15,
        suggestedHonestMin: 28,
        isQuickNav: false,
      },
    });
  });

  it('taskId-only open (widget start link) for the RUNNING task → attaches with store context, never defaults', () => {
    const r = resolveTimerRoute({ taskId: 'task-1' }, runningTask);
    expect(r.kind).toBe('session');
    if (r.kind !== 'session') return;
    expect(r.session.label).toBe('Leave for work');
    expect(r.session.estimateMin).toBe(28);
    expect(r.session.guessMin).toBe(15);
  });

  it('explicit params for the SAME task (label match, no taskId) → store context wins', () => {
    const r = resolveTimerRoute(
      { label: 'Leave for work', category: 'errands', estimateMin: '30' },
      runningTask,
    );
    expect(r.kind).toBe('session');
    if (r.kind !== 'session') return;
    // Attach semantics: the running session's numbers, not the route's.
    expect(r.session.estimateMin).toBe(28);
  });

  it('explicit params for a DIFFERENT task while one runs → fresh session from params (intentional restart)', () => {
    const r = resolveTimerRoute(
      { taskId: 'task-2', label: 'Write report', category: 'admin', estimateMin: '45', guessMin: '30' },
      runningTask,
    );
    expect(r).toEqual({
      kind: 'session',
      session: {
        taskId: 'task-2',
        label: 'Write report',
        category: 'admin',
        estimateMin: 45,
        guessMin: 30,
        suggestedHonestMin: 45,
        isQuickNav: false,
      },
    });
  });

  it('bare open while a QUICK session runs → attaches as quick nav (defaults, isQuickNav)', () => {
    const r = resolveTimerRoute({}, runningQuick);
    expect(r.kind).toBe('session');
    if (r.kind !== 'session') return;
    expect(r.session.isQuickNav).toBe(true);
    expect(r.session.label).toBe('Focus session');
  });

  it('quick=1 while a quick session runs → attaches as quick nav', () => {
    const r = resolveTimerRoute({ quick: '1' }, runningQuick);
    expect(r.kind).toBe('session');
    if (r.kind !== 'session') return;
    expect(r.session.isQuickNav).toBe(true);
  });

  it('bare open with NOTHING running → redirect to Today (never fabricate a placeholder session)', () => {
    expect(resolveTimerRoute({}, idle)).toEqual({ kind: 'redirect-today' });
  });

  it('quick=1 with nothing running → quick session (tab-bar arc path, quickStart already ran)', () => {
    const r = resolveTimerRoute({ quick: '1' }, idle);
    expect(r.kind).toBe('session');
    if (r.kind !== 'session') return;
    expect(r.session.isQuickNav).toBe(true);
  });

  it('explicit params with nothing running → fresh session with guess/honest fallbacks', () => {
    const r = resolveTimerRoute(
      { label: 'Pack bag', category: 'errands', estimateMin: '20' },
      idle,
    );
    expect(r).toEqual({
      kind: 'session',
      session: {
        taskId: undefined,
        label: 'Pack bag',
        category: 'errands',
        estimateMin: 20,
        guessMin: 20,
        suggestedHonestMin: 20,
        isQuickNav: false,
      },
    });
  });

  it('array-shaped params use the first value', () => {
    const r = resolveTimerRoute({ taskId: ['task-2'], label: ['X'], estimateMin: ['10'] }, idle);
    expect(r.kind).toBe('session');
    if (r.kind !== 'session') return;
    expect(r.session.taskId).toBe('task-2');
    expect(r.session.estimateMin).toBe(10);
  });
});
