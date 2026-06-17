import { View } from 'react-native';
import type { ReactNode } from 'react';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from './AppText';

export function OnboardingFooterCard({ glyph, children }: { glyph: ReactNode; children: ReactNode }) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space[3],
        backgroundColor: t.colors.surfaceRaised,
        borderRadius: t.radii.card,
        padding: t.space[3],
      }}
    >
      <View>{glyph}</View>
      <AppText variant="body" style={{ flex: 1, color: t.colors.ink }}>
        {children}
      </AppText>
    </View>
  );
}
