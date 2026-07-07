// src/features/today/PlanReminderChip.tsx
// Shared in-context reminder control for any plan surface that has a start-by
// clock (List row, Timeline row, Run view). Reads the start-by toggle so every
// surface stays in sync on the single `startByEnabled` flag. On = amber filled,
// off = quiet/sunken. Renders nothing when there's no start-by to remind about.
// reactCompiler gotcha: Pressable stays a bare touch wrapper; visual + the press
// animation live on the inner Animated.View (shared value via .get()/.set()).

import { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { haptics } from '@/src/lib/haptics';
import { useTheme } from '@/src/theme/useTheme';
import { useStartByToggle } from './useStartByToggle';

interface PlanReminderChipProps {
  /** The formatted start-by clock time, or null when the plan has no start-by. */
  startByClock: string | null;
}

export function PlanReminderChip({ startByClock }: PlanReminderChipProps) {
  const t = useTheme();
  const { enabled, toggle } = useStartByToggle();
  const scale = useSharedValue(1);

  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  const onPressIn = useCallback(() => {
    scale.set(withTiming(t.scale.pressIn, { duration: t.motion.press }));
  }, [scale, t.scale.pressIn, t.motion.press]);
  const onPressOut = useCallback(() => {
    scale.set(withTiming(1, { duration: t.motion.press }));
  }, [scale, t.motion.press]);
  const onPress = useCallback(() => {
    haptics.light();
    void toggle(!enabled);
  }, [enabled, toggle]);

  if (startByClock === null) return null;

  const bg = enabled ? t.colors.accentSoft : t.colors.surfaceSunken;
  const fg = enabled ? t.colors.amberText : t.colors.inkSoft;
  const label = enabled ? `Nudge me at ${startByClock}` : 'Remind me to start';

  return (
    <Pressable
      testID="plan-reminder-chip"
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled }}
      accessibilityLabel={
        enabled
          ? `Start reminder on, ${startByClock}. Tap to turn off.`
          : 'Start reminder off. Tap to turn on.'
      }
      hitSlop={6}
    >
      <Animated.View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.space[2],
            paddingHorizontal: t.space[3],
            paddingVertical: t.space[2],
            backgroundColor: bg,
            borderRadius: t.radii.md,
            borderCurve: 'continuous',
          },
          aStyle,
        ]}
      >
        <Ionicons
          name={enabled ? 'notifications' : 'notifications-outline'}
          size={t.iconSize.sm}
          color={fg}
        />
        <Text
          style={{
            flex: 1,
            fontSize: t.fontSize.sm,
            fontWeight: t.fontWeight.medium,
            color: fg,
            fontFamily: t.fontFamily.ui,
          }}
        >
          {label}
        </Text>
        <View
          style={{
            width: t.space[6],
            height: t.space[4],
            borderRadius: t.radii.full,
            backgroundColor: enabled ? t.colors.accent : t.colors.hairline,
            alignItems: enabled ? 'flex-end' : 'flex-start',
            justifyContent: 'center',
            paddingHorizontal: 2,
          }}
        >
          <View
            style={{
              width: t.space[3],
              height: t.space[3],
              borderRadius: t.radii.full,
              backgroundColor: t.colors.surface,
            }}
          />
        </View>
      </Animated.View>
    </Pressable>
  );
}
