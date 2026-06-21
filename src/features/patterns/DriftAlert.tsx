import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import type { DriftAlertCard } from './usePatterns';

// ──────────────────────────────────────────────────────────────────────────────
// DriftNote (S9) — "what changed". A quiet amber margin-note (no card chrome), a
// diamond marker, one neutral sentence. Reports a shift in pace, never a verdict:
// the honest numbers already follow along, so there is nothing to fix.
// ──────────────────────────────────────────────────────────────────────────────

export function DriftNote({ card }: { card: DriftAlertCard }) {
  const t = useTheme();
  const { categoryName, earlyMultiplier, recentMultiplier, slowerLately } = card;

  const wrap: ViewStyle = {
    flexDirection: 'row',
    gap: t.space[3],
    backgroundColor: t.colors.accentSoft,
    borderRadius: t.radii.md,
    borderCurve: 'continuous',
    padding: t.space[4],
  };
  const marker: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.accent };
  const body: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.ink, flex: 1 };
  const name: TextStyle = { ...(type.bodySmBold as unknown as TextStyle), color: t.colors.amberText };

  const lead = slowerLately ? 'is taking longer lately' : 'is moving quicker lately';
  return (
    <View style={wrap}>
      <Text style={marker}>◆</Text>
      <Text style={body}>
        <Text style={name}>{categoryName}</Text> {lead} — it used to run {earlyMultiplier.toFixed(1)}×, now nearer{' '}
        {recentMultiplier.toFixed(1)}×. Your honest numbers already follow along.
      </Text>
    </View>
  );
}

