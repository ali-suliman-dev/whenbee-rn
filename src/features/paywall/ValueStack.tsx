import { useMemo } from 'react';
import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { getStackRows, type StackKey } from './paywallCopy';

// ──────────────────────────────────────────────────────────────────────────────
// ValueStack — the fixed five-row bundle that represents all of Pro. The row whose
// key === `lead` (the gate the user tapped) floats to the top; the rest keep their
// default order. Scannable icon rows, not a feature dump and not a carousel.
// t.space[9] is absent from the scale; t.space[8] (32pt) is the nearest token.
// ──────────────────────────────────────────────────────────────────────────────

const ICON: Record<StackKey, keyof typeof Ionicons.glyphMap> = {
  calendar: 'calendar-outline',
  coach: 'flag-outline',
  insight: 'stats-chart-outline',
  review: 'document-text-outline',
  presence: 'notifications-outline',
};

export function ValueStack({ lead }: { lead: StackKey }) {
  const t = useTheme();
  const { t: tr } = useTranslation('paywall');

  const rows = useMemo(() => {
    const stackRows = getStackRows(tr);
    const leadRow = stackRows.filter((r) => r.key === lead);
    const rest = stackRows.filter((r) => r.key !== lead);
    return [...leadRow, ...rest];
  }, [lead, tr]);

  const tile: ViewStyle = {
    width: t.space[8],
    height: t.space[8],
    borderRadius: t.radii.md,
    borderCurve: 'continuous',
    backgroundColor: t.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const row: ViewStyle = { flexDirection: 'row', gap: t.space[3], alignItems: 'flex-start' };
  const titleStyle: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.ink, fontFamily: 'Jakarta-Bold' };
  const descStyle: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };

  return (
    <View style={{ gap: t.space[4] }}>
      {rows.map((r) => (
        <View key={r.key} style={row}>
          <View style={tile}>
            <Ionicons name={ICON[r.key]} size={t.iconSize.sm} color={t.colors.primary} />
          </View>
          <View style={{ flex: 1, gap: t.space[0.5] }}>
            <Text style={titleStyle}>{r.title}</Text>
            <Text style={descStyle}>{r.desc}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}
