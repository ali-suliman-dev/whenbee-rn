import { HONEY_FLOOR_CAP, HONEY_FLOOR_K, HONEY_TRUST_K, HONEY_SEAL_GATE } from './constants';

/**
 * Effort floor — the guaranteed honey from showing up. Concave and strictly
 * increasing in n, asymptotically approaching HONEY_FLOOR_CAP (Thickening) but
 * never reaching it. Pure effort therefore never seals.
 */
export function effortFloor(n: number): number {
  if (n <= 0) return 0;
  return (HONEY_FLOOR_CAP * n) / (n + HONEY_FLOOR_K);
}

/**
 * Honey as calibration maturity:
 *   floor(n) + max(0, accuracy − floor(n)) · t(n),  t(n) = n/(n+HONEY_TRUST_K)
 * capped below the seal gate unless the seal is earned, then floored monotonically
 * at prevHoney. Returns a 0–100 number (not rounded — caller may round for display).
 */
export function honeyMaturity(input: {
  n: number;
  accuracy: number;
  prevHoney: number;
  sealEligible: boolean;
}): number {
  const { n, accuracy, prevHoney, sealEligible } = input;
  const floor = effortFloor(n);
  const trust = n <= 0 ? 0 : n / (n + HONEY_TRUST_K);
  let raw = floor + Math.max(0, accuracy - floor) * trust;
  const cap = sealEligible ? 100 : HONEY_SEAL_GATE - 1;
  raw = Math.min(raw, cap);
  return Math.max(prevHoney, raw);
}
