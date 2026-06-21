# Plan — Global "End of day" setting

**Status:** plan · **Owner:** founder · **Date:** 2026-06-21
**Skills applied:** software-architecture, react-native-architecture, react-native-expert, vercel-react-native-skills, clean-code, coding-standards

> Decided 2026-06-21: the day-capacity feature (spec 04) is mostly a re-skin of the
> already-shipped free Start-By planner (`planBackward` + `VerdictCard` + `cutLadder`).
> The only genuinely-new, genuinely-useful piece is a **durable global day-end the user
> sets once**. This plan ships exactly that one thing, surgically, with its own
> read/reuse path, decoupled from the per-plan planner deadline so the two never clash.

---

## 1. Goal (one sentence)

Let the user set a single, durable **end-of-day time** ("I stop by 9:00pm") in Settings,
persisted on-device, and expose a tiny pure helper that turns it into today's day-end
epoch so any surface (a future capacity glance, reminders, etc.) can reuse it — without
touching the planner's per-plan deadline.

## 2. Why this is a setting, not a per-screen control

A day-end is a **stable personal preference** (same lifecycle as `remindersEnabled` /
`colorMode`), not an ephemeral per-task choice:

| | Planner deadline (exists) | Day-end (this plan) |
|---|---|---|
| Lifecycle | per-plan, set each time, cleared | durable, set once, reused daily |
| Home | `planStore` draft / `FinishTimeWheel` | `settingsStore` (KV) |
| Question | "finish *this plan* by when?" | "when does my day end, in general?" |
| Value | one specific deadline | a default the whole app can lean on |

They **must not share a value.** This plan adds an independent `dayEndMin` to
`settingsStore`; it never reads or writes the planner deadline. (KISS + separation of
concerns: one preference, one owner.)

## 3. Scope

**In scope**
- `dayEndMin` preference in `settingsStore` (minutes-after-midnight integer) + setter + reset.
- Pure, clock-free time helpers (`startOfLocalDay`, `dayEndEpochFor`) in `lib/time.ts`, TDD.
- A Settings row + a time-picker editor (reuse `FinishTimeWheel`), no new wheel.
- A named default constant.

**Out of scope (YAGNI — do later if needed)**
- The capacity card / Today strip / verdict UI (spec 04). This plan only lands the
  *setting + reuse seam*; the glance UI is a separate, optional follow-up that consumes
  this seam (sketched in §8, not built here).
- Pro gating. The setting itself is free (see §9). If a consumer surface is Pro, that
  consumer gates itself, not the setting.
- Per-day overrides, multiple windows, locale day-start ≠ midnight.

## 4. Architecture (layer placement)

Follows the one-directional rule (`UI → store → lib/engine`). No layer is skipped, no
`db`/`services` import added.

```
app/settings.tsx                         (UI row + opens editor)
  → useSettingsStore.dayEndMin / setDayEndMin   (store, KV-persisted)
features/settings/useDayEndSetting.ts    (thin hook: value + formatted label + setter)
  → lib/time.ts: startOfLocalDay, dayEndEpochFor   (PURE, clock-free, TDD)
  → engine/constants.ts: DEFAULT_DAY_END_MIN       (single source for the default)
```

