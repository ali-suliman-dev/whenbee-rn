import type { PickedCategory } from '@/src/stores/onboardingStore';

/** The seed task categories offered on Step 1, in display order. */
export const ONBOARDING_CATEGORIES: PickedCategory[] = [
  { id: 'getting_ready', name: 'Getting ready' },
  { id: 'cleaning', name: 'Cleaning' },
  { id: 'admin', name: 'Admin & email' },
  { id: 'errands', name: 'Errands' },
  { id: 'cooking', name: 'Cooking' },
  { id: 'out_the_door', name: 'Out the door' },
];

/**
 * Turn a custom category name into a stable id: lowercase, collapse any run of
 * non-alphanumeric chars to a single underscore, and trim leading/trailing ones.
 * Unknown ids fall back to the global prior in the engine.
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export const MAX_CUSTOM_NAME = 24;
