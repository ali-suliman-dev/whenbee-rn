import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Screen } from '@/src/components/Screen';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { Card } from '@/src/components/Card';
import { HoneyTrail } from '@/src/components/HoneyTrail';
import { useTheme } from '@/src/theme/useTheme';
import { useOnboarding } from '@/src/features/onboarding/useOnboarding';
import { StepProgress } from '@/src/features/onboarding/StepProgress';
import { PromiseChip } from '@/src/features/onboarding/PromiseChip';

// Raw (now) → Honest (goal) look-ahead. Not a setup wall — a goal preview.
const MASTERY_TRAIL = [
  { label: 'Raw', state: 'now' as const },
  { label: 'Setting', state: 'ahead' as const },
  { label: 'Ripening', state: 'ahead' as const },
  { label: 'Thickening', state: 'ahead' as const },
  { label: 'Honest', state: 'ahead' as const },
];

export default function Ready() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { complete } = useOnboarding();

  function openMyDay() {
    complete();
    router.replace('/(tabs)');
  }

  return (
    <Screen>
      <StepProgress current={2} />
      <View style={{ flex: 1, gap: t.space[4], paddingTop: t.space[3] }}>
        <AppText
          style={{
            fontSize: t.fontSize.xl,
            fontWeight: t.fontWeight.bold as '700',
            color: t.colors.ink,
            letterSpacing: -0.6,
          }}
        >
          One tap to start. One tap to ripen.
        </AppText>
        <AppText
          variant="body"
          style={{ color: t.colors.inkSoft, lineHeight: t.fontSize.base * 1.5 }}
        >
          From your first guess I&apos;ll suggest honest times. Every task you log
          thickens your honey — and I&apos;ll never scold you for a gap.
        </AppText>

        <PromiseChip glyph="check">
          Empty days are fine. Forgot to time something? One tap to add it later.
        </PromiseChip>

        {/* Mastery preview — Raw (now) → Honest (where you're headed). A look-ahead. */}
        <Card>
          <AppText
            variant="label"
            style={{ marginBottom: t.space[3], color: t.colors.inkSoft }}
          >
            Your honeycomb starts raw — here&apos;s where you&apos;re headed
          </AppText>
          <HoneyTrail nodes={MASTERY_TRAIL} />
          <AppText
            variant="caption"
            style={{ marginTop: t.space[3], color: t.colors.inkSoft }}
          >
            It only ever ripens. There&apos;s no streak to break.
          </AppText>
        </Card>
      </View>

      <AppButton label="Open my day →" fullWidth onPress={openMyDay} />
      <View style={{ height: insets.bottom }} />
    </Screen>
  );
}
