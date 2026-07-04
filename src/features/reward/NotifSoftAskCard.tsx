// src/features/reward/NotifSoftAskCard.tsx
// Post-calibration notification soft-ask card. Amber-tinted, never competing
// as the screen's primary CTA. Opacity-only entrance (no translate/bounce).
// Reduced-motion → rendered at final opacity with no transition.

import { AppButton } from '@/src/components/AppButton';
import { useNotifSoftAsk } from '@/src/features/notifications/useNotifSoftAsk';
import { type } from '@/src/theme/typography';
import { useTheme } from '@/src/theme/useTheme';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

// ──────────────────────────────────────────────────────────────────────────────
// NotifSoftAskCard — renders only when the show-predicate is met:
//   • first completed calibration (logs === 1)
//   • soft-ask state is 'pending'
//   • OS notification permission is undetermined
//
// Buttons are secondary (amber + ghost) — the screen's primary "See your bee"
// CTA is untouched.
// ──────────────────────────────────────────────────────────────────────────────

export function NotifSoftAskCard() {
  const t = useTheme();
  const { t: tr } = useTranslation('reward');
  const { show, onAccept, onDecline } = useNotifSoftAsk();
  const reducedMotion = useReducedMotion();

  // Opacity-only entrance — no translate, no bounce, no spring overshoot.
  const opacity = useSharedValue(reducedMotion ? 1 : 0);
  useEffect(() => {
    if (!show) return;
    if (reducedMotion) {
      opacity.set(1);
      return;
    }
    opacity.set(
      withTiming(1, { duration: t.motion.base, easing: t.motion.easing.standard }),
    );
  }, [show, reducedMotion, opacity, t.motion.base, t.motion.easing.standard]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  if (!show) return null;

  const card: ViewStyle = {
    backgroundColor: t.colors.accentSoft,
    borderRadius: t.radii.card,
    padding: t.space[4],
    gap: t.space[3],
  };
  const bodyText: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: t.colors.amberText,
  };
  const buttonRow: ViewStyle = {
    flexDirection: 'row',
    gap: t.space[3],
  };

  return (
    <Animated.View style={animStyle}>
      <View style={card}>
        <Text style={bodyText}>{tr('notifSoftAsk.body')}</Text>
        <View style={buttonRow}>
          <View style={{ flex: 1 }}>
            <AppButton
              label={tr('notifSoftAsk.accept')}
              variant="amber"
              fullWidth
              onPress={() => { void onAccept(); }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <AppButton
              label={tr('notifSoftAsk.decline')}
              variant="ghost"
              fullWidth
              onPress={onDecline}
            />
          </View>
        </View>
      </View>
    </Animated.View>
  );
}
