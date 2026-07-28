import {
  landingHeadline,
  landingFooter,
  landingScale,
  landingLegend,
  landingUpsell,
} from '@/src/features/today/honestLandingCopy';
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

// The card used to lead with "N more logs and this tightens" whenever the
// categories were cold. It competed with the Pro offer directly beneath it for
// the same slot, and asked for work rather than stating a fact — so the footer
// now always reports what is true about the day and the offer stands alone.
test('a cold estimate no longer displaces the day fact', () => {
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
  expect(f.text).toBe('1 done · 30m logged');
  expect(f.action).toBe('Move 1 to tomorrow');
  expect(f.text).not.toMatch(/more logs/);
});

test('over footer names the tail task, it does not restate the overage', () => {
  const f = landingFooter(over, { doneCount: 2, doneHonestMin: 75, logsToWarm: 0, dayEndShort: '9' });
  expect(f.text).toBe('Draft the deck lands after 9');
  expect(f.boldSpan).toBe('Draft the deck');
  expect(f.action).toBe('Move it');
});

test('a cold start still names the tail that lands late', () => {
  const f = landingFooter(over, { doneCount: 0, doneHonestMin: 0, logsToWarm: 4, dayEndShort: '9' });
  expect(f.text).toBe('Draft the deck lands after 9');
  expect(f.action).toBe('Move it');
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

test('past footer makes NO offer when there is nothing left to move', () => {
  // "Move 0 to tomorrow" was tappable and did nothing. An action that cannot act
  // is not offered at all.
  const nothingToMove: LandingResult = {
    kind: 'past',
    landingMs: NOW,
    overMin: 60,
    openMin: 0,
    remainingMin: 0,
    tail: null,
    ends: [],
  };
  const f = landingFooter(nothingToMove, {
    doneCount: 0,
    doneHonestMin: 0,
    logsToWarm: 0,
    dayEndShort: '9',
  });
  expect(f.action).toBeNull();
});

const DAY_END = new Date(2026, 6, 25, 21, 0).getTime();

test('the over scale labels the present moment and names all three times', () => {
  expect(landingScale(over, { nowMs: NOW, dayEndMs: DAY_END })).toEqual([
    'now · 7:10pm',
    '9:00pm',
    '9:50pm',
  ]);
});

test('a range in the headline drops the exact landing from the scale', () => {
  // The headline reads "Roughly done 9:10pm – 10:30pm" here. A scale that then
  // said "9:50pm" would assert the very minute the headline just disclaimed.
  expect(landingScale(over, { nowMs: NOW, dayEndMs: DAY_END, hasRange: true })).toEqual([
    'now · 7:10pm',
    '9:00pm',
  ]);
});

test('the clear scale keeps the "now" anchor — two bare clocks would have none', () => {
  const clear: LandingResult = {
    kind: 'clear',
    landingMs: NOW + 60 * MIN,
    overMin: 0,
    openMin: 50,
    remainingMin: 60,
    tail: null,
    ends: [],
  };
  expect(landingScale(clear, { nowMs: NOW, dayEndMs: DAY_END })).toEqual(['now · 7:10pm', '9:00pm']);
});

test('the states that render no bar get no scale', () => {
  const past: LandingResult = { ...over, kind: 'past' };
  const empty: LandingResult = { ...over, kind: 'empty', landingMs: null, tail: null };
  expect(landingScale(past, { nowMs: NOW, dayEndMs: DAY_END })).toEqual([]);
  expect(landingScale(empty, { nowMs: NOW, dayEndMs: DAY_END })).toEqual([]);
});

test('a Pro day with meetings offers the calendar instead of another task, stating the TRUE booked total', () => {
  const clear: LandingResult = {
    kind: 'clear',
    landingMs: NOW + 60 * MIN,
    overMin: 0,
    openMin: 50,
    remainingMin: 60,
    tail: null,
    ends: [],
  };
  const f = landingFooter(clear, {
    doneCount: 2,
    doneHonestMin: 75,
    logsToWarm: 0,
    dayEndShort: '9',
    bookedMinAll: 90,
  });
  expect(f.action).toBe('Pad calendar');
  // The fact now states the booked total, not the done-count — mirrors the
  // 'over' branch, which also swaps the whole sentence rather than appending.
  expect(f.text).toBe('1h 30m already booked today');
  expect(f.boldSpan).toBe('1h 30m');
});

test('the footer states the UNCLAMPED booked total, never the bar-span-clamped one', () => {
  // 2h really booked, even though only part of it would fit inside the bar's
  // now→landing span (that clamped figure is `bookedMin`, used only by the
  // bar/legend). The sentence about the whole day must use the true total.
  const clear: LandingResult = {
    kind: 'clear',
    landingMs: NOW + 60 * MIN,
    overMin: 0,
    openMin: 50,
    remainingMin: 60,
    tail: null,
    ends: [],
  };
  const f = landingFooter(clear, {
    doneCount: 2,
    doneHonestMin: 75,
    logsToWarm: 0,
    dayEndShort: '9',
    bookedMinAll: 120,
  });
  expect(f.text).toBe('2h already booked today');
});

test('booked time never outranks naming the tail task', () => {
  const f = landingFooter(over, {
    doneCount: 2,
    doneHonestMin: 75,
    logsToWarm: 0,
    dayEndShort: '9',
    bookedMinAll: 90,
  });
  expect(f.action).toBe('Move it');
});

describe('landingLegend', () => {
  it('names calendar time booked, never meetings', () => {
    const legend = landingLegend({ taskMin: 95, bookedMin: 120, overMin: 0 });
    expect(legend).toEqual([
      { key: 'tasks', value: '1h 35m', label: 'tasks' },
      { key: 'booked', value: '2h', label: 'booked' },
    ]);
    expect(JSON.stringify(legend)).not.toMatch(/meeting/i);
  });

  it('adds the over entry only when the day runs past its end', () => {
    const legend = landingLegend({ taskMin: 400, bookedMin: 255, overMin: 40 });
    expect(legend.map((e) => e.key)).toEqual(['tasks', 'booked', 'over']);
  });

  it('returns nothing when no calendar time exists', () => {
    expect(landingLegend({ taskMin: 95, bookedMin: 0, overMin: 0 })).toEqual([]);
  });

  it('drops the tasks entry when the booked span swallows the whole in-day segment', () => {
    // meetMs clamped to the full in-day span leaves taskInDayMs at 0 — no indigo
    // segment renders on the bar, so a "tasks" dot would explain a colour that
    // isn't on screen.
    const legend = landingLegend({ taskMin: 0, bookedMin: 60, overMin: 0 });
    expect(legend).toEqual([{ key: 'booked', value: '1h', label: 'booked' }]);
  });
});

describe('landingUpsell', () => {
  it('names the limit of the number on screen without blaming anyone', () => {
    expect(landingUpsell()).toEqual({
      text: "Optimistic — your calendar isn't in it",
      action: 'Add it',
    });
  });
});
