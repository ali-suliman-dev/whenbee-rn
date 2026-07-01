import {
  formatClock,
  formatMmSs,
  projectedFinish,
  minutesLeft,
  isOverrun,
  startOfLocalDay,
  dayEndEpochFor,
  formatClockMin,
  formatWindowRange,
  setClockHour12,
} from '@/src/lib/time';

// Build a deterministic local epoch from explicit Y/M/D h:m so the formatted
// output is independent of the machine's timezone (we read it back via Date too).
function at(hour: number, min: number): number {
  return new Date(2024, 0, 15, hour, min, 0, 0).getTime();
}

describe('formatClock', () => {
  it('formats a morning time as 12h with no leading zero on the hour', () => {
    expect(formatClock(at(9, 42))).toBe('9:42');
  });

  it('pads the minutes to two digits', () => {
    expect(formatClock(at(9, 5))).toBe('9:05');
    expect(formatClock(at(9, 0))).toBe('9:00');
  });

  it('converts afternoon times to 12h (no leading zero, no am/pm needed)', () => {
    expect(formatClock(at(13, 7))).toBe('1:07');
    expect(formatClock(at(23, 59))).toBe('11:59');
  });

  it('renders midnight and noon as 12', () => {
    expect(formatClock(at(0, 0))).toBe('12:00');
    expect(formatClock(at(12, 30))).toBe('12:30');
  });

  it('formats 24h with a leading-zero hour when hour12 is false', () => {
    expect(formatClock(at(16, 46), false)).toBe('16:46');
    expect(formatClock(at(4, 46), false)).toBe('04:46');
    expect(formatClock(at(0, 0), false)).toBe('00:00');
    expect(formatClock(at(23, 59), false)).toBe('23:59');
  });
});

describe('formatMmSs', () => {
  it('formats minutes:seconds with a two-digit second', () => {
    expect(formatMmSs(845)).toBe('14:05'); // 14m 5s
  });

  it('handles zero and sub-minute values', () => {
    expect(formatMmSs(0)).toBe('0:00');
    expect(formatMmSs(9)).toBe('0:09');
    expect(formatMmSs(60)).toBe('1:00');
  });

  it('does not cap minutes (long sessions read straight through)', () => {
    expect(formatMmSs(3661)).toBe('61:01');
  });

  it('floors fractional seconds', () => {
    expect(formatMmSs(125.9)).toBe('2:05');
  });
});

describe('projectedFinish', () => {
  it('returns start + duration in ms', () => {
    const start = at(9, 14);
    expect(projectedFinish(start, 28)).toBe(start + 28 * 60000);
  });

  it('formats round-trip to the expected clock', () => {
    const start = at(9, 14);
    expect(formatClock(projectedFinish(start, 28))).toBe('9:42');
  });

  it('handles a zero-minute estimate', () => {
    const start = at(9, 14);
    expect(projectedFinish(start, 0)).toBe(start);
  });
});

describe('minutesLeft', () => {
  it('returns whole minutes remaining, flooring elapsed minutes', () => {
    expect(minutesLeft(15, 0)).toBe(15);
    expect(minutesLeft(15, 59)).toBe(15); // <1 min elapsed
    expect(minutesLeft(15, 60)).toBe(14); // exactly 1 min elapsed
    expect(minutesLeft(15, 119)).toBe(14);
  });

  it('goes negative on overrun', () => {
    expect(minutesLeft(15, 16 * 60)).toBe(-1);
    expect(minutesLeft(15, 20 * 60)).toBe(-5);
  });
});

describe('isOverrun', () => {
  it('is false while elapsed is under the estimate', () => {
    expect(isOverrun(15, 0)).toBe(false);
    expect(isOverrun(15, 14 * 60 + 59)).toBe(false);
  });

  it('becomes true at and past the estimate', () => {
    expect(isOverrun(15, 15 * 60)).toBe(true);
    expect(isOverrun(15, 15 * 60 + 1)).toBe(true);
    expect(isOverrun(15, 30 * 60)).toBe(true);
  });
});

describe('startOfLocalDay', () => {
  it('returns local midnight of the same calendar day', () => {
    const noon = new Date(2026, 5, 21, 12, 34, 56, 789).getTime(); // 21 Jun 2026, local
    const midnight = startOfLocalDay(noon);
    const d = new Date(midnight);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
    expect(d.getMilliseconds()).toBe(0);
    expect(d.getDate()).toBe(21);
  });
});

describe('dayEndEpochFor', () => {
  const noon = new Date(2026, 5, 21, 12, 0, 0, 0).getTime();
  it('places the day-end at the given minutes after local midnight (21:00)', () => {
    expect(dayEndEpochFor(noon, 21 * 60)).toBe(startOfLocalDay(noon) + 21 * 60 * 60_000);
  });
  it('0 minutes equals local midnight', () => {
    expect(dayEndEpochFor(noon, 0)).toBe(startOfLocalDay(noon));
  });
  it('1439 minutes equals 23:59 local', () => {
    expect(dayEndEpochFor(noon, 1439)).toBe(startOfLocalDay(noon) + 1439 * 60_000);
  });
});

describe('formatClockMin', () => {
  afterEach(() => setClockHour12(true)); // restore default
  it('formats 12h with no leading zero', () => {
    setClockHour12(true);
    expect(formatClockMin(90)).toBe('1:30');     // 01:30
    expect(formatClockMin(810)).toBe('1:30');    // 13:30
    expect(formatClockMin(0)).toBe('12:00');     // midnight
    expect(formatClockMin(720)).toBe('12:00');   // noon
  });
  it('formats 24h zero-padded', () => {
    expect(formatClockMin(810, false)).toBe('13:30');
    expect(formatClockMin(90, false)).toBe('01:30');
    expect(formatClockMin(0, false)).toBe('00:00');
  });
});

describe('formatWindowRange', () => {
  it('12h same half → one trailing meridiem', () => {
    expect(formatWindowRange(810, 960, true)).toBe('1:30 – 4:00 pm');
    expect(formatWindowRange(540, 660, true)).toBe('9:00 – 11:00 am');
  });
  it('12h crossing noon → two meridiems', () => {
    expect(formatWindowRange(690, 780, true)).toBe('11:30 am – 1:00 pm');
  });
  it('24h → no meridiem', () => {
    expect(formatWindowRange(810, 960, false)).toBe('13:30 – 16:00');
  });
});
