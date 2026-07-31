// src/features/today/StatColumn.tsx
import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

// ──────────────────────────────────────────────────────────────────────────────
// Stat column — value stacked over its label. Every column shares the exact
// same element shape / gap / zero per-column margins so the three baselines
// line up (the one-spacing-source-per-axis rule).
// ──────────────────────────────────────────────────────────────────────────────

export interface StatColumnProps {
  value: string;
  /** Optional unit suffix (e.g. "tasks"). Omitted for h/m values that carry
   * their own unit inside the string ("1h 40m"). */
  unit?: string;
  label: string;
  /** Small color-coded dot before the label — indigo = guessed, amber = honest.
   * Numbers stay ink/white; the dot is the only color that encodes which side. */
  dotColor?: string;
  /** Vertical hairline divider on the left edge — every column but the first. */
  divided?: boolean;
}

export function StatColumn({ value, unit, label, dotColor, divided = false }: StatColumnProps) {
  const t = useTheme();

  const col: ViewStyle = {
    flex: 1,
    alignItems: 'flex-start',
    gap: t.space[1],
    ...(divided
      ? { borderLeftWidth: t.borderWidth.chip, borderLeftColor: t.colors.hairline, paddingLeft: t.space[3] }
      : null),
  };
  const valueRow: ViewStyle = { flexDirection: 'row', alignItems: 'baseline' };
  const valueText: TextStyle = {
    fontFamily: 'Inter-Bold' as TextStyle['fontFamily'],
    fontSize: t.fontSize.lg,
    lineHeight: t.fontSize.lg * t.lineHeight.tight,
    color: t.colors.ink,
    fontVariant: ['tabular-nums'],
  };
  // Muted unit suffix at ~0.6em of the value — `sm` (12) against `lg` (20) is the
  // closest token ratio to that rule (0.6 exactly).
  const unitText: TextStyle = {
    fontFamily: 'Inter-SemiBold' as TextStyle['fontFamily'],
    fontSize: t.fontSize.sm,
    color: t.colors.inkSoft,
    marginLeft: t.space[1],
  };
  const labelRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[1.5] };
  const dot: ViewStyle = {
    width: t.space[1.5],
    height: t.space[1.5],
    borderRadius: t.radii.full,
    backgroundColor: dotColor,
  };
  const labelText: TextStyle = {
    ...(type.eyebrowSm as unknown as TextStyle),
    color: t.colors.inkFaint,
  };

  return (
    <View style={col}>
      <View style={valueRow}>
        <Text style={valueText}>{value}</Text>
        {unit ? <Text style={unitText}>{unit}</Text> : null}
      </View>
      <View style={labelRow}>
        {dotColor ? <View style={dot} /> : null}
        <Text style={labelText}>{label}</Text>
      </View>
    </View>
  );
}
