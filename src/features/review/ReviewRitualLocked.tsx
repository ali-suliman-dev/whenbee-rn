import { useEffect } from 'react';
import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Card } from '@/src/components/Card';
import { AppButton } from '@/src/components/AppButton';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { analytics } from '@/src/services/analytics';
import type { ReviewPeriod } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// ReviewRitualLocked — the non-Pro teaser for the scheduled ritual. Real period
// label (the recap genuinely exists for them), then the withheld lead behind a soft
// scrim and an "Unlock with Pro" CTA. Patterns itself stays free; only the packaged
// recap + the two correlation cards inside it are Pro. Never guilt — it's an
// invitation, not a lock-out. Fires review_card_shown (is_pro:false) on mount.
// ──────────────────────────────────────────────────────────────────────────────

export function ReviewRitualLocked({ period }: { period: ReviewPeriod }) {
  const t = useTheme();
  const { t: tt } = useTranslation('review');
  const isMonth = period.kind === 'month';
  const periodKey = isMonth ? 'month' : 'week';

  useEffect(() => {
    analytics.capture('review_card_shown', {
      period_kind: period.kind,
      state: 'ready',
      is_pro: false,
    });
    // Mount-only impression.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openPaywall() {
    router.push({ pathname: '/(modals)/paywall', params: { trigger: 'review_ritual' } });
  }

  const eyebrowRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2] };
  const eyebrow: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.amberText };
  const label: TextStyle = { ...(type.subtitle as unknown as TextStyle), color: t.colors.ink };
  const foot: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkFaint, textAlign: 'center' };

  // The lead text sits behind a soft scrim so its shape is legible but the words
  // are withheld — a frosted preview, not a hard paywall.
  const previewWrap: ViewStyle = { position: 'relative', overflow: 'hidden', borderRadius: t.radii.md, borderCurve: 'continuous' };
  const scrim: ViewStyle = { position: 'absolute', inset: 0, backgroundColor: t.colors.surface, opacity: t.proTeaser.scrimOpacity } as ViewStyle;
  const withheld: TextStyle = { ...(type.body as unknown as TextStyle), color: t.colors.inkSoft, padding: t.space[2] };

  return (
    <Card tone="flat" style={{ gap: t.space[3] }}>
      <View style={eyebrowRow}>
        <Ionicons name="leaf-outline" size={t.iconSize.sm} color={t.colors.accent} />
        <Text style={eyebrow}>{tt(`eyebrow.${periodKey}`)}</Text>
      </View>
      <Text style={label}>{period.label}</Text>
      <View style={previewWrap}>
        <Text style={withheld} numberOfLines={2}>
          {tt(`locked.withheld.${periodKey}`)}
        </Text>
        <View style={scrim} pointerEvents="none" />
      </View>
      <AppButton label={tt('locked.unlockCta')} variant="amber" size="lg" fullWidth onPress={openPaywall} />
      <Text style={foot}>{tt('locked.footnote')}</Text>
    </Card>
  );
}
