# Planning Expansion — Phase 3: Capacity (Honest Day) + Calendar Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.
>
> **Branch off Phase 2** (`feat/planning-today-surface`, PR #47) — consumes `dayTasksStore` (selectedDate, dayTasks), the calendar strip, `resolveHonestTasks`, `tokens`, and the existing `src/services/calendar.ts` + `src/features/calendar/`.

**Goal:** Give each selected day an **Honest Day capacity read** — "your real day is Xh, you have ~Yh" — computed (pure) from the day's planned tasks' honest minutes PLUS the day's read-only device-calendar events (all-day excluded), surfaced as a quiet collapsible **Pro** chip on Today, with a read-only calendar overlay and per-calendar settings. Unifies the existing calendar-only "Honest Day" under this surface.

**Architecture:** A new pure engine fn `honestDayLoad` sums task + event minutes vs a waking window and returns an amber-only verdict. The existing `src/services/calendar.ts` is extended (per-day events, `allDay`/`calendarId`, list calendars). A `useDayCapacity` hook resolves tasks (reuse `resolveHonestTasks`) + reads the day's events (respecting settings) and calls the engine. A `CapacityChip` renders collapsed/expanded, Pro-gated (free → paywall teaser). The existing buffer-write "Honest Day" modal is reached from the expanded chip ("Make my day honest").

**Tech Stack:** TypeScript (strict), Zustand, expo-calendar (guarded by `isExpoGo`), Reanimated, Jest. Spec: `docs/product/specs/2026-06-24-planning-calendar-expansion-design.md` §5.1, §8.1, §9.1, §10. Phase-1/2 modules: `dayTasksStore`, `resolveHonestTasks`, `src/services/calendar.ts`, `src/features/calendar/*`, `src/lib/day.ts`, `src/engine/constants.ts`.

## Global Constraints

- **Engine pure.** `honestDayLoad` lives in `src/engine/`, no Date/IO; caller passes minutes + window. Tuning in `src/engine/constants.ts`.
- **No-guilt.** Verdict is amber-only (`comfortable` / `snug` / `over`) — `over` is a calm fact + an offer to move, NEVER red, NEVER "behind/failed". Capacity NEVER appears as a droppable hero ring (honey ring stays). Empty day = neutral.
- **Calendar trust model (do not weaken).** READ-only here. NO write except the existing `writeAdjustments` (only from the Honest-Day confirm handler). All-day events are EXCLUDED from the capacity math and shown separately. Per-calendar visibility + a master "show events" toggle gate the overlay. `isExpoGo` guard returns deterministic mock events.
- **Pro gating.** The capacity number + breakdown + event overlay are Pro. Free users see a frosted teaser line → paywall (`trigger`), NEVER a real or fake number; gate the POSITION too (no leaking the value via layout). Pricing/entitlement via `useEntitlement` / `ProGate` (never hardcode).
- **Tokens only** via `useTheme`; new token group → matching `useTheme` line. **Animation rule** (no bounce/translate-in; entering-only; reduced-motion → final). **reactCompiler Pressable** gotcha (visual style on inner View). **Layer rule** (app/components don't import db/services directly — go through a store/hook).
- TS strict + noUncheckedIndexedAccess. Conventional Commits; NO AI/co-author attribution (HARD RULE). Before each commit: `npx eslint <files>` (0 warnings), `npm run typecheck`, relevant `npx jest`; full suite green at task end.

---

## Section A — Engine + data

### Task A1: `honestDayLoad` pure engine

**Files:** Create `src/engine/honestDayLoad.ts`; export from `src/engine/index.ts`; tune in `src/engine/constants.ts`; Test `src/engine/__tests__/honestDayLoad.test.ts`.

**Interfaces:**
- Produces:
  - `interface DayLoadInput { taskHonestMins: readonly number[]; eventTimedMins: readonly number[]; wakingWindowMin: number }`
  - `interface DayLoadResult { taskMin: number; eventMin: number; committedMin: number; freeMin: number; verdict: 'comfortable' | 'snug' | 'over'; overByMin: number }`
  - `honestDayLoad(input: DayLoadInput): DayLoadResult`

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/__tests__/honestDayLoad.test.ts
import { honestDayLoad } from '@/src/engine';

test('sums tasks + events; free = window − events', () => {
  const r = honestDayLoad({ taskHonestMins: [100, 35], eventTimedMins: [60], wakingWindowMin: 600 });
  expect(r.taskMin).toBe(135);
  expect(r.eventMin).toBe(60);
  expect(r.committedMin).toBe(195);
  expect(r.freeMin).toBe(540); // 600 − 60
  expect(r.verdict).toBe('comfortable'); // 195 < 0.8*540
  expect(r.overByMin).toBe(0);
});

test('snug when committed ≤ window but near it', () => {
  const r = honestDayLoad({ taskHonestMins: [500], eventTimedMins: [60], wakingWindowMin: 600 });
  // committed 560 ≤ 600 window; free 540; 560 > 0.8*540 → snug
  expect(r.verdict).toBe('snug');
  expect(r.overByMin).toBe(0);
});

test('over when committed exceeds the window — amber, never negative free', () => {
  const r = honestDayLoad({ taskHonestMins: [600, 120], eventTimedMins: [180], wakingWindowMin: 600 });
  expect(r.verdict).toBe('over');
  expect(r.overByMin).toBe(300); // 900 − 600
  expect(r.freeMin).toBe(420); // 600 − 180, never below 0
});

test('empty day is comfortable, zeros', () => {
  const r = honestDayLoad({ taskHonestMins: [], eventTimedMins: [], wakingWindowMin: 600 });
  expect(r).toMatchObject({ taskMin: 0, eventMin: 0, committedMin: 0, verdict: 'comfortable', overByMin: 0 });
});
```

- [ ] **Step 2: Run, confirm fail.**

- [ ] **Step 3: Implement**

Add to `src/engine/constants.ts`:
```ts
// Day-capacity (honestDayLoad) thresholds. `snugFrac` = fraction of free time at/above
// which the day reads 'snug' (still fits). Amber-only — 'over' is never red/guilt.
export const DAY_LOAD = { snugFrac: 0.8 } as const;
```

```ts
// src/engine/honestDayLoad.ts
// PURE. The day-capacity read: Σ task honest minutes + Σ timed event minutes vs the
// waking window. Amber-only verdict — 'over' is a calm fact (offer to move), never red.
import { DAY_LOAD } from './constants';

export interface DayLoadInput {
  taskHonestMins: readonly number[];
  eventTimedMins: readonly number[]; // all-day events excluded by the caller
  wakingWindowMin: number;
}
export interface DayLoadResult {
  taskMin: number;
  eventMin: number;
  committedMin: number;
  freeMin: number;
  verdict: 'comfortable' | 'snug' | 'over';
  overByMin: number;
}

const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);

export function honestDayLoad({ taskHonestMins, eventTimedMins, wakingWindowMin }: DayLoadInput): DayLoadResult {
  const taskMin = sum(taskHonestMins);
  const eventMin = sum(eventTimedMins);
  const committedMin = taskMin + eventMin;
  const freeMin = Math.max(0, wakingWindowMin - eventMin);
  let verdict: DayLoadResult['verdict'];
  if (committedMin > wakingWindowMin) verdict = 'over';
  else if (committedMin > DAY_LOAD.snugFrac * freeMin) verdict = 'snug';
  else verdict = 'comfortable';
  const overByMin = Math.max(0, committedMin - wakingWindowMin);
  return { taskMin, eventMin, committedMin, freeMin, verdict, overByMin };
}
```
Add to `src/engine/index.ts`: `export { honestDayLoad, type DayLoadInput, type DayLoadResult } from './honestDayLoad';`

- [ ] **Step 4: Run, confirm pass (4 tests).**
- [ ] **Step 5:** eslint + typecheck + commit `feat(engine): honestDayLoad day-capacity (amber-only verdict)`.

### Task A2: Calendar service — per-day events, all-day flag, calendar list

**Files:** Modify `src/services/calendar.ts`; Test `src/services/__tests__/calendar.test.ts` (extend or create — test the stub via `resolveCalendarModule(true, …)`).

**Interfaces:**
- `CalendarEvent` gains: `allDay: boolean; calendarId: string`.
- `CalendarModule` gains:
  - `getEventsForDay(dayKey: string, calendarIds?: readonly string[]): Promise<CalendarEvent[]>` — events whose local day == dayKey; optional per-calendar filter.
  - `listCalendars(): Promise<{ id: string; title: string }[]>`.
  - Keep `getTodaysEvents` (reimplement it via `getEventsForDay(toLocalDayKey(nowMs))`).

- [ ] **Step 1: Write the failing test** (stub path; `getEventsForDay` returns the mock set for a given day; mock events carry `allDay:false` + a `calendarId`; `listCalendars` returns the mock calendar).
- [ ] **Step 2: Run, confirm fail.**
- [ ] **Step 3: Implement.** Extend `CalendarEvent` + mock (`allDay:false`, `calendarId:'mock-cal'`) + stub `getEventsForDay`/`listCalendars`. In `createNative`: `getEventsForDay(dayKey, calendarIds?)` builds local-day bounds from the key (parse 'YYYY-MM-DD' → local midnight..next), filters to `calendarIds` if given, maps `allDay` from the native event's `allDay`, sets `calendarId`. `listCalendars` → `Calendar.getCalendarsAsync(EVENT).map(c => ({id, title}))`. Keep the trust-model header comment + the no-write rule.
- [ ] **Step 4: Run, confirm pass.**
- [ ] **Step 5:** eslint + typecheck + commit `feat(calendar): per-day events + all-day flag + list calendars`.

### Task A3: Settings — calendar group

**Files:** Modify `src/stores/settingsStore.ts` (read it first to match its persist pattern); Test extend its test.

**Interfaces:**
- Adds to settings state: `calendar: { showEvents: boolean; enabledCalendarIds: string[] }` with actions `setShowEvents(b)`, `setEnabledCalendars(ids)`. Default `showEvents:false` (opt-in; first capacity use prompts), `enabledCalendarIds:[]` (empty = all enabled until the user narrows — document the convention).

- [ ] TDD: test the new state + actions persist. Implement following the store's existing slice pattern (mind the `zustandKv` rehydrate-in-create gotcha — set flags via captured `state` in `onRehydrateStorage`, never the store const). Commit `feat(settings): calendar overlay preferences`.

### Task A4: `useDayCapacity` hook

**Files:** Create `src/features/today/useDayCapacity.ts`; Test `…/__tests__/useDayCapacity.test.ts`.

**Interfaces:**
- Consumes: `dayTasksStore` (dayTasks of the selected day, selectedDate), `resolveHonestTasks` (task→honest minutes), `getCalendar().getEventsForDay`, `settingsStore.calendar`, `useCalibrationStore` (stats), `useEntitlement` (isPro), `honestDayLoad` (A1), `src/lib/day`.
- Produces: `useDayCapacity(nowMs?): { status: 'loading'|'denied'|'off'|'ready'; load: DayLoadResult | null; events: CalendarEvent[]; allDayEvents: CalendarEvent[]; isPro: boolean }`.
  - Resolves the day's QUEUED tasks → honest minutes (reuse the same resolver the focus card uses).
  - If `settings.calendar.showEvents` and read access granted: `getEventsForDay(selectedDate, enabledCalendarIds || undefined)`; split timed vs all-day; timed event durations (min) feed `honestDayLoad`. If `showEvents` off → `events:[]`, status `off`-ish (still compute task-only load). If access denied → status 'denied', task-only load.
  - `wakingWindowMin` from a constant (e.g. 08:00–22:00 = 840) — put in `src/engine/constants.ts` (`WAKING_WINDOW_MIN`).

- [ ] TDD with a mocked calendar module (stub) + seeded dayTasks: assert `load` sums tasks (+ events when on), `allDayEvents` excluded from `load.eventMin`, `denied`/`off` paths. Commit `feat(today): useDayCapacity (tasks + calendar overlay → honestDayLoad)`.

---

## Section B — Capacity chip + overlay on Today

### Task B1: `CapacityChip` component

**Files:** Create `src/features/today/CapacityChip.tsx`; Test `…/__tests__/CapacityChip.test.tsx`.
**MANDATORY skills:** `react-native-expert`, `ui-design:react-native-design`, `ui-design:visual-design-foundations`, `ui-design:interaction-design`, `conversion-psychology`, `humanizer`, `clean-code`.

**Interfaces:**
- Consumes: `useDayCapacity`, `useEntitlement`, `useTheme`.
- Behavior:
  - **Pro, ready:** collapsed = a quiet single-line chip on `surfaceSunken`: `⚡ Honest day {Xh Ym} · {fits|snug|~Nh heavy}`. Tap → expand IN PLACE to a thin two-segment bar (tasks vs events) + legend (`tasks Xh Ym`, `meetings Yh Zm`) + free hours; `over` → amber tint + "~{N}h heavy — move one?" (no red). A × dismisses for the session (no nag). Expanded offers a quiet "Make my day honest" link → `/(modals)/honest-day` (the existing buffer-write Pro surface).
  - **Free:** a frosted teaser line "See if {day} will fit" + a small "Pro" pill → `router.push('/(modals)/paywall', { trigger: 'day_capacity' })`. NEVER a number, NEVER the bar (gate the position too).
  - **denied/off (Pro):** collapsed line offering to turn on calendar in Settings (calm), capacity still shows task-only load.
  - Disclosure ≤ 2 levels; reduced-motion → instant; tokens only (add `tokens` if needed + useTheme line). reactCompiler Pressable gotcha.
- [ ] Render tests: Pro-ready shows the verdict word + expands on press; free shows the teaser + no number (assert the number text is absent); over → "move" copy, no "overdue"/red. Commit `feat(today): capacity (Honest Day) chip — collapsed/expanded, Pro-gated`.

### Task B2: Mount the chip + day's read-only event overlay

**Files:** Modify `src/app/(tabs)/index.tsx`; create `src/features/today/CalendarOverlaySection.tsx` (+ test).
- [ ] Mount `<CapacityChip />` between the calendar strip and the focus hero (the discreet density slot). Only on today/future days (not past — past shows the recap). 
- [ ] `CalendarOverlaySection`: when Pro + `showEvents` + events exist for the selected day, render a quiet read-only "Calendar" group — timed events as greyed rows (title + clock range), tap → open in the device calendar (a deep link / `Linking` to `calshow:` is acceptable; if not feasible, no-op tap is fine for Phase 3 — note it); all-day events in a separate quiet sub-row, excluded from the capacity math. Mount beneath the task list. Free users don't see it. Tokens only; clearly non-interactive (read-only) styling. Commit `feat(today): read-only calendar overlay for the selected day`.

---

## Section C — Settings UI + unify

### Task C1: Calendar settings section

**Files:** Modify the settings screen (`src/app/settings.tsx` or its feature dir — read it first) + a `CalendarSettingsSection` component (+ test).
- [ ] A "Calendar" section: a master "Show calendar events" toggle (`settings.calendar.showEvents`), and when on + access granted, a per-calendar list (from `getCalendar().listCalendars()`) with checkboxes writing `enabledCalendarIds`. Requests read access on first enable. Calm copy (conversion-psychology + humanizer). Tokens only. Commit `feat(settings): calendar overlay controls (master toggle + per-calendar)`.

### Task C2: Unify naming + copy pass + Pro-gate audit

**Files:** across Phase-3 surfaces.
- [ ] Ensure the capacity chip is the primary "Honest Day" surface and the existing `/(modals)/honest-day` (buffer write) is reached from the expanded chip ("Make my day honest"), not a stray entry. Reconcile copy so there aren't two competing "Honest Day" names (the chip = the read; the modal = "make it honest" write). Run all new strings through conversion-psychology + humanizer (no guilt). **Pro-gate leak audit:** confirm free users never see the number OR its position (the bar/segments must not render); regression-test the free path. Verify reduced-motion + a11y labels (chip expand state, event rows as read-only). Note sim screenshot verification pending. Commit `style(today): unify Honest Day naming + capacity copy/gate audit`.

---

## Self-Review

**Spec coverage:** §5.1 honestDayLoad → A1; §8.1 read-only overlay + per-calendar/master toggle + all-day excluded → A2, A3, B2, C1; §9.1 capacity chip (collapsed/expanded, Pro teaser) → B1, B2; unify Honest Day → C2; §10 gating → B1, C2. ✅ Out of scope (deferred): Plan-my-day/Timeline + event anchors (Phase 4), export (Phase 7), focus chip (Phase 5).

**Placeholder scan:** A1/A2 carry full code; A3/A4/B/C specify interface + behavior + test intent (UI + store-pattern tasks read the existing file first). The `calshow:` deep-link is flagged as best-effort with a no-op fallback. Decisions named inline (waking window constant; enabledCalendarIds empty = all).

**Type consistency:** `DayLoadResult`/`DayLoadInput` (A1) consumed by A4/B1; `CalendarEvent` gains `allDay`/`calendarId` (A2) used by A4/B2; `useDayCapacity` return shape used by B1/B2.

---

## Execution Handoff

Subagent-driven in a worktree branched off `feat/planning-today-surface`, PR at the end (never merge). Two gates remain yours: on-device **calendar permission + real events** verification, and **visual** verification of the chip/overlay.
