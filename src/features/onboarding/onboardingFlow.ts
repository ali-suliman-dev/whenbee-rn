// ──────────────────────────────────────────────────────────────────────────────
// onboardingFlow — the ONE ordered list of onboarding steps that the top progress
// bar counts. The quiz questions are real steps in this list (not a separate
// indicator), so the bar advances one notch per question and the quiz reads as
// part of onboarding, never a detour. The reveal is the payoff between the last
// quiz step and ready — it shows NO bar (a clean celebration), so it is not listed.
// ──────────────────────────────────────────────────────────────────────────────

export const ONBOARDING_FLOW = [
  'welcome',
  'categories',
  'name',
  'quiz/0',
  'quiz/1',
  'quiz/2',
  'ready',
] as const;

export type OnboardingStepKey = (typeof ONBOARDING_FLOW)[number];

/** Total segments the onboarding progress bar shows (constant across every screen). */
export const ONBOARDING_TOTAL = ONBOARDING_FLOW.length;

/** 0-based index of a step in the flow (the StepProgress `current`). */
export function onboardingStepIndex(key: OnboardingStepKey): number {
  return ONBOARDING_FLOW.indexOf(key);
}

/** First quiz step's index — quiz step N sits at QUIZ_BASE + N. */
export const QUIZ_BASE = onboardingStepIndex('quiz/0');
