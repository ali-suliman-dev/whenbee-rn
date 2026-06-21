import { create } from 'zustand';
import { kv } from '../../lib/kv';
import { getPurchases, type Package } from '../../services/purchases';

/**
 * QA override: when set, Pro stays unlocked across launches and survives
 * hydrate() (which would otherwise reset to the real RevenueCat entitlement
 * on a device with no purchase). Toggled from Settings → Developer in every
 * build so the founder can test gated screens on-device.
 */
const PRO_OVERRIDE_KEY = 'dev_pro_override';
const isProOverridden = (): boolean => kv.getString(PRO_OVERRIDE_KEY) === '1';

interface EntitlementState {
  isPro: boolean;
  ready: boolean;
  hydrate: () => Promise<void>;
  setPro: (v: boolean) => void;
  purchase: (pkg: Package) => Promise<void>;
  restore: () => Promise<void>;
}

export const useEntitlement = create<EntitlementState>((set) => ({
  isPro: isProOverridden(),
  ready: false,
  hydrate: async () => {
    if (isProOverridden()) {
      set({ isPro: true, ready: true });
      return;
    }
    const { isPro } = await getPurchases().getEntitlement();
    set({ isPro, ready: true });
  },
  setPro: (isPro) => {
    if (isPro) kv.set(PRO_OVERRIDE_KEY, '1');
    else kv.delete(PRO_OVERRIDE_KEY);
    set({ isPro });
  },
  purchase: async (pkg) => {
    const { isPro } = await getPurchases().purchasePackage(pkg);
    set({ isPro });
  },
  restore: async () => {
    const { isPro } = await getPurchases().restore();
    set({ isPro });
  },
}));
