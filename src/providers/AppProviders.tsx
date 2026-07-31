import { type ReactNode, useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PostHogProvider, PostHogErrorBoundary } from 'posthog-react-native';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { useColorMode } from '@/src/theme/useColorMode';
import { env } from '@/src/lib/env';
import { configurePurchases } from '@/src/services/purchases';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { AnalyticsProvider } from './AnalyticsProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  const mode = useColorMode();
  useEffect(() => {
    // Configure RevenueCat with the platform key, then restore the user's
    // entitlement so a returning purchaser keeps Pro across launches. Both
    // no-op safely in Expo Go / when no key is set.
    if (configurePurchases()) {
      void useEntitlement.getState().hydrate();
    }
  }, []);

  const inner = (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <GluestackUIProvider mode={mode}>{children}</GluestackUIProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );

  // AnalyticsProvider and PostHogErrorBoundary must both sit inside
  // PostHogProvider — the first so usePostHog() works, the second because the
  // boundary reads the client off PostHogContext. When posthogKey is absent
  // (dev without env vars) both are omitted and the sink stays a safe no-op.
  //
  // Console autocapture stays OFF: breadcrumbs from third-party logs are the
  // one path that could carry user-typed task text off-device, and the core
  // loop is on-device-only by design.
  return env.posthogKey ? (
    <PostHogProvider
      apiKey={env.posthogKey}
      options={{
        host: env.posthogHost,
        errorTracking: { autocapture: { uncaughtExceptions: true, unhandledRejections: true, console: false } },
      }}
    >
      <PostHogErrorBoundary fallback={<></>}>
        <AnalyticsProvider>{inner}</AnalyticsProvider>
      </PostHogErrorBoundary>
    </PostHogProvider>
  ) : (
    inner
  );
}
