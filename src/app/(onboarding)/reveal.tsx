import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Screen } from '@/src/components/Screen';
import { OnboardingBackdrop } from '@/src/components/OnboardingBackdrop';
import { useTheme } from '@/src/theme/useTheme';
import { ArchetypeReveal } from '@/src/features/onboarding/ArchetypeReveal';
import { usePersonalize, type RevealCard } from '@/src/features/onboarding/usePersonalize';
import { useOnboardingStore } from '@/src/stores/onboardingStore';
import type { QuizAnswers } from '@/src/engine';

// Structured full answers passed through to ArchetypeReveal for the echo line.
type RevealState = { card: RevealCard; answers: QuizAnswers };

// The archetype payoff. Gated: only reachable after the quiz — if the required
// `pace` answer is missing (e.g. a stray deep link), bounce to ready. The seed +
// analytics are committed once here via saveQuiz, then Continue → ready.
export default function RevealScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const answers = useOnboardingStore((s) => s.quizAnswers);
  const { saveQuiz, trackRevealShown } = usePersonalize();
  const [reveal, setReveal] = useState<RevealState | null>(null);

  useEffect(() => {
    const pace = answers.pace;
    if (pace === undefined) {
      router.replace('/(onboarding)/ready');
      return;
    }
    const full: QuizAnswers = {
      pace,
      ...(answers.mid !== undefined ? { mid: answers.mid } : {}),
      ...(answers.sink !== undefined ? { sink: answers.sink } : {}),
      ...(answers.focus !== undefined ? { focus: answers.focus } : {}),
    };
    setReveal({ card: saveQuiz(full), answers: full });
    // Reveal is the archetype payoff — fires only when we have a valid quiz result.
    trackRevealShown();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Screen backdrop={<OnboardingBackdrop />}>
      <View style={{ flex: 1, paddingTop: t.space[2] }}>
        {reveal !== null ? (
          <ArchetypeReveal
            title={reveal.card.title}
            blurb={reveal.card.blurb}
            multiplier={reveal.card.multiplier}
            quizAnswers={reveal.answers}
            onContinue={() => router.push('/(onboarding)/categories')}
          />
        ) : null}
      </View>
      <View style={{ height: insets.bottom }} />
    </Screen>
  );
}
