import { useCallback, useRef } from 'react';
import type { View } from 'react-native';
import { captureRef as nativeCaptureRef } from 'react-native-view-shot';
import { router } from 'expo-router';
import { analytics } from '@/src/services/analytics';
import { getShare, type ShareResult } from '@/src/services/share';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';

// ──────────────────────────────────────────────────────────────────────────────
// useShareCard — orchestrates the on-device share of a ShareableCard.
//
// `runShareFlow` is the PURE, fully-injectable core (no native, no router, no
// store) so it unit-tests cleanly:
//   • non-Pro  → log 'gated' + open the paywall; never capture, never share.
//   • empty ref → no-op (the off-screen card hasn't mounted yet).
//   • Pro      → capture the ref to a PNG → hand the file URI to the OS share
//                sheet → log the outcome. Any failure is swallowed to 'error';
//                the flow never throws into the caller.
//
// PRIVACY INVARIANT: the file URI goes straight to the OS share sheet — no upload,
// no account, no network. Sharing stays on-device (mirrors src/services/share.ts).
// ──────────────────────────────────────────────────────────────────────────────

export type ShareSurface = 'plan' | 'archetype';

type CaptureResult = 'shared' | 'gated' | 'error';

interface ShareFlowDeps {
  surface: ShareSurface;
  isPro: boolean;
  ref: { current: unknown };
  onGate: () => void;
  share: (uri: string) => Promise<ShareResult>;
  captureRef: (node: unknown) => Promise<string>;
  capture: (
    event: 'plan_shared',
    props: { surface: ShareSurface; is_pro: boolean; result: CaptureResult },
  ) => void;
}

// The analytics union is shared|gated|error; a 'unavailable' share result (OS sheet
// not available, e.g. Expo Go) folds into 'error' rather than widening the event.
function toAnalyticsResult(result: ShareResult): CaptureResult {
  return result === 'shared' ? 'shared' : 'error';
}

export async function runShareFlow(deps: ShareFlowDeps): Promise<void> {
  const { surface, isPro, ref, onGate, share, captureRef, capture } = deps;

  if (!isPro) {
    capture('plan_shared', { surface, is_pro: false, result: 'gated' });
    onGate();
    return;
  }

  const node = ref.current;
  if (!node) return;

  try {
    const uri = await captureRef(node);
    const result = await share(uri);
    capture('plan_shared', { surface, is_pro: true, result: toAnalyticsResult(result) });
  } catch {
    capture('plan_shared', { surface, is_pro: true, result: 'error' });
  }
}

export function useShareCard(surface: ShareSurface): {
  ref: React.RefObject<View | null>;
  onShare: () => Promise<void>;
} {
  const ref = useRef<View>(null);
  const isPro = useEntitlement((s) => s.isPro);

  const onShare = useCallback(
    () =>
      runShareFlow({
        surface,
        isPro,
        ref,
        onGate: () =>
          router.push({ pathname: '/(modals)/paywall', params: { trigger: 'settings_upgrade' } }),
        share: (uri) => getShare().share(uri),
        captureRef: (node) =>
          nativeCaptureRef(node as View, { format: 'png', quality: 1, result: 'tmpfile' }),
        capture: analytics.capture,
      }),
    [surface, isPro],
  );

  return { ref, onShare };
}
