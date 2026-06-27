// src/features/today/PlanMyDayButton.tsx
// The "Plan my day" action sitting at the right edge of the List/Timeline toggle
// row (label swaps to "Re-plan" in Timeline). It is a SECONDARY,
// Pro-gated action — never a filled indigo CTA (Start owns the one primary on the
// screen). So it reads as a crafted, tactile *tinted* chip: a soft indigo fill
// with a crisp indigo hairline, a filled sparkle, and a semibold indigo label,
// plus the house "ghost" press (scale squeeze + haptic). No edge, no bounce.
// reactCompiler gotcha: Pressable stays a bare touch wrapper; visual + the press
// animation live on the inner Animated.View (shared value via .get()/.set()).

import React, { useCallback } from 'react';
import { Pressable, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { haptics } from '@/src/lib/haptics';
import { useTheme } from '@/src/theme/useTheme';

interface PlanMyDayButtonProps {
  onPress: () => void;
  isPro: boolean;
  /** Label + a11y verb. 'Plan my day' in List, 'Re-plan' once a plan exists (Timeline). */
  label: string;
}

export function PlanMyDayButton({ onPress, isPro, label }: PlanMyDayButtonProps) {
  const t = useTheme();
  const scale = useSharedValue(1);

  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const onPressIn = useCallback(() => {
    scale.set(withTiming(t.scale.pressIn, { duration: t.motion.press }));
  }, [scale, t.scale.pressIn, t.motion.press]);
  const onPressOut = useCallback(() => {
    scale.set(withTiming(1, { duration: t.motion.press }));
  }, [scale, t.motion.press]);

  const handlePress = useCallback(() => {
    haptics.light();
    onPress();
  }, [onPress]);

  return (
    <Pressable
      testID="plan-my-day-btn"
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={isPro ? label : `${label} — Pro feature`}
      hitSlop={8}
    >
      <Animated.View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: t.size.control.sm,
            gap: t.space[2],
            paddingHorizontal: t.space[4],
            backgroundColor: t.colors.primarySoft,
            borderRadius: t.radii.full,
            borderCurve: 'continuous',
            borderWidth: t.borderWidth.hairline,
            borderColor: t.colors.primarySoft2,
          },
          aStyle,
        ]}
      >
        <Ionicons name="sparkles" size={t.iconSize.sm} color={t.colors.primary} />
        <Text
          numberOfLines={1}
          style={{
            fontSize: t.fontSize.sm,
            fontWeight: t.fontWeight.semibold,
            color: t.colors.primary,
            fontFamily: t.fontFamily.ui,
            letterSpacing: 0.2,
          }}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}
