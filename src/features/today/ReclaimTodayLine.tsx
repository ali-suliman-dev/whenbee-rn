import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

// ──────────────────────────────────────────────────────────────────────────────
// ReclaimTodayLine — a small amber "honey" pill tallying the minutes Today handed
// back. Sits under the honeycomb strip. Amber carries the reclaim identity (the
// sparkles glyph reads as "found time"); nothing here ever scolds.
// HIDDEN entirely when the sum is 0 — no "+0m", no empty placeholder.
// ──────────────────────────────────────────────────────────────────────────────

export function ReclaimTodayLine({ minutes }: { minutes: number }) {
  const t = useTheme();

  // Nothing banked today → render nothing. The pill earns its place only with a
  // real number behind it.
  if (minutes <= 0) return null;

  const pill: ViewStyle = {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[1.5],
    backgroundColor: t.colors.accentSoft,
    borderRadius: t.radii.full,
    borderCurve: 'continuous',
    paddingVertical: t.space[1],
    paddingHorizontal: t.space[3],
  };
  const num: TextStyle = {
    fontFamily: 'Inter-Bold',
    fontSize: t.fontSize.bodySm,
    color: t.colors.amberText,
    fontVariant: ['tabular-nums'],
  };
  const label: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.amberText,
  };

  return (
    <View
      style={pill}
      accessibilityLabel={`${minutes} minutes reclaimed today`}
      accessibilityRole="text"
    >
      <Text style={num}>+{minutes}m</Text>
      <Text style={label}>reclaimed today</Text>
    </View>
  );
}
