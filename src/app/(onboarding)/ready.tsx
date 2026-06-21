import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Screen } from '@/src/components/Screen';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { Card } from '@/src/components/Card';
import { HoneyTrail } from '@/src/components/HoneyTrail';
import { OnboardingBackdrop } from '@/src/components/OnboardingBackdrop';
import { OnboardingFooterCard } from '@/src/components/OnboardingFooterCard';
import { ReasonGlyph } from '@/src/features/reward/ReasonGlyph';
import { useTheme } from '@/src/theme/useTheme';
import { useOnboarding } from '@/src/features/onboarding/useOnboarding';
import { StepProgress } from '@/src/features/onboarding/StepProgress';
import { Reveal } from '@/src/features/onboarding/Reveal';

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
    <Screen backdrop={<OnboardingBackdrop />}>
      <StepProgress current={3} total={4} />
      <View style={{ flex: 1, gap: t.space[4], paddingTop: t.space[3] }}>
        <Reveal index={0}>
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
        </Reveal>
        <Reveal index={1}>
          <AppText
            variant="body"
            style={{ color: t.colors.inkSoft, lineHeight: t.fontSize.base * 1.5 }}
          >
            From your first guess, I&apos;ll show honest times. Each task you log
            makes them sharper, and I&apos;ll never scold you for a gap.
          </AppText>
        </Reveal>

        {/* Mastery preview — Raw (now) → Honest (where you're headed). A look-ahead. */}
        <Reveal index={2}>
          <Card>
            <AppText
              variant="label"
              style={{ marginBottom: t.space[3], color: t.colors.inkSoft }}
            >
              Where you&apos;re headed
            </AppText>
            <HoneyTrail nodes={MASTERY_TRAIL} lively />
            <AppText
              variant="caption"
              style={{ marginTop: t.space[3], color: t.colors.inkSoft }}
            >
              It only ever ripens. There&apos;s no streak to break.
            </AppText>
          </Card>
        </Reveal>

        <View style={{ flex: 1 }} />

        <Reveal index={3}>
          <OnboardingFooterCard
            glyph={<ReasonGlyph kind="pulled" active={false} ambient size={t.iconSize.lg} />}
          >
            Empty days are fine. Forgot to time something? Add it in one tap.
          </OnboardingFooterCard>
        </Reveal>
      </View>

      <Reveal index={4} style={{ paddingTop: t.space[4] }}>
        <AppButton label="Open my day →" fullWidth onPress={openMyDay} />
      </Reveal>
      <View style={{ height: insets.bottom }} />
    </Screen>
  );
}
