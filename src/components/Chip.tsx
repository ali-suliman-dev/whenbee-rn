import { Pressable, View, type TextStyle, type ViewStyle } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from './AppText';
import type { ReactNode } from 'react';

// ──────────────────────────────────────────────────────────────────────────────
// Chip — Flat Tactical UI
//
// Variants
//   default  — resting state (surface bg, hairline border)
//   selected — active state (primaryTint bg, primary 1.5px border, ink text)
//   add      — dashed "+ New" affordance
// ──────────────────────────────────────────────────────────────────────────────

export function Chip({
  label,
  icon,
  selected = false,
  variant = 'default',
  onPress,
}: {
  label: string;
  icon?: ReactNode;
  selected?: boolean;
  variant?: 'default' | 'add';
  onPress: () => void;
}) {
  const t = useTheme();

  const isAdd = variant === 'add';

  const container: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[1],
    borderRadius: t.radii.pill,
    borderCurve: 'continuous',
    paddingHorizontal: t.space[4],
    paddingVertical: t.space[2],
    ...(isAdd
      ? {
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: t.colors.hairline,
          borderStyle: 'dashed' as ViewStyle['borderStyle'],
        }
      : selected
        ? {
            backgroundColor: t.colors.primaryTint,
            borderWidth: 1.5,
            borderColor: t.colors.primary,
          }
        : {
            backgroundColor: t.colors.surface,
            borderWidth: 1,
            borderColor: t.colors.hairline,
          }),
  };

  const labelStyle: TextStyle = {
    fontWeight: t.fontWeight.medium as TextStyle['fontWeight'],
    color: selected && !isAdd ? t.colors.ink : t.colors.ink,
    fontSize: t.fontSize.sm,
  };

  // NativeWind's interop + React Compiler drop styles applied directly to a
  // Pressable, so the visual lives on an inner View (matching PromiseChip / Card /
  // AppButton). Pressable stays a bare touch wrapper.
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      hitSlop={6}
    >
      <View style={container}>
        {icon ? <View>{icon}</View> : null}
        <AppText style={labelStyle}>{label}</AppText>
      </View>
    </Pressable>
  );
}
