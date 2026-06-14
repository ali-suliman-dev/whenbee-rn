import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/src/components/Card';
import { HonestNumber } from '@/src/components/HonestNumber';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

// ──────────────────────────────────────────────────────────────────────────────
// HonestCard — the hero of the category screen: the one number that matters,
// with its ripeness + learning progress folded in so the top is a single, clear
// focal block (most-important-first).
//
//   [Raw]  1 log · 10 to Setting          (tier badge + progress, amber = honey)
//   🔍 Your honest number
//   ~28 min   runs 2.0×                   (huge indigo + quiet multiplier)
//   based on typical patterns · learned on-device
// ──────────────────────────────────────────────────────────────────────────────

interface HonestCardProps {
  categoryName: string;
  honestMinutes: number;
  multiplier: number;
  provenance: string;
  /** Ripeness tier (e.g. "Raw"). When present, renders the tier+progress header. */
  tier?: string;
  n?: number;
  logsToNext?: number;
  nextTier?: string | null;
}

export function HonestCard({
  categoryName,
  honestMinutes,
  multiplier,
  provenance,
  tier,
  n,
  logsToNext,
  nextTier,
}: HonestCardProps) {
  const t = useTheme();

  const tierRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2] };
  const pill: ViewStyle = {
    backgroundColor: t.colors.accentSoft,
    borderRadius: t.radii.full,
    paddingHorizontal: t.space[3],
    paddingVertical: t.space[0.5],
  };
  const pillText: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.amberText,
    fontFamily: 'Jakarta-Bold',
  };
  const tierMeta: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft, flex: 1 };

  const eyebrowRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2] };
  const eyebrow: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.primary };
  const numberRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: t.space[3],
    flexWrap: 'wrap',
  };
  const multNote: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: t.colors.inkSoft,
    paddingBottom: 4,
  };
  const provenanceText: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkSoft,
  };

  return (
    <Card tone="focal" style={{ gap: t.space[3] }}>
      {tier ? (
        <View style={tierRow}>
          <View style={pill}>
            <Text style={pillText}>{tier}</Text>
          </View>
          <Text style={tierMeta}>
            {n} {n === 1 ? 'log' : 'logs'}
            {nextTier ? ` · ${logsToNext} to ${nextTier}` : ''}
          </Text>
        </View>
      ) : null}

      <View style={eyebrowRow}>
        <Ionicons name="search-outline" size={16} color={t.colors.primary} />
        <Text style={eyebrow}>YOUR HONEST NUMBER FOR {categoryName.toUpperCase()}</Text>
      </View>

      <View style={numberRow}>
        <HonestNumber size="xl" tone="indigo" value={`~${honestMinutes}`} unit="min" />
        <Text style={multNote}>runs {multiplier.toFixed(1)}×</Text>
      </View>

      <Text style={provenanceText}>{provenance} · learned on-device</Text>
    </Card>
  );
}
