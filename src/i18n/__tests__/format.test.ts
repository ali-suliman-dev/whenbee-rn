import { makeFormatters } from '../format';

describe('makeFormatters', () => {
  const d = new Date(2026, 0, 5); // Mon Jan 5 2026

  it('formats weekday + monthDay for en', () => {
    const f = makeFormatters('en-US');
    expect(f.weekdayShort(d)).toBe('Mon');
    expect(f.monthDay(d)).toBe('Jan 5');
  });

  it('formats weekdayLong (full name, no month/day) for en and sv', () => {
    expect(makeFormatters('en-US').weekdayLong(d)).toBe('Monday');
    expect(makeFormatters('sv-SE').weekdayLong(d).toLowerCase()).toBe('måndag');
  });

  it('formats weekday + monthDay for sv (different words)', () => {
    const f = makeFormatters('sv-SE');
    expect(f.weekdayShort(d).toLowerCase()).toContain('mån');
  });

  it('formats fullDate for en-US', () => {
    const f = makeFormatters('en-US');
    const expected = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(d);
    expect(f.fullDate(d)).toBe(expected);
  });
});
