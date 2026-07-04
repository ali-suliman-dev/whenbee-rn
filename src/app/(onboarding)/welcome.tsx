import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/src/components/Screen';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { OnboardingBackdrop } from '@/src/components/OnboardingBackdrop';
import { OverflowBar } from '@/src/components/OverflowBar';
import { OnboardingFooterCard } from '@/src/components/OnboardingFooterCard';
import { LockGlyph } from '@/src/components/LockGlyph';
import { useTheme } from '@/src/theme/useTheme';
import { useOnboarding } from '@/src/features/onboarding/useOnboarding';
import { StepProgress } from '@/src/features/onboarding/StepProgress';
import { onboardingStepIndex, ONBOARDING_TOTAL } from '@/src/features/onboarding/onboardingFlow';
import { BrandLockup } from '@/src/features/onboarding/BrandLockup';
import { Reveal } from '@/src/features/onboarding/Reveal';

export default function Welcome() {
  const t = useTheme();
  const { t: tr } = useTranslation('onboarding');
  const insets = useSafeAreaInsets();
  const { trackWelcomeShown } = useOnboarding();
  // once-guard: fires exactly once per mount regardless of StrictMode double-invoke
  const firedRef = useRef(false);
  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    trackWelcomeShown();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Screen backdrop={<OnboardingBackdrop />}>
      <StepProgress current={onboardingStepIndex('welcome')} total={ONBOARDING_TOTAL} />
      <View style={{ flex: 1, gap: t.space[4], paddingTop: t.space[3] }}>
        <Reveal index={0}>
          <BrandLockup />
        </Reveal>
        <Reveal index={1}>
          <AppText
            style={{
              fontSize: t.fontSize['2xl'],
              lineHeight: t.fontSize['2xl'] * 1.1,
              fontWeight: t.fontWeight.bold as '700',
              color: t.colors.ink,
              letterSpacing: -0.75,
            }}
          >
            {tr('welcome.titlePrefix')}
            <AppText
              style={{
                fontSize: t.fontSize['2xl'],
                lineHeight: t.fontSize['2xl'] * 1.1,
                fontWeight: t.fontWeight.bold as '700',
                color: t.colors.primary,
                letterSpacing: -0.75,
              }}
            >
              {tr('welcome.titleEmphasis')}
            </AppText>
          </AppText>
        </Reveal>
        <Reveal index={2}>
          <AppText
            variant="body"
            style={{ color: t.colors.inkSoft, lineHeight: t.fontSize.base * 1.5 }}
          >
            {tr('welcome.subtitle')}
          </AppText>
        </Reveal>

        <Reveal index={3}>
          <AppText variant="label" style={{ color: t.colors.inkSoft }}>
            {tr('welcome.overflowLabel')}
          </AppText>
        </Reveal>
        <Reveal index={4}>
          <OverflowBar guessMin={15} honestMin={24} />
        </Reveal>

        <View style={{ flex: 1 }} />

        <Reveal index={5}>
          <OnboardingFooterCard glyph={<LockGlyph />}>
            {tr('welcome.footer')}
          </OnboardingFooterCard>
        </Reveal>
      </View>
      <Reveal index={6} style={{ paddingTop: t.space[4] }}>
        <AppButton
          label={tr('welcome.cta')}
          fullWidth
          onPress={() => router.push('/(onboarding)/quiz/0')}
        />
      </Reveal>
      <View style={{ height: insets.bottom }} />
    </Screen>
  );
}
