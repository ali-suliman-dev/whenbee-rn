// Forgot-to-stop protection threshold + decision math. PURE TS — no RN/Expo,
// no Date.now(). Mirrors guardrail.ts: threshold = round(honest × factor),
// floored at the shared minimum. The recovered finish is ALWAYS the predicted
// honest number, never the runaway elapsed — a forgotten stop must not train a
// fake duration into the model.
import type { ForgotStepIn } from '../domain/types';
import {
  FORGOT_STEP_IN_FACTORS,
  FORGOT_GRACE_MIN,
  GUARDRAIL_MIN_THRESHOLD_MIN,
} from './constants';

/** Elapsed-minute threshold for the gentle nudge, or null when honest is unusable. */
export function nudgeThresholdMin(input: {
  honestMin: number;
  stepIn: ForgotStepIn;
}): number | null {
  const { honestMin, stepIn } = input;
  if (!Number.isFinite(honestMin) || honestMin <= 0) return null;
  const factor = FORGOT_STEP_IN_FACTORS[stepIn];
  return Math.max(GUARDRAIL_MIN_THRESHOLD_MIN, Math.round(honestMin * factor));
}

/** Elapsed-minute threshold at which an unattended session auto-closes. */
export function closeThresholdMin(input: {
  honestMin: number;
  stepIn: ForgotStepIn;
}): number | null {
  const nudge = nudgeThresholdMin(input);
  if (nudge === null) return null;
  return nudge + FORGOT_GRACE_MIN;
}

/** Decide whether an unattended running session should auto-close, and at what
 *  duration. `recoveredActualMin` is the predicted honest finish, rounded. */
export function autoCloseDecision(input: {
  elapsedMin: number;
  honestMin: number;
  stepIn: ForgotStepIn;
}): { shouldAutoClose: boolean; recoveredActualMin: number } {
  const close = closeThresholdMin(input);
  const recoveredActualMin = Math.max(1, Math.round(input.honestMin));
  if (close === null) return { shouldAutoClose: false, recoveredActualMin };
  return { shouldAutoClose: input.elapsedMin >= close, recoveredActualMin };
}
