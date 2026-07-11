import { useEffect } from 'react';
import { View, Text, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { analytics } from '@/src/services/analytics';
import type { ReviewSummary } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// ReviewRitualCard (Pro) — the Patterns entry to the recap. Always the full
// envelope card: amber eyebrow + "Your honest week is ready." + a lead and an
// open CTA, on the standard dark surface. Re-openable, recomputed live every
// visit — it never collapses to a quiet row. Tapping opens the modal. No streak,
// no red, no "you missed". Fires review_card_shown once on mount.
// ──────────────────────────────────────────────────────────────────────────────

export function ReviewRitualCard({ summary }: { summary: ReviewSummary }) {
  const t = useTheme();
  const isMonth = summary.period.kind === 'month';

  useEffect(() => {
    analytics.capture('review_card_shown', {
      period_kind: summary.period.kind,
      state: 'ready',
      is_pro: true,
    });
    // Mount-only: one impression per render of the card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function open() {
    router.push({ pathname: '/(modals)/review', params: { source: 'card' } });
  }

  const periodWord = isMonth ? 'month' : 'week';

  const eyebrowRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2] };
  const eyebrow: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.amberText };
  const headline: TextStyle = { ...(type.subtitle as unknown as TextStyle), color: t.colors.ink };
  const lead: TextStyle = { ...(type.body as unknown as TextStyle), color: t.colors.inkSoft };
  const ctaRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[1.5] };
  const ctaText: TextStyle = { ...(type.bodySmBold as unknown as TextStyle), color: t.colors.amberText };
  // Surface (not accentSoft) so the ready card sits on the same dark card
  // colour as its siblings above (personality / when-you're-sharp) — the amber
  // eyebrow, icon and CTA carry the "ready" warmth without a tinted surface.
  const envelope: ViewStyle = {
    backgroundColor: t.colors.surface,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    padding: t.space[4],
    gap: t.space[2.5],
  };

  return (
    <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={`Open your honest ${periodWord}`}>
      <View style={envelope}>
        <View style={eyebrowRow}>
          <Ionicons name="mail-unread-outline" size={t.iconSize.sm} color={t.colors.accent} />
          <Text style={eyebrow}>{isMonth ? 'YOUR HONEST MONTH' : 'YOUR HONEST WEEK'}</Text>
        </View>
        <Text style={headline}>Your honest {periodWord} is ready.</Text>
        <Text style={lead}>Seven days are in. Here is where your time actually went.</Text>
        <View style={ctaRow}>
          <Text style={ctaText}>Open your {periodWord}</Text>
          <Ionicons name="arrow-forward" size={t.iconSize.xs} color={t.colors.amberText} />
        </View>
      </View>
    </Pressable>
  );
}
