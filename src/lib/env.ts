type Raw = Record<string, string | undefined>;
const clean = (v: string | undefined) => (v && v.trim().length > 0 ? v : undefined);

/**
 * Test seam only. Do NOT build the production `env` from this by passing
 * `process.env` — aliasing `process.env` defeats Expo's build-time inlining of
 * `EXPO_PUBLIC_*`, so the values come out `undefined` in a release bundle.
 */
export function readEnv(raw: Raw) {
  return {
    posthogKey: clean(raw.EXPO_PUBLIC_POSTHOG_KEY),
    posthogHost: clean(raw.EXPO_PUBLIC_POSTHOG_HOST) ?? 'https://eu.i.posthog.com',
    sentryDsn: clean(raw.EXPO_PUBLIC_SENTRY_DSN),
    revenueCatIosKey: clean(raw.EXPO_PUBLIC_RC_IOS_KEY),
    revenueCatAndroidKey: clean(raw.EXPO_PUBLIC_RC_ANDROID_KEY),
  };
}

/**
 * Production env. Each read is a DIRECT `process.env.EXPO_PUBLIC_*` member
 * expression so babel-preset-expo replaces it with the literal value at build
 * time (this is the only form Expo inlines — see readEnv's warning).
 */
export const env = {
  posthogKey: clean(process.env.EXPO_PUBLIC_POSTHOG_KEY),
  posthogHost: clean(process.env.EXPO_PUBLIC_POSTHOG_HOST) ?? 'https://eu.i.posthog.com',
  sentryDsn: clean(process.env.EXPO_PUBLIC_SENTRY_DSN),
  revenueCatIosKey: clean(process.env.EXPO_PUBLIC_RC_IOS_KEY),
  revenueCatAndroidKey: clean(process.env.EXPO_PUBLIC_RC_ANDROID_KEY),
};
