// ──────────────────────────────────────────────────────────────────────────────
// Clock format preference — bridges the device's "24-Hour Time" toggle into the
// pure `formatClock` helper. JS `Intl` reads ICU locale data only and ignores the
// iOS manual 24h override, so we prefer expo-localization's calendar info.
//
// expo-localization is a NATIVE module: a require() that resolves before the dev
// client is rebuilt throws "Cannot find native module 'ExpoLocalization'". We
// load it lazily inside a try/catch and fall back to a locale-based guess so a
// stale binary degrades instead of crashing. Rebuild (`npm run ios`) to get the
// toggle-accurate answer. Kept out of `lib/time.ts` to keep that module pure.
// ──────────────────────────────────────────────────────────────────────────────

/** Locale-based fallback: 12h locales render "1:00 PM", 24h render "13:00". */
function inferFromLocale(): boolean {
  try {
    return !/[ap]\.?m\.?/i.test(new Date(2020, 0, 1, 13, 0, 0).toLocaleTimeString());
  } catch {
    return false;
  }
}

/** True when the system clock is set to 24-hour time. Defaults to 12h if unknown. */
export function prefers24Hour(): boolean {
  try {
    // Lazy require so a pre-rebuild binary hits the catch instead of a load-time crash.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCalendars } = require('expo-localization') as typeof import('expo-localization');
    const uses24 = getCalendars()[0]?.uses24hourClock;
    if (typeof uses24 === 'boolean') return uses24;
  } catch {
    // native module absent — fall through to the locale guess
  }
  return inferFromLocale();
}
