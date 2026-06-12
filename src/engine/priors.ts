// Day-1 population priors. PURE TS. Values verbatim from 01-FOUNDATION.md §3.5.
// n=0 → M = prior, so the very first suggestion is already smart.
import { GLOBAL_PRIOR } from './constants';

export { GLOBAL_PRIOR };

/** Canonical seed categories with their population priors. */
export const CATEGORY_PRIORS: Record<string, number> = {
  getting_ready: 1.7,
  cleaning: 2.0,
  admin: 2.2,
  email: 1.6,
  errands: 1.8,
  writing: 2.3,
  creative: 2.4,
  calls: 1.3,
  commute: 1.4,
  cooking: 1.5,
};

/** Display names for the seed categories (for onboarding chips / category list). */
export const CATEGORY_NAMES: Record<string, string> = {
  getting_ready: 'Getting ready',
  cleaning: 'Cleaning',
  admin: 'Admin & email',
  email: 'Email',
  errands: 'Errands',
  writing: 'Writing',
  creative: 'Creative',
  calls: 'Calls',
  commute: 'Commute',
  cooking: 'Cooking',
};

/** Prior multiplier for a category id; custom/unknown categories fall back to the global prior. */
export function priorFor(categoryId: string): number {
  return CATEGORY_PRIORS[categoryId] ?? GLOBAL_PRIOR;
}
