// ──────────────────────────────────────────────────────────────────────────────
// useLandingVariant — which headline wording HonestLandingCard renders, kept in
// KV so the founder can flip it from Settings → Developer and compare both on
// device. Default: 'd' ("Done ~9:50pm · 50m past your day").
// Spec: docs/superpowers/specs/2026-07-25-honest-landing-design.md
// ──────────────────────────────────────────────────────────────────────────────

import { useCallback, useState } from 'react';
import { kv } from '@/src/lib/kv';

export type LandingVariant = 'd' | 'dAlt';

export const LANDING_VARIANT_KEY = 'today.landingVariant';

export function getLandingVariant(): LandingVariant {
  return kv.getString(LANDING_VARIANT_KEY) === 'dAlt' ? 'dAlt' : 'd';
}

export function setLandingVariant(variant: LandingVariant): void {
  kv.set(LANDING_VARIANT_KEY, variant);
}

export function useLandingVariant(): {
  variant: LandingVariant;
  setVariant: (v: LandingVariant) => void;
} {
  const [variant, setVariantState] = useState<LandingVariant>(getLandingVariant);
  const setVariant = useCallback((v: LandingVariant) => {
    setLandingVariant(v);
    setVariantState(v);
  }, []);
  return { variant, setVariant };
}
