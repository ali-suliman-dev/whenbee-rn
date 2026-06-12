type Raw = Record<string, string | undefined>;
const clean = (v: string | undefined) => (v && v.trim().length > 0 ? v : undefined);
export function readEnv(raw: Raw) {
  return {
    posthogKey: clean(raw.EXPO_PUBLIC_POSTHOG_KEY),
    posthogHost: clean(raw.EXPO_PUBLIC_POSTHOG_HOST) ?? 'https://eu.i.posthog.com',
    sentryDsn: clean(raw.EXPO_PUBLIC_SENTRY_DSN),
    revenueCatIosKey: clean(raw.EXPO_PUBLIC_RC_IOS_KEY),
    revenueCatAndroidKey: clean(raw.EXPO_PUBLIC_RC_ANDROID_KEY),
  };
}
export const env = readEnv(process.env as Raw);
