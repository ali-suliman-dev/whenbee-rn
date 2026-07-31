// src/features/notifications/notifSoftAskState.ts
// KV-backed state machine for the post-calibration notification soft-ask.
// States: 'pending' (default) → 'accepted' | 'declined'. A decline is softened
// by exactly ONE later re-ask (see reaskGate.ts) — this module also stamps the
// decline moment (when + log count) and tracks the re-ask's one-shot budget.
// Beyond that, the re-entry path stays the Settings notification toggle.

import { kv } from '@/src/lib/kv';

const KV_KEY = 'whenbee.notifSoftAsk';
const REASK_USED_KEY = 'whenbee.notifReaskUsed';
const DECLINED_AT_KEY = 'whenbee.notifSoftAskDeclinedAt';
const DECLINED_NECTAR_KEY = 'whenbee.notifSoftAskDeclinedNectar';

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

// ── re-ask metadata ───────────────────────────────────────────────────────────

export interface NotifReaskMeta {
  /** True once the one-shot re-ask has been shown (spent forever). */
  used: boolean;
  /** When the decline happened (ms epoch); null for a legacy decline pre-stamp. */
  declinedAtMs: number | null;
  /** lifetimeNectar at the moment of decline; null for a legacy decline. */
  nectarAtDecline: number | null;
}

/** Record a decline WITH the stamps the re-ask clocks need. */
export function recordNotifSoftAskDecline(lifetimeNectar: number, nowMs: number = Date.now()): void {
  setNotifSoftAsk('declined');
  kv.set(DECLINED_AT_KEY, String(nowMs));
  kv.set(DECLINED_NECTAR_KEY, String(lifetimeNectar));
}

/** Read the re-ask metadata. */
export function getNotifReaskMeta(): NotifReaskMeta {
  const at = kv.getString(DECLINED_AT_KEY);
  const nectar = kv.getString(DECLINED_NECTAR_KEY);
  return {
    used: kv.getString(REASK_USED_KEY) === '1',
    declinedAtMs: at != null ? Number(at) : null,
    nectarAtDecline: nectar != null ? Number(nectar) : null,
  };
}

/** Spend the one-shot re-ask budget. Permanent. */
export function markNotifReaskUsed(): void {
  kv.set(REASK_USED_KEY, '1');
}

/** Backfill stamps for a decline recorded before the re-ask feature existed.
 *  Stamps "now" so the ≥days/≥logs clocks start fresh — never retroactively.
 *  No-op unless status is 'declined' and the stamps are missing. */
export function ensureDeclineMeta(lifetimeNectar: number, nowMs: number = Date.now()): void {
  if (getNotifSoftAsk() !== 'declined') return;
  if (kv.getString(DECLINED_AT_KEY) != null) return;
  kv.set(DECLINED_AT_KEY, String(nowMs));
  kv.set(DECLINED_NECTAR_KEY, String(lifetimeNectar));
}
