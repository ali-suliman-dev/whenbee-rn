/**
 * exampleRoutine — the pre-built "Morning routine" shown in the empty state.
 *
 * Shows value before setup: the user can run this immediately without building
 * anything. Durations use sane defaults (no personal data required on first run).
 *
 * "Try it" loads these steps into the draft so the user can run or edit before
 * ever saving. Nothing is written to the DB until the user explicitly saves.
 */

export interface ExampleStep {
  label: string;
  category: string;
  guessMin: number;
}

export interface ExampleRoutineSpec {
  name: string;
  steps: readonly ExampleStep[];
}

/**
 * The pre-built example. Durations are sane defaults — no calibration data
 * required. When the user has category data, B2 (calibration-seeded step
 * durations) will override these once they add their own steps.
 *
 * Categories match the app's built-in seed set (src/features/onboarding/categories.ts):
 *   getting_ready, cooking, errands — the closest real ids for a morning routine.
 */
export const EXAMPLE_ROUTINE: ExampleRoutineSpec = {
  name: 'Morning routine',
  steps: [
    { label: 'Get ready', category: 'getting_ready', guessMin: 20 },
    { label: 'Breakfast', category: 'cooking', guessMin: 15 },
    { label: 'Commute prep', category: 'errands', guessMin: 10 },
  ],
} as const;
