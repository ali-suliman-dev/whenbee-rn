import { Text, type TextProps, type TextStyle } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
type Variant = 'display' | 'title' | 'body' | 'label' | 'caption';
export function AppText({ variant = 'body', style, ...rest }: TextProps & { variant?: Variant }) {
  const t = useTheme();
  const v: Record<Variant, TextStyle> = {
    display: { fontSize: t.fontSize['3xl'], fontWeight: t.fontWeight.bold as TextStyle['fontWeight'], color: t.colors.text },
    title: { fontSize: t.fontSize.xl, fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'], color: t.colors.text },
    body: { fontSize: t.fontSize.base, color: t.colors.text },
    label: { fontSize: t.fontSize.sm, fontWeight: t.fontWeight.medium as TextStyle['fontWeight'], color: t.colors.textMuted },
    caption: { fontSize: t.fontSize.xs, color: t.colors.textMuted },
  };
  return <Text style={[v[variant], style]} {...rest} />;
}
