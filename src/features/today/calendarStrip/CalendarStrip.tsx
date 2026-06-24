// src/features/today/calendarStrip/CalendarStrip.tsx
// Horizontal swipeable 7-day calendar strip.
//
// Architecture:
//   - A FlatList with pagingEnabled renders one "week page" per item.
//     Each page is exactly one screen width wide and shows 7 day cells.
//   - Data: a fixed array of 105 week-anchor keys (±52 weeks around today).
//     initialScrollIndex points to today's week so the first render lands in the
//     right place without an animated jump.
//   - Each cell is a Pressable (bare touch wrapper, reactCompiler gotcha) wrapping
//     an inner View that carries all visual styles.
//   - Tokens only: all sizing/color/motion comes from useTheme() / t.strip / t.colors.
//   - Entering-only animation rule: no exiting, no translate-in, no bounce.
//   - Reduced-motion: skip the scroll animation, jump instantly.
//   - a11y: each cell has role="button", descriptive accessibilityLabel, and
//     accessibilityState={{ selected }}.

import React, { memo, useCallback, useRef } from 'react';
import {
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { haptics } from '@/src/lib/haptics';
import { addDays, toLocalDayKey } from '@/src/lib/day';
import { useDayTasksStore } from '@/src/stores/dayTasksStore';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from '@/src/components/AppText';

import { dayCells, weekFor, type DayCell } from './weekDays';

// ─── Constants ────────────────────────────────────────────────────────────────

/** ±52 weeks around today — capped range for the paging FlatList data array. */
const WEEK_RADIUS = 52;
const TODAY_INDEX = WEEK_RADIUS; // the index of today's week in the data array
/** Monday-start week (ISO 8601). */
const WEEK_STARTS_ON = 1 as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build the full array of week-anchor keys centered on `todayKey`. */
function buildWeekAnchors(todayKey: string): string[] {
  const anchors: string[] = [];
  for (let i = -WEEK_RADIUS; i <= WEEK_RADIUS; i++) {
    anchors.push(addDays(todayKey, i * 7));
  }
  return anchors;
}

/** Formats a day-key as "Weekday Month DD" for a11y labels (e.g. "Wednesday June 24"). */
function formatA11yLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

// ─── DayCell component ────────────────────────────────────────────────────────

interface DayCellProps {
  cell: DayCell;
  cellWidth: number;
  onPress: (key: string) => void;
}

const DayCellView = memo(function DayCellView({ cell, cellWidth, onPress }: DayCellProps) {
  const t = useTheme();

  const handlePress = useCallback(() => {
    haptics.selection();
    onPress(cell.key);
  }, [cell.key, onPress]);

  // Visual state derivation
  const isSelected = cell.isSelected;
  const isToday = cell.isToday;

  // Colors: selected → solid ink pill with light text; today (not selected) → primary
  // number; muted → inkFaint label + inkSoft number; both states can overlap only if
  // today is also selected (both flags true → selected wins for the pill).
  const numColor: string = isSelected
    ? t.colors.surface  // white text on ink pill
    : isToday
      ? t.colors.primary
      : t.colors.inkSoft;

  const labelColor: string = isSelected
    ? t.colors.surface
    : t.colors.inkFaint;

  const a11yLabel = formatA11yLabel(cell.key);

  const styles = StyleSheet.create({
    pressable: {
      width: cellWidth,
      alignItems: 'center',
    },
    inner: {
      alignItems: 'center',
      justifyContent: 'center',
      width: cellWidth,
      height: t.strip.cellH,
      paddingVertical: t.strip.rowPadV,
    },
    pill: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: t.strip.pillPadH,
      paddingVertical: t.strip.pillPadV,
      borderRadius: t.radii.full,
      backgroundColor: isSelected ? t.colors.ink : 'transparent',
      minWidth: t.strip.pillPadH * 2 + t.strip.numSize + 4,
    },
    dot: {
      width: t.strip.dotSize,
      height: t.strip.dotSize,
      borderRadius: t.radii.full,
      backgroundColor: t.colors.accent,
      marginTop: t.strip.dotGap,
    },
  });

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ selected: isSelected }}
      style={styles.pressable}
    >
      <View style={styles.inner}>
        <AppText
          style={{
            fontSize: t.strip.labelSize,
            color: labelColor,
            fontWeight: t.fontWeight.medium,
            lineHeight: t.strip.labelSize * t.lineHeight.tight,
          }}
        >
          {cell.weekdayLabel}
        </AppText>
        <View style={styles.pill}>
          <AppText
            style={{
              fontSize: t.strip.numSize,
              color: numColor,
              fontWeight: isToday || isSelected ? t.fontWeight.semibold : t.fontWeight.regular,
              lineHeight: t.strip.numSize * t.lineHeight.tight,
            }}
          >
            {cell.dayNum}
          </AppText>
        </View>
        {cell.hasTasks ? <View style={styles.dot} /> : null}
      </View>
    </Pressable>
  );
});

