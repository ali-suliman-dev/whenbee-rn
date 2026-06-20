import { View, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { router } from 'expo-router';
import { AppText } from '@/src/components/AppText';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { analytics } from '@/src/services/analytics';

// ──────────────────────────────────────────────────────────────────────────────
// HonestBandLockedTeaser — the non-Pro teaser for the category-detail honest band.
//
// Shows the SHAPE of the value (a band that narrows) using placeholder geometry,
// never the user's real low/high. A greyed track with a ghost segment + a Pro chip
// + a one-line promise. Tapping opens the paywall with the honest_range trigger.
// The Pressable stays a bare touch wrapper; visuals live on the inner View (RN
// reactCompiler + nativewind drop function-form Pressable styles).
// ──────────────────────────────────────────────────────────────────────────────

const CAPTION = 'See the range your tasks land in, and watch it tighten.';

export function HonestBandLockedTeaser() {
  const t = useTheme();

  const openPaywall = () => {
    analytics.capture('honest_range_locked_tap', { surface: 'category_detail' });
    router.push({ pathname: '/(modals)/paywall', params: { trigger: 'honest_range' } });
  };

  const block: ViewStyle = { gap: t.space[2] };
  const headerRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2] };
  const chip: ViewStyle = {
    backgroundColor: t.colors.primarySoft,
    borderRadius: t.radii.full,
    paddingHorizontal: t.space[2],
    paddingVertical: t.space[0.5],
  };
  const chipText: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.primary,
    fontFamily: 'Jakarta-Bold',
  };
  const caption: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft, flex: 1 };
  // Greyed band: a generic, narrow ghost segment in the middle of a sunken well.
  const track: ViewStyle = {
    height: t.progress.gapTrack,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.surfaceSunken,
    overflow: 'hidden',
    justifyContent: 'center',
  };
  const ghost: ViewStyle = {
    position: 'absolute',
    left: '32%',
    width: '36%',
    top: 0,
    bottom: 0,
    backgroundColor: t.colors.primarySoft,
    borderRadius: t.radii.full,
  };

  return (
    <Pressable
      onPress={openPaywall}
      accessibilityRole="button"
      accessibilityLabel="Unlock the honest range with Pro."
    >
      <View style={block}>
        <View style={headerRow}>
          <AppText style={caption}>{CAPTION}</AppText>
          <View style={chip}>
            <AppText style={chipText}>Pro</AppText>
          </View>
        </View>
        <View style={track}>
          <View style={ghost} pointerEvents="none" />
        </View>
      </View>
    </Pressable>
  );
}
