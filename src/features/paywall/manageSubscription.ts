import { Linking } from 'react-native';

/**
 * Apple's account-level subscriptions page — the same destination as
 * Settings → Apple ID → Subscriptions. Used for the Apple-required
 * "Manage subscription" entry point on the paywall and in Settings.
 */
export const APPLE_MANAGE_SUBS_URL = 'https://apps.apple.com/account/subscriptions';

/**
 * Opens the App Store manage-subscriptions sheet. Fire-and-forget: if the URL
 * can't open, fail silently — the user can still reach it from the Settings app.
 */
export function openManageSubscriptions(): void {
  void Linking.openURL(APPLE_MANAGE_SUBS_URL).catch(() => {});
}
