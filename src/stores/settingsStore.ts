import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandKv } from '@/src/lib/kv';
import { DEFAULT_DAY_END_MIN, DEFAULT_GUARDRAIL } from '@/src/engine/constants';
import type { GuardrailMultiple } from '@/src/domain/types';

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
  /** Focus-window start, minutes after local midnight (0–1439). `null` = unset
   *  (the invite state). Two local time integers — no health data, never trained. */
  windowStartMin: number | null;
  /** Focus-window end, minutes after local midnight (0–1439). `null` = unset. */
  windowEndMin: number | null;
  /** Set the focus window atomically so the card never sees a half-set window. */
  setFocusWindow: (startMin: number, endMin: number) => void;
  /** Hyperfocus guardrail multiple of the honest number, or 'off'. Off by default;
   *  the gentle check-in is opt-in and Pro-only. Reads the model, trains nothing. */
  hyperfocusGuard: GuardrailMultiple;
  setHyperfocusGuard: (v: GuardrailMultiple) => void;
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
      windowStartMin: null,
      windowEndMin: null,
      setFocusWindow: (startMin, endMin) =>
        set({ windowStartMin: clampDayEndMin(startMin), windowEndMin: clampDayEndMin(endMin) }),
      hyperfocusGuard: DEFAULT_GUARDRAIL,
      setHyperfocusGuard: (hyperfocusGuard) => set({ hyperfocusGuard }),
      reset: () =>
        set({
          colorMode: 'system',
          remindersEnabled: false,
          dailyRitualEnabled: false,
          dayEndMin: DEFAULT_DAY_END_MIN,
          windowStartMin: null,
          windowEndMin: null,
          hyperfocusGuard: DEFAULT_GUARDRAIL,
        }),
    }),
    { name: 'settings', storage: createJSONStorage(() => zustandKv) },
  ),
);
