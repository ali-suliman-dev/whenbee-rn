import { View, Text, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Card } from '@/src/components/Card';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

// ──────────────────────────────────────────────────────────────────────────────
// AccuracyCorrelationsLocked (S3) — the non-Pro teaser for "when you're sharpest".
// Names the question Whenbee can already answer from the user's logs (the rhythm
// behind their accuracy), then offers Pro. Tapping opens the paywall with the
// steals_your_time trigger (the shared Pro-Patterns surface); the paywall route
// fires paywall_view on mount. Pressable stays a bare touch wrapper; visuals live
// on the inner Card (reactCompiler + nativewind drop function-form Pressable styles).
// ──────────────────────────────────────────────────────────────────────────────

const HEADLINE = 'There is a rhythm to when your estimates land.';
const DETAIL =
  'Some hours and some days, your guesses are closer than others. Pro reads your logs back to you: when you are sharpest, and when to leave a little more buffer.';

export function AccuracyCorrelationsLocked() {
  const t = useTheme();

  const eyebrowRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2] };
  const eyebrow: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.primary };
  const headline: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink };
  const detail: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft };
  const ctaRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[1] };
  const cta: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.primary };
  const block: ViewStyle = { gap: t.space[1.5] };

  const openPaywall = () => {
    router.push({ pathname: '/(modals)/paywall', params: { trigger: 'steals_your_time' } });
  };

  return (
    <Pressable
      onPress={openPaywall}
      accessibilityRole="button"
      accessibilityLabel="Unlock when you're sharpest with Pro"
    >
      <Card tone="flat" style={{ gap: t.space[3] }}>
        <View style={eyebrowRow}>
          <Ionicons name="time-outline" size={t.iconSize.sm} color={t.colors.primary} />
          <Text style={eyebrow} numberOfLines={1}>
            WHEN YOU&apos;RE SHARPEST
          </Text>
        </View>
        <View style={block}>
          <Text style={headline}>{HEADLINE}</Text>
          <Text style={detail}>{DETAIL}</Text>
        </View>
        <View style={ctaRow}>
          <Text style={cta}>Unlock with Pro</Text>
          <Ionicons name="arrow-forward" size={t.iconSize.xs} color={t.colors.primary} />
        </View>
      </Card>
    </Pressable>
  );
}
