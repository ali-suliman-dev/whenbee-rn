// PlanButton — the compact plan entry that sits far-right on the UP NEXT title
// row. Replaces the old PlanStrip (planned)/PlanMyDayButton (unplanned) pair
// with a single pill: indigo map icon, mono label, indigo chevron. Planned →
// "plan {startByClock}" (reopens the plan sheet); unplanned → "plan my day"
// (runs handlePlanMyDay, which keeps the Pro-gate). reactCompiler gotcha:
// Pressable stays a bare touch wrapper; the visual + press-scale live on the
// inner Animated.View (shared value via .get()/.set()). No bounce.

import { useCallback } from 'react';
import { Pressable, Text, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { haptics } from '@/src/lib/haptics';
import { useTheme } from '@/src/theme/useTheme';

interface PlanButtonProps {
  /** Whether a plan currently exists for the selected day. */
  hasPlan: boolean;
  /** Start-by clock in 24-hour form (e.g. "15:00"), or null when unplanned. */
  startByClock: string | null;
  /** Planned → reopen the plan sheet. Unplanned → handlePlanMyDay (Pro-gated). */
  onPress: () => void;
}

export function PlanButton({ hasPlan, startByClock, onPress }: PlanButtonProps) {
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

  const label = hasPlan && startByClock ? `plan ${startByClock}` : 'plan my day';
  const a11yLabel = hasPlan && startByClock ? `Plan. Start by ${startByClock}. Tap to open.` : 'Plan my day';

  const pillStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[1.5],
    minHeight: t.size.control.xs,
    paddingHorizontal: t.space[3],
    backgroundColor: t.colors.surfaceRaised,
    borderRadius: t.radii.full,
    borderCurve: 'continuous',
  };
  const labelStyle: TextStyle = {
    fontSize: t.fontSize.sm,
    fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
    color: t.colors.ink,
    fontFamily: t.fontFamily.mono,
  };

  return (
    <Pressable
      testID="plan-button"
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      hitSlop={t.size.hitSlop}
    >
      <Animated.View style={[pillStyle, aStyle]}>
        <Ionicons name="map-outline" size={t.iconSize.sm} color={t.colors.primary} />
        <Text style={labelStyle}>{label}</Text>
        <Ionicons name="chevron-forward" size={t.iconSize.xs} color={t.colors.primary} />
      </Animated.View>
    </Pressable>
  );
}
