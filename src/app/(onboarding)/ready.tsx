import { useState } from 'react';
import { View, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
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
import { usePersonalize } from '@/src/features/onboarding/usePersonalize';
import { StepProgress } from '@/src/features/onboarding/StepProgress';
import { onboardingStepIndex, ONBOARDING_TOTAL } from '@/src/features/onboarding/onboardingFlow';
import { Reveal } from '@/src/features/onboarding/Reveal';
import { MAX_CUSTOM_NAME } from '@/src/features/onboarding/categories';
import type { TFunction } from 'i18next';

// Raw (now) → Honest (goal) look-ahead. Not a setup wall — a goal preview.
function masteryTrail(tr: TFunction<'onboarding'>) {
  return [
    { label: tr('ready.trail.raw'), state: 'now' as const },
    { label: tr('ready.trail.setting'), state: 'ahead' as const },
    { label: tr('ready.trail.ripening'), state: 'ahead' as const },
    { label: tr('ready.trail.thickening'), state: 'ahead' as const },
    { label: tr('ready.trail.honest'), state: 'ahead' as const },
  ];
}

export default function Ready() {
  const t = useTheme();
  const { t: tr } = useTranslation('onboarding');
  const insets = useSafeAreaInsets();
  const { complete } = useOnboarding();
  const { saveName } = usePersonalize();
  const [nickname, setNickname] = useState('');

  function timeFirstThing() {
    saveName(nickname.trim() || undefined);
    complete();
    router.replace('/(tabs)');
  }

  return (
    <Screen backdrop={<OnboardingBackdrop />}>
      <StepProgress current={onboardingStepIndex('ready')} total={ONBOARDING_TOTAL} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
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
              {tr('ready.title')}
            </AppText>
          </Reveal>
          <Reveal index={1}>
            <AppText
              variant="body"
              style={{ color: t.colors.inkSoft, lineHeight: t.fontSize.base * 1.5 }}
            >
              {tr('ready.subtitle')}
            </AppText>
          </Reveal>

          {/* Mastery preview — Raw (now) → Honest (where you're headed). A look-ahead. */}
          <Reveal index={2}>
            <Card>
              <AppText
                variant="label"
                style={{ marginBottom: t.space[3], color: t.colors.inkSoft }}
              >
                {tr('ready.trailLabel')}
              </AppText>
              <HoneyTrail nodes={masteryTrail(tr)} lively />
              {/* Trail legend: accuracy is monotonic, no guilt/streak. */}
              <AppText
                style={{
                  fontSize: t.fontSize.sm,
                  color: t.colors.inkFaint,
                  marginTop: t.space[3],
                }}
              >
                {tr('ready.trailCaption')}
              </AppText>
            </Card>
          </Reveal>

          <View style={{ flex: 1 }} />

          <Reveal index={3}>
            <OnboardingFooterCard
              glyph={<ReasonGlyph kind="pulled" active={false} ambient size={t.iconSize.lg} />}
            >
              {tr('ready.footer')}
            </OnboardingFooterCard>
          </Reveal>

          {/* Optional nickname — quiet, skippable, folded in above the CTA. */}
          <Reveal index={4}>
            <View style={{ gap: t.space[2] }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: t.space[2] }}>
                <AppText
                  style={{
                    fontSize: t.fontSize.sm,
                    color: t.colors.inkSoft,
                    fontWeight: t.fontWeight.medium as '500',
                  }}
                >
                  {tr('ready.nicknameLabel')}
                </AppText>
                <AppText
                  style={{ fontSize: t.fontSize.xs, color: t.colors.inkFaint }}
                >
                  {tr('ready.nicknameOptional')}
                </AppText>
              </View>
              <TextInput
                value={nickname}
                onChangeText={setNickname}
                onSubmitEditing={() => {/* save happens on CTA */}}
                placeholder={tr('ready.nicknamePlaceholder')}
                placeholderTextColor={t.colors.inkFaint}
                maxLength={MAX_CUSTOM_NAME}
                returnKeyType="done"
                accessibilityLabel={tr('ready.nicknameAccessibilityLabel')}
                style={{
                  height: t.size.control.md,
                  fontSize: t.fontSize.base,
                  color: t.colors.ink,
                  borderWidth: t.borderWidth.chip,
                  borderColor: t.colors.border,
                  borderRadius: t.radii.sm,
                  paddingHorizontal: t.space[3],
                }}
              />
            </View>
          </Reveal>
        </View>

        <Reveal index={5} style={{ paddingTop: t.space[4] }}>
          <AppButton label={tr('ready.cta')} fullWidth onPress={timeFirstThing} />
        </Reveal>
        <View style={{ height: insets.bottom }} />
      </KeyboardAvoidingView>
    </Screen>
  );
}
