import { Platform } from 'react-native';
import type {
  CustomerInfo,
  PurchasesOfferings,
  PurchasesPackage as RcPackage,
} from 'react-native-purchases';
import { isExpoGo } from '@/src/lib/isExpoGo';
import { env } from '@/src/lib/env';

/** RevenueCat entitlement identifier that unlocks Pro (Honest-Day calendar). */
const PRO_ENTITLEMENT_ID = 'pro';

/** Duration tag the paywall uses to label and order packages. */
export type PackageDuration = 'monthly' | 'yearly' | 'lifetime' | 'other';

/**
 * App-side view of a purchasable package. Carries only what the paywall needs.
 * `priceString` is always the human-formatted price from the store — never hardcoded.
 */
export interface Package {
  /** RevenueCat package identifier (e.g. "$rc_monthly"). */
  id: string;
  /** Coarse duration tag for labelling/ordering in the paywall. */
  duration: PackageDuration;
  /** Localized, store-formatted price (e.g. "$4.99"). The only price the UI shows. */
  priceString: string;
  /** Underlying store product identifier. */
  productId: string;
}

/** App-side view of the current offering and its packages. */
export interface Offering {
  /** RevenueCat offering identifier. */
  id: string;
  packages: Package[];
}

export interface PurchasesModule {
  isStub: boolean;
  configure: (apiKey: string) => void;
  getEntitlement: () => Promise<{ isPro: boolean }>;
  getOfferings: () => Promise<Offering | null>;
  purchasePackage: (pkg: Package) => Promise<{ isPro: boolean }>;
  restore: () => Promise<{ isPro: boolean }>;
}

type NativePurchases = typeof import('react-native-purchases').default;

function isProActive(info: CustomerInfo): boolean {
  return info.entitlements.active[PRO_ENTITLEMENT_ID] != null;
}

function toDuration(packageType: RcPackage['packageType']): PackageDuration {
  switch (packageType) {
    case 'MONTHLY':
      return 'monthly';
    case 'ANNUAL':
      return 'yearly';
    case 'LIFETIME':
      return 'lifetime';
    default:
      return 'other';
  }
}

function toPackage(pkg: RcPackage): Package {
  return {
    id: pkg.identifier,
    duration: toDuration(pkg.packageType),
    priceString: pkg.product.priceString,
    productId: pkg.product.identifier,
  };
}

function toOffering(offerings: PurchasesOfferings): Offering | null {
  const current = offerings.current;
  if (!current) return null;
  return {
    id: current.identifier,
    packages: current.availablePackages.map(toPackage),
  };
}

/**
 * Deterministic stub for Expo Go and tests. The paywall renders against this so
 * the UI can be built without the native SDK.
 *
 * STUB-ONLY: these priceStrings are placeholders so the UI lays out. They are
 * NEVER shown on device — the native path always reads the real store price.
 */
const STUB_OFFERING: Offering = {
  id: 'stub-default',
  packages: [
    { id: 'stub_monthly', duration: 'monthly', priceString: '$0.00 (mock)', productId: 'stub.monthly' },
    { id: 'stub_yearly', duration: 'yearly', priceString: '$0.00 (mock)', productId: 'stub.yearly' },
    { id: 'stub_lifetime', duration: 'lifetime', priceString: '$0.00 (mock)', productId: 'stub.lifetime' },
  ],
};

function createStub(): PurchasesModule {
  let isPro = false;
  return {
    isStub: true,
    configure: () => {},
    getEntitlement: async () => ({ isPro }),
    getOfferings: async () => STUB_OFFERING,
    purchasePackage: async () => {
      isPro = true;
      return { isPro };
    },
    restore: async () => ({ isPro }),
  };
}

function createNative(Purchases: NativePurchases): PurchasesModule {
  return {
    isStub: false,
    configure: (apiKey: string) => Purchases.configure({ apiKey }),
    getEntitlement: async () => ({ isPro: isProActive(await Purchases.getCustomerInfo()) }),
    getOfferings: async () => toOffering(await Purchases.getOfferings()),
    purchasePackage: async (pkg: Package) => {
      const offerings = await Purchases.getOfferings();
      const rcPackage = offerings.current?.availablePackages.find((p) => p.identifier === pkg.id);
      if (!rcPackage) throw new Error(`Package not found in current offering: ${pkg.id}`);
      const { customerInfo } = await Purchases.purchasePackage(rcPackage);
      return { isPro: isProActive(customerInfo) };
    },
    restore: async () => ({ isPro: isProActive(await Purchases.restorePurchases()) }),
  };
}

export function resolvePurchasesModule(
  expoGo: boolean,
  loadNative: () => NativePurchases,
): PurchasesModule {
  return expoGo ? createStub() : createNative(loadNative());
}

const loadNativePurchases = () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (require('react-native-purchases') as { default: NativePurchases }).default;

let cached: PurchasesModule | null = null;
export function getPurchases(): PurchasesModule {
  if (!cached) cached = resolvePurchasesModule(isExpoGo, loadNativePurchases);
  return cached;
}

/**
 * Initialize RevenueCat once with the current platform's public SDK key from
 * env. Idempotent — safe to call on every boot. Returns false (and configures
 * nothing) in Expo Go / tests (stub module) or when no key is set for the
 * platform, so the app never crashes; the paywall just runs against the stub
 * or stays locked. MUST run before `useEntitlement.hydrate()` so that
 * `getCustomerInfo()` has a configured SDK.
 */
let configured = false;
export function configurePurchases(): boolean {
  if (configured) return true;
  const module = getPurchases();
  if (module.isStub) return false;
  const apiKey = Platform.OS === 'ios' ? env.revenueCatIosKey : env.revenueCatAndroidKey;
  if (!apiKey) return false;
  module.configure(apiKey);
  configured = true;
  return true;
}
