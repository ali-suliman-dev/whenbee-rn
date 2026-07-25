import { landingHeadline, landingFooter } from '@/src/features/today/honestLandingCopy';
import type { LandingResult, LandingTask } from '@/src/engine';

const NOW = new Date(2026, 6, 25, 19, 10).getTime();
const MIN = 60_000;
const tail: LandingTask = { id: 'c', label: 'Draft the deck', honestMin: 90 };

const over: LandingResult = {
  kind: 'over',
  landingMs: NOW + 160 * MIN, // 9:50pm
  overMin: 50,
  openMin: 0,
  remainingMin: 160,
  tail,
  ends: [],
};

test('over headline leads with the landing, then the cost — no "by", no second clock', () => {
  const c = landingHeadline(over, {});
  expect(c.lead).toBe('Done ');
  expect(c.clock).toBe('~9:50pm');
  expect(c.trail).toBe(' · 50m past your day');
});

test('the D-alt variant is a string swap, not a different shape', () => {
  const c = landingHeadline(over, { variant: 'dAlt' });
  expect(c.lead).toBe('');
  expect(c.clock).toBe('~9:50pm');
  expect(c.trail).toBe(". That's 50m past your day.");
});

test('clear headline states the slack instead of a cost', () => {
  const clear: LandingResult = {
    kind: 'clear',
    landingMs: NOW + 105 * MIN,
    overMin: 0,
    openMin: 600,
    remainingMin: 105,
    tail: null,
    ends: [],
  };
  const c = landingHeadline(clear, {});
  expect(c.trail).toBe(' · 10h still open');
});

test('cold start reads as a range and never claims one time', () => {
  const c = landingHeadline(over, { rangeLowMs: NOW + 200 * MIN, rangeHighMs: NOW + 280 * MIN });
  expect(c.lead).toBe('Roughly done ');
  expect(c.clock).toBe('10:30pm – 11:50pm');
  expect(c.trail).toBe('');
});

test('past headline states the fact without a scold', () => {
  const past: LandingResult = {
    kind: 'past',
    landingMs: NOW,
    overMin: 90,
    openMin: 0,
    remainingMin: 115,
    tail: null,
    ends: [],
  };
  const c = landingHeadline(past, {});
  expect(c.lead).toBe('Your day ended ');
  expect(c.clock).toBe('1h 30m ago');
  expect(c.trail).toBe(' · 1h 55m still queued');
});

test('empty headline renders no clock — a regression to the epoch fallback fails loudly', () => {
  const empty: LandingResult = {
    kind: 'empty',
    landingMs: null,
    overMin: 0,
    openMin: 0,
    remainingMin: 0,
    tail: null,
    ends: [],
  };
  const c = landingHeadline(empty, {});
  expect(c.clock).not.toMatch(/\d/);
});

test('a past day wins over a supplied range — the range never overrides the fact', () => {
  const past: LandingResult = {
    kind: 'past',
    landingMs: NOW,
    overMin: 90,
    openMin: 0,
    remainingMin: 115,
    tail: null,
    ends: [],
  };
  const c = landingHeadline(past, { rangeLowMs: NOW + 200 * MIN, rangeHighMs: NOW + 280 * MIN });
  expect(c.lead).toBe('Your day ended ');
  expect(c.clock).toBe('1h 30m ago');
});

test('warming logs win over the past footer', () => {
  const past: LandingResult = {
    kind: 'past',
    landingMs: NOW,
    overMin: 90,
    openMin: 0,
    remainingMin: 115,
    tail: null,
    ends: [{ id: 'a', endMs: NOW }],
  };
  const f = landingFooter(past, { doneCount: 1, doneHonestMin: 30, logsToWarm: 3, dayEndShort: '9' });
  expect(f.text).toBe('3 more logs and this tightens');
  expect(f.action).toBe('Start one');
});

test('over footer names the tail task, it does not restate the overage', () => {
  const f = landingFooter(over, { doneCount: 2, doneHonestMin: 75, logsToWarm: 0, dayEndShort: '9' });
  expect(f.text).toBe('Draft the deck lands after 9');
  expect(f.boldSpan).toBe('Draft the deck');
  expect(f.action).toBe('Move it');
});

test('cold-start footer counts the real logs left', () => {
  const f = landingFooter(over, { doneCount: 0, doneHonestMin: 0, logsToWarm: 4, dayEndShort: '9' });
  expect(f.text).toBe('4 more logs and this tightens');
  expect(f.action).toBe('Start one');
});

test('clear footer with nothing logged offers growth, not a cut', () => {
  const clear: LandingResult = {
    kind: 'clear',
    landingMs: NOW,
    overMin: 0,
    openMin: 600,
    remainingMin: 105,
    tail: null,
    ends: [],
  };
  const f = landingFooter(clear, { doneCount: 0, doneHonestMin: 0, logsToWarm: 0, dayEndShort: '9' });
  expect(f.text).toBe('Nothing logged yet');
  expect(f.action).toBe('Add a task');
});

test('past footer offers tomorrow and says "logged", never "banked"', () => {
  const past: LandingResult = {
    kind: 'past',
    landingMs: NOW,
    overMin: 90,
    openMin: 0,
    remainingMin: 115,
    tail: null,
    ends: [{ id: 'a', endMs: NOW }, { id: 'b', endMs: NOW }],
  };
  const f = landingFooter(past, { doneCount: 2, doneHonestMin: 75, logsToWarm: 0, dayEndShort: '9' });
  expect(f.text).toBe('2 done · 1h 15m logged');
  expect(f.action).toBe('Move 2 to tomorrow');
});
