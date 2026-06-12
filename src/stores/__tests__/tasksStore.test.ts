import { useTasksStore } from '../tasksStore';

const T0 = 1_700_000_000_000;

describe('tasksStore', () => {
  beforeEach(() => useTasksStore.setState({ tasks: [] }));

  it('addTask returns the created task with an id + createdAt', () => {
    const task = useTasksStore
      .getState()
      .addTask({ label: 'Leave for work', category: 'getting_ready', guessMin: 15, nowMs: T0 });

    expect(task.label).toBe('Leave for work');
    expect(task.category).toBe('getting_ready');
    expect(task.guessMin).toBe(15);
    expect(task.createdAt).toBe(T0);
    expect(typeof task.id).toBe('string');
    expect(task.id.length).toBeGreaterThan(0);
  });

  it('focus is tasks[0] — the first task added (FIFO append)', () => {
    const first = useTasksStore
      .getState()
      .addTask({ label: 'First', category: 'cleaning', guessMin: 10, nowMs: T0 });
    useTasksStore.getState().addTask({ label: 'Second', category: 'admin', guessMin: 20, nowMs: T0 + 1 });

    const { tasks } = useTasksStore.getState();
    expect(tasks).toHaveLength(2);
    expect(tasks[0]?.id).toBe(first.id);
    expect(tasks[0]?.label).toBe('First');
  });

  it('removeTask drops the matching task and promotes the next focus', () => {
    const first = useTasksStore
      .getState()
      .addTask({ label: 'First', category: 'cleaning', guessMin: 10, nowMs: T0 });
    const second = useTasksStore
      .getState()
      .addTask({ label: 'Second', category: 'admin', guessMin: 20, nowMs: T0 + 1 });

    useTasksStore.getState().removeTask(first.id);

    const { tasks } = useTasksStore.getState();
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.id).toBe(second.id);
  });

  it('clear empties the list', () => {
    useTasksStore.getState().addTask({ label: 'x', category: 'cleaning', guessMin: 5, nowMs: T0 });
    useTasksStore.getState().clear();
    expect(useTasksStore.getState().tasks).toEqual([]);
  });
});
