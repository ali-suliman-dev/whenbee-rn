import { useOnboardingStore, type PickedCategory } from '@/src/stores/onboardingStore';
import { useCategoriesStore } from '@/src/stores/categoriesStore';

/**
 * Onboarding feature hook. Owns the cross-store wiring for the 3-step flow so the
 * route screens never reach into stores/services directly (layer rule).
 */
export function useOnboarding() {
  const completed = useOnboardingStore((s) => s.completed);
  const hydrated = useOnboardingStore((s) => s.hydrated);
  const picked = useOnboardingStore((s) => s.picked);
  const togglePick = useOnboardingStore((s) => s.togglePick);
  const markComplete = useOnboardingStore((s) => s.complete);
  const setCategories = useCategoriesStore((s) => s.setCategories);

  const isPicked = (id: string) => picked.some((p) => p.id === id);

  /**
   * Finish the flow: persist the picked categories (balanced adapt speed by
   * default) and flip the boot-gate flag. category_stats rows are created lazily
   * on first read, so nothing is pre-seeded into the DB here.
   */
  function complete() {
    setCategories(picked.map((p) => ({ id: p.id, name: p.name, adaptSpeed: 'balanced' })));
    markComplete();
  }

  return { completed, hydrated, picked, togglePick, isPicked, complete };
}

export type { PickedCategory };
