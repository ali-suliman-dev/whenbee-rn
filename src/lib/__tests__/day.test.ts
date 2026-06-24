// src/lib/__tests__/day.test.ts
import { toLocalDayKey, addDays, compareDayKeys } from '@/src/lib/day';

describe('day keys', () => {
  test('toLocalDayKey formats local Y-M-D zero-padded', () => {
    // 2026-06-24 12:00 local — build via local Date so the test is tz-agnostic.
    const ms = new Date(2026, 5, 24, 12, 0, 0).getTime();
    expect(toLocalDayKey(ms)).toBe('2026-06-24');
  });

  test('toLocalDayKey pads single-digit month/day', () => {
    const ms = new Date(2026, 0, 5, 9, 0, 0).getTime();
    expect(toLocalDayKey(ms)).toBe('2026-01-05');
  });

  test('addDays crosses month and year boundaries', () => {
    expect(addDays('2026-06-24', 1)).toBe('2026-06-25');
    expect(addDays('2026-06-30', 1)).toBe('2026-07-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  test('compareDayKeys orders chronologically', () => {
    expect(compareDayKeys('2026-06-24', '2026-06-25')).toBeLessThan(0);
    expect(compareDayKeys('2026-06-25', '2026-06-24')).toBeGreaterThan(0);
    expect(compareDayKeys('2026-06-24', '2026-06-24')).toBe(0);
  });
});
