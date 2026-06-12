import * as Sentry from '@sentry/react-native';
import { env } from '@/src/lib/env';
let initialized = false;
export function initSentry() {
  if (initialized || !env.sentryDsn) return;
  Sentry.init({ dsn: env.sentryDsn, enableNative: true, tracesSampleRate: 0.2 });
  initialized = true;
}
export const captureError = (e: unknown) => { if (initialized) Sentry.captureException(e); };
export const SentryErrorBoundary = Sentry.ErrorBoundary;
