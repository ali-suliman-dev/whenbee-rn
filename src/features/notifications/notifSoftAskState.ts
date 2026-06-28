// src/features/notifications/notifSoftAskState.ts
// KV-backed state machine for the post-calibration notification soft-ask.
// States: 'pending' (default) → 'accepted' | 'declined'. Terminal states never
// re-open — the re-entry path is the Settings notification toggle.

import { kv } from '@/src/lib/kv';

const KV_KEY = 'whenbee.notifSoftAsk';

export type NotifSoftAskStatus = 'pending' | 'accepted' | 'declined';

/** Read the current soft-ask state. Defaults to 'pending' when no value is set. */
export function getNotifSoftAsk(): NotifSoftAskStatus {
  const val = kv.getString(KV_KEY);
  if (val === 'accepted' || val === 'declined') return val;
  return 'pending';
}

/** Persist the new soft-ask state. Only 'accepted' and 'declined' are written;
 *  'pending' is implicit (absence of a key). */
export function setNotifSoftAsk(status: NotifSoftAskStatus): void {
  kv.set(KV_KEY, status);
}
