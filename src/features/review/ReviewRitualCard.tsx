import { useEffect } from 'react';
import { View, Text, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Card } from '@/src/components/Card';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { analytics } from '@/src/services/analytics';
import type { ReviewSummary } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// ReviewRitualCard (Pro) — the Patterns entry to the recap. Two calm states:
//   ready (isFresh) → an amber envelope: "Your honest week is ready" + a lead and
//                     an open CTA. The one scarce-amber moment on the screen.
//   quiet (seen)    → a plain row + chevron, re-openable, always recomputed live.
// Tapping opens the modal. No streak, no red, no "you missed". Fires
// review_card_shown once on mount.
// ──────────────────────────────────────────────────────────────────────────────

export function ReviewRitualCard({
  summary,
  isFresh,
}: {
  summary: ReviewSummary;
  isFresh: boolean;
}) {
  const t = useTheme();
  const isMonth = summary.period.kind === 'month';

  useEffect(() => {
    analytics.capture('review_card_shown', {
      period_kind: summary.period.kind,
      state: isFresh ? 'ready' : 'quiet',
      is_pro: true,
    });
    // Mount-only: one impression per render of the card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function open() {
    router.push({ pathname: '/(modals)/review', params: { source: 'card' } });
  }

  const periodWord = isMonth ? 'month' : 'week';
  const quietRowText = isMonth ? 'Your honest month' : 'Your honest week';

  // ── Quiet row (already opened this period) ──────────────────────────────────
  if (!isFresh) {
    const row: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[3] };
    const label: TextStyle = { ...(type.bodySmBold as unknown as TextStyle), color: t.colors.ink, flex: 1 };
    return (
      <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={`Open ${quietRowText}`}>
        <Card tone="flat" style={row}>
          <Ionicons name="leaf-outline" size={t.iconSize.md} color={t.colors.inkSoft} />
          <Text style={label}>{quietRowText}</Text>
          <Ionicons name="chevron-forward" size={t.iconSize.sm} color={t.colors.inkSoft} />
        </Card>
      </Pressable>
    );
  }

  // ── Ready envelope (unopened — the scarce amber moment) ─────────────────────
  const eyebrowRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2] };
  const eyebrow: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.amberText };
  const headline: TextStyle = { ...(type.subtitle as unknown as TextStyle), color: t.colors.ink };
  const lead: TextStyle = { ...(type.body as unknown as TextStyle), color: t.colors.inkSoft };
  const ctaRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[1.5] };
  const ctaText: TextStyle = { ...(type.bodySmBold as unknown as TextStyle), color: t.colors.amberText };
  const envelope: ViewStyle = {
    backgroundColor: t.colors.accentSoft,
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
