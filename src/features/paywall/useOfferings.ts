import { useEffect, useState } from 'react';
import { getPurchases, type Offering } from '../../services/purchases';

// ──────────────────────────────────────────────────────────────────────────────
// useOfferings — loads the current RevenueCat offering (or the Expo Go / test
// stub) and exposes a calm three-state read for the paywall: loading → ready,
// loading → error. The screen renders prices ONLY from `offering.packages[*]
// .priceString`, so nothing is ever hardcoded. Errors are swallowed into a flag
// (a paywall must never crash the app), and an offering with no packages is
// surfaced as the same "unavailable" state.
//
// Lives in src/features (not the screen) so the route stays thin and the service
// import is on the allowed side of the layer boundary.
// ──────────────────────────────────────────────────────────────────────────────

export type OfferingsStatus = 'loading' | 'ready' | 'unavailable';

export interface OfferingsState {
  status: OfferingsStatus;
  offering: Offering | null;
}

export function useOfferings(): OfferingsState {
  const [state, setState] = useState<OfferingsState>({ status: 'loading', offering: null });

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const offering = await getPurchases().getOfferings();
        if (!active) return;
        const hasPackages = offering != null && offering.packages.length > 0;
        setState({ status: hasPackages ? 'ready' : 'unavailable', offering });
      } catch {
        if (active) setState({ status: 'unavailable', offering: null });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return state;
}
