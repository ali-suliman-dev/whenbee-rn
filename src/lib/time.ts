// ──────────────────────────────────────────────────────────────────────────────
// Pure time helpers for the Live Timer (no React Native, no side-effects).
//
// All "clock" output is local 12-hour, no leading zero on the hour, 2-digit
// minute (e.g. "9:42"). Elapsed math is in whole seconds; minute boundaries are
// floored so the readout matches a wall clock (a task is "1 min in" only once a
// full 60s has passed). Overrun is allowed — minutesLeft goes negative — because
// over your guess is data, not failure.
// ──────────────────────────────────────────────────────────────────────────────

// App-wide clock format. Defaults to 12h (so tests stay deterministic); the app
// sets it once at boot from the device's "24-Hour Time" toggle via
// `setClockHour12(!prefers24Hour())` (see `lib/clockPrefs`). A single knob means
// every `formatClock` caller follows the system without threading a flag through.
let hour12Default = true;
export function setClockHour12(value: boolean): void {
  hour12Default = value;
}

/** Local clock. 12h: "9:42", "1:07", "12:00". 24h: "09:42", "16:46", "00:00". */
export function formatClock(epochMs: number, hour12 = hour12Default): string {
  const d = new Date(epochMs);
  const hours24 = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  if (!hour12) return `${hours24.toString().padStart(2, '0')}:${minutes}`;
  const h12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${h12}:${minutes}`;
}

/** Local 12-hour clock with meridiem: "9:42am", "5:00pm", "12:00pm" (noon). */
export function formatClockMeridiem(epochMs: number): string {
  const d = new Date(epochMs);
  const meridiem = d.getHours() < 12 ? 'am' : 'pm';
  return `${formatClock(epochMs)}${meridiem}`;
}

/** "mm:ss" with a 2-digit second; minutes are not capped (e.g. "61:01"). */
export function formatMmSs(totalSeconds: number): string {
  const whole = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(whole / 60);
  const seconds = whole % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** Projected finish epoch = started + estimate (ms). */
export function projectedFinish(startedAtMs: number, durationMin: number): number {
  return startedAtMs + durationMin * 60000;
}

/** Epoch ms of local midnight for the day containing `nowMs`. Pure (no Date.now). */
export function startOfLocalDay(nowMs: number): number {
  const d = new Date(nowMs);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Epoch ms of today's end-of-day for `dayEndMin` (minutes after local midnight). */
export function dayEndEpochFor(nowMs: number, dayEndMin: number): number {
  return startOfLocalDay(nowMs) + dayEndMin * 60_000;
}

/**
 * Format a minute count as a compact "Xh Ym" string. Examples:
 *   75 → "1h 15m"    60 → "1h"    45 → "45m"    0 → "0m"
 * Used by CapacityChip to display task/event durations.
 */
export function fmtHm(totalMin: number): string {
  const mins = Math.max(0, Math.round(totalMin));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

/** Whole minutes remaining vs the estimate; negative on overrun. */
export function minutesLeft(estimateMin: number, elapsedSec: number): number {
  return estimateMin - Math.floor(elapsedSec / 60);
}

/** True once elapsed reaches or passes the estimate. */
export function isOverrun(estimateMin: number, elapsedSec: number): boolean {
  return elapsedSec >= estimateMin * 60;
}
