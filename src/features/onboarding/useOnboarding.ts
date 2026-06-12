import { useOnboardingStore } from '@/src/stores/onboardingStore';

export function useOnboarding() {
  const completed = useOnboardingStore((s) => s.completed);
  const hydrated = useOnboardingStore((s) => s.hydrated);
  const complete = useOnboardingStore((s) => s.complete);
  return { completed, hydrated, complete };
}
