import { Pressable, Text, type TextStyle } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
export function Chip({ label, selected = false, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={{ borderRadius: t.radii.pill, paddingHorizontal: t.space[4], paddingVertical: t.space[2], backgroundColor: selected ? t.colors.primary : t.colors.surface, borderWidth: selected ? 0 : 1, borderColor: t.colors.border }}>
      <Text style={{ color: selected ? t.colors.primaryText : t.colors.text, fontWeight: t.fontWeight.medium as TextStyle['fontWeight'] }}>{label}</Text>
    </Pressable>
  );
}
