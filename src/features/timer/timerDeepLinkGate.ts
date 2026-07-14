// ──────────────────────────────────────────────────────────────────────────────
// Cold-boot deep links into the timer sheet (presence-notification body tap,
// widget Start) cannot be part of the app's INITIAL navigation state:
// react-native-screens 4.x on Android silently skips presenting a formSheet that
// exists in the first committed navigation state — the JS screen mounts, but no
// sheet ever appears (the user lands "behind" it on a bare Today). A sheet
// PUSHED after boot presents fine.
//
// So the +native-intent hook rewrites an initial timer link to '/' (Today) and
// parks the intended href here; PendingTimerOpener pushes it once the navigator
// is ready. Warm links are untouched — warm presentation works.
//
// action=stop links are exempt: their handler is headless (stops + logs from the
// store, then replaces the route itself), so it never needs the sheet visible.
// ──────────────────────────────────────────────────────────────────────────────

let pendingHref: string | null = null;

/** Matches '/(modals)/timer', '/timer', and host-style 'timer' (scheme URLs). */
const TIMER_PATH = /(^|\/)(\(modals\)\/)?timer$/;

export function rewriteInitialTimerLink(path: string): string {
  const queryStart = path.indexOf('?');
  const pathname = queryStart === -1 ? path : path.slice(0, queryStart);
  const query = queryStart === -1 ? '' : path.slice(queryStart + 1);
  if (!TIMER_PATH.test(pathname)) return path;
  if (/(^|&)action=stop(&|$)/.test(query)) return path;
  pendingHref = query.length > 0 ? `/(modals)/timer?${query}` : '/(modals)/timer';
  return '/';
}

/** One-shot read of the parked timer href (null when none / already consumed). */
export function consumePendingTimerHref(): string | null {
  const href = pendingHref;
  pendingHref = null;
  return href;
}
