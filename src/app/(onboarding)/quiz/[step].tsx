import { useLocalSearchParams } from 'expo-router';
import { QuizStepScreen } from '@/src/features/onboarding/QuizStepScreen';

// One time-style quiz question per route (`/quiz/0`, `/quiz/1`, …). Native stack
// swipe-back walks to the previous question; the comb + Next/Skip live in the screen.
export default function QuizStepRoute() {
  const { step } = useLocalSearchParams<{ step: string }>();
  const idx = Number(step);
  return <QuizStepScreen step={Number.isFinite(idx) ? idx : 0} />;
}
