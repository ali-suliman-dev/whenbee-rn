import { View, type ViewProps } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
export function Card({ style, ...rest }: ViewProps) {
  const t = useTheme();
  return <View style={[{ borderRadius: t.radii.lg, borderWidth: 1, borderColor: t.colors.border, backgroundColor: t.colors.surface, padding: t.space[4] }, style]} {...rest} />;
}
