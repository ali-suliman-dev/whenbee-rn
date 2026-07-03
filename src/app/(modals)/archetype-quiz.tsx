import { useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Screen } from '@/src/components/Screen';
import { SheetGrabber } from '@/src/components/SheetGrabber';
import { useTheme } from '@/src/theme/useTheme';
import { TimeStyleQuiz } from '@/src/features/onboarding/TimeStyleQuiz';
import { ArchetypeReveal } from '@/src/features/onboarding/ArchetypeReveal';
import { usePersonalize, type RevealCard } from '@/src/features/onboarding/usePersonalize';
import type { QuizAnswers } from '@/src/engine';

// ──────────────────────────────────────────────────────────────────────────────
// Archetype Quiz modal — re-opens the quiz from Settings or the Whenbee Hub CTA.
// Phase machine: quiz → reveal. Saves the seed then dismisses on continue.
// Analytics are fired via usePersonalize (not directly from the screen).
// ──────────────────────────────────────────────────────────────────────────────

export default function ArchetypeQuizModal() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { saveQuiz, trackQuizSkipped, trackReopened } = usePersonalize();
  const [reveal, setReveal] = useState<{ card: RevealCard; answers: QuizAnswers } | null>(null);

  function handleQuizComplete(answers: QuizAnswers) {
    const card = saveQuiz(answers);
    trackReopened();
    setReveal({ card, answers });
  }

  function handleQuizSkip() {
    trackQuizSkipped();
    router.back();
  }

  function handleRevealContinue() {
    router.back();
  }

  return (
    <Screen edges={['left', 'right']}>
      <SheetGrabber />
      <View style={{ flex: 1, gap: t.space[4], paddingTop: t.space[3] }}>
        {reveal === null ? (
          <TimeStyleQuiz onComplete={handleQuizComplete} onSkip={handleQuizSkip} />
        ) : (
          <ArchetypeReveal
            title={reveal.card.title}
            blurb={reveal.card.blurb}
            multiplier={reveal.card.multiplier}
            quizAnswers={reveal.answers}
            onContinue={handleRevealContinue}
          />
        )}
      </View>
      <View style={{ height: insets.bottom }} />
    </Screen>
  );
}
