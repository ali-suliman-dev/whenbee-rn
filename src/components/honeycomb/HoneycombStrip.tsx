import { Pressable, View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { TIERS, logsToNextTier } from '@/src/engine';
import type { Tier } from '@/src/domain/types';
import { Honeycomb, type HoneycombCell } from './Honeycomb';

// ──────────────────────────────────────────────────────────────────────────────
// HoneycombStrip — the persistent gamification HUD on Today (real, not placeholder).
//
// Tappable Card → Whenbee hub. A row of live per-category honey hexes (Honeycomb,
// size="strip") + the aggregate readout the placeholder showed:
//   [ honey hexes ]  Your honeycomb  [tier pill]
//                    {pct}% honey · {logs} logs
//                    {n} logs to {nextTier} →
//
// The pill/next-line read the LEAD (most-ripened) category — that's the tier the
// user is chasing. Amber is the sanctioned honey accent here (tier = ripeness).
// ──────────────────────────────────────────────────────────────────────────────

interface AggregateHoney {
  pct: number;
  tier: Tier;
  nextTier: Tier | null;
  logsToNext: number;
}

/** Lead = the most-ripened category; it drives the pill + next-tier line. */
function aggregate(cells: HoneycombCell[]): AggregateHoney {
  const lead = cells.reduce<HoneycombCell | null>(
    (best, c) => (best === null || c.sharpness > best.sharpness ? c : best),
    null,
  );
  const sharpness = lead?.sharpness ?? 0;
  const tier = lead?.tier ?? 'Raw';
  const tierIdx = TIERS.indexOf(tier);
  const nextTier = tierIdx >= 0 && tierIdx < TIERS.length - 1 ? TIERS[tierIdx + 1]! : null;
  return { pct: Math.round(sharpness), tier, nextTier, logsToNext: logsToNextTier(sharpness) };
}

interface HoneycombStripProps {
  cells: HoneycombCell[];
  logs: number;
  onPress: () => void;
}

export function HoneycombStrip({ cells, logs, onPress }: HoneycombStripProps) {
  const t = useTheme();
  const { pct, tier, nextTier, logsToNext } = aggregate(cells);

  // Quieter than the FocusCard: a HUD, not the hero. Thin hairline, card radius.
  const card: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[3],
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.thin,
    borderColor: t.colors.hairline,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    padding: t.space[3],
  };
  const headingRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2] };
  const heading: TextStyle = { ...(type.heading as unknown as TextStyle), color: t.colors.ink };
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
  const nextLine: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.ink,
    fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
  };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Your honeycomb — ${pct}% honey, tier ${tier}, ${logs} logs`}
      style={card}
    >
      {cells.length > 0 ? <Honeycomb size="strip" cells={cells} /> : null}
      <View style={{ flex: 1, gap: t.space[0.5] }}>
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
            {logsToNext} logs to {nextTier} <Text style={{ color: t.colors.amberText }}>→</Text>
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
