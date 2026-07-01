// src/features/today/calendarStrip/weekDays.ts
// Pure helpers for calendar strip: week enumeration and display cell construction.
// No direct Date use here — delegates calendar arithmetic to src/lib/day.ts.

import { addDays, weekdayOf } from '@/src/lib/day';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DayCell {
  /** 'YYYY-MM-DD' key */
  key: string;
  /** Short weekday label, e.g. 'Mon', 'Tue' */
  weekdayLabel: string;
  /** Day-of-month as a string, e.g. '7', '24' */
  dayNum: string;
  isToday: boolean;
  isSelected: boolean;
  hasTasks: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Short 3-char weekday labels, index 0 = Sunday. */
const WEEKDAY_LABELS: readonly string[] = [
  'Sun',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
] as const;

// ─── formatA11yLabel ───────────────────────────────────────────────────────────

/**
 * Formats a day-key as "Weekday Month DD" for a11y labels (e.g. "Wednesday June 24").
 * `fullDate` is a locale-aware formatter (see `makeFormatters`/`useLocalizedFormat`
 * in `src/i18n`) threaded in from the calling component — this file stays pure
 * and never imports i18n directly.
 */
export function formatA11yLabel(key: string, fullDate: (d: Date) => string): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  return fullDate(date);
}

// ─── weekFor ──────────────────────────────────────────────────────────────────

/**
 * Returns the 7 'YYYY-MM-DD' keys of the week containing `anchorKey`, in order.
 * Index 0 is always the week-start day (Sun when weekStartsOn=0, Mon when =1).
 */
export function weekFor(anchorKey: string, weekStartsOn: 0 | 1): string[] {
  const anchorWeekday = weekdayOf(anchorKey); // 0=Sun..6=Sat

  // Number of days between anchor and the start of its week.
  // For Mon-start: Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6
  // For Sun-start: Sun=0, Mon=1, ..., Sat=6
  let daysFromStart: number;
  if (weekStartsOn === 1) {
    // Monday-start: Monday is weekday 1; Sunday (0) wraps to 6
    daysFromStart = anchorWeekday === 0 ? 6 : anchorWeekday - 1;
  } else {
    // Sunday-start: Sunday is 0, Saturday is 6
    daysFromStart = anchorWeekday;
  }

  const weekStartKey = addDays(anchorKey, -daysFromStart);

  const keys: string[] = [];
  for (let i = 0; i < 7; i++) {
    keys.push(addDays(weekStartKey, i));
  }
  return keys;
}

// ─── dayCells ─────────────────────────────────────────────────────────────────

/**
 * Maps a sorted array of 7 week keys to display cells.
 *
 * @param weekKeys    7 'YYYY-MM-DD' keys from weekFor()
 * @param today       Today's key (for isToday)
 * @param selected    Currently selected key (for isSelected)
 * @param datesWithTasks  Set of keys that have at least one task
 */
export function dayCells(
  weekKeys: string[],
  today: string,
  selected: string,
  datesWithTasks: ReadonlySet<string>,
): DayCell[] {
  return weekKeys.map((key) => {
    const weekday = weekdayOf(key);
    const label = WEEKDAY_LABELS[weekday];
    // dayNum: extract the DD portion from YYYY-MM-DD and strip leading zero
    const ddPart = key.slice(8); // '08' or '24'
    const dayNum = String(parseInt(ddPart, 10)); // '8' or '24'

    return {
      key,
      weekdayLabel: label ?? '',
      dayNum,
      isToday: key === today,
      isSelected: key === selected,
      hasTasks: datesWithTasks.has(key),
    };
  });
}
