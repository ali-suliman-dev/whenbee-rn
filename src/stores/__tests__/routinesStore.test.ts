import { createMemoryDatabase, makeRoutinesRepo, makeRecurringRepo, type Database } from '@/src/db';
import { useRoutinesStore } from '../routinesStore';
import { useSettingsStore } from '../settingsStore';
import {
  ROUTINE_PERSONAL_MIN_RUNS,
  blendWithPrior,
  clampRatio,
  updateEwma,
  alphaFor,
  priorFor,
  seededPriorFor,
} from '@/src/engine';

// Mirror the namespaced per-step recurring key the store uses.
const stepKey = (routineId: string, stepId: string) => `routine:${routineId}:${stepId}`;

async function freshStore(): Promise<Database> {
  const db = createMemoryDatabase();
  useRoutinesStore.getState().setDatabase(db);
  useRoutinesStore.getState().resetDraft();
  await useRoutinesStore.getState().abandonRun();
  return db;
}

describe('routinesStore — draft + persistence', () => {
  it('saving a draft persists a routine + steps via the repo', async () => {
    const db = await freshStore();
    const s = useRoutinesStore.getState();
    s.setName('Morning routine');
    s.addStep({ label: 'Shower', category: 'getting-ready', guessMin: 20 });
    s.addStep({ label: 'Breakfast', category: 'meals', guessMin: 15 });
    const id = await useRoutinesStore.getState().saveDraft();

    const repo = makeRoutinesRepo(db);
    const saved = await repo.get(id);
    expect(saved?.routine.name).toBe('Morning routine');
    expect(saved?.steps.map((step) => step.label)).toEqual(['Shower', 'Breakfast']);
    expect(saved?.steps.map((step) => step.position)).toEqual([0, 1]);
  });
});

