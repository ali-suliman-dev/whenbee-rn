import { greetingFor } from '@/src/engine';
import { useSettingsStore } from '@/src/stores/settingsStore';

// Home greeting. Reads the local hour (clock lives here, not the engine) and the
// optional display name. When a name is set it shows in every greeting; with no
// name it falls back to the bare salutation.

/** Greeting split into its muted lead ("Good evening") and the optional name,
 *  so the UI can weight the name distinctly from the salutation. */
export function useGreeting(): { lead: string; name?: string } {
  const name = useSettingsStore((s) => s.displayName);
  const lead = greetingFor(new Date().getHours());
  return name ? { lead, name } : { lead };
}
