import { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
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
import { QuizProgressComb } from './QuizProgressComb';
import { QuizOption } from './QuizOption';
import { QUIZ_QUESTIONS, QUIZ_SUBTEXT } from './quizQuestions';
import type { QuizAnswers } from '@/src/engine';

// ──────────────────────────────────────────────────────────────────────────────
// QuizStepScreen — one time-style quiz question per route (Layout A, companion-led).
// The Whenbee bee hosts; a honey-comb seals one cell per question; the answer
// NEVER auto-advances (the user taps Next). Skip-left / Next-right, one row. Back
// is the native swipe (no hint). Reveal is reached only from the last step's Next.
// ──────────────────────────────────────────────────────────────────────────────

export function QuizStepScreen({ step }: { step: number }): React.JSX.Element | null {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const quizAnswers = useOnboardingStore((s) => s.quizAnswers);
  const setQuizAnswer = useOnboardingStore((s) => s.setQuizAnswer);
  const { trackQuizSkipped } = usePersonalize();

  const question = QUIZ_QUESTIONS[step];
  const isLast = step === QUIZ_QUESTIONS.length - 1;

  useEffect(() => {
    // Guard a bad/out-of-range deep link — bounce to the first question.
    if (!question) router.replace('/(onboarding)/quiz/0');
  }, [question]);

  if (!question) return null;

  const selected = quizAnswers[question.key];
  const hasAnswer = selected !== undefined;

  function choose(value: string) {
    if (!question) return;
    setQuizAnswer(question.key, value as QuizAnswers[typeof question.key]);
  }

  function goNext() {
    if (isLast) router.push('/(onboarding)/reveal');
    else router.push(`/(onboarding)/quiz/${step + 1}`);
  }

  function skip() {
    trackQuizSkipped();
    router.push('/(onboarding)/ready');
  }

  const optionsWrap: ViewStyle =
    question.layout === 'tile'
      ? { flexDirection: 'row', flexWrap: 'wrap', gap: t.space[2.5] }
      : { gap: t.space[2.5] };

  return (
    <Screen backdrop={<OnboardingBackdrop />}>
      <View style={{ flex: 1, paddingTop: t.space[2] }}>
        <QuizProgressComb total={QUIZ_QUESTIONS.length} current={step} />

        <View style={{ alignItems: 'center', gap: t.space[3], marginTop: t.space[5] }}>
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

        <View style={[optionsWrap, { marginTop: t.space[6], justifyContent: 'center' }]}>
          {question.options.map((opt) => (
            <View
              key={opt.value}
              style={question.layout === 'tile' ? { flexBasis: '47%', flexGrow: 1 } : undefined}
            >
              <QuizOption
                layout={question.layout}
                label={opt.label}
                glyph={opt.glyph}
                selected={selected === opt.value}
                onPress={() => choose(opt.value)}
              />
            </View>
          ))}
        </View>

        <View style={{ flex: 1 }} />

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: t.space[3],
          }}
        >
          <AppButton label="Skip" variant="ghost" onPress={skip} />
          <View style={{ flex: 1, maxWidth: t.size.shareCard / 1.7 }}>
            <AppButton
              label="Next →"
              variant="indigo"
              size="lg"
              fullWidth
              disabled={!hasAnswer}
              onPress={goNext}
            />
          </View>
        </View>
      </View>
      <View style={{ height: insets.bottom }} />
    </Screen>
  );
}
