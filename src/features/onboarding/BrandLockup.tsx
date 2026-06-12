import { View, type ViewStyle } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from '@/src/components/AppText';

/**
 * Logo tile + "Whenbee" wordmark. A flat indigo rounded tile with an amber
 * honey-drop glyph (identity amber is exempt from the chrome-scarcity rule).
 */
export function BrandLockup() {
  const t = useTheme();

  const tile: ViewStyle = {
    width: 40,
    height: 40,
    borderRadius: t.radii.md,
    backgroundColor: t.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[2] }}>
      <View style={tile} accessibilityRole="image" accessibilityLabel="Whenbee logo">
        <AppText style={{ fontSize: t.fontSize.lg, color: t.colors.accent }}>🍯</AppText>
      </View>
      <AppText
        style={{
          fontSize: t.fontSize.lg,
          fontWeight: t.fontWeight.bold as '700',
          color: t.colors.ink,
          letterSpacing: -0.3,
        }}
      >
        Whenbee
      </AppText>
    </View>
  );
}
