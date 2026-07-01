// src/features/today/calendarStrip/CalendarStripLens.tsx
// Variant A1 — "Focus Lens". The selected day's number scales up; neighbours
// shrink and fade with distance. Every day keeps its weekday label (also faded
// by distance) so the strip stays fully scannable.
//
// Motion: one shared value per week page (`selCol`, a float). Every cell derives
// its scale / opacity / color by interpolating |col − selCol|, so as selCol
// animates with withTiming + easing.out, the whole row morphs continuously — a
// true lens, no per-cell choreography, no overshoot. Reduced motion → jump.
// The number renders at hero size and SCALES DOWN via transform (UI thread) with
// transformOrigin 'bottom' so all baselines stay pinned. reactCompiler gotcha:
// Pressable stays bare; visuals on inner Animated.Views; shared values .get()/.set().

import React, { memo, useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
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

const LensCell = memo(function LensCell({
  cell, col, cellWidth, selCol, reducedMotion, onPress,
}: CellProps) {
  const t = useTheme();
  const fmt = useLocalizedFormat();
  const L = t.strip.lens;
  const press = useSharedValue(1);

  const handlePress = useCallback(() => {
    haptics.selection();
    onPress(cell.key);
  }, [cell.key, onPress]);

  const onPressIn = useCallback(() => {
    if (!reducedMotion) press.set(withTiming(L.pressScale, { duration: t.motion.press }));
  }, [reducedMotion, press, L.pressScale, t.motion.press]);
  const onPressOut = useCallback(() => {
    if (!reducedMotion) press.set(withTiming(1, { duration: t.motion.press }));
  }, [reducedMotion, press, t.motion.press]);

  // distance helper (worklet): -1 selCol → uniform medium (treat as d=1).
  const numWrapStyle = useAnimatedStyle(() => {
    const c = selCol.value;
    const d = c < 0 ? 1 : Math.abs(col - c);
    const scale =
      interpolate(d, [0, 1, 2, 3], [1, L.scaleD1, L.scaleD2, L.scaleD3], Extrapolation.CLAMP) *
      press.value;
    const opacity = interpolate(
      d, [0, 1, 2, 3], [L.opacityD0, L.opacityD1, L.opacityD2, L.opacityD3], Extrapolation.CLAMP,
    );
    return { opacity, transform: [{ scale }] };
  });

  // Today is ALWAYS the bee CTA (indigo) — even as the selected hero it stays
  // primary instead of flipping to ink. Other days use the ink/muted ramp.
  const heroNumColor = cell.isToday ? t.colors.primary : t.colors.ink;
  const restNumColor = cell.isToday ? t.colors.primary : t.colors.inkSoft;
  const restWdColor = cell.isToday ? t.colors.primary : t.colors.inkFaint;

  const numColorStyle = useAnimatedStyle(() => {
    const c = selCol.value;
    if (c < 0) return { color: restNumColor };
    const d = Math.abs(col - c);
    return { color: interpolateColor(d, [0, 1], [heroNumColor, restNumColor]) };
  });

  const wdStyle = useAnimatedStyle(() => {
    const c = selCol.value;
    const d = c < 0 ? 1 : Math.abs(col - c);
    const opacity = interpolate(
      d, [0, 1, 2, 3], [L.opacityD0, L.opacityD1, L.opacityD2, L.opacityD3], Extrapolation.CLAMP,
    );
    const color = c < 0 ? restWdColor : interpolateColor(d, [0, 1], [t.colors.primary, restWdColor]);
    return { opacity, color };
  });

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
      <View style={{ height: L.cellMinH, alignItems: 'center', justifyContent: 'flex-end', gap: L.gap }}>
        <Animated.Text
          style={[
            {
              fontSize: cell.isSelected ? L.heroLabel : L.label,
              fontWeight: cell.isSelected ? t.fontWeight.semibold : t.fontWeight.medium,
              fontFamily: t.fontFamily.ui,
              letterSpacing: 0.3,
            },
            wdStyle,
          ]}
        >
          {cell.weekdayLabel}
        </Animated.Text>
        <Animated.View style={[{ transformOrigin: 'bottom' }, numWrapStyle]}>
          <Animated.Text
            style={[
              {
                fontSize: L.heroNum, // base size; non-hero scales DOWN via transform
                fontWeight: t.fontWeight.bold,
                fontVariant: ['tabular-nums'],
                fontFamily: t.fontFamily.ui,
                lineHeight: L.heroNum * t.lineHeight.tight,
              },
              numColorStyle,
            ]}
          >
            {cell.dayNum}
          </Animated.Text>
        </Animated.View>
        <View
          style={{
            width: L.heroDotSize,
            height: L.heroDotSize,
            borderRadius: t.radii.full,
            backgroundColor: cell.isSelected || cell.isToday ? t.colors.primary : 'transparent',
            marginTop: L.dotGap - L.gap,
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

const LensWeekPage = memo(function LensWeekPage({ anchor, data }: WeekPageProps) {
  const t = useTheme();
  const { today, selectedDate, datesSet, pageWidth, reducedMotion, handleSelectDate } = data;

  const cellWidth = pageWidth / 7;
  const cells = dayCells(weekFor(anchor, WEEK_STARTS_ON), today, selectedDate, datesSet);
  const selectedCol = cells.findIndex((c) => c.isSelected); // -1 if selected elsewhere

  const selCol = useSharedValue(selectedCol);

  useEffect(() => {
    const from = selCol.get();
    if (reducedMotion || from < 0 || selectedCol < 0) {
      selCol.set(selectedCol);
    } else {
      selCol.set(withTiming(selectedCol, { duration: t.motion.base, easing: t.motion.easing.out }));
    }
  }, [selectedCol, reducedMotion, selCol, t.motion.base, t.motion.easing.out]);

  return (
    <View style={{ width: pageWidth, flexDirection: 'row' }}>
      {cells.map((cell, col) => (
        <LensCell
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

function cardStyle(t: Theme) {
  return StyleSheet.create({
    card: {
      backgroundColor: t.colors.surface,
      borderRadius: t.radii.card,
      borderCurve: 'continuous',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.hairline,
      overflow: 'hidden',
      paddingVertical: t.strip.lens.cardPadV,
      paddingHorizontal: t.strip.lens.cardPadH,
    },
  }).card;
}

export function CalendarStripLens() {
  const t = useTheme();
  const data = useCalendarStripData(t.strip.lens.cardPadH);

  const renderWeek = useCallback(
    (anchor: string) => <LensWeekPage anchor={anchor} data={data} />,
    [data],
  );

  return (
    <View style={cardStyle(t)} accessibilityRole="none">
      <WeekPager data={data} renderWeek={renderWeek} />
    </View>
  );
}
