import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Screen } from '@/src/components/Screen';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { OnboardingBackdrop } from '@/src/components/OnboardingBackdrop';
import { OverflowBar } from '@/src/components/OverflowBar';
import { OnboardingFooterCard } from '@/src/components/OnboardingFooterCard';
import { LockGlyph } from '@/src/components/LockGlyph';
import { useTheme } from '@/src/theme/useTheme';
import { StepProgress } from '@/src/features/onboarding/StepProgress';
import { BrandLockup } from '@/src/features/onboarding/BrandLockup';

export default function Welcome() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Screen backdrop={<OnboardingBackdrop />}>
      <StepProgress current={0} />
      <View style={{ flex: 1, gap: t.space[4], paddingTop: t.space[3] }}>
        <BrandLockup />
        <AppText
          style={{
            fontSize: t.fontSize['2xl'],
            lineHeight: t.fontSize['2xl'] * 1.1,
            fontWeight: t.fontWeight.bold as '700',
            color: t.colors.ink,
            letterSpacing: -0.75,
          }}
        >
          You&apos;re not lazy. You&apos;re a{' '}
          <AppText
            style={{
              fontSize: t.fontSize['2xl'],
              lineHeight: t.fontSize['2xl'] * 1.1,
              fontWeight: t.fontWeight.bold as '700',
              color: t.colors.primary,
              letterSpacing: -0.75,
            }}
          >
            time optimist.
          </AppText>
        </AppText>
        <AppText
          variant="body"
          style={{ color: t.colors.inkSoft, lineHeight: t.fontSize.base * 1.5 }}
        >
          I learn how long things really take you, then show you the honest number — before you plan around a guess.
        </AppText>

        <View style={{ flex: 1 }} />

        <AppText variant="label" style={{ color: t.colors.inkSoft }}>
          How long it really takes
        </AppText>
        <OverflowBar guessMin={15} honestMin={24} />

        <OnboardingFooterCard glyph={<LockGlyph />}>
          No account, no email. Everything stays on this phone.
        </OnboardingFooterCard>
      </View>
      <AppButton
        label="Get started →"
        fullWidth
        onPress={() => router.push('/(onboarding)/categories')}
      />
      <View style={{ height: insets.bottom }} />
    </Screen>
  );
}
