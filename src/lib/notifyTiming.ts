// src/lib/notifyTiming.ts
// Pure, deterministic timing + decision helpers for the notification layer.
// In src/lib (not src/engine) because quiet-hours math reads local clock
// components via new Date(ms); the engine forbids clock access. No Date.now()
// here — callers pass nowMs.

export interface QuietHours {
  enabled: boolean;
  /** Window start, minutes after local midnight (0–1439). */
  startMin: number;
  /** Window end, minutes after local midnight (0–1439). May be < startMin (wraps midnight). */
  endMin: number;
}

const MS_PER_MIN = 60_000;
const MS_PER_DAY = 24 * 60 * MS_PER_MIN;

/** Minute-of-day [0,1439] for a local epoch ms. */
function localMinuteOfDay(ms: number): number {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
}

/** Local-midnight epoch ms for the day containing `ms`. */
function localMidnight(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
}

/** True if minute-of-day `mod` is inside [startMin, endMin), wrap-aware. start inclusive, end exclusive. */
function insideWindow(mod: number, startMin: number, endMin: number): boolean {
  if (startMin === endMin) return false; // empty window
  if (startMin < endMin) return mod >= startMin && mod < endMin;
  return mod >= startMin || mod < endMin; // wraps midnight
}

/**
 * If `desiredMs` lands inside the quiet window, return the next occurrence of the
 * window end (endMin); otherwise return `desiredMs` unchanged. `nowMs` is accepted
 * for symmetry/testability and future use; the shift is computed from `desiredMs`.
 */
export function nextAllowedFireMs(desiredMs: number, quiet: QuietHours, _nowMs: number): number {
  if (!quiet.enabled) return desiredMs;
  const mod = localMinuteOfDay(desiredMs);
  if (!insideWindow(mod, quiet.startMin, quiet.endMin)) return desiredMs;
  // Defer to the window end. End on the same local day if it's still ahead of
  // desired; otherwise the next day's end.
  const midnight = localMidnight(desiredMs);
  let end = midnight + quiet.endMin * MS_PER_MIN;
  if (end <= desiredMs) end += MS_PER_DAY;
  return end;
}

/** When the honest-reached ping should fire: start + the chosen anchor minutes. */
export function honestReachedFireMs(startedAtMs: number, anchorMin: number): number {
  return startedAtMs + anchorMin * MS_PER_MIN;
}

/** Suppress the honest banner only when the Live Activity ring is carrying the moment. */
export function shouldSuppressHonestBanner(presenceAvailable: boolean, activityActive: boolean): boolean {
  return presenceAvailable && activityActive;
}

/** True if the guard ping would fire within `gapMs` of the honest ping (so we skip the guard). */
export function guardCollidesWithHonest(honestFireMs: number, guardFireMs: number, gapMs = MS_PER_MIN): boolean {
  return Math.abs(guardFireMs - honestFireMs) < gapMs;
}
