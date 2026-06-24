import { View, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Card } from '@/src/components/Card';
import { AppText } from '@/src/components/AppText';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { analytics } from '@/src/services/analytics';

// ──────────────────────────────────────────────────────────────────────────────
// GoalLocked — the non-Pro teaser for the per-category goal (spec §9).
//
// Shows the SHAPE of the value, never the user's real accuracy: a greyed track at
// a fixed illustrative fraction (no amber, no real data) under one line of copy.
// Tapping opens the paywall with the `goals` trigger and fires `goal_paywall` so
// the funnel goal_card_viewed(locked) → goal_paywall → purchase is measurable.
// (`paywall_view {trigger:'goals'}` is fired once by the paywall route on mount —
// single source of truth, no double-fire here.) The Pressable is a bare touch
// wrapper; visuals live on the inner Card (RN reactCompiler + nativewind drop
// function-form Pressable styles).
// ──────────────────────────────────────────────────────────────────────────────

export function GoalLocked({ categoryId }: { categoryId: string }) {
  const t = useTheme();

  const headerRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  };
  const eyebrow: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.inkSoft };
  const headline: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink };
  const ctaRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  };
  const cta: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft };

  const track: ViewStyle = {
    height: t.progress.track,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.surfaceSunken,
    overflow: 'hidden',
  };
  // Greyed fill — a neutral muted bar, never amber, at a fixed illustrative width.
  const fill: ViewStyle = {
    height: '100%',
    width: `${t.progress.teaserFill * 100}%`,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.inkFaint,
  };

  const openPaywall = () => {
    analytics.capture('goal_paywall', { category: categoryId });
    router.push({ pathname: '/(modals)/paywall', params: { trigger: 'goals' } });
  };

  return (
    <Pressable
      onPress={openPaywall}
      accessibilityRole="button"
      accessibilityLabel="Set a goal for this category with Pro"
    >
      <Card style={{ gap: t.space[3] }}>
        <View style={headerRow}>
          <AppText style={eyebrow}>GOAL</AppText>
          <Ionicons name="lock-closed" size={t.iconSize.sm} color={t.colors.inkFaint} />
        </View>
        <AppText style={headline}>Set a target and watch it tighten</AppText>
        <View style={track}>
          <View style={fill} />
        </View>
        <View style={ctaRow}>
          <AppText style={cta}>Keep a forward goal on this category</AppText>
          <Ionicons name="chevron-forward" size={t.iconSize.sm} color={t.colors.inkSoft} />
        </View>
      </Card>
    </Pressable>
  );
}
