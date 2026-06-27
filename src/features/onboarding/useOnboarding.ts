import { useOnboardingStore, type PickedCategory } from '@/src/stores/onboardingStore';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import { CATEGORY_NAMES } from '@/src/engine';
import { analytics } from '@/src/services/analytics';

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

  /** Fire once when the welcome screen first mounts. */
  const trackWelcomeShown = () => analytics.capture('welcome_shown');

  /**
   * Fire when the user taps Continue on the categories screen (categories_committed).
   * Carries the count of picked categories.
   */
  const trackCategoriesCommitted = () =>
    analytics.capture('categories_committed', { categories_picked: picked.length });

  /**
   * Finish the flow: persist the picked categories (balanced adapt speed by
   * default) and flip the boot-gate flag. category_stats rows are created lazily
   * on first read, so nothing is pre-seeded into the DB here.
   */
  function complete() {
    setCategories(picked.map((p) => ({ id: p.id, name: p.name, adaptSpeed: 'balanced' })));
    markComplete();
    // A picked id that isn't a seed slug is a custom category the user typed.
    const customAdded = picked.some((p) => !(p.id in CATEGORY_NAMES));
    analytics.capture('onboarding_completed', {
      categories_picked: picked.length,
      custom_category_added: customAdded,
    });
  }

  return { completed, hydrated, picked, togglePick, isPicked, complete, trackWelcomeShown, trackCategoriesCommitted };
}

export type { PickedCategory };
