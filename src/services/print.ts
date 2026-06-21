// ──────────────────────────────────────────────────────────────────────────────
// print — on-device PDF render + share via the iOS share sheet. Mirrors the house
// guarded-service pattern (share.ts / purchases.ts): a pure
// `resolvePrintModule(expoGo, loadNative)` seam that returns a no-op stub in
// Expo Go / tests and the native wrapper on a dev build, exposing `isStub`.
//
// PRIVACY INVARIANT: the report is rendered locally; we hand the resulting file
// URI to the OS share sheet — NO upload, NO account, NO network call. The flow
// never rejects into a caller; a failure resolves to 'error'.
// ──────────────────────────────────────────────────────────────────────────────

import { isExpoGo } from '@/src/lib/isExpoGo';

/** Outcome of a print + share attempt. Never throws — failures map to 'error'. */
export type PrintResult = 'shared' | 'unavailable' | 'error';

/** The slice of expo-print + expo-sharing this service needs. Minimal for testing. */
export interface PrintNativeModule {
  printToFileAsync: (options: { html: string }) => Promise<{ uri: string }>;
  shareAsync: (url: string, options?: Record<string, unknown>) => Promise<void>;
  isAvailableAsync: () => Promise<boolean>;
}

/** App-side print surface. `isStub` is true in Expo Go / tests. */
export interface PrintModule {
  isStub: boolean;
  printAndShare: (html: string) => Promise<PrintResult>;
}

/** Deterministic no-op for Expo Go and unit tests — native print is unavailable. */
const stub: PrintModule = { isStub: true, printAndShare: async () => 'unavailable' };

function createNative(native: PrintNativeModule): PrintModule {
  return {
    isStub: false,
    printAndShare: async (html: string): Promise<PrintResult> => {
      try {
        const { uri } = await native.printToFileAsync({ html });
        if (!(await native.isAvailableAsync())) return 'unavailable';
        await native.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share your time report',
          UTI: 'com.adobe.pdf',
        });
        return 'shared';
      } catch {
        // best-effort; a failed render/share must never reject into the caller
        return 'error';
      }
    },
  };
}

/**
 * Resolve the print module. Pure (env + a loader are injected) so it's unit-
 * testable without the native side. Returns the stub in Expo Go; on a dev build,
 * wraps the native loader's module.
 */
export function resolvePrintModule(
  expoGo: boolean,
  loadNative: () => PrintNativeModule,
): PrintModule {
  return expoGo ? stub : createNative(loadNative());
}

const loadNativePrint = (): PrintNativeModule => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const print = require('expo-print') as {
    printToFileAsync: PrintNativeModule['printToFileAsync'];
  };
  const sharing = require('expo-sharing') as Pick<
    PrintNativeModule,
    'shareAsync' | 'isAvailableAsync'
  >;
  /* eslint-enable @typescript-eslint/no-require-imports */
  return {
    printToFileAsync: print.printToFileAsync,
    shareAsync: sharing.shareAsync,
    isAvailableAsync: sharing.isAvailableAsync,
  };
};

let cached: PrintModule | null = null;
export function getPrint(): PrintModule {
  if (!cached) cached = resolvePrintModule(isExpoGo, loadNativePrint);
  return cached;
}
