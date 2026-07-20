// src/stores/__tests__/dayTasksStore.planAnchor.test.ts
// The plan anchor: which end of the day the user pinned (start or finish), plus
// the start-at minute that goes with it. Mirrors doneByMin's nullable
// minute-of-day shape; null means the live "Now" anchor, not "unset".

import { createMemoryDatabase } from '@/src/db/memoryDatabase';
import { makeTasksRepo } from '@/src/db/repositories/tasksRepo';
import { makeDayTasksStore } from '@/src/stores/dayTasksStore';

const NOW = new Date(2026, 5, 24, 9, 0, 0).getTime(); // 2026-06-24
const TODAY = '2026-06-24';
const TOMORROW = '2026-06-25';

function freshStore(initialKv: Record<string, string> = {}) {
  const repo = makeTasksRepo(createMemoryDatabase());
  const flags = new Map<string, string>(Object.entries(initialKv));
  return {
    store: makeDayTasksStore({
      repo,
      kvGet: (k) => flags.get(k) ?? null,
      kvSet: (k, v) => {
        flags.set(k, v);
      },
    }),
    flags,
  };
}

test('a fresh day starts on the Now anchor with the finish row selected', async () => {
  const { store } = freshStore();
  await store.getState().init(NOW);

  expect(store.getState().startAtMin).toBeNull();
  expect(store.getState().planAnchor).toBe('finish');
});

test('setStartAt pins a minute and selects the start row', async () => {
  const { store } = freshStore();
  await store.getState().init(NOW);

  store.getState().setStartAt(9 * 60 + 30);

  expect(store.getState().startAtMin).toBe(9 * 60 + 30);
  expect(store.getState().planAnchor).toBe('start');
});

test('setStartAt(null) is "Use now" — it restores the live anchor and keeps the start row', async () => {
  const { store } = freshStore();
  await store.getState().init(NOW);
  store.getState().setStartAt(9 * 60 + 30);

  store.getState().setStartAt(null);

  expect(store.getState().startAtMin).toBeNull();
  expect(store.getState().planAnchor).toBe('start');
});

test('setDoneBy selects the finish row', async () => {
  const { store } = freshStore();
  await store.getState().init(NOW);
  store.getState().setStartAt(9 * 60 + 30);

  await store.getState().setDoneBy(15 * 60 + 30);

  expect(store.getState().planAnchor).toBe('finish');
});

// The case that decides derive-vs-store: after "Use now" both fields are
// meaningful (a real finish time AND a live start), so doneByMin !== null can no
// longer tell us which row the user is steering by. Only an explicit anchor can.
test('"Use now" after a finish time keeps both values and still selects the start row', async () => {
  const { store } = freshStore();
  await store.getState().init(NOW);
  await store.getState().setDoneBy(15 * 60 + 30);

  store.getState().setStartAt(null);

  expect(store.getState().dayMeta?.doneByMin).toBe(15 * 60 + 30);
  expect(store.getState().startAtMin).toBeNull();
  expect(store.getState().planAnchor).toBe('start');
});

test('setPlanAnchor selects a row without touching either value', async () => {
  const { store } = freshStore();
  await store.getState().init(NOW);
  store.getState().setStartAt(9 * 60 + 30);

  store.getState().setPlanAnchor('finish');

  expect(store.getState().planAnchor).toBe('finish');
  expect(store.getState().startAtMin).toBe(9 * 60 + 30);
});

test('the anchor is per-day: a start pinned today does not leak to tomorrow', async () => {
  const { store } = freshStore();
  await store.getState().init(NOW);
  store.getState().setStartAt(9 * 60 + 30);

  await store.getState().selectDate(TOMORROW);

  expect(store.getState().startAtMin).toBeNull();
  expect(store.getState().planAnchor).toBe('finish');
});

test('the anchor comes back with its day', async () => {
  const { store } = freshStore();
  await store.getState().init(NOW);
  store.getState().setStartAt(9 * 60 + 30);
  await store.getState().selectDate(TOMORROW);

  await store.getState().selectDate(TODAY);

  expect(store.getState().startAtMin).toBe(9 * 60 + 30);
  expect(store.getState().planAnchor).toBe('start');
});

test('goToToday restores the day\'s stored anchor', async () => {
  const { store } = freshStore();
  await store.getState().init(NOW);
  store.getState().setStartAt(7 * 60);
  await store.getState().selectDate(TOMORROW);

  await store.getState().goToToday(NOW);

  expect(store.getState().startAtMin).toBe(7 * 60);
  expect(store.getState().planAnchor).toBe('start');
});

test('clearPlan resets the start back to Now and the selection back to finish', async () => {
  const { store } = freshStore();
  await store.getState().init(NOW);
  store.getState().setStartAt(9 * 60 + 30);
  await store.getState().setDoneBy(15 * 60 + 30);
  store.getState().setPlanAnchor('start');

  await store.getState().clearPlan();

  expect(store.getState().startAtMin).toBeNull();
  expect(store.getState().planAnchor).toBe('finish');
  expect(store.getState().dayMeta?.doneByMin ?? null).toBeNull();
});
