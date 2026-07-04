// Single source for the app's legal URLs. The paywall, Settings, and onboarding
// all read from here so the strings never drift. Apple guideline 3.1.2 requires a
// functional Terms of Use (EULA) and Privacy Policy link on any screen that sells
// an auto-renewable subscription.
//
// ⚠️ These pages must be LIVE before App Store submission (launch-blocker #2 in
// docs/product/11-APP-STORE-LAUNCH-BLOCKERS.md). A reviewer taps these links; a
// 404 is a rejection. Update the host to the real domain you control.
export const LEGAL = {
  privacyUrl: 'https://whenbee.app/privacy',
  termsUrl: 'https://whenbee.app/terms',
} as const;
