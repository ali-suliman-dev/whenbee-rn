import { useCallback, useState } from 'react';
import { analytics } from '@/src/services/analytics';
import { useEntitlement } from './useEntitlement';
import { openManageSubscriptions } from './manageSubscription';

/** Result of a restore attempt, so the caller can show the right message. */
export type RestoreOutcome = 'success' | 'none' | 'error';

/**
 * Account-management actions for the Settings screen: restore an earlier
 * purchase and open Apple's manage-subscriptions sheet. Keeps the analytics +
 * entitlement plumbing out of the route (which can't reach services directly).
 */
export function useAccountActions() {
  const restore = useEntitlement((s) => s.restore);
  const [restoring, setRestoring] = useState(false);

  const manageSubscription = useCallback(() => {
    analytics.capture('manage_subscription', { source: 'settings' });
    openManageSubscriptions();
  }, []);

  const restorePurchases = useCallback(async (): Promise<RestoreOutcome> => {
    setRestoring(true);
    try {
      await restore();
      const outcome: RestoreOutcome = useEntitlement.getState().isPro ? 'success' : 'none';
      analytics.capture('restore_purchases', { result: outcome });
      return outcome;
    } catch {
      analytics.capture('restore_purchases', { result: 'error' });
      return 'error';
    } finally {
      setRestoring(false);
    }
  }, [restore]);

  return { restoring, manageSubscription, restorePurchases };
}
