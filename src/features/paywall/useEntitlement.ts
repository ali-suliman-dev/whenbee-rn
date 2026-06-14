import { create } from 'zustand';
import { getPurchases, type Package } from '../../services/purchases';

interface EntitlementState {
  isPro: boolean;
  ready: boolean;
  hydrate: () => Promise<void>;
  setPro: (v: boolean) => void;
  purchase: (pkg: Package) => Promise<void>;
  restore: () => Promise<void>;
}

export const useEntitlement = create<EntitlementState>((set) => ({
  isPro: false,
  ready: false,
  hydrate: async () => {
    const { isPro } = await getPurchases().getEntitlement();
    set({ isPro, ready: true });
  },
  setPro: (isPro) => set({ isPro }),
  purchase: async (pkg) => {
    const { isPro } = await getPurchases().purchasePackage(pkg);
    set({ isPro });
  },
  restore: async () => {
    const { isPro } = await getPurchases().restore();
    set({ isPro });
  },
}));
