import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandKv } from '@/src/lib/kv';
import { DEFAULT_DAY_END_MIN } from '@/src/engine/constants';

export type ColorModePref = 'system' | 'light' | 'dark';

const MINUTES_IN_DAY = 24 * 60;
/** Keep a stored day-end inside [0, 1439]; guards a corrupt KV value or a bad caller. */
const clampDayEndMin = (m: number): number =>
  Number.isFinite(m)
    ? Math.min(MINUTES_IN_DAY - 1, Math.max(0, Math.round(m)))
    : DEFAULT_DAY_END_MIN;

interface SettingsState {
  colorMode: ColorModePref;
  setColorMode: (m: ColorModePref) => void;
  /** Local "your estimate is up" timer ping. Off by default — reminders are opt-in. */
  remindersEnabled: boolean;
  setRemindersEnabled: (v: boolean) => void;
  /** Gentle "one honest thing a day" line on Today. Off by default; no streak, no guilt. */
  dailyRitualEnabled: boolean;
  setDailyRitualEnabled: (v: boolean) => void;
  /** End-of-day, minutes after local midnight (0–1439). Durable, set once, reused
   *  daily. Independent of any per-plan planner deadline. */
  dayEndMin: number;
  setDayEndMin: (minutes: number) => void;
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
      dayEndMin: DEFAULT_DAY_END_MIN,
      setDayEndMin: (minutes) => set({ dayEndMin: clampDayEndMin(minutes) }),
      reset: () =>
        set({
          colorMode: 'system',
          remindersEnabled: false,
          dailyRitualEnabled: false,
          dayEndMin: DEFAULT_DAY_END_MIN,
        }),
    }),
    { name: 'settings', storage: createJSONStorage(() => zustandKv) },
  ),
);
