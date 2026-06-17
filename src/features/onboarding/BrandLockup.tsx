import { View } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from '@/src/components/AppText';
import { BeeMascot } from '@/src/components/BeeMascot';

/**
 * Logo lockup: the brand bee + "Whenbee" wordmark.
 */
export function BrandLockup() {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[2] }}>
      <BeeMascot size={t.space[10]} />
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
