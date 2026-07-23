import { ripeningHeaderCopy, logsToGoLabel, waitLabelFor } from '../copy';

describe('ripeningHeaderCopy', () => {
  it('returns the zero-ready title and sub', () => {
    expect(ripeningHeaderCopy(0, 4)).toEqual({
      title: 'Your Pro features are on the way.',
      sub: 'Each one opens once your logs can back it up.',
    });
  });

  it('returns the singular title when exactly one feature is ready', () => {
    expect(ripeningHeaderCopy(1, 4)).toEqual({
      title: 'Your first Pro feature is ready.',
      sub: 'The rest open as you log more tasks.',
    });
  });

  it('returns the tally title when more than one feature is ready', () => {
    expect(ripeningHeaderCopy(3, 4)).toEqual({
      title: '3 of 4 Pro features are ready.',
      sub: 'The rest open as you log more tasks.',
    });
  });
});

describe('logsToGoLabel', () => {
  it('pluralizes "logs" for counts other than 1', () => {
    expect(logsToGoLabel(5)).toBe('5 logs to go');
    expect(logsToGoLabel(0)).toBe('0 logs to go');
  });

  it('keeps "log" singular for exactly 1', () => {
    expect(logsToGoLabel(1)).toBe('1 log to go');
  });
});

describe('waitLabelFor', () => {
  it('uses a calendar-week register for the weekly review feature', () => {
    expect(waitLabelFor('honest-week', 5)).toBe('about a week');
  });

  it('uses a calendar-month register for the monthly review feature', () => {
    expect(waitLabelFor('honest-month', 12)).toBe('about a month');
  });

  it('falls back to a logs-to-go label for other log-gated features', () => {
    expect(waitLabelFor('day-capacity', 3)).toBe('3 logs to go');
    expect(waitLabelFor('steals-your-time', 1)).toBe('1 log to go');
  });
});
