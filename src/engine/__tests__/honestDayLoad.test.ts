// src/engine/__tests__/honestDayLoad.test.ts
import { honestDayLoad } from '@/src/engine';

test('sums tasks + events; free = window − events', () => {
  const r = honestDayLoad({ taskHonestMins: [100, 35], eventTimedMins: [60], wakingWindowMin: 600 });
  expect(r.taskMin).toBe(135);
  expect(r.eventMin).toBe(60);
  expect(r.committedMin).toBe(195);
  expect(r.freeMin).toBe(540); // 600 − 60
  expect(r.verdict).toBe('comfortable'); // 195 < 0.8*540
  expect(r.overByMin).toBe(0);
});

test('snug when committed ≤ window but near it', () => {
  const r = honestDayLoad({ taskHonestMins: [500], eventTimedMins: [60], wakingWindowMin: 600 });
  // committed 560 ≤ 600 window; free 540; 560 > 0.8*540 → snug
  expect(r.verdict).toBe('snug');
  expect(r.overByMin).toBe(0);
});

test('over when committed exceeds the window — amber, never negative free', () => {
  const r = honestDayLoad({ taskHonestMins: [600, 120], eventTimedMins: [180], wakingWindowMin: 600 });
  expect(r.verdict).toBe('over');
  expect(r.overByMin).toBe(300); // 900 − 600
  expect(r.freeMin).toBe(420); // 600 − 180, never below 0
});

test('empty day is comfortable, zeros', () => {
  const r = honestDayLoad({ taskHonestMins: [], eventTimedMins: [], wakingWindowMin: 600 });
  expect(r).toMatchObject({ taskMin: 0, eventMin: 0, committedMin: 0, verdict: 'comfortable', overByMin: 0 });
});

test('events shrink free but verdict is task-vs-free (no double count)', () => {
  const r = honestDayLoad({ taskHonestMins: [100], eventTimedMins: [400], wakingWindowMin: 600 });
  // free = 600 − 400 = 200; taskMin 100 < 0.8*200=160 → comfortable; committed 500 < 600 → not over
  expect(r.verdict).toBe('comfortable');
  expect(r.freeMin).toBe(200);
  expect(r.overByMin).toBe(0);
});
