import { View, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { AppText } from '@/src/components/AppText';
import { useTheme } from '@/src/theme/useTheme';

// ──────────────────────────────────────────────────────────────────────────────
// AntiChaseCoachCard — the one-time nudge back to guessing honestly.
//
// Shown once, ever, when the user drags their guess up to meet the honest number
// (the chase move that inflates the model's own input). It wears the INDIGO family,
// not amber: this is a coach note, deliberately a different voice from the honest
// number's honey. Fades in on opacity only (no slide, no bounce) and reduces to its
// final state under reduced motion via the FadeIn preset.
// ──────────────────────────────────────────────────────────────────────────────

export function AntiChaseCoachCard({ onDismiss }: { onDismiss: () => void }) {
  const t = useTheme();

  const card: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.space[3],
    backgroundColor: t.colors.primaryWash,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    paddingVertical: t.space[3],
    paddingLeft: t.space[4],
    paddingRight: t.space[2],
  };
  const coin: ViewStyle = {
    width: t.space[8],
    height: t.space[8],
    borderRadius: t.radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.primarySoft,
  };
  const body: TextStyle = {
    flex: 1,
    fontSize: t.fontSize.sm,
    color: t.colors.ink,
    lineHeight: t.fontSize.sm * t.lineHeight.normal,
    paddingTop: t.space[1],
  };
  const dismiss: ViewStyle = {
    width: t.size.control.xs,
    height: t.size.control.xs,
    borderRadius: t.radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <Animated.View
      entering={FadeIn.duration(t.motion.base)}
      style={card}
      accessibilityLabel="No need to pad your guess. Guess how long it feels — we add the reality part."
    >
      <View style={coin}>
        <Ionicons name="bulb-outline" size={t.iconSize.md} color={t.colors.primary} />
      </View>
      <AppText style={body}>
        No need to pad it yourself — just guess how long it feels. We add the reality part.
      </AppText>
      <Pressable
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        hitSlop={t.size.hitSlop}
        style={dismiss}
      >
        <Ionicons name="close" size={t.iconSize.sm} color={t.colors.inkSoft} />
      </Pressable>
    </Animated.View>
  );
}
