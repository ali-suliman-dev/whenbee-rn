// src/features/today/calendarStrip/useCalendarStripData.ts
// Shared logic for the calendar strip.
//
// The paging + store wiring the strip sits on top of — the ±52-week anchor
// array, the page width, the scroll-to-selected effect, and the select-date
// passthrough — kept separate from the visual component (CalendarStripSegment).

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Dimensions, type FlatList } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { addDays, toLocalDayKey } from '@/src/lib/day';
import { useDayTasksStore } from '@/src/stores/dayTasksStore';
import { useTheme } from '@/src/theme/useTheme';

import { weekFor } from './weekDays';

// ─── Constants ────────────────────────────────────────────────────────────────

/** ±52 weeks around today — capped range for the paging FlatList data array. */
const WEEK_RADIUS = 52;
/** Index of today's week in the anchor array. */
export const TODAY_INDEX = WEEK_RADIUS;
/** Monday-start week (ISO 8601). */
export const WEEK_STARTS_ON = 1 as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Build the full array of week-anchor keys centered on `todayKey`. */
function buildWeekAnchors(todayKey: string): string[] {
  const anchors: string[] = [];
  for (let i = -WEEK_RADIUS; i <= WEEK_RADIUS; i++) {
    anchors.push(addDays(todayKey, i * 7));
  }
  return anchors;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface CalendarStripData {
  today: string;
  selectedDate: string;
  weekAnchors: string[];
  selectedWeekIndex: number;
  datesSet: ReadonlySet<string>;
  pageWidth: number;
  reducedMotion: boolean;
  listRef: React.RefObject<FlatList<string> | null>;
  handleSelectDate: (key: string) => void;
  getItemLayout: (
    _: ArrayLike<string> | null | undefined,
    index: number,
  ) => { length: number; offset: number; index: number };
  onScrollToIndexFailed: (info: { index: number }) => void;
}

/**
 * @param horizontalInset  the strip container's inner horizontal padding (px).
 *   A week page is exactly the card's inner width so paging lands cleanly on each
 *   week. Each variant passes its own container padding (lens vs segment differ by
 *   ~1px); defaults to the legacy strip padding.
 */
export function useCalendarStripData(horizontalInset?: number): CalendarStripData {
  const t = useTheme();
  const reducedMotion = useReducedMotion();

  const selectedDate = useDayTasksStore((s) => s.selectedDate);
  const datesWithTasks = useDayTasksStore((s) => s.datesWithTasks);
  const selectDate = useDayTasksStore((s) => s.selectDate);

  const today = toLocalDayKey(Date.now());
  const inset = horizontalInset ?? t.strip.padH;
  const screenWidth = Dimensions.get('window').width;
  // The strip sits inside the Screen's horizontal padding (space[5]) and its own
  // inner padding (inset). A week page must equal that inner width.
  const pageWidth = screenWidth - t.space[5] * 2 - inset * 2;

  const weekAnchors = useMemo(() => buildWeekAnchors(today), [today]);
  const datesSet = useMemo(() => new Set(datesWithTasks), [datesWithTasks]);

  const selectedWeekIndex = useMemo(() => {
    const idx = weekAnchors.findIndex((anchor) =>
      weekFor(anchor, WEEK_STARTS_ON).includes(selectedDate),
    );
    return idx >= 0 ? idx : TODAY_INDEX;
  }, [weekAnchors, selectedDate]);

  const listRef = useRef<FlatList<string> | null>(null);

  // Scroll to the week of selectedDate when it changes externally (e.g. goToToday).
  useEffect(() => {
    if (listRef.current === null) return;
    listRef.current.scrollToIndex({
      index: selectedWeekIndex,
      animated: !reducedMotion,
    });
  }, [selectedWeekIndex, reducedMotion]);

  const handleSelectDate = useCallback(
    (key: string) => {
      void selectDate(key);
    },
    [selectDate],
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<string> | null | undefined, index: number) => ({
      length: pageWidth,
      offset: pageWidth * index,
      index,
    }),
    [pageWidth],
  );

  const onScrollToIndexFailed = useCallback(
    (info: { index: number }) => {
      const offset = info.index * pageWidth;
      requestAnimationFrame(() =>
        listRef.current?.scrollToOffset({ offset, animated: false }),
      );
    },
    [pageWidth],
  );

  return {
    today,
    selectedDate,
    weekAnchors,
    selectedWeekIndex,
    datesSet,
    pageWidth,
    reducedMotion,
    listRef,
    handleSelectDate,
    getItemLayout,
    onScrollToIndexFailed,
  };
}
