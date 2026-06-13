// ──────────────────────────────────────────────────────────────────────────────
// Pure time helpers for the Live Timer (no React Native, no side-effects).
//
// All "clock" output is local 12-hour, no leading zero on the hour, 2-digit
// minute (e.g. "9:42"). Elapsed math is in whole seconds; minute boundaries are
// floored so the readout matches a wall clock (a task is "1 min in" only once a
// full 60s has passed). Overrun is allowed — minutesLeft goes negative — because
// over your guess is data, not failure.
// ──────────────────────────────────────────────────────────────────────────────

/** Local 12-hour clock: "9:42", "1:07", "12:00" (midnight/noon → 12). */
export function formatClock(epochMs: number): string {
  const d = new Date(epochMs);
  const hours24 = d.getHours();
  const hour12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const minutes = d.getMinutes();
  return `${hour12}:${minutes.toString().padStart(2, '0')}`;
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

/** Whole minutes remaining vs the estimate; negative on overrun. */
export function minutesLeft(estimateMin: number, elapsedSec: number): number {
  return estimateMin - Math.floor(elapsedSec / 60);
}

/** True once elapsed reaches or passes the estimate. */
export function isOverrun(estimateMin: number, elapsedSec: number): boolean {
  return elapsedSec >= estimateMin * 60;
}
