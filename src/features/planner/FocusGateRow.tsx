import { View, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { AppText } from '@/src/components/AppText';

// ──────────────────────────────────────────────────────────────────────────────
// FocusGateRow — one rung of the focus-unlock ladder. Presentational, tokens only.
//
//   done      success-tinted marker + ✓ glyph, value in success, muted sub. No pips.
//   active    indigo marker (soft fill + ring + centre dot), value as have/need
//             (num ink, den faint), a pip row, and the amber "N to go" sub.
//   upcoming  sunken marker, muted label + value + sub, no pips.
//
// Rows are separated by a 1px hairline top border (all but the first).
// ──────────────────────────────────────────────────────────────────────────────

export type FocusGateState = 'done' | 'active' | 'upcoming';

export interface FocusGateRowProps {
  state: FocusGateState;
  label: string;
  valueText: string;
  sub: string;
  /** Progress dots for the active row (filled indigo, rest sunken). */
  pips?: { filled: number; total: number };
  /** The first row omits its top divider so the ladder reads as one block. */
  first?: boolean;
}

export function FocusGateRow({ state, label, valueText, sub, pips, first = false }: FocusGateRowProps) {
  const t = useTheme();
  const { marker, markerIcon, ring, dot } = t.focusLadder;

  const done = state === 'done';
  const active = state === 'active';

  const row: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.space[3],
    paddingVertical: t.space[3],
    ...(first ? null : { borderTopWidth: t.borderWidth.share, borderTopColor: t.colors.hairline }),
  };

  const markerBase: ViewStyle = {
    width: marker,
    height: marker,
    borderRadius: t.radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const markerStyle: ViewStyle = done
    ? { ...markerBase, backgroundColor: t.colors.successSoft }
    : active
      ? { ...markerBase, backgroundColor: t.colors.primarySoft, borderWidth: ring, borderColor: t.colors.primary }
      : { ...markerBase, backgroundColor: t.colors.surfaceSunken };

  const content: ViewStyle = { flex: 1, gap: t.space[1.5] };
  const headRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.space[2],
  };

  const labelStyle: TextStyle = {
    ...(type.bodySmBold as unknown as TextStyle),
    color: active || done ? t.colors.ink : t.colors.inkFaint,
  };
  const subStyle: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: active ? t.colors.amberText : t.colors.inkFaint,
  };

  // Active value two-tones the fraction: numerator ink, "/need" faint.
  const slash = valueText.indexOf('/');
  const numText = slash >= 0 ? valueText.slice(0, slash) : valueText;
  const denText = slash >= 0 ? valueText.slice(slash) : '';

  const valueNode = done ? (
    <AppText style={{ ...(type.bodySmBold as unknown as TextStyle), color: t.colors.success }}>{valueText}</AppText>
  ) : active ? (
    <AppText>
      <AppText style={{ ...(type.numCaption as unknown as TextStyle), color: t.colors.ink }}>{numText}</AppText>
      {denText ? (
        <AppText style={{ ...(type.numCaption as unknown as TextStyle), color: t.colors.inkFaint }}>{denText}</AppText>
      ) : null}
    </AppText>
  ) : (
    <AppText style={{ ...(type.numCaption as unknown as TextStyle), color: t.colors.inkFaint }}>{valueText}</AppText>
  );

  const pipDot = (filled: boolean): ViewStyle => ({
    width: dot,
    height: dot,
    borderRadius: t.radii.full,
    backgroundColor: filled ? t.colors.primary : t.colors.surfaceSunken,
  });

  return (
    <View style={row}>
      <View style={markerStyle}>
        {done ? <Ionicons name="checkmark" size={markerIcon} color={t.colors.success} /> : null}
        {active ? <View style={pipDot(true)} /> : null}
      </View>
      <View style={content}>
        <View style={headRow}>
          <AppText style={labelStyle}>{label}</AppText>
          {valueNode}
        </View>
        {active && pips ? (
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space[1] }}
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
          >
            {Array.from({ length: pips.total }, (_, i) => (
              <View key={i} style={pipDot(i < pips.filled)} />
            ))}
          </View>
        ) : null}
        <AppText style={subStyle}>{sub}</AppText>
      </View>
    </View>
  );
}
