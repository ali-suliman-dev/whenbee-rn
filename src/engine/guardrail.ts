// Hyperfocus guardrail threshold math. PURE TS — no RN/Expo, no Date.now().
import type { GuardrailMultiple } from '../domain/types';
import { GUARDRAIL_FACTORS, GUARDRAIL_MIN_THRESHOLD_MIN } from './constants';

/** Numeric factor for a setting, or null when off. */
export function guardrailFactor(setting: GuardrailMultiple): number | null {
  if (setting === 'off') return null;
  return GUARDRAIL_FACTORS[setting];
}

/** Elapsed-minute threshold at which the guardrail fires, or null when off / no usable
 *  honest number. threshold = round(honestMin × factor), floored at the minimum. */
export function guardrailThresholdMin(input: {
  honestMin: number;
  setting: GuardrailMultiple;
}): number | null {
  const factor = guardrailFactor(input.setting);
  if (factor === null) return null;
  if (!Number.isFinite(input.honestMin) || input.honestMin <= 0) return null;
  return Math.max(GUARDRAIL_MIN_THRESHOLD_MIN, Math.round(input.honestMin * factor));
}
