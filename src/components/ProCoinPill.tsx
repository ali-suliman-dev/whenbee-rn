import { View, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { AppText } from '@/src/components/AppText';

// ──────────────────────────────────────────────────────────────────────────────
// ProCoinPill — the app's tactile "PRO" coin pill (honey face on a darker amber
// edge, like CoinBadge / CoinHex). Display-only; wrap in a Pressable for a tap
// target. Shared by GoalLocked and FocusPeakCard. `icon` defaults to the
// lock (a still-behind-Pro cue); pass "medal" for a milestone/achievement cue.
// ──────────────────────────────────────────────────────────────────────────────

export function ProCoinPill({ icon = 'lock-closed' }: { icon?: ComponentProps<typeof Ionicons>['name'] }) {
  const t = useTheme();
  const edge = t.burst.coinEdge;
  const wrap: ViewStyle = { paddingBottom: edge };
  const edgeBase: ViewStyle = {
    position: 'absolute',
    left: 0,
    right: 0,
    top: edge,
    bottom: 0,
    borderRadius: t.radii.full,
    borderCurve: 'continuous',
    backgroundColor: t.colors.accentEdge,
  };
  const face: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[1],
    backgroundColor: t.colors.accent,
    borderRadius: t.radii.full,
    borderCurve: 'continuous',
    paddingHorizontal: t.space[2.5],
    paddingVertical: t.space[0.5],
  };
  const label: TextStyle = {
    ...(type.captionBold as unknown as TextStyle),
    color: t.colors.onAmber,
    letterSpacing: 0.3,
  };
  return (
    <View style={wrap}>
      <View style={edgeBase} />
      <View style={face}>
        <Ionicons name={icon} size={t.iconSize.xs} color={t.colors.onAmber} />
        <AppText style={label}>PRO</AppText>
      </View>
    </View>
  );
}
