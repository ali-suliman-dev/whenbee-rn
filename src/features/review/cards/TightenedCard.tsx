import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Card } from '@/src/components/Card';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import type { TightenedRow } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// TightenedCard — the categories whose guesses moved toward reality this period.
// Direction only, never a score: an amber down-chip means "closer to honest", which
// is the good direction. No red, ever — looser is data, tighter is quiet progress.
// Renders nothing when no category earned it.
// ──────────────────────────────────────────────────────────────────────────────

export function TightenedCard({ rows }: { rows: TightenedRow[] }) {
  const t = useTheme();
  const { t: tt } = useTranslation('review');
  if (rows.length === 0) return null;

  const eyebrow: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.amberText };
  const name: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink, flex: 1 };
  const detail: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft };
  const chipText: TextStyle = { ...(type.captionBold as unknown as TextStyle), color: t.colors.amberText };

  const eyebrowRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2] };
  const row: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[3] };
  const chip: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[1],
    backgroundColor: t.colors.accentSoft,
    paddingHorizontal: t.space[2],
    paddingVertical: t.space[1],
    borderRadius: t.radii.full,
  };

  return (
    <Card tone="flat" style={{ gap: t.space[3] }}>
      <View style={eyebrowRow}>
        <Ionicons name="trending-down" size={t.iconSize.sm} color={t.colors.accent} />
        <Text style={eyebrow}>{tt('tightened.eyebrow')}</Text>
      </View>
      <View style={{ gap: t.space[3] }}>
        {rows.map((r) => (
          <View key={r.categoryId} style={{ gap: t.space[1] }}>
            <View style={row}>
              <Text style={name}>{r.categoryName}</Text>
              <View style={chip}>
                <Ionicons name="arrow-down" size={t.iconSize.xs} color={t.colors.accent} />
                <Text style={chipText}>{tt('tightened.closerChip')}</Text>
              </View>
            </View>
            <Text style={detail}>
              {tt('tightened.detail', {
                early: r.earlyMultiplier.toFixed(1),
                recent: r.recentMultiplier.toFixed(1),
              })}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}
