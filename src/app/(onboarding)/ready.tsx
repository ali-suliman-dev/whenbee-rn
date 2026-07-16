import { useState } from 'react';
import { View, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
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
import { usePersonalize } from '@/src/features/onboarding/usePersonalize';
import { StepProgress } from '@/src/features/onboarding/StepProgress';
import { onboardingStepIndex, ONBOARDING_TOTAL } from '@/src/features/onboarding/onboardingFlow';
import { Reveal } from '@/src/features/onboarding/Reveal';
import { MAX_CUSTOM_NAME } from '@/src/features/onboarding/categories';
import { useOnce } from '@/src/lib/useOnce';

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
  const { saveName } = usePersonalize();
  const [nickname, setNickname] = useState('');

  const timeFirstThing = useOnce(() => {
    saveName(nickname.trim() || undefined);
    complete();
    router.replace('/(tabs)');
  });

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
              {/* Trail legend: accuracy is monotonic, no guilt/streak. */}
              <AppText
                style={{
                  fontSize: t.fontSize.sm,
                  color: t.colors.inkFaint,
                  marginTop: t.space[3],
                }}
              >
                Your accuracy ripens as you log. It only ever ripens — no streak to break.
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
                  Anything I should call you?
                </AppText>
                <AppText
                  style={{ fontSize: t.fontSize.xs, color: t.colors.inkFaint }}
                >
                  optional
                </AppText>
              </View>
              <TextInput
                value={nickname}
                onChangeText={setNickname}
                onSubmitEditing={() => {/* save happens on CTA */}}
                placeholder="Your nickname"
                placeholderTextColor={t.colors.inkFaint}
                maxLength={MAX_CUSTOM_NAME}
                returnKeyType="done"
                accessibilityLabel="Your nickname"
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
          <AppButton label="Time my first thing →" fullWidth onPress={timeFirstThing} />
        </Reveal>
        <View style={{ height: insets.bottom }} />
      </KeyboardAvoidingView>
    </Screen>
  );
}
