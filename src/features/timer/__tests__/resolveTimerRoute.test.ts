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

  it('explicit params for a DIFFERENT task while one runs → confirm-switch (destructive, must be confirmed)', () => {
    const r = resolveTimerRoute(
      { taskId: 'task-2', label: 'Write report', category: 'admin', estimateMin: '45', guessMin: '30' },
      runningTask,
    );
    expect(r).toEqual({
      kind: 'confirm-switch',
      leavingLabel: 'Leave for work',
      startingLabel: 'Write report',
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

  it('confirm-switch leavingLabel falls back to a generic label when the running non-quick task has no store label', () => {
    const runningTaskNoLabel: TimerStoreSnapshot = { ...runningTask, taskLabel: null };
    const r = resolveTimerRoute(
      { taskId: 'task-2', label: 'Write report', category: 'admin' },
      runningTaskNoLabel,
    );
    expect(r.kind).toBe('confirm-switch');
    if (r.kind !== 'confirm-switch') return;
    expect(r.leavingLabel).toBe('your timer');
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

  it('running QUICK session + explicit params for a task → confirm-switch (quick sessions have no task identity)', () => {
    const r = resolveTimerRoute(
      { taskId: 'task-2', label: 'Write report', category: 'admin', estimateMin: '45', guessMin: '30' },
      runningQuick,
    );
    expect(r).toEqual({
      kind: 'confirm-switch',
      leavingLabel: 'your timer',
      startingLabel: 'Write report',
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

  it('running QUICK session + explicit label-only params → confirm-switch, leavingLabel from store when present', () => {
    const runningQuickWithLabel: TimerStoreSnapshot = { ...runningQuick, taskLabel: 'Some quick thing' };
    const r = resolveTimerRoute({ label: 'Write report' }, runningQuickWithLabel);
    expect(r.kind).toBe('confirm-switch');
    if (r.kind !== 'confirm-switch') return;
    expect(r.leavingLabel).toBe('Some quick thing');
    expect(r.startingLabel).toBe('Write report');
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

  describe('replace intent (FAB quick-start while a session is running)', () => {
    it('running + {replace:"1", quick:"1"} → confirm-switch to a fresh quick session', () => {
      const r = resolveTimerRoute({ replace: '1', quick: '1' }, runningTask);
      expect(r.kind).toBe('confirm-switch');
      if (r.kind !== 'confirm-switch') return;
      expect(r.leavingLabel).toBe('Leave for work');
      expect(r.startingLabel).toBe('a quick timer');
      expect(r.session.isQuickNav).toBe(true);
    });

    it('running (no store label) + {replace:"1", quick:"1"} → leavingLabel falls back to "your timer"', () => {
      const runningTaskNoLabel: TimerStoreSnapshot = { ...runningTask, taskLabel: '' };
      const r = resolveTimerRoute({ replace: '1', quick: '1' }, runningTaskNoLabel);
      expect(r.kind).toBe('confirm-switch');
      if (r.kind !== 'confirm-switch') return;
      expect(r.leavingLabel).toBe('your timer');
    });

    it('running + {replace:"1", label:"Email"} → startingLabel is the explicit label', () => {
      const r = resolveTimerRoute({ replace: '1', label: 'Email' }, runningTask);
      expect(r.kind).toBe('confirm-switch');
      if (r.kind !== 'confirm-switch') return;
      expect(r.startingLabel).toBe('Email');
    });

    it('NOT running + {replace:"1", quick:"1"} → replace is a no-op, still a normal quick session', () => {
      const r = resolveTimerRoute({ replace: '1', quick: '1' }, idle);
      expect(r.kind).not.toBe('confirm-switch');
      expect(r.kind).toBe('session');
      if (r.kind !== 'session') return;
      expect(r.session.isQuickNav).toBe(true);
    });
  });
});
