import { Pressable, View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { TIERS, logsToNextTier } from '@/src/engine';
import type { Tier } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// HoneycombStripPlaceholder — the persistent gamification HUD on Today.
//
// Tappable Card → Whenbee hub. Shows the aggregate honeycomb state:
//   "Your honeycomb"  [tier pill]
//   {pct}% honey · {logs} logs
//   {n} logs to {nextTier} →     (indigo)
//
// PLACEHOLDER QUALITY: this reads a simple aggregate from the calibration cache
// (sum of logs; the lead category's tier drives the pill). Real per-cell
// Honeycomb wiring lands in a later phase — functional, not final.
// ──────────────────────────────────────────────────────────────────────────────

interface AggregateHoney {
  pct: number;
  logs: number;
  tier: Tier;
  nextTier: Tier | null;
  logsToNext: number;
}

function aggregate(
  stats: Record<string, { sharpness: number; tier: Tier }>,
  logs: number,
): AggregateHoney {
  const entries = Object.values(stats);
  // Lead = the most-ripened category drives the pill + next-tier line.
  const lead = entries.reduce<{ sharpness: number; tier: Tier } | null>(
    (best, s) => (best === null || s.sharpness > best.sharpness ? s : best),
    null,
  );
  const sharpness = lead?.sharpness ?? 0;
  const tier = lead?.tier ?? 'Raw';
  const tierIdx = TIERS.indexOf(tier);
  const nextTier = tierIdx >= 0 && tierIdx < TIERS.length - 1 ? TIERS[tierIdx + 1]! : null;
  return { pct: Math.round(sharpness), logs, tier, nextTier, logsToNext: logsToNextTier(sharpness) };
}

export function HoneycombStripPlaceholder({ onPress }: { onPress: () => void }) {
  const t = useTheme();
  const stats = useCalibrationStore((s) => s.statsByCategory);
  const logs = useCalibrationStore((s) => s.logs);

  const { pct, tier, nextTier, logsToNext } = aggregate(stats, logs);

  const card: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[3],
    backgroundColor: t.colors.surface,
    borderWidth: 2,
    borderColor: t.colors.hairline,
    borderRadius: t.radii.xl,
    padding: t.space[3],
  };
  const hexBadge: ViewStyle = {
    width: 40,
    height: 40,
    borderRadius: t.radii.md,
    backgroundColor: t.colors.accentTint,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const headingRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2] };
  const heading: TextStyle = { ...(type.heading as unknown as TextStyle), color: t.colors.ink };
  const pill: ViewStyle = {
    backgroundColor: t.colors.primaryTint,
    borderRadius: t.radii.pill,
    paddingHorizontal: t.space[2],
    paddingVertical: 2,
  };
  const pillText: TextStyle = {
    ...(type.micro as unknown as TextStyle),
    color: t.colors.primary,
    fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
  };
  const subline: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };
  const nextLine: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.primary,
    fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
  };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Your honeycomb — ${pct}% honey, tier ${tier}, ${logs} logs`}
      style={({ pressed }) => [card, pressed ? { opacity: 0.85 } : null]}
    >
      <View style={hexBadge}>
        <Ionicons name="apps-outline" size={20} color={t.colors.accent} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={headingRow}>
          <Text style={heading}>Your honeycomb</Text>
          <View style={pill}>
            <Text style={pillText}>{tier}</Text>
          </View>
        </View>
        <Text style={subline}>
          {pct}% honey · {logs} {logs === 1 ? 'log' : 'logs'}
        </Text>
        {nextTier ? (
          <Text style={nextLine}>
            {logsToNext} logs to {nextTier} →
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
