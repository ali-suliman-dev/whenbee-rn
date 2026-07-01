// src/features/today/calendarStrip/CalendarStripSegment.tsx
// Variant B — "Sliding Segment". A sunken, borderless track with one elevated
// chip that slides to the selected day (the same metaphor as the List/Timeline
// ViewToggle). Nothing is hidden: every day keeps its weekday + number.
//
// Motion: a single shared value per week page (`selCol`) drives the chip's
// translateX and each cell's text-color crossfade with withTiming + easing.out —
// no spring, no overshoot (project animation rule). Reduced motion → jump.
// reactCompiler gotcha: Pressable stays a bare touch wrapper; visual style lives
// on inner Animated.Views. Shared values use .get()/.set() in the component body.

import React, { memo, useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { haptics } from '@/src/lib/haptics';
import { useTheme, type Theme } from '@/src/theme/useTheme';

import { useLocalizedFormat } from '@/src/i18n/useLocalizedFormat';

import { useCalendarStripData, WEEK_STARTS_ON, type CalendarStripData } from './useCalendarStripData';
import { WeekPager } from './WeekPager';
import { dayCells, formatA11yLabel, weekFor, type DayCell } from './weekDays';

// ─── Cell ──────────────────────────────────────────────────────────────────────

interface CellProps {
  cell: DayCell;
  col: number;
  cellWidth: number;
  selCol: SharedValue<number>;
  reducedMotion: boolean;
  onPress: (key: string) => void;
}

const SegmentCell = memo(function SegmentCell({
  cell, col, cellWidth, selCol, reducedMotion, onPress,
}: CellProps) {
  const t = useTheme();
  const fmt = useLocalizedFormat();
  const seg = t.strip.segment;
  const press = useSharedValue(1);

  const handlePress = useCallback(() => {
    haptics.selection();
    onPress(cell.key);
  }, [cell.key, onPress]);

  const onPressIn = useCallback(() => {
    if (!reducedMotion) press.set(withTiming(seg.pressScale, { duration: t.motion.press }));
  }, [reducedMotion, press, seg.pressScale, t.motion.press]);
  const onPressOut = useCallback(() => {
    if (!reducedMotion) press.set(withTiming(1, { duration: t.motion.press }));
  }, [reducedMotion, press, t.motion.press]);

  const innerStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));

  // Today is ALWAYS the bee CTA (indigo) — selected or not. For a today cell both
  // the resting and the on-chip colors are primary, so it never flips to ink. Any
  // other day: ink number / primary weekday on the chip, muted ramp at rest.
  const selNum = cell.isToday ? t.colors.primary : t.colors.ink;
  const restNum = cell.isToday ? t.colors.primary : t.colors.inkSoft;
  const restWd = cell.isToday ? t.colors.primary : t.colors.inkFaint;

  // Text colors crossfade as the chip arrives at this column.
  const numStyle = useAnimatedStyle(() => {
    const c = selCol.value;
    if (c < 0) return { color: restNum };
    const d = Math.abs(col - c);
    return { color: interpolateColor(d, [0, 0.6], [selNum, restNum]) };
  });
  const wdStyle = useAnimatedStyle(() => {
    const c = selCol.value;
    if (c < 0) return { color: restWd };
    const d = Math.abs(col - c);
    return { color: interpolateColor(d, [0, 0.6], [t.colors.primary, restWd]) };
  });

  const dotColor =
    cell.isSelected || cell.isToday
      ? t.colors.primary
      : cell.hasTasks
        ? t.colors.inkFaint
        : 'transparent';

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={formatA11yLabel(cell.key, fmt.fullDate)}
      accessibilityState={{ selected: cell.isSelected }}
      style={{ width: cellWidth }}
    >
      {/* Chip frames just this block (weekday + number), vertically centered. */}
      <Animated.View
        style={[
          { height: seg.chipH, alignItems: 'center', justifyContent: 'center', gap: seg.gap },
          innerStyle,
        ]}
      >
        <Animated.Text
          style={[
            { fontSize: seg.label, fontWeight: t.fontWeight.medium, fontFamily: t.fontFamily.ui, letterSpacing: 0.3 },
            wdStyle,
          ]}
        >
          {cell.weekdayLabel}
        </Animated.Text>
        <Animated.Text
          style={[
            {
              fontSize: seg.num,
              fontWeight: cell.isSelected ? t.fontWeight.bold : t.fontWeight.medium,
              fontVariant: ['tabular-nums'],
              fontFamily: t.fontFamily.ui,
              lineHeight: seg.num * t.lineHeight.tight,
            },
            numStyle,
          ]}
        >
          {cell.dayNum}
        </Animated.Text>
      </Animated.View>
      {/* Dot keeps its place below the number; the chip (above) grows down to
          enclose it. paddingBottom mirrors the chip's top inset for symmetry. */}
      <View style={{ alignItems: 'center', paddingTop: seg.dotGap, paddingBottom: seg.chipPadBelowDot }}>
        <View
          style={{
            width: seg.dotSize,
            height: seg.dotSize,
            borderRadius: t.radii.full,
            backgroundColor: dotColor,
          }}
        />
      </View>
    </Pressable>
  );
});

