import { View, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from '@/src/components/AppText';

/**
 * A soft reassurance pill used on the onboarding promise steps — a lock glyph
 * (privacy) or a check glyph (no-guilt). Flat indigoSoft surface, never alarming.
 */
export function PromiseChip({
  glyph = 'lock',
  children,
}: {
  glyph?: 'lock' | 'check';
  children: ReactNode;
}) {
  const t = useTheme();

  const container: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[2],
    backgroundColor: t.colors.primaryTint,
    borderRadius: t.radii.lg,
    paddingHorizontal: t.space[4],
    paddingVertical: t.space[3],
  };

  return (
    <View style={container} accessible accessibilityRole="text">
      <AppText style={{ fontSize: t.fontSize.md, color: t.colors.primaryEdge }}>
        {glyph === 'lock' ? '🔒' : '✓'}
      </AppText>
      <AppText
        style={{
          flex: 1,
          fontSize: t.fontSize.sm,
          fontWeight: t.fontWeight.medium as '500',
          color: t.colors.ink,
          lineHeight: t.fontSize.sm * 1.45,
        }}
      >
        {children}
      </AppText>
    </View>
  );
}
