// src/features/today/PlanEntryCard.tsx
// Today's entry point for Option 3 planning. Before a plan exists it is a quiet
// secondary "Plan my day" CTA (ghost, matching PlanMyDayButton) — the + FAB stays
// the single filled primary on the screen. After a plan is computed it becomes a
// glanceable live status card ("Today's plan · Start by 12:35 PM · nudge on ·
// tap to view") that reopens the plan screen on tap.
// reactCompiler gotcha: Pressable stays a bare touch wrapper; visual + the press
// animation live on the inner Animated.View (shared value via .get()/.set()).

import { useCallback } from 'react';
import { Pressable, View, type ViewStyle, type TextStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { haptics } from '@/src/lib/haptics';
import { AppText } from '@/src/components/AppText';
import { useTheme } from '@/src/theme/useTheme';

interface PlanEntryCardProps {
  /** True once the selected day has been planned (planComputedAt stamped). */
  hasPlan: boolean;
  /** The plan's start-by time, already formatted (e.g. "12:35 PM"), or null. */
  startByClock: string | null;
  /** Whether the start-by nudge is currently armed. */
  reminderOn: boolean;
  onPress: () => void;
}

/**
 * Today's plan entry. Before a plan exists it is a quiet secondary "Plan my day"
 * CTA (the + FAB stays the single filled primary). After planning it becomes a
 * glanceable status card that doubles as at-a-glance state and reopens the plan
 * screen on tap. Bare Pressable + visual on the inner Animated.View (reactCompiler
 * gotcha); press-scale only, no bounce, no slide-in.
 */
export function PlanEntryCard({ hasPlan, startByClock, reminderOn, onPress }: PlanEntryCardProps) {
  const t = useTheme();
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  const onPressIn = useCallback(
    () => scale.set(withTiming(t.scale.pressIn, { duration: t.motion.press })),
    [scale, t.scale.pressIn, t.motion.press],
  );
  const onPressOut = useCallback(
    () => scale.set(withTiming(1, { duration: t.motion.press })),
    [scale, t.motion.press],
  );
  const handlePress = useCallback(() => {
    haptics.light();
    onPress();
  }, [onPress]);

  if (!hasPlan) {
    const ctaStyle: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      minHeight: t.size.control.sm,
      gap: t.space[1.5],
      paddingHorizontal: t.space[2],
      borderRadius: t.radii.full,
      borderCurve: 'continuous',
    };
    return (
      <Pressable
        testID="plan-entry-card"
        onPress={handlePress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="button"
        accessibilityLabel="Plan my day"
        hitSlop={8}
      >
        <Animated.View style={[ctaStyle, aStyle]}>
          <Ionicons name="map-outline" size={t.iconSize.sm} color={t.colors.primary} />
          <AppText
            style={{
              fontSize: t.fontSize.sm,
              fontWeight: t.fontWeight.semibold,
              color: t.colors.primary,
              fontFamily: t.fontFamily.ui,
            }}
          >
            Plan my day
          </AppText>
        </Animated.View>
      </Pressable>
    );
  }

  const cardStyle: ViewStyle = {
    gap: t.space[1.5],
    padding: t.space[4],
    borderRadius: t.radii.md,
    borderCurve: 'continuous',
    backgroundColor: t.colors.surfaceSunken,
    borderWidth: t.borderWidth.chip,
    borderColor: t.colors.hairline,
  };
  const headerRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2] };
  const titleStyle: TextStyle = {
    flex: 1,
    fontSize: t.fontSize.bodySm,
    fontWeight: t.fontWeight.semibold,
    color: t.colors.ink,
    fontFamily: t.fontFamily.ui,
  };
  const statusStyle: TextStyle = { fontSize: t.fontSize.caption, color: t.colors.inkSoft };

  const startClause = startByClock !== null ? `Start by ${startByClock}` : 'Ready to start';
  const reminderClause = reminderOn ? 'nudge on' : 'no nudge';

  return (
    <Pressable
      testID="plan-entry-card"
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`Today's plan. ${startClause}, ${reminderClause}. Tap to view.`}
      hitSlop={4}
    >
      <Animated.View style={[cardStyle, aStyle]}>
        <View style={headerRow}>
          <Ionicons name="map-outline" size={t.iconSize.sm} color={t.colors.primary} />
          <AppText style={titleStyle}>Today&apos;s plan</AppText>
          <Ionicons name="chevron-forward" size={t.iconSize.sm} color={t.colors.inkFaint} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[1.5] }}>
          <AppText style={statusStyle}>{startClause}</AppText>
          <AppText style={statusStyle}>·</AppText>
          <Ionicons
            name={reminderOn ? 'notifications' : 'notifications-off-outline'}
            size={t.iconSize.xs}
            color={reminderOn ? t.colors.primary : t.colors.inkFaint}
          />
          <AppText style={statusStyle}>{reminderClause}</AppText>
          <AppText style={statusStyle}>·</AppText>
          <AppText style={{ ...statusStyle, color: t.colors.primary }}>tap to view</AppText>
        </View>
      </Animated.View>
    </Pressable>
  );
}
