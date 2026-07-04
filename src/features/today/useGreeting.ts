import { useTranslation } from 'react-i18next';
import { greetingPart } from '@/src/engine';
import { useSettingsStore } from '@/src/stores/settingsStore';

// Home greeting. Reads the local hour (clock lives here, not the engine) and the
// optional display name. The engine only supplies the pure time-of-day bucket
// (morning/afternoon/evening); the actual copy is localized here via the `today`
// i18n namespace so it renders in the user's language. The name is kept as a
// separate field (not baked into `lead`) so the UI can weight it distinctly.
export function useGreeting(): { lead: string; name?: string } {
  const { t } = useTranslation('today');
  const name = useSettingsStore((s) => s.displayName);
  const part = greetingPart(new Date().getHours());
  const lead = t(`greeting.${part}`);
  return name ? { lead, name } : { lead };
}