- **`dayEndMin` lives in `settingsStore`** (not a new store, not `engine`): it is a user
  preference, and `settingsStore` already owns prefs + the KV persist wiring. Adding a
  field is the smallest correct change (clean-code: don't create a class/store for one int).
- **Time math is pure and clock-free** in `lib/time.ts` (the existing home for
  `formatClock`, `projectedFinish`). The caller passes `nowMs`; the helper never reads
  `Date.now()` itself, so it is deterministic and unit-testable (mirrors the engine's
  clock-free contract and `buildHonestDay`'s `nowMs` pattern).
- **The default constant lives in `engine/constants.ts`** (`DEFAULT_DAY_END_MIN`) so the
  store, the reset, and any consumer read one value — no magic `1260` sprinkled around.

## 5. Data model + store change

`src/engine/constants.ts` — add:

```ts
/** Default end-of-day, minutes after local midnight. 21:00 = a sane "I stop by 9pm". */
export const DEFAULT_DAY_END_MIN = 21 * 60; // 1260
```

`src/stores/settingsStore.ts` — extend `SettingsState` (additive, persisted, reset-aware):

```ts
import { DEFAULT_DAY_END_MIN } from '@/src/engine/constants';

interface SettingsState {
  // ...existing...
  /** End-of-day, minutes after local midnight (0–1439). The durable "my day ends
   *  around here" preference. Independent of any per-plan planner deadline. */
  dayEndMin: number;
  setDayEndMin: (minutes: number) => void;
  reset: () => void;
}

// in create():
dayEndMin: DEFAULT_DAY_END_MIN,
setDayEndMin: (dayEndMin) => set({ dayEndMin: clampDayEndMin(dayEndMin) }),

// reset() — add dayEndMin back to the default alongside the others:
reset: () =>
  set({
    colorMode: 'system',
    remindersEnabled: false,
    dailyRitualEnabled: false,
    dayEndMin: DEFAULT_DAY_END_MIN,
  }),
```

Clamp helper (top of file, module-private, clean-code single-purpose):

```ts
const MINUTES_IN_DAY = 24 * 60;
/** Keep a stored day-end inside [0, 1439]; guards a corrupt KV value or a bad caller. */
const clampDayEndMin = (m: number): number =>
  Number.isFinite(m) ? Math.min(MINUTES_IN_DAY - 1, Math.max(0, Math.round(m))) : DEFAULT_DAY_END_MIN;
```

**Persistence:** none new — `settingsStore` already persists via `zustandKv` under the
`settings` key. `dayEndMin` rides the existing `persist` middleware. New installs get
`DEFAULT_DAY_END_MIN`; existing installs without the field rehydrate to the default
(zustand merges missing keys from the initializer), so **no migration is required.**

## 6. Pure time helpers (TDD first)

`src/lib/time.ts` — add two pure, clock-free helpers (caller supplies `nowMs`):

```ts
/** Epoch ms of local midnight for the day containing `nowMs`. */
export function startOfLocalDay(nowMs: number): number {
  const d = new Date(nowMs);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Epoch ms of today's end-of-day for a `dayEndMin` (minutes after local midnight). */
export function dayEndEpochFor(nowMs: number, dayEndMin: number): number {
  return startOfLocalDay(nowMs) + dayEndMin * 60_000;
}
```

(These supersede the inline `minutesFromMidnight` copy in `buildHonestDay.ts` for new
code; do **not** refactor `buildHonestDay` in this change — leave calendar untouched,
just stop duplicating the pattern going forward. DRY without a risky drive-by edit.)

`src/lib/__tests__/time.test.ts` — add (write first):

| # | Input | Expect |
|---|---|---|
| 1 | `startOfLocalDay(t)` for any `t` | hours/min/sec/ms all 0, same calendar day |
| 2 | `dayEndEpochFor(t, 1260)` | `startOfLocalDay(t) + 1260*60000` (= 21:00 local) |
| 3 | `dayEndEpochFor(t, 0)` | equals `startOfLocalDay(t)` (midnight) |
| 4 | `dayEndEpochFor(t, 1439)` | 23:59 local |
| 5 | DST spring-forward day | helper is pure ms math on the local-midnight anchor; assert it equals `startOfLocalDay + min*60000` (document that wall-clock 21:00 on a 23h day shifts by an hour — acceptable, it is a personal soft boundary, not a scheduling primitive) |

> DST note (react-native-expert / correctness): `setHours(0,0,0,0)` gives the correct
> local midnight; adding `min*60000` is fixed-offset ms. On the two DST days a year the
> rendered wall clock can be ±1h. For a "roughly when my day ends" preference this is
> fine and explicitly accepted; we do **not** add `tz`-library weight for it (YAGNI).

## 7. Settings UI

### 7.1 The row (`app/settings.tsx`)

Reuse the existing `SettingRow` component (already in the file). Place it in the same
group as Reminders / Daily ritual. It navigates (opens the editor), so it uses the
default chevron trailing + a formatted value as the `note`.

```tsx
import { useDayEndSetting } from '@/src/features/settings/useDayEndSetting';

const { label: dayEndLabel, open: openDayEndEditor } = useDayEndSetting();

<SettingRow
  icon="moon-outline"
  title="End of day"
  note={`Your day winds down around ${dayEndLabel}`}
  onPress={openDayEndEditor}
  accessibilityLabel={`End of day, currently ${dayEndLabel}. Tap to change.`}
/>
```

- Icon `moon-outline` (Ionicons) reads as "wind-down", neutral, no alarm.
- `note` shows the current value via `formatClockMeridiem` (e.g. "9:00pm") so the row is
  self-explaining (clean-code: the screen states its own state).
- Copy is plain and no-guilt ("winds down", not "deadline"/"cutoff"). Final string gets a
  `humanizer` + `conversion-psychology` pass at build (project rule) — placeholder above.

### 7.2 The editor (reuse `FinishTimeWheel`, no new wheel)

`FinishTimeWheel` is already the app's HH:MM picker. It currently always renders the mode
chips (`leave by / be done by / be at`), which are irrelevant for a day-end. Add **one
optional, backward-compatible prop** rather than building a second wheel (DRY):

`src/features/planner/FinishTimeWheel.tsx`:

```ts
// new optional prop; default true keeps every existing call site unchanged
showModes?: boolean; // when false, hide the mode chip row (the wheel is a plain time picker)
```

Guard the chip row with `{showModes !== false && <ModeChips .../>}`. No other change.

Editor presentation: a bottom sheet (reuse the app's existing sheet/modal pattern used by
other pickers) opened from the row, containing `<FinishTimeWheel showModes={false} … />`
with a header "When does your day wind down?" and a Done button. On change:

- `FinishTimeWheel` returns an epoch ms on today's calendar day.
- Convert to minutes-after-midnight and persist:
  `setDayEndMin(Math.round((chosenMs - startOfLocalDay(chosenMs)) / 60_000))`.
- No live preview needed; the row updates from the store on dismiss.

> If wiring `FinishTimeWheel` into a standalone sheet proves heavier than expected, the
> fallback is a minimal inline 3-chip quick-set (8pm / 9pm / 10pm) + "custom" — but the
> wheel reuse is preferred for parity with the planner. Decide at build (open Q1).

### 7.3 The hook (`src/features/settings/useDayEndSetting.ts`)

Thin view-model so `settings.tsx` stays declarative and the formatting/logic lives in one
testable place (mirrors `useReminderSetting.ts`).

```ts
import { useCallback, useMemo, useState } from 'react';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { dayEndEpochFor, formatClockMeridiem, startOfLocalDay } from '@/src/lib/time';

export function useDayEndSetting() {
  const dayEndMin = useSettingsStore((s) => s.dayEndMin);
  const setDayEndMin = useSettingsStore((s) => s.setDayEndMin);
  const [editing, setEditing] = useState(false);

  const label = useMemo(() => formatClockMeridiem(dayEndEpochFor(Date.now(), dayEndMin)), [dayEndMin]);

  const commit = useCallback(
    (chosenMs: number) => {
      setDayEndMin(Math.round((chosenMs - startOfLocalDay(chosenMs)) / 60_000));
      setEditing(false);
    },
    [setDayEndMin],
  );

  return { dayEndMin, label, editing, open: () => setEditing(true), close: () => setEditing(false), commit };
}
```

- `Date.now()` is read in the **hook (UI layer)**, where clock access is allowed; the pure
  helpers stay clock-free. (Layer rule honored.)
- Minimal store subscription — selects only `dayEndMin` + the setter, not the whole store
  (vercel-react-native-skills: `react-state-minimize`).

## 8. Consumer seam (sketch only — not built in this change)

The whole point of the setting is reuse. A future capacity glance consumes it like this,
**without rebuilding any verdict math and without touching `planStore`:**

```ts
// future: features/today/useDayFit.ts (NOT in this plan's scope)
const dayEndMin = useSettingsStore((s) => s.dayEndMin);
const deadline = dayEndEpochFor(Date.now(), dayEndMin);
const result = planBackward({ deadline, tasks: honestTasks, nowMs: Date.now() });
// result.verdict → 'fits' | 'cut-one' | 'multi-cut' | 'push-deadline' (already built)
```

This documents the intended reuse so the setting is not orphaned, and proves the
decoupling: the consumer reads `dayEndMin` + `planBackward` only; it never reads or writes
the planner's own deadline. Building that glance (and deciding if it is free or Pro) is a
separate task.

## 9. Free vs Pro

**The setting is free.** It is configuration, not a payoff. It also powers free surfaces
(reminders, the existing planner if a user wants to set the deadline to their day-end). A
*consumer* surface may be Pro, but it gates itself; the preference stays free so we never
gate a knob the user needs (and never invite the "pay to configure your own app" reaction
the product docs warn about).

## 10. Edge cases & guardrails

- **Corrupt/out-of-range KV value:** `clampDayEndMin` forces `[0, 1439]`, falls back to
  the default on `NaN`/`Infinity`.
- **dayEndMin = 0 (midnight):** valid; `dayEndEpochFor` returns local midnight. A consumer
  treating "now past day-end" is that consumer's concern, not the setting's.
- **No migration:** missing field on existing installs rehydrates to `DEFAULT_DAY_END_MIN`
  via the zustand initializer merge. Verified by not relying on the persisted blob having
  the key.
- **DST:** documented in §6; accepted ±1h on two days/year, no tz dependency added.
- **Reset path:** `settingsStore.reset()` restores the default (wired in §5) so the full
  data-reset flow stays correct.
- **No-guilt:** copy frames it as "winds down", never "cutoff/deadline/behind"; the setting
  itself produces no nudge.
- **Privacy / on-device:** one integer in KV; no network, no calendar, no PII.

## 11. Build manifest

**Add**
| File | What | Size |
|---|---|---|
| `src/features/settings/useDayEndSetting.ts` | view-model hook (label + commit + editing) | S |
| `src/lib/__tests__/time.test.ts` (extend) | `startOfLocalDay` + `dayEndEpochFor` cases (§6) — write first | S |
| `src/features/settings/__tests__/useDayEndSetting.test.ts` | label formatting + commit→minutes conversion | S |

**Edit**
| File | Change | Size |
|---|---|---|
| `src/engine/constants.ts` | add `DEFAULT_DAY_END_MIN` | XS |
| `src/lib/time.ts` | add `startOfLocalDay`, `dayEndEpochFor` | XS |
| `src/stores/settingsStore.ts` | add `dayEndMin` + `setDayEndMin` + `clampDayEndMin` + reset | S |
| `src/features/planner/FinishTimeWheel.tsx` | add optional `showModes` prop (default true) | XS |
| `app/settings.tsx` | add the "End of day" row + mount the editor sheet | S |
| `src/stores/__tests__/settingsStore.test.ts` (if present) | cover default + clamp + reset | S |

**Total effort:** **S** (≈ half a day). No new deps, no native module, no DB migration,
no calendar.

## 12. Validation (before opening PR)

1. `npx jest src/lib/__tests__/time.test.ts src/features/settings/__tests__/useDayEndSetting.test.ts` — green, written first.
2. `npx eslint src/lib/time.ts src/stores/settingsStore.ts src/features/settings/useDayEndSetting.ts app/settings.tsx src/features/planner/FinishTimeWheel.tsx src/engine/constants.ts` — 0 warnings.
3. `npm run typecheck` — clean (note: `noUncheckedIndexedAccess` on; no indexed access added here).
4. Sim check (`npm run ios`): Settings shows "End of day · 9:00pm"; tap → wheel (no mode chips) → pick 10:00pm → row reads "10:00pm"; kill + relaunch → still 10:00pm; data-reset → back to 9:00pm.

## 13. Open questions

1. **Editor surface:** `FinishTimeWheel` in a sheet (preferred, parity) vs a 3-chip
   quick-set + custom. Pick on the sim.
2. **Row copy:** "End of day" vs "When your day ends" vs "Wind-down time" — final string
   through `humanizer` + `conversion-psychology` at build.
3. **Icon:** `moon-outline` vs `time-outline`. Founder call from the rendered row.
