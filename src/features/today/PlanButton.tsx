// PlanButton — the compact plan entry that sits far-right on the TASKS title
// row. A single pill, two states, chevron on both: no-plan renders a quiet
// indigo "invite" (📅 Plan ›) that runs handlePlanMyDay (Pro-gated); an active
// plan renders a neutral clock pill (📅 15:00 ›) that reopens the plan sheet.
// Color discipline: the icon carries the tap/plan signal (indigo), the clock
// number is a neutral `ink` datum — never amber (reserved for honey/reward).
// reactCompiler gotcha: Pressable stays a bare touch wrapper; the visual +
// press-scale live on the inner Animated.View (shared value via .get()/.set()).
// No bounce.

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { haptics } from '@/src/lib/haptics';
import { useTheme } from '@/src/theme/useTheme';
import type { PlanAnchorSide } from '@/src/stores/dayTasksStore';

interface PlanButtonProps {
  /** Whether a plan currently exists for the selected day. */
  hasPlan: boolean;
  /** Start-by clock in 24-hour form (e.g. "15:00"), or null when unplanned. */
  startByClock: string | null;
  /**
   * Which end of the day is fixed. A 'start' plan's clock is a derived first-
   * block start, not a deadline — the a11y label reads "Starting" for it, never
   * "Start by" (that word implies a deadline the user set). Defaults to
   * 'finish', the historical behaviour, so existing callers are unaffected.
   */
  planAnchor?: PlanAnchorSide;
  /** Planned → reopen the plan sheet. Unplanned → handlePlanMyDay (Pro-gated). */
  onPress: () => void;
}

export function PlanButton({
  hasPlan,
  startByClock,
  planAnchor = 'finish',
  onPress,
}: PlanButtonProps) {
  const t = useTheme();
  const { t: tr } = useTranslation('today');
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

  const active = hasPlan && startByClock != null;
  const label = active ? startByClock : tr('planButton.label');
  const startWord = planAnchor === 'start' ? tr('timeline.starting') : tr('timeline.startBy');
  const a11yLabel = active
    ? tr('planButton.a11y', { startWord, clock: startByClock })
    : tr('planMyDay.plan');

  const pillStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[1.5],
    minHeight: t.size.control.xs,
    paddingHorizontal: t.space[3],
    backgroundColor: active ? t.colors.surfaceRaised : t.colors.primaryWash,
    borderRadius: t.radii.full,
    borderCurve: 'continuous',
  };
  const labelStyle: TextStyle = active
    ? {
        fontSize: t.fontSize.sm,
        fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
        color: t.colors.ink,
        fontFamily: t.fontFamily.mono,
      }
    : {
        fontSize: t.fontSize.sm,
        fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
        color: t.colors.primaryBright,
        fontFamily: t.fontFamily.ui,
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
        <Ionicons name="calendar-outline" size={t.iconSize.sm} color={t.colors.primary} />
        <Text style={labelStyle}>{label}</Text>
        <Ionicons name="chevron-forward" size={t.iconSize.xs} color={t.colors.inkFaint} />
      </Animated.View>
    </Pressable>
  );
}
