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
//   xl      → type.honestNumberXl (40px Inter-Bold)
//
// Tones:
//   ink     → t.colors.ink
//   indigo  → t.colors.primary
//   amber   → t.colors.accent
// ──────────────────────────────────────────────────────────────────────────────

type Size = 'inline' | 'big' | 'xl';
type Tone = 'ink' | 'indigo' | 'amber';

const sizeScale: Record<Size, typeof type.multiplier | typeof type.bigNumber | typeof type.honestNumberXl> = {
  inline: type.multiplier,
  big: type.bigNumber,
  xl: type.honestNumberXl,
};

export function HonestNumber({
  value,
  unit,
  size = 'big',
  tone = 'ink',
}: {
  value: string;
  unit?: string;
  size?: Size;
  tone?: Tone;
}) {
  const t = useTheme();

  const toneColor: Record<Tone, string> = {
    ink: t.colors.ink,
    indigo: t.colors.primary,
    amber: t.colors.accent,
  };

  const scale = sizeScale[size];

  const row: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  };

  // Cast needed: `fontVariant` in our const type is readonly tuple, but TextStyle expects mutable
  const numStyle: TextStyle = {
    ...(scale as unknown as TextStyle),
    color: toneColor[tone],
  };

  // Unit is ~0.6em relative to the number's fontSize, muted
  const unitFontSize = Math.round(scale.fontSize * 0.6);
  const unitStyle: TextStyle = {
    fontSize: unitFontSize,
    lineHeight: unitFontSize * 1.3,
    fontFamily: 'Inter-Medium' as TextStyle['fontFamily'],
    color: t.colors.inkSoft,
    // Align visually to cap-height, not raw baseline
    alignSelf: 'flex-end',
    paddingBottom: 2,
  };

  return (
    <View style={row} accessibilityLabel={unit ? `${value} ${unit}` : value}>
      <Text style={numStyle}>{value}</Text>
      {unit ? <Text style={unitStyle}>{unit}</Text> : null}
    </View>
  );
}