describe('routinesStore — run training', () => {
  it('a full run trains each step, bumps runCount, and updates the transition factor', async () => {
    const db = await freshStore();
    const s = useRoutinesStore.getState();
    s.setName('AM');
    s.addStep({ label: 'a', category: 'getting-ready', guessMin: 20 });
    s.addStep({ label: 'b', category: 'meals', guessMin: 10 });
    const id = await useRoutinesStore.getState().saveDraft();

    const repo = makeRoutinesRepo(db);
    const saved = await repo.get(id);
    const [stepA, stepB] = saved!.steps;

    await useRoutinesStore.getState().startRun(id);
    useRoutinesStore.getState().completeStep(stepA!.id, 24);
    useRoutinesStore.getState().completeStep(stepB!.id, 12);
    await useRoutinesStore.getState().finishRun();

    // Each completed step trained its own recurring stat.
    const recurring = makeRecurringRepo(db);
    expect((await recurring.get(stepKey(id, stepA!.id)))?.n).toBe(1);
    expect((await recurring.get(stepKey(id, stepB!.id)))?.n).toBe(1);

    // runCount bumped + transition factor moved off the prior.
    const after = await repo.get(id);
    expect(after?.routine.runCount).toBe(1);
    expect(after?.routine.transitionFactor).not.toBeCloseTo(1.15, 6);

    // Active run cleared.
    expect(useRoutinesStore.getState().activeRun).toBeNull();
  });

  it('a run with a skipped step trains only completed steps, never the factor or runCount', async () => {
    const db = await freshStore();
    const s = useRoutinesStore.getState();
    s.setName('AM');
    s.addStep({ label: 'a', category: 'getting-ready', guessMin: 20 });
    s.addStep({ label: 'b', category: 'meals', guessMin: 10 });
    const id = await useRoutinesStore.getState().saveDraft();

    const repo = makeRoutinesRepo(db);
    const saved = await repo.get(id);
    const [stepA, stepB] = saved!.steps;

    await useRoutinesStore.getState().startRun(id);
    useRoutinesStore.getState().completeStep(stepA!.id, 24);
    useRoutinesStore.getState().skipStep(stepB!.id);
    await useRoutinesStore.getState().finishRun();

    const recurring = makeRecurringRepo(db);
    expect((await recurring.get(stepKey(id, stepA!.id)))?.n).toBe(1);
    expect(await recurring.get(stepKey(id, stepB!.id))).toBeNull(); // skipped → untrained

    const after = await repo.get(id);
    expect(after?.routine.runCount).toBe(0);
    expect(after?.routine.transitionFactor).toBeCloseTo(1.15, 6);
  });

  it('a step trained for the first time blends against the SEEDED prior, not the population prior', async () => {
    const db = await freshStore();
    useSettingsStore.getState().setArchetypeSeed({ m0: 3.0, source: 'quiz', tookAt: 1 });

    const s = useRoutinesStore.getState();
    s.setName('Creative block');
    s.addStep({ label: 'Sketch', category: 'creative', guessMin: 20 });
    const id = await useRoutinesStore.getState().saveDraft();

    const repo = makeRoutinesRepo(db);
    const saved = await repo.get(id);
    const [step] = saved!.steps;

    await useRoutinesStore.getState().startRun(id);
    useRoutinesStore.getState().completeStep(step!.id, 24);
    await useRoutinesStore.getState().finishRun();

    const recurring = makeRecurringRepo(db);
    const trained = await recurring.get(stepKey(id, step!.id));
    expect(trained?.n).toBe(1);

    const seed = useSettingsStore.getState().archetypeSeed;
    const ratio = clampRatio(20, 24);
    const alpha = alphaFor('balanced', 'timed');
    const logEwma = updateEwma(0, ratio, alpha);

    const seededM = blendWithPrior(1, logEwma, seededPriorFor('creative', seed));
    const unseededM = blendWithPrior(1, logEwma, priorFor('creative'));

    expect(trained?.mEffective).toBeCloseTo(seededM, 6);
    expect(trained?.mEffective).not.toBeCloseTo(unseededM, 6);

    useSettingsStore.getState().reset();
  });

  it('abandoning a run clears the active-run slice without training', async () => {
    const db = await freshStore();
    const s = useRoutinesStore.getState();
    s.setName('AM');
    s.addStep({ label: 'a', category: 'getting-ready', guessMin: 20 });
    const id = await useRoutinesStore.getState().saveDraft();

    await useRoutinesStore.getState().startRun(id);
    expect(useRoutinesStore.getState().activeRun).not.toBeNull();
    await useRoutinesStore.getState().abandonRun();

    expect(useRoutinesStore.getState().activeRun).toBeNull();
    const after = await makeRoutinesRepo(db).get(id);
    expect(after?.routine.runCount).toBe(0);
  });

  // ── A1: schedule + alert draft actions ──────────────────────────────────────

  it('setSchedule updates draft scheduleDays', async () => {
    await freshStore();
    useRoutinesStore.getState().setSchedule([1, 3, 5]);
    expect(useRoutinesStore.getState().draft.scheduleDays).toEqual([1, 3, 5]);
  });

  it('setAlert updates draft alertEnabled and alertLeadMin', async () => {
    await freshStore();
    useRoutinesStore.getState().setAlert(true, 15);
    expect(useRoutinesStore.getState().draft.alertEnabled).toBe(true);
    expect(useRoutinesStore.getState().draft.alertLeadMin).toBe(15);
  });

  it('saveDraft persists scheduleDays and alert fields via the repo', async () => {
    const db = await freshStore();
    const s = useRoutinesStore.getState();
    s.setName('Gym session');
    s.addStep({ label: 'Warm up', category: 'exercise', guessMin: 10 });
    s.setSchedule([0, 2, 4]);
    s.setAlert(true, 20);
    const id = await useRoutinesStore.getState().saveDraft();

    const repo = makeRoutinesRepo(db);
    const saved = await repo.get(id);
    expect(saved?.routine.scheduleDays).toEqual([0, 2, 4]);
    expect(saved?.routine.alertEnabled).toBe(true);
    expect(saved?.routine.alertLeadMin).toBe(20);
  });

  it('editExisting loads scheduleDays and alert fields back into the draft', async () => {
    await freshStore();
    const s = useRoutinesStore.getState();
    s.setName('Evening wind-down');
    s.addStep({ label: 'Read', category: 'learning', guessMin: 30 });
    s.setSchedule([0, 1, 2, 3, 4]);
    s.setAlert(true, 5);
    const id = await useRoutinesStore.getState().saveDraft();

    // Reset the draft but keep the same db so editExisting can load the saved routine.
    useRoutinesStore.getState().resetDraft();
    await useRoutinesStore.getState().editExisting(id);
    const draft = useRoutinesStore.getState().draft;
    expect(draft.scheduleDays).toEqual([0, 1, 2, 3, 4]);
    expect(draft.alertEnabled).toBe(true);
    expect(draft.alertLeadMin).toBe(5);
  });

  it('basis flips to personal only after the min-runs threshold of full runs', async () => {
    const db = await freshStore();
    const s = useRoutinesStore.getState();
    s.setName('AM');
    s.addStep({ label: 'a', category: 'getting-ready', guessMin: 20 });
    const id = await useRoutinesStore.getState().saveDraft();
    const repo = makeRoutinesRepo(db);
    const stepId = (await repo.get(id))!.steps[0]!.id;

    for (let i = 0; i < ROUTINE_PERSONAL_MIN_RUNS; i += 1) {
      await useRoutinesStore.getState().startRun(id);
      useRoutinesStore.getState().completeStep(stepId, 25);
      await useRoutinesStore.getState().finishRun();
    }
    expect((await repo.get(id))?.routine.runCount).toBe(ROUTINE_PERSONAL_MIN_RUNS);
  });
});
