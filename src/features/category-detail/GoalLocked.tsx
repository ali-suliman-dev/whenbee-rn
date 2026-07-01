import { View, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Card } from '@/src/components/Card';
import { AppText } from '@/src/components/AppText';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { analytics } from '@/src/services/analytics';

// ──────────────────────────────────────────────────────────────────────────────
// GoalLocked — the non-Pro teaser for the per-category goal COACH (spec
// 2026-06-26-goal-coach §Locked). Sells the verb ("I'll coach you there"), never
// the user's real numbers: a greyed teaser track at a fixed illustrative fraction
// with a honey target tick (no amber data, no real %). The Pro affordance is a
// coin-edge PRO pill (the app's coin language). Tapping opens the paywall with the
// `goals` trigger and fires `goal_paywall`. The Pressable is a bare touch wrapper;
// visuals live on the inner Card (RN reactCompiler + nativewind drop function-form
// Pressable styles).
// ──────────────────────────────────────────────────────────────────────────────

/** A small tactile "PRO" coin pill — honey face on a darker amber edge (coin-edge
 *  depth, like CoinBadge / CoinHex). Display-only. */
function ProCoinPill() {
  const t = useTheme();
  const { t: tr } = useTranslation('categoryDetail');
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
        <Ionicons name="lock-closed" size={t.iconSize.xs} color={t.colors.onAmber} />
        <AppText style={label}>{tr('goalLocked.proLabel')}</AppText>
      </View>
    </View>
  );
}

export function GoalLocked({ categoryId }: { categoryId: string }) {
  const t = useTheme();
  const { t: tr } = useTranslation('categoryDetail');

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
      accessibilityLabel={tr('goalLocked.accessibilityLabel')}
    >
      <Card style={{ gap: t.space[3] }}>
        <View style={headerRow}>
          <AppText style={eyebrow}>{tr('goalLocked.eyebrow')}</AppText>
          <ProCoinPill />
        </View>
        <View style={titleRow}>
          <AppText style={headline}>{tr('goalLocked.headline')}</AppText>
          <Ionicons name="chevron-forward" size={t.iconSize.sm} color={t.colors.inkSoft} />
        </View>
        <AppText style={sub}>{tr('goalLocked.sub')}</AppText>
        <View style={track}>
          <View style={fill} />
          <View style={tick} />
        </View>
      </Card>
    </Pressable>
  );
}
