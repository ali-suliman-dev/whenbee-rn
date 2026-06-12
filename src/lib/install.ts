import { kv } from './kv';

// ──────────────────────────────────────────────────────────────────────────────
// install — the first-run timestamp, kv-backed and synchronous.
//
// Stamped exactly once on first read so funnel events (`first_log`) and retention
// reads (C.2) can measure "time since install" without a network call. Survives
// reopen; never overwritten once set.
// ──────────────────────────────────────────────────────────────────────────────

const INSTALL_AT_KEY = 'whenbee.installAt';

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