// ─── WeekPage component ───────────────────────────────────────────────────────

interface WeekPageProps {
  anchor: string;
  today: string;
  selected: string;
  datesWithTasksSet: ReadonlySet<string>;
  screenWidth: number;
  onSelectDate: (key: string) => void;
}

const WeekPage = memo(function WeekPage({
  anchor,
  today,
  selected,
  datesWithTasksSet,
  screenWidth,
  onSelectDate,
}: WeekPageProps) {
  const cellWidth = screenWidth / 7;
  const weekKeys = weekFor(anchor, WEEK_STARTS_ON);
  const cells = dayCells(weekKeys, today, selected, datesWithTasksSet);

  return (
    <View style={{ width: screenWidth, flexDirection: 'row' }}>
      {cells.map((cell) => (
        <DayCellView
          key={cell.key}
          cell={cell}
          cellWidth={cellWidth}
          onPress={onSelectDate}
        />
      ))}
    </View>
  );
});

// ─── CalendarStrip ────────────────────────────────────────────────────────────

export function CalendarStrip() {
  const t = useTheme();
  const reducedMotion = useReducedMotion();

  // Store bindings
  const selectedDate = useDayTasksStore((s) => s.selectedDate);
  const datesWithTasks = useDayTasksStore((s) => s.datesWithTasks);
  const selectDate = useDayTasksStore((s) => s.selectDate);

  const today = toLocalDayKey(Date.now());
  const screenWidth = Dimensions.get('window').width;

  // Build stable week-anchor array (derived from today; stable for this render tree).
  const weekAnchors = React.useMemo(() => buildWeekAnchors(today), [today]);
  const datesSet = React.useMemo(
    () => new Set(datesWithTasks),
    [datesWithTasks],
  );

  // Resolve which week index contains the selected date so the list scrolls there.
  const selectedWeekIndex = React.useMemo(() => {
    // Find the anchor whose week contains selectedDate
    const idx = weekAnchors.findIndex((anchor) => {
      const keys = weekFor(anchor, WEEK_STARTS_ON);
      return keys.includes(selectedDate);
    });
    return idx >= 0 ? idx : TODAY_INDEX;
  }, [weekAnchors, selectedDate]);

  const listRef = useRef<FlatList<string>>(null);

  // Scroll to the week of selectedDate when it changes externally (e.g. goToToday).
  React.useEffect(() => {
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
      length: screenWidth,
      offset: screenWidth * index,
      index,
    }),
    [screenWidth],
  );

  const renderItem = useCallback(
    ({ item: anchor }: ListRenderItemInfo<string>) => (
      <WeekPage
        anchor={anchor}
        today={today}
        selected={selectedDate}
        datesWithTasksSet={datesSet}
        screenWidth={screenWidth}
        onSelectDate={handleSelectDate}
      />
    ),
    [today, selectedDate, datesSet, screenWidth, handleSelectDate],
  );

  const keyExtractor = useCallback((anchor: string) => anchor, []);

  return (
    <View
      style={{
        backgroundColor: t.colors.surface,
        borderBottomWidth: t.borderWidth.hairline,
        borderBottomColor: t.colors.hairline,
      }}
      accessibilityRole="none"
    >
      <FlatList
        ref={listRef}
        data={weekAnchors}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        getItemLayout={getItemLayout}
        initialScrollIndex={TODAY_INDEX}
        removeClippedSubviews
        decelerationRate="fast"
        // No bounce on the strip (animation rule: ease-out, no overshoot)
        bounces={false}
        overScrollMode="never"
        // Allow initial scroll index to work reliably
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={5}
      />
    </View>
  );
}
