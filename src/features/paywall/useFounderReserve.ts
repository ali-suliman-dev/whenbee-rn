import { useCallback, useState } from 'react';
import { kv } from '@/src/lib/kv';
import { analytics } from '@/src/services/analytics';

// ──────────────────────────────────────────────────────────────────────────────
// useFounderReserve — records the user's INTENT to lock the founder price before
// their numbers are honest. This is a soft, no-charge promise: it persists a kv
// flag and fires a single analytics event. It NEVER calls purchasePackage and
// NEVER touches the `pro` entitlement — the real purchase still happens later,
// through the normal plan picker, at the same store-read price.
//
// The flag is stable across launches (kv) so the card stays in its "locked in"
// state once tapped, and re-tapping is idempotent (no duplicate analytics, no
// duplicate writes).
// ──────────────────────────────────────────────────────────────────────────────

/** Stable kv key for the founder-price reservation flag. */
export const FOUNDER_RESERVED_KEY = 'paywall.founderReserved';
/** Stable kv key for the reservation timestamp (epoch ms, optional context). */
export const FOUNDER_RESERVED_AT_KEY = 'paywall.founderReservedAt';

export interface FounderReserveState {
  reserved: boolean;
  reserve: () => void;
}

function readReserved(): boolean {
  return kv.getString(FOUNDER_RESERVED_KEY) === '1';
}

export function useFounderReserve(): FounderReserveState {
  const [reserved, setReserved] = useState<boolean>(readReserved);

  const reserve = useCallback(() => {
    // Idempotent: a second tap must not re-write or re-fire the funnel event.
    if (readReserved()) {
      setReserved(true);
      return;
    }
    kv.set(FOUNDER_RESERVED_KEY, '1');
    kv.set(FOUNDER_RESERVED_AT_KEY, String(Date.now()));
    analytics.capture('founder_reserve', { result: 'reserved' });
    setReserved(true);
  }, []);

  return { reserved, reserve };
}
