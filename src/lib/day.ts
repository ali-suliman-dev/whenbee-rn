// src/lib/day.ts
// Local calendar day-key helpers. Uses Date (local tz) → lives in lib, never the
// pure engine. A day key is a stable 'YYYY-MM-DD' string in the device's local time.

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Local calendar day of an epoch ms, as 'YYYY-MM-DD'. */
export function toLocalDayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Shift a 'YYYY-MM-DD' key by n days (n may be negative). */
export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  const shifted = new Date(y, m - 1, d + n);
  return `${shifted.getFullYear()}-${pad(shifted.getMonth() + 1)}-${pad(shifted.getDate())}`;
}

/** Chronological comparison; <0 if a before b. Lexicographic is valid for 'YYYY-MM-DD'. */
export function compareDayKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
