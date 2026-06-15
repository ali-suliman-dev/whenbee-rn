import { View, Text, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Card } from '@/src/components/Card';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

// ──────────────────────────────────────────────────────────────────────────────
// StealsYourTimeLocked (S12) — the non-Pro teaser for "what steals your time".
// Honest about what's behind it: the user's own why-notes, summed into one read.
// Curiosity, not pressure — it names the question Whenbee can already answer from
// their data, then offers Pro to see it. Tapping opens the paywall with the
// steals_your_time trigger; the paywall route fires paywall_view on mount, so the
// source is captured there (single source of truth, no double-fire). The Pressable
// stays a bare touch wrapper — visuals live on the inner Card (RN reactCompiler +
// nativewind drop function-form Pressable styles).
// ──────────────────────────────────────────────────────────────────────────────

const HEADLINE = 'You have been telling Whenbee where your time goes.';
const DETAIL =
  'Every time you note why a task ran long, that is a clue. Pro reads those notes back to you: the cause behind your overruns, by category.';

export function StealsYourTimeLocked() {
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
      accessibilityLabel="Unlock what steals your time with Pro"
    >
      <Card tone="flat" style={{ gap: t.space[3] }}>
        <View style={eyebrowRow}>
          <Ionicons name="hourglass-outline" size={t.iconSize.sm} color={t.colors.primary} />
          <Text style={eyebrow} numberOfLines={1}>
            WHAT STEALS YOUR TIME
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
