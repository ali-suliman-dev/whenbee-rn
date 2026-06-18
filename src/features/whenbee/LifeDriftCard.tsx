import { Pressable, View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/src/components/Card';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { analytics } from '@/src/services/analytics';
import type { BlindSpot } from './useWhenbeeHub';

// ──────────────────────────────────────────────────────────────────────────────
// LifeDriftCard (C17) — the gentle "life shifts, numbers drift" re-check moment.
// Surfaces only when the companion's positive-only drift register reads 'curious'.
// Never a guilt state: drift isn't failure, it's life changing (new routine, a
// season, sleep). A few fresh logs and the numbers re-sync. One soft CTA into a
// category to re-check, plus a quiet "Not now" that dismisses for this cycle.
//
//   LIFE CHANGES, SO DOES YOUR TIMING
//   When your days shift, {name} catches back up with a few fresh logs.
//   [ Re-check {area} → ]   Not now
// ──────────────────────────────────────────────────────────────────────────────

export function LifeDriftCard({
  companionName,
  blindSpot,
  onDismiss,
}: {
  companionName: string | null;
  blindSpot: BlindSpot | null;
  onDismiss: () => void;
}) {
  const t = useTheme();
  const who = companionName ?? 'Whenbee';
  const area = blindSpot?.name ?? null;

  function recheck() {
    analytics.capture('drift_recheck', { action: 'recheck' });
    if (blindSpot) {
      router.push({ pathname: '/category/[category]', params: { category: blindSpot.categoryId } });
    }
    onDismiss();
  }

  const eyebrow: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.inkSoft };
  const body: TextStyle = { ...(type.body as unknown as TextStyle), color: t.colors.inkSoft };
  const ctaText: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.primary };
  const dismissText: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft };

  const row: ViewStyle = { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: t.space[3] };
  const cta: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[1], minHeight: t.size.control.md };
  const dismiss: ViewStyle = { justifyContent: 'center', minHeight: t.size.control.md, paddingHorizontal: t.space[2] };

  return (
    <Card style={{ gap: t.space[2] }}>
      <Text style={eyebrow}>LIFE CHANGES, SO DOES YOUR TIMING</Text>
      <Text style={body}>
        When your days shift, how long things take shifts with them. Log a few and {who} catches
        back up to you.
      </Text>
      <View style={row}>
        <Pressable
          onPress={recheck}
          accessibilityRole="button"
          accessibilityLabel={area ? `Re-check ${area}` : 'Re-check an area'}
          style={cta}
        >
          <Text style={ctaText}>{area ? `Re-check ${area}` : 'Keep logging'}</Text>
          {area ? <Ionicons name="arrow-forward" size={t.iconSize.sm} color={t.colors.primary} /> : null}
        </Pressable>
        <Pressable onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Not now" style={dismiss}>
          <Text style={dismissText}>Not now</Text>
        </Pressable>
      </View>
    </Card>
  );
}
