import { View, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Card } from '@/src/components/Card';
import { AppText } from '@/src/components/AppText';
import { ProCoinPill } from '@/src/components/ProCoinPill';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { analytics } from '@/src/services/analytics';

// ──────────────────────────────────────────────────────────────────────────────
// GoalLocked — the non-Pro teaser for the per-category goal COACH (spec
// 2026-06-26-goal-coach §Locked). Sells the verb ("I'll coach you there"), never
// the user's real numbers: a greyed teaser track at a fixed illustrative fraction
// with a honey target tick (no amber data, no real %). The Pro affordance is a
// coin-edge PRO pill (the app's coin language, see ProCoinPill). Tapping opens
// the paywall with the `goals` trigger and fires `goal_paywall`. The Pressable
// is a bare touch wrapper; visuals live on the inner Card (RN reactCompiler +
// nativewind drop function-form Pressable styles).
// ──────────────────────────────────────────────────────────────────────────────

export function GoalLocked({ categoryId }: { categoryId: string }) {
  const t = useTheme();

  const headerRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  };
  const eyebrow: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.inkSoft };
  const titleRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.space[2],
  };
  const headline: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink, flex: 1 };
  const sub: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft };

  const track: ViewStyle = {
    position: 'relative',
    height: t.progress.track,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.surfaceSunken,
    overflow: 'visible',
  };
  // Greyed teaser fill — neutral, never amber, at a fixed illustrative width.
  const fill: ViewStyle = {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: `${t.progress.teaserFill * 100}%`,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.inkFaint,
  };
  // A honey target tick — the SHAPE of "a target you aim for", no real number.
  const tick: ViewStyle = {
    position: 'absolute',
    top: -t.space[1],
    bottom: -t.space[1],
    left: '52%',
    width: t.progress.tickW,
    borderRadius: t.radii.full,
    backgroundColor: t.brand.honeyFill,
    opacity: t.opacity.pressed,
  };

  const openPaywall = () => {
    analytics.capture('goal_paywall', { category: categoryId });
    router.push({ pathname: '/(modals)/paywall', params: { trigger: 'goals' } });
  };

  return (
    <Pressable
      onPress={openPaywall}
      accessibilityRole="button"
      accessibilityLabel="Set a goal for this category with Pro — Whenbee coaches you to it"
    >
      <Card style={{ gap: t.space[3] }}>
        <View style={headerRow}>
          <AppText style={eyebrow}>GOAL</AppText>
          <ProCoinPill />
        </View>
        <View style={titleRow}>
          <AppText style={headline}>Set a target and I&apos;ll coach you there</AppText>
          <Ionicons name="chevron-forward" size={t.iconSize.sm} color={t.colors.inkSoft} />
        </View>
        <AppText style={sub}>The number to guess, your biggest miss, how close you are.</AppText>
        <View style={track}>
          <View style={fill} />
          <View style={tick} />
        </View>
      </Card>
    </Pressable>
  );
}
