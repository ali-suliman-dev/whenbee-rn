import { Pressable, View, Text, type ViewStyle, type TextStyle } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
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

/** Maps an engine Tier value to its translated display word. */
function tierLabel(tier: Tier, tr: TFunction<'today'>): string {
  const key = tier.toLowerCase() as 'raw' | 'setting' | 'ripening' | 'thickening' | 'honest';
  return tr(`tiers.${key}`);
}

export function HoneycombStripPlaceholder({ onPress }: { onPress: () => void }) {
  const t = useTheme();
  const { t: tr } = useTranslation('today');
  const stats = useCalibrationStore((s) => s.statsByCategory);
  const logs = useCalibrationStore((s) => s.logs);

  const { pct, tier, nextTier, logsToNext } = aggregate(stats, logs);

  // Quieter than the FocusCard: a HUD, not the hero. Thin hairline, card radius.
  const card: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[3],
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.thin,
    borderColor: t.colors.hairline,
    borderRadius: t.radii.card,
    padding: t.space[3],
  };
  const hexBadge: ViewStyle = {
    width: 40,
    height: 40,
    borderRadius: t.radii.md,
    backgroundColor: t.colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const headingRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2] };
  const heading: TextStyle = { ...(type.heading as unknown as TextStyle), color: t.colors.ink };
  // Tier = honey ripeness → amber semantics (the one legitimate amber up top),
  // not indigo. Pills stop being indigo-filled.
  const pill: ViewStyle = {
    backgroundColor: t.colors.accentSoft,
    borderRadius: t.radii.full,
    paddingHorizontal: t.space[2],
    paddingVertical: t.space[0.5],
  };
  const pillText: TextStyle = {
    ...(type.micro as unknown as TextStyle),
    color: t.colors.amberText,
    fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
  };
  const subline: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };
  // Neutral, authoritative — the only color is the amber progress arrow.
  const nextLine: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.ink,
    fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
  };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={tr('honeycombStrip.a11y', { pct, tier: tierLabel(tier, tr), logs })}
      style={card}
    >
      <View style={hexBadge}>
        {/* Real honeycomb cell — a flat-top hexagon in amber, not a dot grid. */}
        <Svg width={20} height={20} viewBox="0 0 24 24">
          <Polygon points="6,2.5 18,2.5 22.5,12 18,21.5 6,21.5 1.5,12" fill={t.colors.accent} />
        </Svg>
      </View>
      <View style={{ flex: 1, gap: t.space[0.5] }}>
        <View style={headingRow}>
          <Text style={heading}>{tr('honeycombStrip.title')}</Text>
          <View style={pill}>
            <Text style={pillText}>{tierLabel(tier, tr)}</Text>
          </View>
        </View>
        <Text style={subline}>
          {tr('honeycombStrip.subline', { pct, count: logs })}
        </Text>
        {nextTier ? (
          <Text style={nextLine}>
            {tr('honeycombStrip.nextLine', { count: logsToNext, tier: tierLabel(nextTier, tr) })} <Text style={{ color: t.colors.amberText }}>→</Text>
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
