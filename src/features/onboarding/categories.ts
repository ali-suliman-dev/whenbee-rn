import type { TFunction } from 'i18next';
import type { PickedCategory } from '@/src/stores/onboardingStore';

/** The seed task category ids offered on Step 1, in display order. */
const ONBOARDING_CATEGORY_IDS = [
  'getting_ready',
  'cleaning',
  'admin',
  'errands',
  'cooking',
  'out_the_door',
] as const;

/** Full translation key for each seed category id's localized name. */
const SEED_KEY = {
  getting_ready: 'categories.seed.gettingReady',
  cleaning: 'categories.seed.cleaning',
  admin: 'categories.seed.admin',
  errands: 'categories.seed.errands',
  cooking: 'categories.seed.cooking',
  out_the_door: 'categories.seed.outTheDoor',
} as const satisfies Record<(typeof ONBOARDING_CATEGORY_IDS)[number], string>;

/** The seed task categories offered on Step 1, in display order, with localized names. */
export function getOnboardingCategories(t: TFunction<'onboarding'>): PickedCategory[] {
  return ONBOARDING_CATEGORY_IDS.map((id) => ({
    id,
    name: t(SEED_KEY[id]),
  }));
}

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
