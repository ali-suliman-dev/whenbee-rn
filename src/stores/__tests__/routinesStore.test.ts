import { createMemoryDatabase, makeRoutinesRepo, makeRecurringRepo, type Database } from '@/src/db';
import { useRoutinesStore } from '../routinesStore';
import { ROUTINE_PERSONAL_MIN_RUNS } from '@/src/engine';

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
