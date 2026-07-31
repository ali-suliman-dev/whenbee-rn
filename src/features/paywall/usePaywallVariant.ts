// ──────────────────────────────────────────────────────────────────────────────
// usePaywallVariant — which feature-section layout the paywall renders, kept in
// KV so the founder can flip it from Settings → Developer and compare both on
// device. Default: the "A day with Pro" rail.
// Spec: docs/product/specs/2026-07-19-paywall-redesign.md §3.3
// ──────────────────────────────────────────────────────────────────────────────

import { useCallback, useState } from 'react';
import { kv } from '@/src/lib/kv';

export type PaywallFeatureVariant = 'day' | 'groups';

export const PAYWALL_VARIANT_KEY = 'paywall.featureVariant';

export function getPaywallVariant(): PaywallFeatureVariant {
  return kv.getString(PAYWALL_VARIANT_KEY) === 'groups' ? 'groups' : 'day';
}

export function setPaywallVariant(variant: PaywallFeatureVariant): void {
  kv.set(PAYWALL_VARIANT_KEY, variant);
}

export function usePaywallVariant(): {
  variant: PaywallFeatureVariant;
  setVariant: (v: PaywallFeatureVariant) => void;
} {
  const [variant, setVariantState] = useState<PaywallFeatureVariant>(getPaywallVariant);
  const setVariant = useCallback((v: PaywallFeatureVariant) => {
    setPaywallVariant(v);
    setVariantState(v);
  }, []);
  return { variant, setVariant };
}
