import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandKv } from '@/src/lib/kv';

export type ColorModePref = 'system' | 'light' | 'dark';

interface SettingsState {
  colorMode: ColorModePref;
  setColorMode: (m: ColorModePref) => void;
  /** Local "your estimate is up" timer ping. Off by default — reminders are opt-in. */
  remindersEnabled: boolean;
  setRemindersEnabled: (v: boolean) => void;
  /** Gentle "one honest thing a day" line on Today. Off by default; no streak, no guilt. */
  dailyRitualEnabled: boolean;
  setDailyRitualEnabled: (v: boolean) => void;
  /** Return every preference to its first-run default (full data-reset path). */
  reset: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      colorMode: 'system',
      setColorMode: (colorMode) => set({ colorMode }),
      remindersEnabled: false,
      setRemindersEnabled: (remindersEnabled) => set({ remindersEnabled }),
      dailyRitualEnabled: false,
      setDailyRitualEnabled: (dailyRitualEnabled) => set({ dailyRitualEnabled }),
      reset: () => set({ colorMode: 'system', remindersEnabled: false, dailyRitualEnabled: false }),
    }),
    { name: 'settings', storage: createJSONStorage(() => zustandKv) },
  ),
);
