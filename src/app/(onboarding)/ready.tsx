import { useState } from 'react';
import { View, TextInput, KeyboardAvoidingView, Platform, Pressable, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Screen } from '@/src/components/Screen';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { Card } from '@/src/components/Card';
import { HoneyTrail } from '@/src/components/HoneyTrail';
import { OnboardingBackdrop } from '@/src/components/OnboardingBackdrop';
import { ReasonGlyph } from '@/src/features/reward/ReasonGlyph';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
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
  const [expanded, setExpanded] = useState(false);

  const timeFirstThing = useOnce(() => {
    saveName(nickname.trim() || undefined);
    complete();
    // Anchor (tabs) beneath first: (modals) live on the root stack, so pushing
    // the sheet without the anchor traps the user in the drawer on dismiss.
    router.replace('/(tabs)');
    router.push('/(modals)/add-task');
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
                letterSpacing: t.letterSpacing.tight,
              }}
            >
              One tap to start. One tap to ripen.
            </AppText>
          </Reveal>
          <Reveal index={1}>
            <AppText
              variant="body"
              style={{ color: t.colors.inkSoft, lineHeight: t.fontSize.base * t.lineHeight.relaxed }}
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
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: t.space[3] }}>
              <ReasonGlyph kind="pulled" active={false} ambient size={t.iconSize.md} />
              <AppText variant="body" style={{ flex: 1, color: t.colors.ink }}>
                Forgot to time something? Add it in one tap — empty days are fine.
              </AppText>
            </View>
          </Reveal>

          {/* Optional nickname — demoted to a tap. Collapsed ghost row → real input. */}
          <Reveal index={4}>
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
                    height: t.size.control.md,
                    paddingHorizontal: t.space[3],
                    borderWidth: t.borderWidth.chip,
                    borderStyle: 'dashed',
                    borderColor: t.colors.border,
                    borderRadius: t.radii.md,
                  }}
                >
                  <AppText style={{ fontSize: t.fontSize.md, color: t.colors.primary }}>＋</AppText>
                  <AppText style={{ fontSize: t.fontSize.base, color: t.colors.inkSoft }}>Set a nickname</AppText>
                  <AppText style={{ fontSize: t.fontSize.xs, color: t.colors.inkFaint, marginLeft: 'auto' }}>
                    optional
                  </AppText>
                </View>
              </Pressable>
            )}
          </Reveal>
        </View>

        <Reveal index={5}>
          <AppText style={{ ...(type.caption as TextStyle), color: t.colors.inkSoft, textAlign: 'center' }}>
            <AppText style={{ ...(type.captionBold as TextStyle), color: t.colors.ink }}>Made by one person. </AppText>
            Tell me what to add anytime, it&apos;s in Settings.
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
