import { View } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';

/**
 * Three hairline pills, filled indigo up to and including the current step.
 * Forward-only progress indicator for the onboarding flow (no carousel race).
 */
export function StepProgress({ current, total = 3 }: { current: number; total?: number }) {
  const t = useTheme();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${current + 1} of ${total}`}
      style={{ flexDirection: 'row', gap: t.space[1], paddingVertical: t.space[3] }}
    >
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 4,
            borderRadius: t.radii.full,
            backgroundColor: i <= current ? t.colors.primary : t.colors.hairline,
          }}
        />
      ))}
    </View>
  );
}
