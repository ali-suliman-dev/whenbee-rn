// src/features/reward/RewardReaskRow.tsx
// The once-ever notification re-ask, as a quiet single row on the reward screen
// (never a card competing with the primary CTA). Renders only when the pure
// reaskGate qualifies this exact moment:
//   overrun — the just-banked log ran well past its guess (calm fact, no guilt)
//   granted — OS permission already exists (start-by piggyback): one-tap enable
// Mutually exclusive with NotifSoftAskCard (that needs status 'pending'; this
// needs 'declined'). Opacity-only entrance; reduced-motion → final state.

import { AppButton } from '@/src/components/AppButton';
import { Card } from '@/src/components/Card';
import { useNotifReask } from '@/src/features/notifications/useNotifReask';
import { useRewardStore } from '@/src/stores/rewardStore';
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

export function RewardReaskRow() {
  const t = useTheme();
  const guessMin = useRewardStore((s) => s.guessMin);
  const actualMin = useRewardStore((s) => s.actualMin);
  const { show, trigger, overrunMin, onAccept, onDismiss } = useNotifReask({
    guessMin,
    actualMin,
  });
  const reducedMotion = useReducedMotion();

  // Opacity-only entrance — same motion grammar as NotifSoftAskCard.
  const opacity = useSharedValue(reducedMotion ? 1 : 0);
  useEffect(() => {
    if (!show) return;
    if (reducedMotion) {
      opacity.set(1);
      return;
    }
    opacity.set(withTiming(1, { duration: t.motion.base, easing: t.motion.easing.standard }));
  }, [show, reducedMotion, opacity, t.motion.base, t.motion.easing.standard]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  if (!show) return null;

  const title =
    trigger === 'granted'
      ? 'Add the honest-finish ping?'
      : `This ran ${overrunMin}m past your guess`;
  const sub =
    trigger === 'granted'
      ? 'Notifications are already allowed. One tap.'
      : 'Want a quiet tap at your honest finish?';

  const titleText: TextStyle = {
    ...(type.bodySmBold as unknown as TextStyle),
    color: t.colors.ink,
  };
  const subText: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkSoft,
  };

  const row: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[3] };
  const textCol: ViewStyle = { flex: 1, gap: t.space[0.5] };
  const dismiss: ViewStyle = {
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: t.size.control.sm,
    minHeight: t.size.control.sm,
  };

  return (
    <Animated.View style={animStyle}>
      <Card style={row}>
        <Ionicons name="notifications-outline" size={t.iconSize.md} color={t.colors.ink} />
        <View style={textCol}>
          <Text style={titleText}>{title}</Text>
          <Text style={subText}>{sub}</Text>
        </View>
        <AppButton label="Turn on" variant="amber" size="xs" onPress={() => { void onAccept(); }} />
        <Pressable
          onPress={onDismiss}
          hitSlop={t.size.hitSlop}
          accessibilityRole="button"
          accessibilityLabel="No thanks"
          style={dismiss}
        >
          <Ionicons name="close" size={t.iconSize.sm} color={t.colors.inkFaint} />
        </Pressable>
      </Card>
    </Animated.View>
  );
}
