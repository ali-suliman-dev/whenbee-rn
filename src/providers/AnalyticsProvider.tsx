// ──────────────────────────────────────────────────────────────────────────────
// AnalyticsProvider — wires the PostHog client into the module-level analytics
// sink and fires the two lifecycle events:
//
//   • `app_open`      — every launch (unchanged behaviour; used for DAU/session)
//   • `app_installed` — exactly once ever (kv-gated); fires on first launch only
//
// Must be rendered inside <PostHogProvider> so `usePostHog()` returns a client.
// Distinct id: PostHog generates and persists a UUID on first init; subsequent
// launches reuse it from AsyncStorage automatically — no manual management needed.
// ──────────────────────────────────────────────────────────────────────────────

import { type ReactNode, useEffect } from 'react';
import { usePostHog } from 'posthog-react-native';
import { setAnalyticsSink, analytics } from '@/src/services/analytics';
import { wasInstallFired, markInstallFired } from '@/src/lib/install';

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const posthog = usePostHog();

  useEffect(() => {
    // Adapt the PostHog client to the MinimalClient interface. PostHog's
    // `PostHogEventProperties` uses a `JsonType` index signature (narrower than
    // `unknown`), but our analytics contract types props as `Record<string, unknown>`.
    // Double-cast through `unknown` is safe: every value we emit is JSON-serialisable.
    const sink = posthog
      ? {
          capture: (event: string, props?: Record<string, unknown>) =>
            posthog.capture(event, props as unknown as Record<string, string>),
        }
      : null;

    // Wire the PostHog client into the module-level sink so non-React layers
    // (stores, services) can emit events via `analytics.capture(...)`.
    setAnalyticsSink(sink);

    if (!posthog) return;

    // Per-launch lifecycle event.
    analytics.capture('app_open', {});

    // Once-only install event — fires on first launch, never again.
    if (!wasInstallFired()) {
      analytics.capture('app_installed', {});
      markInstallFired();
    }

    return () => {
      // Clear sink when provider unmounts (app teardown / hot-reload).
      setAnalyticsSink(null);
    };
  }, [posthog]);

  return <>{children}</>;
}
