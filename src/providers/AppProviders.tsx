import { type ReactNode, useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PostHogProvider } from 'posthog-react-native';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { useColorMode } from '@/src/theme/useColorMode';
import { env } from '@/src/lib/env';
import { initSentry, SentryErrorBoundary } from '@/src/services/sentry';
import { configurePurchases } from '@/src/services/purchases';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { AnalyticsProvider } from './AnalyticsProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  const mode = useColorMode();
  useEffect(() => {
    initSentry();
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

  // AnalyticsProvider must sit inside PostHogProvider so usePostHog() works.
  // When posthogKey is absent (dev without env vars), AnalyticsProvider is
  // omitted and the sink stays a safe no-op.
  const withAnalytics = env.posthogKey ? (
    <PostHogProvider apiKey={env.posthogKey} options={{ host: env.posthogHost }}>
      <AnalyticsProvider>{inner}</AnalyticsProvider>
    </PostHogProvider>
  ) : (
    inner
  );

  return <SentryErrorBoundary fallback={<></>}>{withAnalytics}</SentryErrorBoundary>;
}
