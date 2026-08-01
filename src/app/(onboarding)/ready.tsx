import { useState } from 'react';
import { View, TextInput, KeyboardAvoidingView, Platform, Pressable, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Trans, useTranslation } from 'react-i18next';
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
  const { t: tr } = useTranslation('onboarding');
  const insets = useSafeAreaInsets();
  const { complete } = useOnboarding();
  const { saveName } = usePersonalize();
  const archetypeSeed = useSettingsStore((s) => s.archetypeSeed);
  const [name, setName] = useState('');
  const [expanded, setExpanded] = useState(false);

  const timeFirstThing = useOnce(() => {
    saveName(name.trim() || undefined);
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
              <ArchetypeCrest beeSize={t.iconSize['2xl']} showSeal={false} />
              <View>
                <AppText style={{ fontSize: t.fontSize.sm, color: t.colors.inkFaint }}>
                  {archetypeTitle ? 'Your time-style' : "You're calibrated"}
                </AppText>
                {archetypeTitle ? (
                  <AppText
                    style={{
                      fontSize: t.fontSize.sm,
                      fontWeight: t.fontWeight.bold as '700',
                      letterSpacing: t.letterSpacing.wide,
                      textTransform: 'uppercase',
                      color: t.colors.accent,
                      marginTop: t.space[0.5],
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
              <Trans
                i18nKey="ready.headline"
                ns="onboarding"
                components={{
                  honest: (
                    <AppText
                      style={{
                        fontSize: t.fontSize.xl,
                        fontWeight: t.fontWeight.bold as '700',
                        letterSpacing: t.letterSpacing.tight,
                        color: t.colors.accent,
                      }}
                    />
                  ),
                }}
              />
            </AppText>
          </Reveal>

          <Reveal index={2} style={{ marginTop: t.space[4] }}>
            <AppText
              variant="body"
              style={{ color: t.colors.inkSoft, lineHeight: t.fontSize.base * t.lineHeight.relaxed }}
            >
              {tr('ready.body')}
            </AppText>
          </Reveal>

          {/* Optional name — 6C quiet link. No container, no border; expands to
              the real input on tap. The link is the APP asking ("What should I
              call you?"), matching the body copy's voice: the screen also speaks
              in the user's first person ("Time my first thing"), so a link that
              said "give me a name" had no fixed referent — and the app has a real
              companion-naming screen, so half of readers named the bee. The
              placeholder stays deliberately open ("Anything you answer to"): the
              field is just as happy with a handle as a first name. */}
          <Reveal index={3} style={{ marginTop: t.space[4] }}>
            {expanded ? (
              <TextInput
                value={name}
                onChangeText={setName}
                autoFocus
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
                  borderRadius: t.radii.md,
                  paddingHorizontal: t.space[3],
                }}
              />
            ) : (
              <Pressable
                onPress={() => setExpanded(true)}
                accessibilityRole="button"
                accessibilityLabel={tr('ready.nicknameLink')}
                accessibilityHint={tr('ready.nicknameHint')}
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
                    {tr('ready.nicknameLink')}
                  </AppText>
                  <AppText style={{ fontSize: t.fontSize.sm, color: t.colors.inkFaint }}>{tr('ready.nicknameOptional')}</AppText>
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
            <Trans
              i18nKey="ready.footer"
              ns="onboarding"
              components={{
                strong: <AppText style={{ ...(type.captionBold as TextStyle), color: t.colors.ink }} />,
              }}
            />
          </AppText>
        </Reveal>
        <Reveal index={6} style={{ paddingTop: t.space[4] }}>
          <AppButton label={tr('ready.cta')} fullWidth onPress={timeFirstThing} />
        </Reveal>
        <View style={{ height: insets.bottom }} />
      </KeyboardAvoidingView>
    </Screen>
  );
}
