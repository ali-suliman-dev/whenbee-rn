import { Card } from '@/src/components/Card';
import { type } from '@/src/theme/typography';
import { useTheme } from '@/src/theme/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  Pressable,
  Text,
  View,
  type DimensionValue,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import type { BlindSpot } from './useWhenbeeHub';

// ──────────────────────────────────────────────────────────────────────────────
// BlindSpotCard — a kind "let's calibrate this next" nudge, never a scold. Points
// at the lowest-sharpness tracked category and drills into its Tune screen.
//
// Layout (flat-tactical, one warm anchor):
//   [amber ✦ tile]  STILL LEARNING            ›
//                   Cleaning
//   A few honest logs and this number gets sharper.
//   ▓▓▓▓▓░░░░░░░  ← slim honey track (floored at the endowed sliver, never cold)
//
// The honey fill is the eye-catch and the information scent (you can SEE there's
// progress to make), floored at ring.endowedPct so a fresh category never reads as
// an empty/failed bar — same no-guilt move as the hub ring.
// ──────────────────────────────────────────────────────────────────────────────

export function BlindSpotCard({ blindSpot }: { blindSpot: BlindSpot }) {
  const t = useTheme();
  const { t: tr } = useTranslation('whenbee');

  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  function open() {
    router.push({ pathname: '/category/[category]', params: { category: blindSpot.categoryId } });
  }

  const pct = Math.max(0, Math.min(100, Math.round(blindSpot.sharpness)));
  // Floor the fill so a barely-started category still shows a warm sliver, never a
  // cold empty bar (matches the hub ring's endowed sliver — no-guilt invariant).
  const fillPct = Math.max(t.ring.endowedPct, pct);

  const eyebrow: TextStyle = {
    ...(type.eyebrow as unknown as TextStyle),
    color: t.colors.inkFaint,
  };
  const title: TextStyle = { ...(type.heading as unknown as TextStyle), color: t.colors.ink };
  const body: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft };

  const chip: ViewStyle = {
    width: t.size.coin,
    height: t.size.coin,
    borderRadius: t.radii.md,
    borderCurve: 'continuous',
    backgroundColor: t.colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const group: ViewStyle = { gap: t.space[1] };
  const headRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[3] };
  const titleCol: ViewStyle = { flex: 1, gap: t.space[0.5] };
  const track: ViewStyle = {
    height: t.progress.track,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.surfaceSunken,
    overflow: 'hidden',
  };
  const fill: ViewStyle = {
    height: '100%',
    width: `${fillPct}%` as DimensionValue,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.accent,
  };

  return (
    <Pressable
      onPress={open}
      onPressIn={() =>
        scale.set(withTiming(0.985, { duration: t.motion.press, easing: t.motion.easing.out }))
      }
      onPressOut={() =>
        scale.set(withTiming(1, { duration: t.motion.fast, easing: t.motion.easing.out }))
      }
      accessibilityRole="button"
      accessibilityLabel={tr('blindSpot.a11y', { name: blindSpot.name })}
    >
      <Animated.View style={pressStyle}>
        <Card style={{ gap: t.space[5] }}>
          <View style={group}>
            <View style={headRow}>
              <View style={chip}>
                <Ionicons name="bulb-outline" size={t.iconSize.sm} color={t.colors.ink} />
              </View>
              <View style={titleCol}>
                <Text style={eyebrow}>{tr('blindSpot.eyebrow')}</Text>
                <Text style={title} numberOfLines={1}>
                  {blindSpot.name}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={t.iconSize.sm} color={t.colors.inkFaint} />
            </View>
            <Text style={body}>{tr('blindSpot.body')}</Text>
          </View>
          <View style={track}>
            <View style={fill} />
          </View>
        </Card>
      </Animated.View>
    </Pressable>
  );
}
