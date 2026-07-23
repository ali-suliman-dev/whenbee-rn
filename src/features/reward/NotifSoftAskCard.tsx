// src/features/reward/NotifSoftAskCard.tsx
// Post-calibration notification soft-ask card. Follows the hub's gentle-card
// grammar (BlindSpotCard / LifeDriftCard): white surface, sunken icon tile,
// eyebrow + ink title, muted body. Amber lives ONLY in the CTA; the decline is
// a quiet text link so it never competes with the screen's primary CTA.
// Opacity-only entrance (no translate/bounce). Reduced-motion → final opacity.

import { AppButton } from '@/src/components/AppButton';
import { Card } from '@/src/components/Card';
import { useNotifSoftAsk } from '@/src/features/notifications/useNotifSoftAsk';
import { type } from '@/src/theme/typography';
import { useTheme } from '@/src/theme/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Pressable, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

// ──────────────────────────────────────────────────────────────────────────────
// NotifSoftAskCard — renders only when the show-predicate is met:
//   • first completed calibration (lifetimeNectar === 1)
//   • soft-ask state is 'pending'
//   • OS notification permission is undetermined
//
// Layout (cohesive with BlindSpotCard — same sunken tile + eyebrow/title head):
//   [🔔 tile]  ONE TAP, WHEN IT COUNTS
//              A quiet ping at your honest finish
//   When a timer hits your real number, not your guess, …
//   [ Turn on the ping ]  (amber, the card's only color)
//         Not now
// ──────────────────────────────────────────────────────────────────────────────

export function NotifSoftAskCard() {
  const t = useTheme();
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

  const eyebrow: TextStyle = {
    ...(type.eyebrow as unknown as TextStyle),
    color: t.colors.inkFaint,
  };
  const title: TextStyle = { ...(type.heading as unknown as TextStyle), color: t.colors.ink };
  const body: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft };
  const declineText: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    textDecorationLine: 'underline',
    color: t.colors.inkSoft,
    textAlign: 'center',
  };

  const tile: ViewStyle = {
    width: t.size.coin,
    height: t.size.coin,
    borderRadius: t.radii.md,
    borderCurve: 'continuous',
    backgroundColor: t.colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const group: ViewStyle = { gap: t.space[1.5] };
  const headRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[3] };
  const titleCol: ViewStyle = { flex: 1, gap: t.space[0.5] };
  const decline: ViewStyle = {
    alignSelf: 'center',
    justifyContent: 'center',
    minHeight: t.size.control.sm,
    paddingHorizontal: t.space[2],
  };

  return (
    <Animated.View style={animStyle}>
      <Card style={{ gap: t.space[5] }}>
        <View style={group}>
          <View style={headRow}>
            <View style={tile}>
              <Ionicons name="notifications-outline" size={t.iconSize.sm} color={t.colors.ink} />
            </View>
            <View style={titleCol}>
              <Text style={eyebrow}>One tap, when it counts</Text>
              <Text style={title}>A quiet ping at your honest finish</Text>
            </View>
          </View>
          <Text style={body}>
            When a timer hits your real number, not your guess, Whenbee taps you once. No streaks,
            no scolding.
          </Text>
        </View>

        <View style={{ gap: t.space[3] }}>
          <AppButton
            label="Turn on the ping"
            variant="amber"
            fullWidth
            onPress={() => { void onAccept(); }}
          />
          <Pressable
            onPress={onDecline}
            hitSlop={t.size.hitSlop}
            accessibilityRole="button"
            accessibilityLabel="Not now"
            style={decline}
          >
            <Text style={declineText}>Not now</Text>
          </Pressable>
        </View>
      </Card>
    </Animated.View>
  );
}
