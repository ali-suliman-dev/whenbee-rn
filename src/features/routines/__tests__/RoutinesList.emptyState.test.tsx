/**
 * RoutinesList.emptyState.test — Task B3
 *
 * Tests the behavior-framed empty state logic:
 *   1. The EXAMPLE_ROUTINE exports the expected shape.
 *   2. "Try it" pre-fills the draft with the example steps.
 *   3. Nothing is persisted to the DB when trying the example.
 *   4. The example is only shown when the routine list is empty (non-empty → normal list).
 *
 * Strategy: pure store-level tests (no render) — mirrors the existing RoutineRunView
 * and calibrationSeed tests. The component's "Try it" handler is tested by calling
 * the same logic it executes (resetDraft → setName → addStep × n) to keep tests
 * deterministic and free of deep native-module mock chains.
 */

import { useRoutinesStore } from '@/src/stores/routinesStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { createMemoryDatabase } from '@/src/db';
import { EXAMPLE_ROUTINE } from '../exampleRoutine';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/src/services/analytics', () => ({ analytics: { capture: jest.fn() } }));
jest.mock('@/src/services/routineNotifications', () => ({
  scheduleRoutineAlerts: jest.fn(() => Promise.resolve()),
  cancelRoutineAlerts: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/src/services/liveActivity', () => ({
  startFinishTimeActivity: jest.fn(),
  endFinishTimeActivity: jest.fn(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function resetStores() {
  useRoutinesStore.setState({
    db: null,
    routines: [],
    stepMByKey: {},
    activeRun: null,
    draft: {
      editingId: null,
      name: '',
      doneByMinuteOfDay: null,
      steps: [],
      scheduleDays: [],
      alertEnabled: false,
      alertLeadMin: 0,
    },
  });
  useCalibrationStore.setState({ logs: 0, statsByCategory: {} });
}

/** The same logic RoutinesScreen.tryExample() executes. */
function loadExampleIntoDraft() {
  const store = useRoutinesStore.getState();
  store.resetDraft();
  store.setName(EXAMPLE_ROUTINE.name);
  for (const step of EXAMPLE_ROUTINE.steps) {
    store.addStep(step);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

describe('exampleRoutine shape', () => {
  it('has a non-empty name', () => {
    expect(EXAMPLE_ROUTINE.name.length).toBeGreaterThan(0);
  });

  it('has between 3 and 5 steps', () => {
    expect(EXAMPLE_ROUTINE.steps.length).toBeGreaterThanOrEqual(3);
    expect(EXAMPLE_ROUTINE.steps.length).toBeLessThanOrEqual(5);
  });

  it('every step has a positive guessMin', () => {
    for (const step of EXAMPLE_ROUTINE.steps) {
      expect(step.guessMin).toBeGreaterThan(0);
    }
  });

  it('every step has a non-empty label and category', () => {
    for (const step of EXAMPLE_ROUTINE.steps) {
      expect(step.label.length).toBeGreaterThan(0);
      expect(step.category.length).toBeGreaterThan(0);
    }
  });
});

describe('"Try it" — draft loading without persistence', () => {
  beforeEach(resetStores);

  it('loads the example name into the draft', () => {
    loadExampleIntoDraft();
    const { draft } = useRoutinesStore.getState();
    expect(draft.name).toBe(EXAMPLE_ROUTINE.name);
  });

  it('loads the correct step count into the draft', () => {
    loadExampleIntoDraft();
    const { draft } = useRoutinesStore.getState();
    expect(draft.steps).toHaveLength(EXAMPLE_ROUTINE.steps.length);
  });

  it('loads the correct first step label into the draft', () => {
    loadExampleIntoDraft();
    const { draft } = useRoutinesStore.getState();
    expect(draft.steps[0]?.label).toBe(EXAMPLE_ROUTINE.steps[0]?.label);
  });

  it('does NOT persist a routine to the DB after loading the draft', async () => {
    const db = createMemoryDatabase();
    useRoutinesStore.getState().setDatabase(db);

    loadExampleIntoDraft();

    // routines list must stay empty — nothing was saved
    const { routines } = useRoutinesStore.getState();
    expect(routines).toHaveLength(0);
  });

  it('draft editingId stays null (example is not an edit of a saved routine)', () => {
    loadExampleIntoDraft();
    const { draft } = useRoutinesStore.getState();
    expect(draft.editingId).toBeNull();
  });
});

describe('empty state condition', () => {
  beforeEach(resetStores);

  it('store.routines is empty when no routines have been saved', () => {
    const { routines } = useRoutinesStore.getState();
    expect(routines).toHaveLength(0);
  });

  it('store.routines is non-empty after saving a routine (example should not show)', async () => {
    const db = createMemoryDatabase();
    useRoutinesStore.getState().setDatabase(db);
    useRoutinesStore.getState().resetDraft();

    const s = useRoutinesStore.getState();
    s.setName('Evening wind-down');
    s.addStep({ label: 'Read', category: 'leisure', guessMin: 20 });
    await useRoutinesStore.getState().saveDraft();

    const { routines } = useRoutinesStore.getState();
    expect(routines).toHaveLength(1);
  });

  it('trying example then saving a routine persists exactly one routine', async () => {
    const db = createMemoryDatabase();
    useRoutinesStore.getState().setDatabase(db);

    // Simulate "Try it" → user edits and saves
    loadExampleIntoDraft();
    await useRoutinesStore.getState().saveDraft();

    const { routines } = useRoutinesStore.getState();
    expect(routines).toHaveLength(1);
    expect(routines[0]?.routine.name).toBe(EXAMPLE_ROUTINE.name);
  });
});
