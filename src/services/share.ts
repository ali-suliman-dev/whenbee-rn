// ──────────────────────────────────────────────────────────────────────────────
// share — on-device sharing of a locally-rendered plan card via the iOS share
// sheet. Mirrors the house guarded-service pattern (purchases.ts /
// liveActivity.ts): a pure `resolveShareModule(expoGo, loadNative)` seam that
// returns a no-op stub in Expo Go / tests and the native wrapper on a dev build,
// exposing `isStub`.
//
// PRIVACY INVARIANT: sharing is entirely on-device. We hand a locally-rendered
// file URI to the OS share sheet — NO upload, NO account, NO network call. The
// share never rejects into a caller; a failure resolves to 'error'.
// ──────────────────────────────────────────────────────────────────────────────

import { isExpoGo } from '@/src/lib/isExpoGo';

/** Outcome of a share attempt. Never throws — failures map to 'error'. */
export type ShareResult = 'shared' | 'unavailable' | 'error';

/** The slice of `expo-sharing` this service needs. Kept minimal for testing. */
export interface ShareNativeModule {
  isAvailableAsync: () => Promise<boolean>;
  shareAsync: (url: string, options?: Record<string, unknown>) => Promise<void>;
}

/** App-side share surface. `isStub` is true in Expo Go / tests. */
export interface ShareModule {
  isStub: boolean;
  share: (fileUri: string) => Promise<ShareResult>;
}

/** Deterministic no-op for Expo Go and unit tests — the OS sheet is unavailable. */
const stub: ShareModule = { isStub: true, share: async () => 'unavailable' };

function createNative(native: ShareNativeModule): ShareModule {
  return {
    isStub: false,
    share: async (fileUri: string): Promise<ShareResult> => {
      try {
        if (!(await native.isAvailableAsync())) return 'unavailable';
        await native.shareAsync(fileUri, {
          mimeType: 'image/png',
          dialogTitle: 'Share your honest plan',
          UTI: 'public.png',
        });
        return 'shared';
      } catch {
        // best-effort; a failed share must never reject into the caller
        return 'error';
      }
    },
  };
}

/**
 * Resolve the share module. Pure (env + a loader are injected) so it's unit-
 * testable without the native side. Returns the stub in Expo Go; on a dev build,
 * wraps the native loader's module.
 */
export function resolveShareModule(
  expoGo: boolean,
  loadNative: () => ShareNativeModule,
): ShareModule {
  return expoGo ? stub : createNative(loadNative());
}

const loadNativeSharing = (): ShareNativeModule =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('expo-sharing') as ShareNativeModule;

let cached: ShareModule | null = null;
export function getShare(): ShareModule {
  if (!cached) cached = resolveShareModule(isExpoGo, loadNativeSharing);
  return cached;
}
