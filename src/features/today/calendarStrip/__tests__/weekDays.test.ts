// src/features/today/calendarStrip/__tests__/weekDays.test.ts
import { weekFor, dayCells } from '../weekDays';

const enWeekdayShort = (d: Date) => new Intl.DateTimeFormat('en', { weekday: 'short' }).format(d);

describe('weekFor', () => {
  test('Mon-start: 2026-06-24 (Wed) → 2026-06-22..2026-06-28', () => {
    const keys = weekFor('2026-06-24', 1);
    expect(keys).toHaveLength(7);
    expect(keys[0]).toBe('2026-06-22'); // Monday
    expect(keys[6]).toBe('2026-06-28'); // Sunday
    expect(keys[2]).toBe('2026-06-24'); // Wednesday at index 2
  });

  test('Sun-start: 2026-06-24 (Wed) → 2026-06-21..2026-06-27', () => {
    const keys = weekFor('2026-06-24', 0);
    expect(keys).toHaveLength(7);
    expect(keys[0]).toBe('2026-06-21'); // Sunday
    expect(keys[6]).toBe('2026-06-27'); // Saturday
    expect(keys[3]).toBe('2026-06-24'); // Wednesday at index 3
  });

  test('Mon-start: anchor is Monday itself → same day at index 0', () => {
    const keys = weekFor('2026-06-22', 1);
    expect(keys[0]).toBe('2026-06-22');
    expect(keys[6]).toBe('2026-06-28');
  });

  test('Sun-start: anchor is Sunday itself → same day at index 0', () => {
    const keys = weekFor('2026-06-21', 0);
    expect(keys[0]).toBe('2026-06-21');
    expect(keys[6]).toBe('2026-06-27');
  });

  test('Mon-start: anchor is Sunday 2026-06-28 → goes in last slot', () => {
    const keys = weekFor('2026-06-28', 1);
    expect(keys[0]).toBe('2026-06-22');
    expect(keys[6]).toBe('2026-06-28');
  });
});

describe('dayCells', () => {
  const WEEK_MON = weekFor('2026-06-24', 1); // Mon 22..Sun 28

  test('isToday and isSelected flag the right cells', () => {
    const cells = dayCells(WEEK_MON, '2026-06-24', '2026-06-24', new Set(), enWeekdayShort);
    const todayCell = cells.find((c) => c.key === '2026-06-24');
    expect(todayCell?.isToday).toBe(true);
    expect(todayCell?.isSelected).toBe(true);

    const otherCell = cells.find((c) => c.key === '2026-06-22');
    expect(otherCell?.isToday).toBe(false);
    expect(otherCell?.isSelected).toBe(false);
  });

  test('isSelected differs from isToday when selection != today', () => {
    const cells = dayCells(WEEK_MON, '2026-06-24', '2026-06-25', new Set(), enWeekdayShort);
    const todayCell = cells.find((c) => c.key === '2026-06-24');
    expect(todayCell?.isToday).toBe(true);
    expect(todayCell?.isSelected).toBe(false);

    const selectedCell = cells.find((c) => c.key === '2026-06-25');
    expect(selectedCell?.isToday).toBe(false);
    expect(selectedCell?.isSelected).toBe(true);
  });

  test('hasTasks is true only for keys in the set', () => {
    const tasksSet = new Set(['2026-06-22', '2026-06-26']);
    const cells = dayCells(WEEK_MON, '2026-06-24', '2026-06-24', tasksSet, enWeekdayShort);
    expect(cells.find((c) => c.key === '2026-06-22')?.hasTasks).toBe(true);
    expect(cells.find((c) => c.key === '2026-06-26')?.hasTasks).toBe(true);
    expect(cells.find((c) => c.key === '2026-06-23')?.hasTasks).toBe(false);
    expect(cells.find((c) => c.key === '2026-06-24')?.hasTasks).toBe(false);
  });

  test('dayNum is the day-of-month as string', () => {
    const cells = dayCells(WEEK_MON, '2026-06-24', '2026-06-24', new Set(), enWeekdayShort);
    expect(cells.find((c) => c.key === '2026-06-22')?.dayNum).toBe('22');
    expect(cells.find((c) => c.key === '2026-06-28')?.dayNum).toBe('28');
  });

  test('weekdayLabel is a short string for Mon and Wed', () => {
    const cells = dayCells(WEEK_MON, '2026-06-24', '2026-06-24', new Set(), enWeekdayShort);
    const monCell = cells.find((c) => c.key === '2026-06-22');
    const wedCell = cells.find((c) => c.key === '2026-06-24');
    // Labels should be short (1-3 chars) and consistent
    expect(monCell?.weekdayLabel).toMatch(/^[A-Z][a-z]{0,2}$/);
    expect(wedCell?.weekdayLabel).toMatch(/^[A-Z][a-z]{0,2}$/);
    expect(monCell?.weekdayLabel).toBe('Mon');
    expect(wedCell?.weekdayLabel).toBe('Wed');
  });

  test('produces exactly 7 cells matching the input keys', () => {
    const cells = dayCells(WEEK_MON, '2026-06-24', '2026-06-24', new Set(), enWeekdayShort);
    expect(cells).toHaveLength(7);
    cells.forEach((cell, i) => {
      expect(cell.key).toBe(WEEK_MON[i]);
    });
  });
});
