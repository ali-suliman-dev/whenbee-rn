import { greetingFor } from '../greeting';

describe('greetingFor', () => {
  it('buckets morning/afternoon/evening (doc 12 boundaries)', () => {
    expect(greetingFor(6)).toBe('Good morning');
    expect(greetingFor(13)).toBe('Good afternoon');
    expect(greetingFor(19)).toBe('Good evening');
    expect(greetingFor(2)).toBe('Good evening'); // 17:00–04:59 is evening
  });
  it('appends a name when given', () => {
    expect(greetingFor(6, 'Ali')).toBe('Good morning, Ali');
  });
  it('never emits a trailing comma or "undefined" without a name', () => {
    expect(greetingFor(6)).not.toMatch(/undefined|,\s*$/);
    expect(greetingFor(6, '')).toBe('Good morning'); // empty name = no name
  });
});
