import { readEnv } from '../env';
describe('readEnv', () => {
  it('returns provided public values', () => {
    const e = readEnv({ EXPO_PUBLIC_POSTHOG_KEY: 'ph', EXPO_PUBLIC_POSTHOG_HOST: 'https://eu.i.posthog.com', EXPO_PUBLIC_SENTRY_DSN: 'dsn', EXPO_PUBLIC_RC_IOS_KEY: 'rc' });
    expect(e.posthogKey).toBe('ph'); expect(e.sentryDsn).toBe('dsn');
  });
  it('treats blank/missing as undefined', () => {
    const e = readEnv({}); expect(e.posthogKey).toBeUndefined(); expect(e.revenueCatIosKey).toBeUndefined();
  });
});
