// greetingFor — PURE TS time-of-day greeting (doc 12 boundaries). Caller passes the
// local hour (the clock read stays in a hook). Name is optional and appended only
// when non-empty; never renders "undefined". Warmth only — no behavioral content.
export function greetingFor(hour: number, name?: string): string {
  const part = hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 17 ? 'afternoon' : 'evening';
  const base = `Good ${part}`;
  const trimmed = name?.trim();
  return trimmed ? `${base}, ${trimmed}` : base;
}
