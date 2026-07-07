import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandKv } from '@/src/lib/kv';
import {
  DEFAULT_DAY_END_MIN,
  DEFAULT_GUARDRAIL,
  DEFAULT_FORGOT_STEP_IN,
} from '@/src/engine/constants';
import type { GuardrailMultiple, ForgotStepIn } from '@/src/domain/types';
import type { QuietHours } from '@/src/lib/notifyTiming';
import {
  type StripVariant,
  DEFAULT_STRIP_VARIANT,
} from '@/src/features/today/calendarStrip/stripVariant';

export type ColorModePref = 'system' | 'light' | 'dark';

const MINUTES_IN_DAY = 24 * 60;
/** Keep a stored day-end inside [0, 1439]; guards a corrupt KV value or a bad caller. */
const clampDayEndMin = (m: number): number =>
  Number.isFinite(m)
    ? Math.min(MINUTES_IN_DAY - 1, Math.max(0, Math.round(m)))
    : DEFAULT_DAY_END_MIN;

/** Calendar overlay preferences. `enabledCalendarIds` is empty by default — treat
 *  all calendars as enabled until the user narrows the selection.
 *
 *  Export fields (Phase 7):
 *  - `exportEnabled`: when true, Pro users push their planned day to the
 *    app-owned "Whenbee" calendar. Off by default; opt-in only.
 *  - `whenbeeCalendarId`: the native id of the app-owned calendar created by
 *    `ensureWhenbeeCalendar`. Null until the user first enables export.
 */
interface CalendarPrefs {
  showEvents: boolean;
  // empty enabledCalendarIds means treat all calendars as enabled until user narrows the selection
  enabledCalendarIds: string[];
  /** Whether to push the planned day to the Whenbee calendar. Off by default; Pro-only. */
  exportEnabled: boolean;
  /** Native id of the app-owned "Whenbee" calendar. Null until export is first enabled. */
  whenbeeCalendarId: string | null;
}

const DEFAULT_CALENDAR: CalendarPrefs = {
  showEvents: false,
  enabledCalendarIds: [],
  exportEnabled: false,
  whenbeeCalendarId: null,
};

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
  /** "Tap to start again" quick-start chips on Today (repeat tasks you've run before). Off by default. */
  quickStartEnabled: boolean;
  setQuickStartEnabled: (v: boolean) => void;
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
  /** Free forgot-to-stop protection preset — how soon Whenbee steps in. On by
   *  default ('balanced'). Distinct from the Pro hyperfocusGuard. */
  forgotStepIn: ForgotStepIn;
  setForgotStepIn: (v: ForgotStepIn) => void;
  /** True once the auto-close has acted at least once (drives the one-time
   *  contextual explainer). */
  forgotProtectSeen: boolean;
  markForgotProtectSeen: () => void;
  /** Whether the end-of-day feature is active. On by default. */
  dayEndEnabled: boolean;
  setDayEndEnabled: (v: boolean) => void;
  /** Calendar overlay preferences: master toggle + per-calendar filter. */
  calendar: CalendarPrefs;
  /** Master toggle for showing device-calendar events on the day surface. */
  setShowEvents: (showEvents: boolean) => void;
  /** Replace the enabled-calendar list. An empty list means all calendars are enabled. */
  setEnabledCalendars: (ids: string[]) => void;
  /** Toggle a single calendar id in/out of the enabled list. */
  toggleCalendar: (id: string) => void;
  /** Enable or disable pushing the planned day to the Whenbee calendar (Pro-only). */
  setExportEnabled: (enabled: boolean) => void;
  /** Store (or clear) the native id of the app-owned "Whenbee" calendar. */
  setWhenbeeCalendarId: (id: string | null) => void;
  /** TEMP A/B (remove after decision): which calendar-strip design renders.
   *  Lets the founder compare both variants live on-device. See
   *  src/features/today/calendarStrip/stripVariant.ts. */
  stripVariant: StripVariant;
  setStripVariant: (v: StripVariant) => void;
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
      startByEnabled: false,
      setStartByEnabled: (startByEnabled) => set({ startByEnabled }),
      quietHours: { enabled: true, startMin: 1260, endMin: 480 },
      setQuietHours: (quietHours) => set({ quietHours }),
      notificationSound: 'default',
      setNotificationSound: (notificationSound) => set({ notificationSound }),
      dailyRitualEnabled: false,
      setDailyRitualEnabled: (dailyRitualEnabled) => set({ dailyRitualEnabled }),
      quickStartEnabled: false,
      setQuickStartEnabled: (quickStartEnabled) => set({ quickStartEnabled }),
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
      forgotStepIn: DEFAULT_FORGOT_STEP_IN,
      setForgotStepIn: (forgotStepIn) => set({ forgotStepIn }),
      forgotProtectSeen: false,
      markForgotProtectSeen: () => set({ forgotProtectSeen: true }),
      dayEndEnabled: true,
      setDayEndEnabled: (dayEndEnabled) => set({ dayEndEnabled }),
      calendar: DEFAULT_CALENDAR,
      setShowEvents: (showEvents) =>
        set((s) => ({ calendar: { ...s.calendar, showEvents } })),
      setEnabledCalendars: (ids) =>
        set((s) => ({ calendar: { ...s.calendar, enabledCalendarIds: ids } })),
      toggleCalendar: (id) =>
        set((s) => {
          const ids = s.calendar.enabledCalendarIds;
          const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
          return { calendar: { ...s.calendar, enabledCalendarIds: next } };
        }),
      setExportEnabled: (exportEnabled) =>
        set((s) => ({ calendar: { ...s.calendar, exportEnabled } })),
      setWhenbeeCalendarId: (whenbeeCalendarId) =>
        set((s) => ({ calendar: { ...s.calendar, whenbeeCalendarId } })),
      stripVariant: DEFAULT_STRIP_VARIANT,
      setStripVariant: (stripVariant) => set({ stripVariant }),
      reset: () =>
        set({
          colorMode: 'system',
          remindersEnabled: false,
          dailyRitualEnabled: false,
          quickStartEnabled: false,
          displayName: undefined,
          archetypeSeed: undefined,
          dayEndMin: DEFAULT_DAY_END_MIN,
          dayEndEnabled: true,
          windowStartMin: null,
          windowEndMin: null,
          hyperfocusGuard: DEFAULT_GUARDRAIL,
          forgotStepIn: DEFAULT_FORGOT_STEP_IN,
          forgotProtectSeen: false,
          focusWindowUserSet: false,
          focusShownStartMin: null,
          focusShownEndMin: null,
          focusLastMoveAtMs: null,
          calendar: DEFAULT_CALENDAR,
          honestReachedEnabled: true,
          startByEnabled: false,
          quietHours: { enabled: true, startMin: 1260, endMin: 480 },
          notificationSound: 'default',
          stripVariant: DEFAULT_STRIP_VARIANT,
        }),
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => zustandKv),
      // Deep-backfill the calendar slice so that pre-Phase-7 persisted blobs
      // (which only have showEvents/enabledCalendarIds) rehydrate the new export
      // fields as their defaults instead of `undefined`, which would violate the
      // non-optional CalendarPrefs type.
      merge: (persisted, current) => {
        const p = persisted as Partial<SettingsState> | null | undefined;
        return {
          ...current,
          ...(p ?? {}),
          calendar: { ...DEFAULT_CALENDAR, ...(p?.calendar ?? {}) },
        };
      },
    },
  ),
);
