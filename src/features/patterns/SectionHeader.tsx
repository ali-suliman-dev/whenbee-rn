import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

// Group label for the redesigned Patterns sections: an indigo-muted eyebrow with a
// hairline rule trailing to the card edge. Replaces the per-card eyebrow rhythm
// with a sectioned one (identity → progress → what changed → numbers → Pro).
export function SectionHeader({ label }: { label: string }) {
  const t = useTheme();
  const row: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2.5] };
  const text: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.inkSoft };
  const line: ViewStyle = { flex: 1, height: t.borderWidth.share, backgroundColor: t.colors.hairline };
  return (
    <View style={row} accessibilityRole="header">
      <Text style={text}>{label}</Text>
      <View style={line} />
    </View>
  );
}
