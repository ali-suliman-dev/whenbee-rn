// src/features/notifications/reaskGate.ts
// Pure eligibility gate for the once-ever notification re-ask (founder-approved
// 2026-07-23: "overrun receipt + piggyback"). A user who declined the first-log
// soft-ask gets exactly ONE later re-ask, only at a moment where the ping's
// value is self-evident:
//   'granted' — OS permission was granted elsewhere (start-by nudge), so the
//               finish ping is one tap with no OS prompt. Takes priority.
//   'overrun' — the log just banked ran well past its guess.
// No-guilt invariant: the copy states the overrun as a calm fact; the gate here
// only decides WHETHER a moment qualifies.

import type { NotifSoftAskStatus } from './notifSoftAskState';
import type { NotificationPermissionStatus } from '@/src/services/timerNotifications';

/** Days that must pass after the decline before any re-ask. */
export const REASK_MIN_DAYS = 3;
/** Logs that must be banked after the decline before any re-ask. */
export const REASK_MIN_LOGS = 5;
/** Overrun qualifies at actual ≥ ratio × guess… */
export const REASK_OVERRUN_RATIO = 1.4;
/** …or actual ≥ guess + this many minutes. */
export const REASK_OVERRUN_MIN = 10;

export type ReaskTrigger = 'overrun' | 'granted';

export function reaskTriggerFor(input: {
  status: NotifSoftAskStatus;
  reaskUsed: boolean;
  remindersEnabled: boolean;
  permStatus: NotificationPermissionStatus;
  declinedAtMs: number;
  nectarAtDecline: number;
  lifetimeNectar: number;
  nowMs: number;
  guessMin: number;
  actualMin: number;
}): ReaskTrigger | null {
  if (input.status !== 'declined') return null;
  if (input.reaskUsed) return null;
  if (input.remindersEnabled) return null;
  if (input.permStatus === 'denied') return null;

  const dayMs = 24 * 60 * 60 * 1000;
  if (input.nowMs - input.declinedAtMs < REASK_MIN_DAYS * dayMs) return null;
  if (input.lifetimeNectar - input.nectarAtDecline < REASK_MIN_LOGS) return null;

  // Piggyback first: permission already granted elsewhere → one-tap enable.
  if (input.permStatus === 'granted') return 'granted';

  // Overrun receipt: the just-banked log ran meaningfully past its guess.
  if (input.guessMin <= 0 || input.actualMin <= 0) return null;
  const overran =
    input.actualMin >= input.guessMin * REASK_OVERRUN_RATIO ||
    input.actualMin >= input.guessMin + REASK_OVERRUN_MIN;
  return overran ? 'overrun' : null;
}
