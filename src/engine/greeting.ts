/** Time-of-day bucket the greeting falls into (doc 12 boundaries). PURE — hour in,
 *  bucket out, no words, no locale. Display layers localize the actual copy from this. */
export type GreetingPart = 'morning' | 'afternoon' | 'evening';

export function greetingPart(hour: number): GreetingPart {
  return hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 17 ? 'afternoon' : 'evening';
}

// greetingFor — PURE TS time-of-day greeting (doc 12 boundaries). Caller passes the
// local hour (the clock read stays in a hook). Name is optional and appended only
// when non-empty; never renders "undefined". Warmth only — no behavioral content.
// English-only; UI copy should localize via greetingPart + the today i18n namespace
// instead of rendering this string directly.
export function greetingFor(hour: number, name?: string): string {
  const base = `Good ${greetingPart(hour)}`;
  const trimmed = name?.trim();
  return trimmed ? `${base}, ${trimmed}` : base;
}