// ─── Week page ──────────────────────────────────────────────────────────────────

interface WeekPageProps {
  anchor: string;
  data: CalendarStripData;
}

const SegmentWeekPage = memo(function SegmentWeekPage({ anchor, data }: WeekPageProps) {
  const t = useTheme();
  const seg = t.strip.segment;
  const { today, selectedDate, datesSet, pageWidth, reducedMotion, handleSelectDate } = data;

  const cellWidth = pageWidth / 7;
  const cells = dayCells(weekFor(anchor, WEEK_STARTS_ON), today, selectedDate, datesSet);
  const selectedCol = cells.findIndex((c) => c.isSelected); // -1 if selected elsewhere

  const selCol = useSharedValue(selectedCol);

  // Drive the chip. Animate only when sliding between two in-week columns; jump
  // when arriving from / leaving to another week (no off-screen slide) or reduced.
  useEffect(() => {
    const from = selCol.get();
    if (reducedMotion || from < 0 || selectedCol < 0) {
      selCol.set(selectedCol);
    } else {
      selCol.set(withTiming(selectedCol, { duration: t.motion.base, easing: t.motion.easing.out }));
    }
  }, [selectedCol, reducedMotion, selCol, t.motion.base, t.motion.easing.out]);

  const chipStyle = useAnimatedStyle(() => {
    const c = selCol.value;
    return {
      opacity: c < 0 ? 0 : 1,
      transform: [{ translateX: Math.max(0, c) * cellWidth }],
    };
  });

  return (
    <View style={{ width: pageWidth, flexDirection: 'row', position: 'relative' }}>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: 0,
            // Frame weekday + number + the dot below it (dotGap + dotSize) plus a
            // bottom inset that mirrors the chip's top breathing room.
            height: seg.chipH + seg.dotGap + seg.dotSize + seg.chipPadBelowDot,
            left: seg.chipInsetX,
            width: cellWidth - seg.chipInsetX * 2,
            // Recessed selected pill: the track is now a surface card (matching
            // the task rows), so the selection reads as an inset well rather than
            // a raised chip — surfaceSunken is the one neutral token that stays
            // distinct from surface in both light and dark. No shadow: a recessed
            // element doesn't cast one.
            backgroundColor: t.colors.surfaceSunken,
            borderRadius: seg.chipRadius,
            borderCurve: 'continuous',
          },
          chipStyle,
        ]}
      />
      {cells.map((cell, col) => (
        <SegmentCell
          key={cell.key}
          cell={cell}
          col={col}
          cellWidth={cellWidth}
          selCol={selCol}
          reducedMotion={reducedMotion}
          onPress={handleSelectDate}
        />
      ))}
    </View>
  );
});

// ─── Container ──────────────────────────────────────────────────────────────────

function trackStyle(t: Theme) {
  return StyleSheet.create({
    track: {
      // Lifted surface card matching the task rows (was a sunken well that
      // floated invisibly on the page bg). Hairline edge mirrors TaskRow/lens.
      backgroundColor: t.colors.surface,
      borderRadius: t.radii.card,
      borderCurve: 'continuous',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.hairline,
      overflow: 'hidden',
      paddingVertical: t.strip.segment.trackPadV,
      paddingHorizontal: t.strip.segment.trackPadH,
    },
  }).track;
}

export function CalendarStripSegment() {
  const t = useTheme();
  const data = useCalendarStripData(t.strip.segment.trackPadH);

  const renderWeek = useCallback(
    (anchor: string) => <SegmentWeekPage anchor={anchor} data={data} />,
    [data],
  );

  return (
    <View style={trackStyle(t)} accessibilityRole="none">
      <WeekPager data={data} renderWeek={renderWeek} />
    </View>
  );
}
