import { View, Text, type TextStyle, type ViewStyle } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

// ──────────────────────────────────────────────────────────────────────────────
// HonestNumber — Flat Tactical UI
//
// Renders a numeric value in Inter tabular type. The unit suffix is always
// rendered smaller + muted beside the number (never same weight/size).
//
// Sizes:
//   inline  → type.multiplier   (22px Inter-Bold)
//   big     → type.bigNumber    (30px Inter-Bold)
//   lg      → type.honestNumberLg (36px Inter-Bold)
//   xl      → type.honestNumberXl (40px Inter-Bold)
//
// Tones:
//   ink       → t.colors.ink
//   indigo    → t.colors.primary
//   amber     → t.colors.accent     (bright fill amber; pairs with dark surfaces)
//   amberText → t.colors.amberText  (AA amber-on-light; use for text on light cards)
// ──────────────────────────────────────────────────────────────────────────────

type Size = 'inline' | 'big' | 'lg' | 'xl';
type Tone = 'ink' | 'indigo' | 'amber' | 'amberText';

const sizeScale: Record<
  Size,
  | typeof type.multiplier
  | typeof type.bigNumber
  | typeof type.honestNumberLg
  | typeof type.honestNumberXl
> = {
  inline: type.multiplier,
  big: type.bigNumber,
  lg: type.honestNumberLg,
  xl: type.honestNumberXl,
};

export function HonestNumber({
  value,
  unit,
  size = 'big',
  tone = 'ink',
  unitSize,
}: {
  value: string;
  unit?: string;
  /** Override the unit suffix size (defaults to ~0.6× the number). */
  unitSize?: number;
  size?: Size;
  tone?: Tone;
}) {
  const t = useTheme();

  const toneColor: Record<Tone, string> = {
    ink: t.colors.ink,
    indigo: t.colors.primary,
    amber: t.colors.accent,
    amberText: t.colors.amberText,
  };

  const scale = sizeScale[size];

  const row: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[1],
  };

  // Cast needed: `fontVariant` in our const type is readonly tuple, but TextStyle expects mutable
  const numStyle: TextStyle = {
    ...(scale as unknown as TextStyle),
    color: toneColor[tone],
  };

  // Unit is ~0.6em relative to the number's fontSize, muted — unless the caller
  // pins an explicit size (e.g. a quieter, fixed "min" beside a smaller hero).
  const unitFontSize = unitSize ?? Math.round(scale.fontSize * 0.6);
  const unitStyle: TextStyle = {
    fontSize: unitFontSize,
    lineHeight: unitFontSize * 1.3,
    fontFamily: 'Inter-Medium' as TextStyle['fontFamily'],
    color: t.colors.inkSoft,
    // Align visually to cap-height, not raw baseline
    alignSelf: 'flex-end',
    paddingBottom: t.space[0.5],
  };

  return (
    <View style={row} accessibilityLabel={unit ? `${value} ${unit}` : value}>
      <Text style={numStyle}>{value}</Text>
      {unit ? <Text style={unitStyle}>{unit}</Text> : null}
    </View>
  );
}
