import { useSettingsStore } from '@/src/stores/settingsStore';
import { greetingFor } from '@/src/engine';

// Home greeting. Reads the local hour (clock lives here, not the engine) and the
// optional display name. Sparing density (spec 12): the name is appended on a
// fraction of opens, keyed to the calendar day so it is stable within a session —
// warm like a friend, never mechanical. With no name it falls back to the bare
// greeting.

/** Pure density helper. Returns true (use the name) for even day-indices.
 *  Exported for direct unit testing. */
export function shouldUseName(dayIndex: number): boolean {
  return dayIndex % 2 === 0;
}

export function useGreeting(): string {
  const name = useSettingsStore((s) => s.displayName);
  const now = new Date();
  const hour = now.getHours();
  if (!name) return greetingFor(hour);
  const dayIndex = Math.floor(now.getTime() / 86_400_000);
  return greetingFor(hour, shouldUseName(dayIndex) ? name : undefined);
}
