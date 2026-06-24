import { createMemoryDatabase } from '../../memoryDatabase';
import { makeRoutinesRepo } from '../routinesRepo';
import type { Routine, RoutineStep } from '@/src/domain/types';

function seed(): { routine: Routine; steps: RoutineStep[] } {
  const routine: Routine = {
    id: 'r1',
    name: 'Morning routine',
    doneByMinuteOfDay: 9 * 60,
    transitionFactor: 1.15,
    runCount: 0,
    scheduleDays: [],
    alertEnabled: false,
    alertLeadMin: 0,
    createdAt: 1000,
    updatedAt: 1000,
  };
  // Intentionally out of order to prove the repo returns them by position.
  const steps: RoutineStep[] = [
    { id: 's2', routineId: 'r1', position: 1, label: 'Get dressed', category: 'getting-ready', guessMin: 10 },
    { id: 's1', routineId: 'r1', position: 0, label: 'Shower', category: 'getting-ready', guessMin: 20 },
    { id: 's3', routineId: 'r1', position: 2, label: 'Breakfast', category: 'meals', guessMin: 15 },
  ];
  return { routine, steps };
}

it('creates → lists → gets a routine with steps ordered by position', async () => {
  const repo = makeRoutinesRepo(createMemoryDatabase());
  const { routine, steps } = seed();
  await repo.create(routine, steps);

  const list = await repo.list();
  expect(list).toHaveLength(1);
  expect(list[0]?.routine.name).toBe('Morning routine');

  const got = await repo.get('r1');
  expect(got).not.toBeNull();
  expect(got?.steps.map((s) => s.id)).toEqual(['s1', 's2', 's3']);
  expect(got?.steps.map((s) => s.position)).toEqual([0, 1, 2]);
  expect(got?.routine.doneByMinuteOfDay).toBe(540);
});

it('update replaces the step set wholesale', async () => {
  const repo = makeRoutinesRepo(createMemoryDatabase());
  const { routine, steps } = seed();
  await repo.create(routine, steps);

  const newSteps: RoutineStep[] = [
    { id: 's4', routineId: 'r1', position: 0, label: 'Meds', category: 'admin', guessMin: 5 },
    { id: 's5', routineId: 'r1', position: 1, label: 'Shower', category: 'getting-ready', guessMin: 20 },
  ];
  await repo.update({ ...routine, name: 'New morning', updatedAt: 2000, scheduleDays: [], alertEnabled: false, alertLeadMin: 0 }, newSteps);

  const got = await repo.get('r1');
  expect(got?.routine.name).toBe('New morning');
  expect(got?.steps.map((s) => s.id)).toEqual(['s4', 's5']);
});

it('remove deletes the routine and its steps', async () => {
  const db = createMemoryDatabase();
  const repo = makeRoutinesRepo(db);
  const { routine, steps } = seed();
  await repo.create(routine, steps);
  await repo.remove('r1');

  expect(await repo.get('r1')).toBeNull();
  expect(await db.listRoutineSteps('r1')).toEqual([]);
});

it('setTransitionFactor and incrementRunCount persist', async () => {
  const repo = makeRoutinesRepo(createMemoryDatabase());
  const { routine, steps } = seed();
  await repo.create(routine, steps);

  await repo.setTransitionFactor('r1', 1.3, 3000);
  await repo.incrementRunCount('r1', 4000);

  const got = await repo.get('r1');
  expect(got?.routine.transitionFactor).toBeCloseTo(1.3, 6);
  expect(got?.routine.runCount).toBe(1);
});

it('list returns newest-updated first', async () => {
  const repo = makeRoutinesRepo(createMemoryDatabase());
  await repo.create(
    { id: 'a', name: 'A', doneByMinuteOfDay: null, transitionFactor: 1.15, runCount: 0, createdAt: 1, updatedAt: 1, scheduleDays: [], alertEnabled: false, alertLeadMin: 0 },
    [],
  );
  await repo.create(
    { id: 'b', name: 'B', doneByMinuteOfDay: null, transitionFactor: 1.15, runCount: 0, createdAt: 2, updatedAt: 5, scheduleDays: [], alertEnabled: false, alertLeadMin: 0 },
    [],
  );
  const list = await repo.list();
  expect(list.map((r) => r.routine.id)).toEqual(['b', 'a']);
});

// ── A1: Scheduling + alert fields ──────────────────────────────────────────────

it('round-trips scheduleDays, alertEnabled, alertLeadMin via the memory adapter', async () => {
  const repo = makeRoutinesRepo(createMemoryDatabase());
  const routine: Routine = {
    id: 'r-sched',
    name: 'Workout',
    doneByMinuteOfDay: 7 * 60,
    transitionFactor: 1.15,
    runCount: 0,
    createdAt: 1000,
    updatedAt: 1000,
    scheduleDays: [1, 3, 5],
    alertEnabled: true,
    alertLeadMin: 10,
  };
  await repo.create(routine, []);

  const got = await repo.get('r-sched');
  expect(got?.routine.scheduleDays).toEqual([1, 3, 5]);
  expect(got?.routine.alertEnabled).toBe(true);
  expect(got?.routine.alertLeadMin).toBe(10);

  const list = await repo.list();
  expect(list[0]?.routine.scheduleDays).toEqual([1, 3, 5]);
});

it('empty scheduleDays round-trips as an empty array', async () => {
  const repo = makeRoutinesRepo(createMemoryDatabase());
  const routine: Routine = {
    id: 'r-empty',
    name: 'Empty days',
    doneByMinuteOfDay: null,
    transitionFactor: 1.15,
    runCount: 0,
    createdAt: 1000,
    updatedAt: 1000,
    scheduleDays: [],
    alertEnabled: false,
    alertLeadMin: 0,
  };
  await repo.create(routine, []);

  const got = await repo.get('r-empty');
  expect(got?.routine.scheduleDays).toEqual([]);
  expect(got?.routine.alertEnabled).toBe(false);
});
