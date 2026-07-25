// src/engine/__tests__/honestLanding.test.ts
import { honestLanding, landingRange, type LandingTask } from '@/src/engine';

const MIN = 60_000;
// A fixed, readable clock: 7:10pm on 2026-07-25, end of day 9:00pm.
const NOW = new Date(2026, 6, 25, 19, 10).getTime();
const DAY_END = new Date(2026, 6, 25, 21, 0).getTime();

const task = (id: string, honestMin: number): LandingTask => ({ id, label: id, honestMin });

test('empty when nothing is queued', () => {
  const r = honestLanding({ nowMs: NOW, dayEndMs: DAY_END, tasks: [] });
  expect(r.kind).toBe('empty');
  expect(r.landingMs).toBeNull();
  expect(r.remainingMin).toBe(0);
  expect(r.tail).toBeNull();
  expect(r.ends).toEqual([]);
});

test('clear — lands before end of day, openMin is the gap to dayEnd', () => {
  const r = honestLanding({ nowMs: NOW, dayEndMs: DAY_END, tasks: [task('a', 45), task('b', 25)] });
  expect(r.kind).toBe('clear');
  expect(r.remainingMin).toBe(70);
  expect(r.landingMs).toBe(NOW + 70 * MIN); // 8:20pm
  expect(r.openMin).toBe(40); // 8:20pm → 9:00pm
  expect(r.overMin).toBe(0);
  expect(r.tail).toBeNull();
});

test('over — lands past end of day; tail is the task that CROSSES it, in order', () => {
  // 45 + 25 + 90 = 160 min from 7:10pm → 9:50pm. 'c' is the block spanning 9:00pm.
  const r = honestLanding({
    nowMs: NOW,
    dayEndMs: DAY_END,
    tasks: [task('a', 45), task('b', 25), task('c', 90)],
  });
  expect(r.kind).toBe('over');
  expect(r.landingMs).toBe(NOW + 160 * MIN);
  expect(r.overMin).toBe(50);
  expect(r.openMin).toBe(0);
  expect(r.tail?.id).toBe('c');
});

test('tail is chosen by execution order, NOT by largest block', () => {
  // The 90-min task runs FIRST and is the one crossing 9:00pm; the later 30-min
  // task is not the tail even though a largest-first drop would pick the 90.
  const r = honestLanding({
    nowMs: NOW,
    dayEndMs: DAY_END,
    tasks: [task('big', 90), task('small', 30), task('last', 60)],
  });
  expect(r.kind).toBe('over');
  expect(r.tail?.id).toBe('small'); // 90 ends 8:40, +30 ends 9:10 → 'small' crosses
});

test('a task ending exactly at end of day is clear, not over', () => {
  const r = honestLanding({ nowMs: NOW, dayEndMs: DAY_END, tasks: [task('a', 110)] });
  expect(r.kind).toBe('clear');
  expect(r.openMin).toBe(0);
  expect(r.overMin).toBe(0);
  expect(r.tail).toBeNull();
});

test('past — now is already at or beyond end of day, whatever is queued', () => {
  const late = new Date(2026, 6, 25, 22, 30).getTime();
  const r = honestLanding({ nowMs: late, dayEndMs: DAY_END, tasks: [task('a', 115)] });
  expect(r.kind).toBe('past');
  expect(r.remainingMin).toBe(115);
  expect(r.overMin).toBe(90); // minutes since dayEnd
  expect(r.landingMs).toBe(late + 115 * MIN);
});

test('past end of day with an empty queue is empty, even with a meeting still running', () => {
  // Meetings alone used to keep this out of 'empty', producing a card of zeroes —
  // "0m still queued", "0 done · 0m logged", "Move 0 to tomorrow". Past end of day
  // with nothing on the list there is no forecast and nothing to offer.
  const late = new Date(2026, 6, 25, 22, 0).getTime();
  const r = honestLanding({ nowMs: late, dayEndMs: DAY_END, tasks: [], eventMinAhead: 60 });
  expect(r.kind).toBe('empty');
  expect(r.landingMs).toBeNull();
  expect(r.ends).toEqual([]);
});

test('a meeting before end of day still reports a landing — only the past case is dropped', () => {
  const r = honestLanding({ nowMs: NOW, dayEndMs: DAY_END, tasks: [], eventMinAhead: 60 });
  expect(r.kind).toBe('clear');
  expect(r.landingMs).toBe(NOW + 60 * MIN);
});

test('past also covers now exactly on the boundary', () => {
  const r = honestLanding({ nowMs: DAY_END, dayEndMs: DAY_END, tasks: [task('a', 10)] });
  expect(r.kind).toBe('past');
  expect(r.overMin).toBe(0);
});

test('eventMinAhead pushes the landing out and can flip clear to over', () => {
  const r = honestLanding({
    nowMs: NOW,
    dayEndMs: DAY_END,
    tasks: [task('a', 60)],
    eventMinAhead: 90,
  });
  expect(r.kind).toBe('over');
  expect(r.remainingMin).toBe(60); // remainingMin is TASK minutes only
  expect(r.landingMs).toBe(NOW + 150 * MIN); // 9:40pm
  expect(r.overMin).toBe(40);
});

test('ends carries a cumulative finish per task, in input order', () => {
  const r = honestLanding({ nowMs: NOW, dayEndMs: DAY_END, tasks: [task('a', 45), task('b', 25)] });
  expect(r.ends).toEqual([
    { id: 'a', endMs: NOW + 45 * MIN },
    { id: 'b', endMs: NOW + 70 * MIN },
  ]);
});

test('negative or zero honest minutes never move the clock backwards', () => {
  const r = honestLanding({ nowMs: NOW, dayEndMs: DAY_END, tasks: [task('a', -30), task('b', 20)] });
  expect(r.remainingMin).toBe(20);
  expect(r.landingMs).toBe(NOW + 20 * MIN);
});

test('landingRange projects a summed band onto the clock', () => {
  const r = landingRange({ nowMs: NOW, lowMin: 180, highMin: 260 });
  expect(r.lowMs).toBe(NOW + 180 * MIN); // 10:10pm
  expect(r.highMs).toBe(NOW + 260 * MIN); // 11:30pm
});

test('landingRange folds events into both edges and never inverts', () => {
  const r = landingRange({ nowMs: NOW, lowMin: 90, highMin: 40, eventMinAhead: 30 });
  expect(r.lowMs).toBe(NOW + 70 * MIN); // low/high swapped back: 40 + 30
  expect(r.highMs).toBe(NOW + 120 * MIN); // 90 + 30
});
