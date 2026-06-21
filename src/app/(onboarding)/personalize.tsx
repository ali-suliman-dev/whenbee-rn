import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Screen } from '@/src/components/Screen';
import { OnboardingBackdrop } from '@/src/components/OnboardingBackdrop';
import { useTheme } from '@/src/theme/useTheme';
import { StepProgress } from '@/src/features/onboarding/StepProgress';
import { NameAsk } from '@/src/features/onboarding/NameAsk';
import { TimeStyleQuiz } from '@/src/features/onboarding/TimeStyleQuiz';
import { ArchetypeReveal } from '@/src/features/onboarding/ArchetypeReveal';
import { usePersonalize, type RevealCard } from '@/src/features/onboarding/usePersonalize';
import type { QuizAnswers } from '@/src/engine';

// ──────────────────────────────────────────────────────────────────────────────
// Personalize — onboarding step 2 (index 2 of 4).
// Phase machine: name → quiz → reveal, every phase skippable to /(onboarding)/ready.
// Analytics are fired via usePersonalize (not directly from the screen, per layer rules).
// ──────────────────────────────────────────────────────────────────────────────

type Phase = 'name' | 'quiz' | 'reveal';

export default function Personalize() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { trackShown, saveName, saveQuiz, trackQuizSkipped } = usePersonalize();
  const [phase, setPhase] = useState<Phase>('name');
  const [reveal, setReveal] = useState<RevealCard | null>(null);

  useEffect(() => {
    trackShown();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleNameContinue(name: string | undefined) {
    saveName(name);
    setPhase('quiz');
  }

  function handleQuizComplete(answers: QuizAnswers) {
    const card = saveQuiz(answers);
    setReveal(card);
    setPhase('reveal');
  }

  function handleQuizSkip() {
    trackQuizSkipped();
    router.push('/(onboarding)/ready');
  }

  function handleRevealContinue() {
    router.push('/(onboarding)/ready');
  }

  return (
    <Screen backdrop={<OnboardingBackdrop />}>
      <StepProgress current={2} total={4} />
      <View style={{ flex: 1, gap: t.space[4], paddingTop: t.space[2] }}>
        {phase === 'name' && (
          <NameAsk onContinue={handleNameContinue} />
        )}
        {phase === 'quiz' && (
          <TimeStyleQuiz onComplete={handleQuizComplete} onSkip={handleQuizSkip} />
        )}
        {phase === 'reveal' && reveal !== null && (
          <ArchetypeReveal
            title={reveal.title}
            blurb={reveal.blurb}
            multiplier={reveal.multiplier}
            onContinue={handleRevealContinue}
          />
        )}
      </View>
      <View style={{ height: insets.bottom }} />
    </Screen>
  );
}
