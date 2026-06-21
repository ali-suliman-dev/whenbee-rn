import { Card } from '@/src/components/Card';
import { analytics } from '@/src/services/analytics';
import { type } from '@/src/theme/typography';
import { useTheme } from '@/src/theme/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { BlindSpot } from './useWhenbeeHub';

// ──────────────────────────────────────────────────────────────────────────────
// LifeDriftCard (C17) — the gentle "life shifts, numbers drift" re-check moment.
// Surfaces only when the companion's positive-only drift register reads 'curious'.
// Never a guilt state: drift isn't failure, it's life changing (new routine, a
// season, sleep). A few fresh logs and the numbers re-sync.
//
// Layout (cohesive with BlindSpotCard — same amber tile + label/title header):
//   [amber ↻ tile]  DRIFT CHECK
//                   Life shifts, so does your timing
//   A few honest logs and {name} catches back up to you.
//   [ Re-check {area} → ]            Not now
// ──────────────────────────────────────────────────────────────────────────────

export function LifeDriftCard({
  companionName,
  blindSpot,
  onDismiss,
}: {
  companionName: string | null;
  blindSpot: BlindSpot | null;
  onDismiss: () => void;
}) {
  const t = useTheme();
  const who = companionName ?? 'Whenbee';
  const area = blindSpot?.name ?? null;

  const scale = useSharedValue(1);
  const pillStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  function recheck() {
    analytics.capture('drift_recheck', { action: 'recheck' });
    if (blindSpot) {
      router.push({ pathname: '/category/[category]', params: { category: blindSpot.categoryId } });
    }
    onDismiss();
  }

  const eyebrow: TextStyle = {
    ...(type.eyebrow as unknown as TextStyle),
    color: t.colors.inkFaint,
  };
  const title: TextStyle = { ...(type.heading as unknown as TextStyle), color: t.colors.ink };
  const body: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft };
  const pillText: TextStyle = {
    ...(type.captionBold as unknown as TextStyle),
    textDecorationLine: 'underline',
    color: t.colors.primary,
  };
  const dismissText: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    textDecorationLine: 'underline',
    color: t.colors.inkSoft,
  };

  const chip: ViewStyle = {
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
  const actionRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.space[3],
  };
  const pill: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[1],
    borderRadius: t.radii.full,
  };
  const dismiss: ViewStyle = {
    justifyContent: 'center',
    minHeight: t.size.control.sm,
    paddingHorizontal: t.space[2],
  };

  return (
    <Card style={{ gap: t.space[5] }}>
      <View style={group}>
        <View style={headRow}>
          <View style={chip}>
            <Ionicons name="refresh-outline" size={t.iconSize.sm} color={t.colors.ink} />
          </View>
          <View style={titleCol}>
            <Text style={eyebrow}>DRIFT CHECK</Text>
            <Text style={title}>Life shifts, so does your timing</Text>
          </View>
        </View>
        <Text style={body}>A few honest logs and {who} catches back up to you.</Text>
      </View>

      <View style={actionRow}>
        <Pressable
          onPress={recheck}
          onPressIn={() =>
            scale.set(withTiming(0.97, { duration: t.motion.press, easing: t.motion.easing.out }))
          }
          onPressOut={() =>
            scale.set(withTiming(1, { duration: t.motion.fast, easing: t.motion.easing.out }))
          }
          hitSlop={t.size.hitSlop}
          accessibilityRole="button"
          accessibilityLabel={area ? `Re-check ${area}` : 'Keep logging'}
        >
          <Animated.View style={[pill, pillStyle]}>
            <Text style={pillText}>{area ? `Re-check ${area}` : 'Keep logging'}</Text>
            {area ? (
              <Ionicons name="arrow-forward" size={t.iconSize.xs} color={t.colors.primary} />
            ) : null}
          </Animated.View>
        </Pressable>
        <Pressable
          onPress={onDismiss}
          hitSlop={t.size.hitSlop}
          accessibilityRole="button"
          accessibilityLabel="Not now"
          style={dismiss}
        >
          <Text style={dismissText}>Not now</Text>
        </Pressable>
      </View>
    </Card>
  );
}
