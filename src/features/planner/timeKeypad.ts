// ──────────────────────────────────────────────────────────────────────────────
// timeKeypad — pure digit-entry logic for the FinishTimeWheel tap-to-type keypad.
//
// Models an iOS-style 24-hour time keypad: digits fill a right-aligned HHMM
// buffer (max 4). The buffer left-pads with zeros, so "1347" → 13:47 and a
// partial "9" reads as 00:09. A digit is only accepted when the resulting buffer
// still parses to a valid 24-hour time (hour 0–23, minute 0–59); this blocks
// impossible entries like 25:00 or 00:99 at the source instead of after the fact.
//
// Pure + clock-free: the component turns { hour, minute } into epoch ms itself.
// ──────────────────────────────────────────────────────────────────────────────

const MAX_DIGITS = 4;

export interface HourMinute {
  hour: number;
  minute: number;
}

/** Left-pad a buffer to 4 digits so HH = slice(0,2), MM = slice(2,4). */
function pad4(buffer: string): string {
  return buffer.padStart(MAX_DIGITS, '0');
}

/**
 * Parse a digit buffer into { hour, minute }, or null when it can't be a valid
 * 24-hour time. An empty buffer is null (nothing entered yet).
 */
export function bufferToHourMinute(buffer: string): HourMinute | null {
  if (buffer.length === 0) return null;
  const padded = pad4(buffer);
  const hour = Number(padded.slice(0, 2));
  const minute = Number(padded.slice(2, 4));
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

/** True when the buffer parses to a valid time. */
export function isValidBuffer(buffer: string): boolean {
  return bufferToHourMinute(buffer) !== null;
}

/**
 * Append one digit to the buffer, dropping the oldest digit past 4. The append
 * is rejected (buffer returned unchanged) when it would produce an invalid time,
 * so the readout can never show 25:00 or a 99 minute.
 */
export function pushDigit(buffer: string, digit: string): string {
  if (!/^[0-9]$/.test(digit)) return buffer;
  const next = (buffer + digit).slice(-MAX_DIGITS);
  return isValidBuffer(next) ? next : buffer;
}

/** Remove the most recently entered digit. */
export function popDigit(buffer: string): string {
  return buffer.slice(0, -1);
}

/** Seed a buffer from an existing time so the keypad opens on the current value. */
export function bufferFromHourMinute({ hour, minute }: HourMinute): string {
  return `${String(hour).padStart(2, '0')}${String(minute).padStart(2, '0')}`;
}

/** Format a buffer as "HH:MM" for the readout (leading zeros shown). */
export function formatBuffer(buffer: string): string {
  const padded = pad4(buffer);
  return `${padded.slice(0, 2)}:${padded.slice(2, 4)}`;
}
