import { Pressable, Text, type ViewStyle, type TextStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/src/theme/useTheme';
type Variant = 'primary' | 'secondary' | 'ghost';
export function AppButton({ label, onPress, variant = 'primary', disabled = false }: {
  label: string; onPress: () => void; variant?: Variant; disabled?: boolean;
}) {
  const t = useTheme();
  const bg: Record<Variant, string | undefined> = { primary: t.colors.primary, secondary: t.colors.surface, ghost: 'transparent' };
  const fg: Record<Variant, string> = { primary: t.colors.primaryText, secondary: t.colors.text, ghost: t.colors.primary };
  const container: ViewStyle = {
    height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: t.radii.lg,
    paddingHorizontal: t.space[5], backgroundColor: bg[variant], opacity: disabled ? 0.4 : 1,
    borderWidth: variant === 'secondary' ? 1 : 0, borderColor: t.colors.border,
  };
  return (
    <Pressable accessibilityRole="button" disabled={disabled}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onPress(); }}
      style={({ pressed }) => [container, pressed ? { opacity: 0.8 } : null]}>
      <Text style={{ fontSize: t.fontSize.md, fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'], color: fg[variant] }}>{label}</Text>
    </Pressable>
  );
}
