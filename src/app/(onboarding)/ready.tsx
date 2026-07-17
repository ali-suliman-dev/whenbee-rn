import { useState } from 'react';
import { View, TextInput, KeyboardAvoidingView, Platform, Pressable, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Screen } from '@/src/components/Screen';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { OnboardingBackdrop } from '@/src/components/OnboardingBackdrop';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { useOnboarding } from '@/src/features/onboarding/useOnboarding';
import { usePersonalize, archetypeTitleFor } from '@/src/features/onboarding/usePersonalize';
import { ArchetypeCrest } from '@/src/features/onboarding/ArchetypeCrest';
import { RipeningRail } from '@/src/features/onboarding/RipeningRail';
import { StepProgress } from '@/src/features/onboarding/StepProgress';
import { onboardingStepIndex, ONBOARDING_TOTAL } from '@/src/features/onboarding/onboardingFlow';
import { Reveal } from '@/src/features/onboarding/Reveal';
import { MAX_CUSTOM_NAME } from '@/src/features/onboarding/categories';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useOnce } from '@/src/lib/useOnce';

export default function Ready() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { complete } = useOnboarding();
  const { saveName } = usePersonalize();
  const archetypeSeed = useSettingsStore((s) => s.archetypeSeed);
  const [nickname, setNickname] = useState('');
  const [expanded, setExpanded] = useState(false);

  const timeFirstThing = useOnce(() => {
    saveName(nickname.trim() || undefined);
    complete();
    // Anchor (tabs) beneath first: (modals) live on the root stack, so pushing
    // the sheet without the anchor traps the user in the drawer on dismiss.
    router.replace('/(tabs)');
    router.push('/(modals)/add-task');
  });

  const archetypeTitle = archetypeSeed ? archetypeTitleFor(archetypeSeed.m0) : undefined;

  return (
    <Screen backdrop={<OnboardingBackdrop />}>
      <StepProgress current={onboardingStepIndex('ready')} total={ONBOARDING_TOTAL} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ flex: 1, paddingTop: t.space[3] }}>
          <Reveal index={0}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[3] }}>
              <ArchetypeCrest beeSize={t.iconSize.xl} />
              <View>
                <AppText style={{ fontSize: t.fontSize.xs, color: t.colors.inkFaint }}>
                  {archetypeTitle ? 'Your time-style' : "You're calibrated"}
                </AppText>
                {archetypeTitle ? (
                  <AppText
                    style={{
                      fontSize: t.fontSize.xs,
                      fontWeight: t.fontWeight.semibold as '600',
                      letterSpacing: t.letterSpacing.wide,
                      textTransform: 'uppercase',
                      color: t.colors.accent,
                    }}
                  >
                    {archetypeTitle}
                  </AppText>
                ) : null}
              </View>
            </View>
          </Reveal>

          <Reveal index={1} style={{ marginTop: t.space[4] }}>
            <AppText
              style={{
                fontSize: t.fontSize.xl,
                fontWeight: t.fontWeight.bold as '700',
                lineHeight: t.fontSize.xl * t.lineHeight.tight,
                letterSpacing: t.letterSpacing.tight,
                color: t.colors.ink,
              }}
            >
              Your first{' '}
              <AppText
                style={{
                  fontSize: t.fontSize.xl,
                  fontWeight: t.fontWeight.bold as '700',
                  letterSpacing: t.letterSpacing.tight,
                  color: t.colors.accent,
                }}
              >
                honest
              </AppText>{' '}
              times are already set.
            </AppText>
          </Reveal>

          <Reveal index={2} style={{ marginTop: t.space[4] }}>
            <AppText
              variant="body"
              style={{ color: t.colors.inkSoft, lineHeight: t.fontSize.base * t.lineHeight.relaxed }}
            >
              I read them from your time-style, so you start with real numbers, not
              blank guesses. Log a task and they sharpen.
            </AppText>
          </Reveal>

          {/* Optional nickname — 6C quiet link. No container, no border; expands to
              the real input on tap. */}
          <Reveal index={3} style={{ marginTop: t.space[4] }}>
            {expanded ? (
              <TextInput
                value={nickname}
                onChangeText={setNickname}
                autoFocus
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
                  borderRadius: t.radii.md,
                  paddingHorizontal: t.space[3],
                }}
              />
            ) : (
              <Pressable
                onPress={() => setExpanded(true)}
                accessibilityRole="button"
                accessibilityLabel="Set a nickname"
                accessibilityHint="Optional"
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: t.space[2],
                    paddingVertical: t.space[1],
                  }}
                >
                  <AppText style={{ fontSize: t.fontSize.md, fontWeight: t.fontWeight.semibold as '600', color: t.colors.primary }}>
                    ＋
                  </AppText>
                  <AppText style={{ fontSize: t.fontSize.base, fontWeight: t.fontWeight.medium as '500', color: t.colors.primary }}>
                    Give me a nickname
                  </AppText>
                  <AppText style={{ fontSize: t.fontSize.sm, color: t.colors.inkFaint }}>optional</AppText>
                </View>
              </Pressable>
            )}
          </Reveal>

          <View style={{ flex: 1 }} />

          <Reveal index={4} style={{ marginBottom: t.space[6] }}>
            <RipeningRail />
          </Reveal>
        </View>

        <Reveal index={5}>
          <AppText style={{ ...(type.caption as TextStyle), color: t.colors.inkSoft, textAlign: 'center' }}>
            <AppText style={{ ...(type.captionBold as TextStyle), color: t.colors.ink }}>Made by one person. </AppText>
            Tell me what to add, it&apos;s in Settings.
          </AppText>
        </Reveal>
        <Reveal index={6} style={{ paddingTop: t.space[4] }}>
          <AppButton label="Time my first thing →" fullWidth onPress={timeFirstThing} />
        </Reveal>
        <View style={{ height: insets.bottom }} />
      </KeyboardAvoidingView>
    </Screen>
  );
}
