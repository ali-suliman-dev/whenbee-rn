// PlanStrip — the pinned "you have a plan" status row on Today. Glanceable: start-by
// clock, live nudge state, done-by target, chevron. Tapping reopens the plan sheet.
// It is NOT a primary CTA (the + FAB owns the one filled action) — a quiet hairline
// surface. reactCompiler gotcha: Pressable is a bare touch wrapper; the visual + press
// scale live on the inner Animated.View (shared value via .get()/.set()). No bounce.

import { useCallback } from 'react';
import { Pressable, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { haptics } from '@/src/lib/haptics';
import { useTheme } from '@/src/theme/useTheme';

interface PlanStripProps {
  /** Start-by clock in the user's meridiem format, e.g. "12:35pm". */
  startByClock: string;
  /** Done-by target clock, or null when the user hasn't set one. */
  doneByClock: string | null;
  /** Whether the start-by nudge is currently on (reflects settingsStore.startByEnabled). */
  reminderOn: boolean;
  /** Reopen the plan sheet. */
  onPress: () => void;
}

export function PlanStrip({ startByClock, doneByClock, reminderOn, onPress }: PlanStripProps) {
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

  const stripStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[1.5],
    minHeight: t.size.control.sm,
    paddingHorizontal: t.space[3],
    paddingVertical: t.space[2],
    backgroundColor: t.colors.surface,
    borderRadius: t.radii.md,
    borderCurve: 'continuous',
    borderWidth: t.borderWidth.hairline,
    borderColor: t.colors.hairline,
  };
  const strongText: TextStyle = {
    fontSize: t.fontSize.sm,
    fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
    color: t.colors.ink,
    fontFamily: t.fontFamily.mono,
  };
  const softText: TextStyle = {
    fontSize: t.fontSize.sm,
    color: t.colors.inkSoft,
    fontFamily: t.fontFamily.ui,
  };
  const dot: TextStyle = { fontSize: t.fontSize.sm, color: t.colors.inkFaint };

  const a11yLabel =
    `Today's plan. Start by ${startByClock}. Reminder ${reminderOn ? 'on' : 'off'}.` +
    (doneByClock ? ` Done by ${doneByClock}.` : '') +
    ' Tap to open.';

  return (
    <Pressable
      testID="plan-strip"
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      hitSlop={4}
    >
      <Animated.View style={[stripStyle, aStyle]}>
        <Ionicons name="map-outline" size={t.iconSize.sm} color={t.colors.primary} />
        <Text style={strongText}>Start by {startByClock}</Text>
        <Text style={dot}>·</Text>
        <Ionicons
          name={reminderOn ? 'notifications' : 'notifications-outline'}
          size={t.iconSize.xs}
          color={reminderOn ? t.colors.primary : t.colors.inkSoft}
        />
        <Text style={softText}>{reminderOn ? 'nudge on' : 'nudge off'}</Text>
        {doneByClock ? (
          <>
            <Text style={dot}>·</Text>
            <Text style={softText}>done by {doneByClock}</Text>
          </>
        ) : null}
        <View style={{ flex: 1 }} />
        <Ionicons name="chevron-forward" size={t.iconSize.sm} color={t.colors.inkSoft} />
      </Animated.View>
    </Pressable>
  );
}
