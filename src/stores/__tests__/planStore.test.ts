import { usePlanStore } from '../planStore';
import { kv } from '@/src/lib/kv';
import { DEFAULT_BUFFER_MIN } from '@/src/engine';

const T0 = 1_700_000_000_000;

function resetDraft() {
  usePlanStore.setState({
    draft: { deadline: null, bufferMin: DEFAULT_BUFFER_MIN, tasks: [] },
    active: null,
  });
}

describe('planStore', () => {
  beforeEach(resetDraft);

  it('setDeadline + setBuffer update the draft', () => {
    usePlanStore.getState().setDeadline(T0);
    usePlanStore.getState().setBuffer(10);
    const { draft } = usePlanStore.getState();
    expect(draft.deadline).toBe(T0);
    expect(draft.bufferMin).toBe(10);
  });

  it('addTask appends with an id and returns the created task', () => {
    const task = usePlanStore
      .getState()
      .addTask({ label: 'Breakfast', category: 'cooking', durationMin: 20 });
    expect(typeof task.id).toBe('string');
    expect(task.id.length).toBeGreaterThan(0);
    expect(usePlanStore.getState().draft.tasks).toHaveLength(1);
    expect(usePlanStore.getState().draft.tasks[0]?.label).toBe('Breakfast');
  });

  it('updateTaskDuration changes only the matching task and floors at 5', () => {
    const a = usePlanStore.getState().addTask({ label: 'A', category: 'admin', durationMin: 30 });
    const b = usePlanStore.getState().addTask({ label: 'B', category: 'email', durationMin: 15 });

    usePlanStore.getState().updateTaskDuration(a.id, 45);
    usePlanStore.getState().updateTaskDuration(b.id, 1); // below floor

    const tasks = usePlanStore.getState().draft.tasks;
    expect(tasks.find((t) => t.id === a.id)?.durationMin).toBe(45);
    expect(tasks.find((t) => t.id === b.id)?.durationMin).toBe(5);
  });

  it('removeTask drops the matching task', () => {
    const a = usePlanStore.getState().addTask({ label: 'A', category: 'admin', durationMin: 30 });
    usePlanStore.getState().addTask({ label: 'B', category: 'email', durationMin: 15 });
    usePlanStore.getState().removeTask(a.id);
    const tasks = usePlanStore.getState().draft.tasks;
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.label).toBe('B');
  });

  it('reorderTasks reorders to match the given id order', () => {
    const a = usePlanStore.getState().addTask({ label: 'A', category: 'admin', durationMin: 30 });
    const b = usePlanStore.getState().addTask({ label: 'B', category: 'email', durationMin: 15 });
    const c = usePlanStore.getState().addTask({ label: 'C', category: 'calls', durationMin: 10 });

    usePlanStore.getState().reorderTasks([c.id, a.id, b.id]);
    expect(usePlanStore.getState().draft.tasks.map((t) => t.label)).toEqual(['C', 'A', 'B']);
  });

  it('reorderTasks keeps any task missing from the id list (defensive)', () => {
    usePlanStore.getState().addTask({ label: 'A', category: 'admin', durationMin: 30 });
    const b = usePlanStore.getState().addTask({ label: 'B', category: 'email', durationMin: 15 });
    usePlanStore.getState().reorderTasks([b.id]); // 'A' omitted → appended back
    expect(usePlanStore.getState().draft.tasks.map((t) => t.label)).toEqual(['B', 'A']);
  });

  it('saveActive freezes the draft into active with createdAt', () => {
    usePlanStore.getState().setDeadline(T0);
    usePlanStore.getState().setBuffer(10);
    usePlanStore.getState().addTask({ label: 'A', category: 'admin', durationMin: 30 });

    usePlanStore.getState().saveActive(T0 + 500);

    const { active } = usePlanStore.getState();
    expect(active).not.toBeNull();
    expect(active?.deadline).toBe(T0);
    expect(active?.bufferMin).toBe(10);
    expect(active?.createdAt).toBe(T0 + 500);
    expect(active?.tasks).toHaveLength(1);
  });

  it('saveActive is a no-op without a deadline', () => {
    usePlanStore.getState().addTask({ label: 'A', category: 'admin', durationMin: 30 });
    usePlanStore.getState().saveActive(T0);
    expect(usePlanStore.getState().active).toBeNull();
  });

  it('clearActive drops the active plan', () => {
    usePlanStore.getState().setDeadline(T0);
    usePlanStore.getState().saveActive(T0);
    expect(usePlanStore.getState().active).not.toBeNull();
    usePlanStore.getState().clearActive();
    expect(usePlanStore.getState().active).toBeNull();
  });

  it('persists ONLY the active plan to kv (not the draft)', () => {
    usePlanStore.getState().setDeadline(T0);
    usePlanStore.getState().addTask({ label: 'A', category: 'admin', durationMin: 30 });
    usePlanStore.getState().saveActive(T0);

    const raw = kv.getString('active-plan');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string);
    expect(parsed.state.active).toBeTruthy();
    expect(parsed.state.active.deadline).toBe(T0);
    // draft is session-only — never serialized
    expect(parsed.state.draft).toBeUndefined();
  });
});
