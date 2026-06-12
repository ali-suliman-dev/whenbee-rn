import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/src/components/Card';
import { HonestNumber } from '@/src/components/HonestNumber';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

// ──────────────────────────────────────────────────────────────────────────────
// HonestCard — the honest number for a 15-min guess in this category.
//
//   🔍 Your honest number for {category}
//   ~28 min          (huge indigo, round_to_5(15 × M))
//   runs 2.0×        (the multiplier, quiet)
//   {provenance}     ("based on your last N times" / "based on typical patterns")
// ──────────────────────────────────────────────────────────────────────────────

interface HonestCardProps {
  categoryName: string;
  honestMinutes: number;
  multiplier: number;
  provenance: string;
}

export function HonestCard({ categoryName, honestMinutes, multiplier, provenance }: HonestCardProps) {
  const t = useTheme();

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
    <Card style={{ gap: t.space[3] }}>
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
