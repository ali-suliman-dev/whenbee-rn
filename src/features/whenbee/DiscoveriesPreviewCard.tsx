import type { Discovery } from '@/src/domain/types';
import { type } from '@/src/theme/typography';
import { useTheme } from '@/src/theme/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import {
  categoryLabel,
  discoveryDirection,
  discoverySentence,
  multiplierValue,
} from './discoveryDisplay';

// ──────────────────────────────────────────────────────────────────────────────
// DiscoveriesPreviewCard — the hub teaser into the full gallery. A flat "featured
// nugget": the newest discovery in focus (its multiplier the hero, amber if it
// runs longer / green if faster), the running count (only ever grows), and a tap
// into the gallery. Discoveries are banked self-knowledge, never a score to beat.
//
// Flat surface (matches the Your-areas / Pro cards below) — no glow, no border.
// Rendered only when discoveryCount > 0 (the parent gates).
// ──────────────────────────────────────────────────────────────────────────────

export function DiscoveriesPreviewCard({
  discoveries,
  discoveryCount,
}: {
  discoveries: Discovery[];
  discoveryCount: number;
}) {
  const t = useTheme();
  const latest = discoveries[0];
  if (!latest) return null;

  const direction = discoveryDirection(latest.multiplier);
  const tint = direction === 'longer' ? t.colors.accent : t.colors.success;
  const moreCount = discoveryCount - 1;

  function open() {
    router.push('/(modals)/discoveries');
  }

  const cardWrap: ViewStyle = {
    backgroundColor: t.colors.surface,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    padding: t.space[4],
  };
  const eyebrowRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[2],
    marginBottom: t.space[3],
  };
  const eyebrowLab: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.inkSoft };
  const pill: TextStyle = {
    ...(type.captionBold as unknown as TextStyle),
    color: t.colors.accent,
    backgroundColor: t.colors.accentSoft,
    marginLeft: 'auto',
    paddingHorizontal: t.space[2.5],
    paddingVertical: t.space[1],
    borderRadius: t.radii.full,
    overflow: 'hidden',
    fontVariant: ['tabular-nums'],
  };
  // Hero number + × rendered as siblings in a baseline row so RNTL can
  // getByText('2.3') without matching the concatenated "2.3×" form.
  const heroRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: t.space[1],
  };
  const heroN: TextStyle = {
    ...(type.honestNumberMd as unknown as TextStyle),
    color: tint,
  };
  const heroX: TextStyle = {
    fontSize: t.fontSize.md,
    color: tint,
    opacity: t.opacity.pressed,
  };
  const cat: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink };
  const sentence: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: t.colors.inkSoft,
    marginTop: t.space[0.5],
  };
  const footer: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: t.space[3],
    paddingTop: t.space[3],
    borderTopWidth: t.borderWidth.thick,
    borderTopColor: t.colors.hairline,
  };
  const moreTxt: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkFaint };
  const seeAll: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[1] };
  const seeTxt: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.primary };

  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={`See all ${discoveryCount} things you've learned`}
    >
      <View style={cardWrap}>
        <View style={eyebrowRow}>
          <Text style={eyebrowLab}>LATEST DISCOVERY</Text>
          <Text style={pill}>{discoveryCount} banked</Text>
        </View>

        {/* Sibling-Text hero so RNTL getByText('2.3') works without matching '2.3×' */}
        <View style={heroRow}>
          <Text style={heroN}>{multiplierValue(latest.multiplier)}</Text>
          <Text style={heroX}>×</Text>
        </View>
        <Text style={cat}>{categoryLabel(latest.categoryId)}</Text>
        <Text style={sentence}>{discoverySentence(latest.honestForFifteen, direction)}</Text>

        <View style={footer}>
          {moreCount > 0 ? <Text style={moreTxt}>+{moreCount} more</Text> : <View />}
          <View style={seeAll}>
            <Text style={seeTxt}>See all {discoveryCount}</Text>
            <Ionicons name="chevron-forward" size={t.iconSize.sm} color={t.colors.primary} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}
