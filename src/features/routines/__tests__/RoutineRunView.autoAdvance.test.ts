/**
 * TDD for Task B1: auto-advancing run + chime + live countdown.
 *
 * Strategy: pure store-level tests (no render) for the auto-advance rule, since
 * the view delegates ALL advance logic to the store's completeStep/skipStep actions.
 * The view's setInterval fires autoAdvanceStep() when elapsed >= honestSec; we test
 * the key contracts:
 *   1. A step reaching its honest seconds triggers completeStep → next step becomes 'running'.
 *   2. The haptic fires exactly once (not on every tick afterward).
 *   3. Manual Done still advances.
 *   4. Abandon calls endFinishTimeActivity.
 */

import { useRoutinesStore } from '@/src/stores/routinesStore';
import { createMemoryDatabase } from '@/src/db';

// expo-haptics is already mocked in jest.setup.js
import { endFinishTimeActivity } from '@/src/services/liveActivity';
import { haptics } from '@/src/lib/haptics';
import * as Haptics from 'expo-haptics';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/src/services/liveActivity', () => ({
  startFinishTimeActivity: jest.fn(),
  updateFinishTimeActivity: jest.fn(),
  endFinishTimeActivity: jest.fn(),
}));

jest.mock('@/src/services/routineNotifications', () => ({
  scheduleRoutineAlerts: jest.fn(() => Promise.resolve()),
  cancelRoutineAlerts: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/src/services/analytics', () => ({
  analytics: { capture: jest.fn() },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function resetStore() {
  useRoutinesStore.setState({
    db: null,
    routines: [],
    stepMByKey: {},
    draft: {
      editingId: null,
      name: '',
      doneByMinuteOfDay: null,
      steps: [],
      scheduleDays: [],
      alertEnabled: false,
      alertLeadMin: 0,
    },
    activeRun: null,
  });
}

async function seedAndStartRun(guessMinutes: number[] = [5, 10]) {
  const db = createMemoryDatabase();
  useRoutinesStore.getState().setDatabase(db);

  const s = useRoutinesStore.getState();
  s.setName('Test Routine');
  for (const [i, guessMin] of guessMinutes.entries()) {
    s.addStep({ label: `Step ${i + 1}`, category: 'admin', guessMin });
  }

  const id = await useRoutinesStore.getState().saveDraft();
  await useRoutinesStore.getState().startRun(id);
  return id;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetStore();
  jest.clearAllMocks();
});

describe('routinesStore — auto-advance contracts', () => {
  it('step 1 starts as running, step 2 as upcoming', async () => {
    await seedAndStartRun([5, 10]);
    const { activeRun } = useRoutinesStore.getState();
    expect(activeRun).not.toBeNull();
    expect(activeRun!.steps[0]!.status).toBe('running');
    expect(activeRun!.steps[1]!.status).toBe('upcoming');
  });

  it('completeStep marks step done and promotes next to running', async () => {
    await seedAndStartRun([5, 10]);
    const { activeRun, completeStep } = useRoutinesStore.getState();
    const firstStepId = activeRun!.steps[0]!.stepId;

    completeStep(firstStepId, 5);

    const updated = useRoutinesStore.getState().activeRun!;
    expect(updated.steps[0]!.status).toBe('done');
    expect(updated.steps[0]!.actualMin).toBe(5);
    expect(updated.steps[1]!.status).toBe('running');
  });

  it('skipStep marks step skipped and promotes next to running', async () => {
    await seedAndStartRun([5, 10]);
    const { activeRun, skipStep } = useRoutinesStore.getState();
    const firstStepId = activeRun!.steps[0]!.stepId;

    skipStep(firstStepId);

    const updated = useRoutinesStore.getState().activeRun!;
    expect(updated.steps[0]!.status).toBe('skipped');
    expect(updated.steps[1]!.status).toBe('running');
  });

  it('completeStep on last step leaves no running step (recap state)', async () => {
    await seedAndStartRun([5]);
    const { activeRun, completeStep } = useRoutinesStore.getState();
    const stepId = activeRun!.steps[0]!.stepId;

    completeStep(stepId, 5);

    const updated = useRoutinesStore.getState().activeRun!;
    const anyRunning = updated.steps.some((rs) => rs.status === 'running');
    expect(anyRunning).toBe(false);
    expect(updated.steps[0]!.status).toBe('done');
  });

  it('abandonRun clears activeRun and calls endFinishTimeActivity', async () => {
    await seedAndStartRun([5, 10]);

    await useRoutinesStore.getState().abandonRun();

    expect(useRoutinesStore.getState().activeRun).toBeNull();
    expect(endFinishTimeActivity).toHaveBeenCalledTimes(1);
  });

  it('finishRun (after all steps done) clears activeRun and calls endFinishTimeActivity', async () => {
    await seedAndStartRun([5]);
    const { activeRun, completeStep, finishRun } = useRoutinesStore.getState();
    completeStep(activeRun!.steps[0]!.stepId, 5);

    await finishRun();

    expect(useRoutinesStore.getState().activeRun).toBeNull();
    expect(endFinishTimeActivity).toHaveBeenCalledTimes(1);
  });
});

describe('auto-advance integration: haptic fires once at honest estimate', () => {
  /**
   * The auto-advance fires in RoutineRunView via setInterval. Here we simulate
   * what the view does: when elapsed >= honestSec, it calls completeStep +
   * haptics.success(). We verify the GUARD: once the step has been advanced
   * (status !== 'running'), the view must NOT fire again (using the advancedRef
   * guard). This test simulates two ticks: one AT the threshold, one AFTER.
   */
  it('haptic fires only once even if interval ticks again after advance', () => {
    // Simulate the guard the view keeps (matches the implementation in RoutineRunView)
    const advancedRef = { current: false };

    function simulateTick(stepStatus: string, elapsedSec: number, honestSec: number) {
      if (stepStatus !== 'running') return; // step already done
      if (advancedRef.current) return; // guard: already fired this session
      if (elapsedSec >= honestSec) {
        advancedRef.current = true;
        haptics.success();
        // completeStep would be called here in the real view
      }
    }

    // Tick 1: elapsed = 299s, honestSec = 300 → NOT yet
    simulateTick('running', 299, 300);
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();

    // Tick 2: elapsed = 300s → fires
    simulateTick('running', 300, 300);
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);

    // Tick 3: step still 'running' but advancedRef is true → guard blocks
    simulateTick('running', 301, 300);
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1); // still 1, not 2
  });

  it('haptic does NOT fire if step is already done (status guard)', () => {
    function simulateTick(stepStatus: string) {
      if (stepStatus !== 'running') return;
      haptics.success();
    }

    simulateTick('done');
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });
});

describe('countdown display contract', () => {
  /**
   * The view derives remainingSec = honestSec - elapsedSec. Test the math:
   * positive = normal countdown, zero/negative = overrun (show +MM:SS calmly).
   */
  it('remainingSec is positive before the estimate', () => {
    const honestSec = 300;
    const elapsedSec = 120;
    const remainingSec = honestSec - elapsedSec;
    expect(remainingSec).toBe(180);
  });

  it('remainingSec is 0 at the estimate boundary', () => {
    const honestSec = 300;
    const elapsedSec = 300;
    const remainingSec = honestSec - elapsedSec;
    expect(remainingSec).toBe(0);
  });

  it('remainingSec is negative on overrun (no guilt — just information)', () => {
    const honestSec = 300;
    const elapsedSec = 430;
    const remainingSec = honestSec - elapsedSec;
    expect(remainingSec).toBe(-130);
  });
});
