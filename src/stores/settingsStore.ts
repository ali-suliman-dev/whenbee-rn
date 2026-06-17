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
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      colorMode: 'system',
      setColorMode: (colorMode) => set({ colorMode }),
      remindersEnabled: false,
      setRemindersEnabled: (remindersEnabled) => set({ remindersEnabled }),
    }),
    { name: 'settings', storage: createJSONStorage(() => zustandKv) },
  ),
);
