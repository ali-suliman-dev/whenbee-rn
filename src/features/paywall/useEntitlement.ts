import { create } from 'zustand';
import { getPurchases } from '../../services/purchases';
interface EntitlementState { isPro: boolean; ready: boolean; hydrate: () => Promise<void>; setPro: (v: boolean) => void; }
export const useEntitlement = create<EntitlementState>((set) => ({
  isPro: false, ready: false,
  hydrate: async () => { const { isPro } = await getPurchases().getEntitlement(); set({ isPro, ready: true }); },
  setPro: (isPro) => set({ isPro }),
}));
