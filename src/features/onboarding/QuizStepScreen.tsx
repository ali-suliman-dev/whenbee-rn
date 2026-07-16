import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Screen } from '@/src/components/Screen';
import { OnboardingBackdrop } from '@/src/components/OnboardingBackdrop';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { BeeMascot } from '@/src/components/BeeMascot';
import { useTheme } from '@/src/theme/useTheme';
import { useOnboardingStore } from '@/src/stores/onboardingStore';
import { usePersonalize } from '@/src/features/onboarding/usePersonalize';
import { StepProgress } from '@/src/features/onboarding/StepProgress';
import { ONBOARDING_TOTAL, QUIZ_BASE } from '@/src/features/onboarding/onboardingFlow';
import { QuizOption } from './QuizOption';
import { QUIZ_QUESTIONS, QUIZ_SUBTEXT } from './quizQuestions';
import { useOnce } from '@/src/lib/useOnce';
import type { QuizAnswers } from '@/src/engine';

// ──────────────────────────────────────────────────────────────────────────────
// QuizStepScreen — one time-style quiz question per route (Layout A, companion-led).
// The quiz is PART of onboarding: the same top progress bar counts each question as
// a step (no separate comb). The Whenbee bee hosts; the answer NEVER auto-advances
// (the user taps Next). Mandatory — no skip; the quiz answers drive the honest
// number, so skipping would only cost the user their own accuracy. Next styled
// exactly like the onboarding Continue (default size — never the oversized lg).
// Back = native swipe. Reveal is reached only from the last step's Next.
// ──────────────────────────────────────────────────────────────────────────────

export function QuizStepScreen({ step }: { step: number }): React.JSX.Element | null {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const quizAnswers = useOnboardingStore((s) => s.quizAnswers);
  const setQuizAnswer = useOnboardingStore((s) => s.setQuizAnswer);
  const { trackQuizStarted } = usePersonalize();

  const question = QUIZ_QUESTIONS[step];
  const isLast = step === QUIZ_QUESTIONS.length - 1;

  useEffect(() => {
    if (!question) router.replace('/(onboarding)/quiz/0');
  }, [question]);

  // Fire quiz_started exactly once when the first quiz step mounts.
  // once-guard: fires exactly once per mount regardless of StrictMode double-invoke.
  const quizStartedFiredRef = useRef(false);
  useEffect(() => {
    if (step !== 0) return;
    if (quizStartedFiredRef.current) return;
    quizStartedFiredRef.current = true;
    trackQuizStarted();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Guard above the early return — hooks must run unconditionally every render.
  const goNext = useOnce(() => {
    if (isLast) router.push('/(onboarding)/reveal');
    else router.push(`/(onboarding)/quiz/${step + 1}`);
  });

  if (!question) return null;

  const selected = quizAnswers[question.key];
  const hasAnswer = selected !== undefined;
  const isTile = question.layout === 'tile';

  function choose(value: string) {
    if (!question) return;
    setQuizAnswer(question.key, value as QuizAnswers[typeof question.key]);
  }

  return (
    <Screen backdrop={<OnboardingBackdrop />}>
      <StepProgress current={QUIZ_BASE + step} total={ONBOARDING_TOTAL} />

      <View style={{ flex: 1, paddingTop: t.space[2] }}>
        <View style={{ alignItems: 'center', gap: t.space[3] }}>
          <BeeMascot size={t.companion.quizBee} animated glow={false} />
          <AppText
            style={{
              fontSize: t.fontSize.subtitle,
              fontWeight: t.fontWeight.bold as '700',
              color: t.colors.ink,
              textAlign: 'center',
              letterSpacing: t.letterSpacing.tight,
            }}
          >
            {question.prompt}
          </AppText>
          <AppText
            variant="body"
            style={{ color: t.colors.inkSoft, textAlign: 'center', maxWidth: t.size.shareCard }}
          >
            {QUIZ_SUBTEXT}
          </AppText>
        </View>

        {isTile ? (
          <View
            accessibilityRole="radiogroup"
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: t.space[2.5],
              justifyContent: 'center',
              marginTop: t.space[6],
            }}
          >
            {question.options.map((opt) => (
              <View key={opt.value} style={{ width: t.size.quizTileWidth }}>
                <QuizOption
                  layout="tile"
                  label={opt.label}
                  glyph={opt.glyph}
                  selected={selected === opt.value}
                  onPress={() => choose(opt.value)}
                />
              </View>
            ))}
          </View>
        ) : (
          <View accessibilityRole="radiogroup" style={{ gap: t.space[2.5], marginTop: t.space[6] }}>
            {question.options.map((opt) => (
              <QuizOption
                key={opt.value}
                layout="row"
                label={opt.label}
                glyph={opt.glyph}
                selected={selected === opt.value}
                onPress={() => choose(opt.value)}
              />
            ))}
          </View>
        )}

        <View style={{ flex: 1 }} />

        {/* Only the Next button at the bottom — full width, the standard CTA. */}
        {!hasAnswer ? (
          <AppText
            style={{
              fontSize: t.fontSize.sm,
              color: t.colors.inkFaint,
              textAlign: 'center',
              marginBottom: t.space[2],
            }}
          >
            Pick one to continue
          </AppText>
        ) : null}
        <AppButton
          label="Next →"
          variant="indigo"
          fullWidth
          disabled={!hasAnswer}
          onPress={goNext}
        />
      </View>
      <View style={{ height: insets.bottom }} />
    </Screen>
  );
}
