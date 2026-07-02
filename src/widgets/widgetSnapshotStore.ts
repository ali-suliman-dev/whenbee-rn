// Persists the Home-screen widget snapshot so the headless widget task can
// re-render from last-known state when the app process isn't running. The bridge
// (androidPresence) writes here on every publish; widgetTaskHandler reads here.
import { kv } from '@/src/lib/kv';
import { WIDGET_SNAPSHOT_KEY, type WidgetSnapshot } from '@/src/services/liveActivity';

export const widgetSnapshotStore = {
  save: (snapshot: WidgetSnapshot): void => {
    kv.set(WIDGET_SNAPSHOT_KEY, JSON.stringify(snapshot));
  },

  load: (): WidgetSnapshot | null => {
    const raw = kv.getString(WIDGET_SNAPSHOT_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as WidgetSnapshot;
    } catch {
      return null; // corrupt payload → quiet empty widget, never throw
    }
  },

  clear: (): void => {
    kv.delete(WIDGET_SNAPSHOT_KEY);
  },
};
