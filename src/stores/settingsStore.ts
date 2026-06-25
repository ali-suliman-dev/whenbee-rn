import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandKv } from '@/src/lib/kv';
import { DEFAULT_DAY_END_MIN, DEFAULT_GUARDRAIL } from '@/src/engine/constants';
import type { GuardrailMultiple } from '@/src/domain/types';
import type { QuietHours } from '@/src/lib/notifyTiming';

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
  /** Per-type ping toggles, shown only when reminders are on. Default on. */
  honestReachedEnabled: boolean;
  setHonestReachedEnabled: (v: boolean) => void;
  startByEnabled: boolean;
  setStartByEnabled: (v: boolean) => void;
  /** Quiet window for gentle pings (guard, review). Time-sensitive pings ignore it. */
  quietHours: QuietHours;
  setQuietHours: (q: QuietHours) => void;
  /** Notification sound choice. 'honey' maps to the system sound until the asset ships. */
  notificationSound: 'honey' | 'default' | 'none';
  setNotificationSound: (v: 'honey' | 'default' | 'none') => void;
  /** Gentle "one honest thing a day" line on Today. Off by default; no streak, no guilt. */
  dailyRitualEnabled: boolean;
  setDailyRitualEnabled: (v: boolean) => void;
  /** Optional nickname for greetings/companion lines. No name = greeting only. */
  displayName?: string;
  setDisplayName: (name: string | undefined) => void;
  /** Provisional archetype seed from the onboarding quiz; washes out as data grows. */
  archetypeSeed?: { m0: number; source: 'quiz'; tookAt: number };
  setArchetypeSeed: (seed: { m0: number; source: 'quiz'; tookAt: number }) => void;
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
  /** True once the user manually dragged/set the focus window — suppresses
   *  auto-learn overrides. False when only the engine has updated it. */
  focusWindowUserSet: boolean;
  /** The start minute the learned window was last written to (mirrors windowStartMin
   *  but kept separately so the engine can detect real shifts vs. confirmation). */
  focusShownStartMin: number | null;
  /** The end minute the learned window was last written to. */
  focusShownEndMin: number | null;
  /** Epoch ms when the focus window was last moved (user or engine). Used for
   *  the hysteresis dwell check — window must have dwelt for FW_DWELL_DAYS. */
  focusLastMoveAtMs: number | null;
  /** Called by the engine hook when the learned window moves. Also writes
   *  through to windowStartMin/EndMin so the packer reads the new window. */
  setLearnedFocusWindow: (startMin: number, endMin: number, atMs: number) => void;
  /** Hyperfocus guardrail multiple of the honest number, or 'off'. Off by default;
   *  the gentle check-in is opt-in and Pro-only. Reads the model, trains nothing. */
  hyperfocusGuard: GuardrailMultiple;
  setHyperfocusGuard: (v: GuardrailMultiple) => void;
  /** Whether the end-of-day feature is active. On by default. */
  dayEndEnabled: boolean;
  setDayEndEnabled: (v: boolean) => void;
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
      honestReachedEnabled: true,
      setHonestReachedEnabled: (honestReachedEnabled) => set({ honestReachedEnabled }),
      startByEnabled: true,
      setStartByEnabled: (startByEnabled) => set({ startByEnabled }),
      quietHours: { enabled: true, startMin: 1260, endMin: 480 },
      setQuietHours: (quietHours) => set({ quietHours }),
      notificationSound: 'default',
      setNotificationSound: (notificationSound) => set({ notificationSound }),
      dailyRitualEnabled: false,
      setDailyRitualEnabled: (dailyRitualEnabled) => set({ dailyRitualEnabled }),
      displayName: undefined,
      setDisplayName: (displayName) => set({ displayName: displayName?.trim() ? displayName.trim() : undefined }),
      archetypeSeed: undefined,
      setArchetypeSeed: (archetypeSeed) => set({ archetypeSeed }),
      dayEndMin: DEFAULT_DAY_END_MIN,
      setDayEndMin: (minutes) => set({ dayEndMin: clampDayEndMin(minutes) }),
      windowStartMin: null,
      windowEndMin: null,
      setFocusWindow: (startMin, endMin) =>
        set({
          windowStartMin: clampDayEndMin(startMin),
          windowEndMin: clampDayEndMin(endMin),
          focusWindowUserSet: true,
        }),
      focusWindowUserSet: false,
      focusShownStartMin: null,
      focusShownEndMin: null,
      focusLastMoveAtMs: null,
      setLearnedFocusWindow: (startMin, endMin, atMs) =>
        set({
          windowStartMin: startMin,
          windowEndMin: endMin,
          focusShownStartMin: startMin,
          focusShownEndMin: endMin,
          focusLastMoveAtMs: atMs,
        }),
      hyperfocusGuard: DEFAULT_GUARDRAIL,
      setHyperfocusGuard: (hyperfocusGuard) => set({ hyperfocusGuard }),
      dayEndEnabled: true,
      setDayEndEnabled: (dayEndEnabled) => set({ dayEndEnabled }),
      reset: () =>
        set({
          colorMode: 'system',
          remindersEnabled: false,
          dailyRitualEnabled: false,
          displayName: undefined,
          archetypeSeed: undefined,
          dayEndMin: DEFAULT_DAY_END_MIN,
          dayEndEnabled: true,
          windowStartMin: null,
          windowEndMin: null,
          hyperfocusGuard: DEFAULT_GUARDRAIL,
          focusWindowUserSet: false,
          focusShownStartMin: null,
          focusShownEndMin: null,
          focusLastMoveAtMs: null,
          honestReachedEnabled: true,
          startByEnabled: true,
          quietHours: { enabled: true, startMin: 1260, endMin: 480 },
          notificationSound: 'default',
        }),
    }),
    { name: 'settings', storage: createJSONStorage(() => zustandKv) },
  ),
);
