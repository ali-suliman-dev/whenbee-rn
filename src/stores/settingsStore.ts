import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandKv } from '@/src/lib/kv';
export type ColorModePref = 'system' | 'light' | 'dark';
interface SettingsState { colorMode: ColorModePref; setColorMode: (m: ColorModePref) => void; }
export const useSettingsStore = create<SettingsState>()(
  persist((set) => ({ colorMode: 'system', setColorMode: (colorMode) => set({ colorMode }) }),
    { name: 'settings', storage: createJSONStorage(() => zustandKv) }),
);
