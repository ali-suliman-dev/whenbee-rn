import { isExpoGo } from '@/src/lib/isExpoGo';
export interface PurchasesModule {
  isStub: boolean;
  configure: (apiKey: string) => void;
  getEntitlement: () => Promise<{ isPro: boolean }>;
}
const stub: PurchasesModule = { isStub: true, configure: () => {}, getEntitlement: async () => ({ isPro: false }) };
export function resolvePurchasesModule(
  expoGo: boolean,
  loadNative: () => typeof import('react-native-purchases').default,
): PurchasesModule {
  if (expoGo) return stub;
  const Purchases = loadNative();
  return {
    isStub: false,
    configure: (apiKey: string) => Purchases.configure({ apiKey }),
    getEntitlement: async () => {
      const info = await Purchases.getCustomerInfo();
      return { isPro: Object.keys(info.entitlements.active).length > 0 };
    },
  };
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
const loadNativePurchases = () => (require('react-native-purchases') as { default: typeof import('react-native-purchases').default }).default;
let cached: PurchasesModule | null = null;
export function getPurchases(): PurchasesModule {
  if (!cached) cached = resolvePurchasesModule(isExpoGo, loadNativePurchases);
  return cached;
}
