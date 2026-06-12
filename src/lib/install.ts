import { kv } from './kv';

// ──────────────────────────────────────────────────────────────────────────────
// install — the first-run timestamp and once-only install-event gate, kv-backed
// and synchronous.
//
// Stamped exactly once on first read so funnel events (`first_log`) and retention
// reads (C.2) can measure "time since install" without a network call. Survives
// reopen; never overwritten once set.
//
// `app_installed_fired` guards the once-only PostHog `app_installed` event so it
// fires on the very first launch and never again — even across app updates.
// ──────────────────────────────────────────────────────────────────────────────

const INSTALL_AT_KEY = 'whenbee.installAt';
const INSTALL_FIRED_KEY = 'whenbee.installFired';

/**
 * Epoch-ms of first run. Stamps `now` on the first call and returns the stored
 * value forever after, so the install moment is stable across launches.
 */
export function getInstallAt(now: number = Date.now()): number {
  const stored = kv.getString(INSTALL_AT_KEY);
  if (stored !== null) {
    const parsed = Number(stored);
    if (Number.isFinite(parsed)) return parsed;
  }
  kv.set(INSTALL_AT_KEY, String(now));
  return now;
}

/** Whole seconds elapsed since install (never negative). */
export function secondsSinceInstall(now: number = Date.now()): number {
  return Math.max(0, Math.round((now - getInstallAt(now)) / 1000));
}

/**
 * Returns true if the once-only `app_installed` analytics event has already
 * been fired on a previous launch. Use alongside `markInstallFired`.
 */
export function wasInstallFired(): boolean {
  return kv.getString(INSTALL_FIRED_KEY) === '1';
}

/**
 * Marks the once-only `app_installed` analytics event as fired. Call this
 * immediately after emitting the event so subsequent launches skip it.
 */
export function markInstallFired(): void {
  kv.set(INSTALL_FIRED_KEY, '1');
}
