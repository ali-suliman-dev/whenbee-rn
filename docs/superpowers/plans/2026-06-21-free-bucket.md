# Free Bucket Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the only net-new feature in the "free" bucket — a durable global **End of day** setting — and confirm the rest of the free bucket (already shipped) is intact.

**Architecture:** Add one preference (`dayEndMin`, minutes-after-midnight) to the existing `settingsStore` (KV-persisted, no migration). Two pure clock-free helpers in `lib/time.ts` convert it to today's day-end epoch. A thin feature hook formats it; the Settings screen edits it by reusing the existing `FinishTimeWheel`. No new deps, no native module, no DB change. Design rationale lives in `docs/plans/day-end-setting.md`.

**Tech Stack:** Expo SDK 54, React Native 0.81 (Fabric), TypeScript (strict + `noUncheckedIndexedAccess`), Zustand + `persist`/`zustandKv`, Reanimated, Jest. Flat ESLint config (`eslint.config.js`).

## Global Constraints

- **Theming:** every spacing/size/font/color is a token from `src/theme/tokens.ts` via `useTheme()`. No raw numbers/hex. (No new tokens needed here — reuse `SettingRow`.)
- **No magic numbers:** the default day-end lives once as `DEFAULT_DAY_END_MIN` in `src/engine/constants.ts` (= `21 * 60`). Nothing else hardcodes `1260`.
- **Engine/lib purity:** `lib/time.ts` helpers are pure and clock-free — the caller passes `nowMs`. `Date.now()` is read only in the UI/hook layer.
- **Layer rule:** `src/app/**` and `src/components/**` never import `src/services/*` or `src/db/*`. Route through the store/hook.
- **No-guilt copy:** frame as "winds down", never "deadline/cutoff/behind". Final strings get a `humanizer` + `conversion-psychology` pass at build.
- **Commits:** Conventional Commits, no AI/co-author trailers (project HARD RULE). Use plain `git` (the `/init-cmt` interactive gate stalls автonomous runs).
- **Verify before done:** `npm run lint` (0 warnings), `npm run typecheck`, `npx jest <touched>` all green before the final commit. Never merge — open a PR, founder merges.

---

## Already shipped — verify only, do NOT rebuild

These free-bucket items exist in `src/`. Confirm they still render/pass; build nothing.

- [ ] **Honest point number + core loop** — `src/features/shared/HonestSuggestionCard.tsx`, engine. Verify the point number shows for a non-Pro user.
- [ ] **Calibration trend / tier / aha / WeeklyReview** — `src/features/category-detail/*`, `src/features/patterns/WeeklyReview.tsx` (wired in `src/app/(tabs)/patterns.tsx`). Verify they render free.
- [ ] **Recent 30-day history + receipts** — `TrendChart.tsx` ("Last 30 days" pill), `RecentList.tsx`. Verify free.
- [ ] **Static widget + minimal Live Activity** — `modules/whenbee-presence/`, `targets/widget/`, `src/services/liveActivity.ts`. Code present; device verification is its own task (out of scope here).
- [ ] **Fast task entry (arc + chips + capture-at-stop)** — `src/features/quick-tasks/`, `src/features/voice/`, `QuickActionArc.tsx`. In progress on the current branch; finishing it is tracked separately, not in this plan.
- [ ] **Start-By planner (fits/over/cut)** — `src/engine/planner.ts`, `VerdictCard.tsx`. Verify free.

Everything below is the actual build: the **End of day** setting.

---

### Task 1: Pure time helpers (`startOfLocalDay`, `dayEndEpochFor`)

**Files:**
- Modify: `src/lib/time.ts`
- Test: `src/lib/__tests__/time.test.ts`

**Interfaces:**
- Produces:
  - `startOfLocalDay(nowMs: number): number` — epoch ms of local midnight for `nowMs`'s day.
  - `dayEndEpochFor(nowMs: number, dayEndMin: number): number` — epoch ms of today's end-of-day.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/__tests__/time.test.ts` (create the file with this content if it does not exist; if it exists, add the `describe` block and the import):

```ts
import { startOfLocalDay, dayEndEpochFor } from '../time';

describe('startOfLocalDay', () => {
  it('returns local midnight of the same calendar day', () => {
    const noon = new Date(2026, 5, 21, 12, 34, 56, 789).getTime(); // 21 Jun 2026, local
    const midnight = startOfLocalDay(noon);
    const d = new Date(midnight);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
    expect(d.getMilliseconds()).toBe(0);
    expect(d.getDate()).toBe(21);
  });
});

describe('dayEndEpochFor', () => {
  const noon = new Date(2026, 5, 21, 12, 0, 0, 0).getTime();
  it('places the day-end at the given minutes after local midnight (21:00)', () => {
    expect(dayEndEpochFor(noon, 21 * 60)).toBe(startOfLocalDay(noon) + 21 * 60 * 60_000);
  });
  it('0 minutes equals local midnight', () => {
    expect(dayEndEpochFor(noon, 0)).toBe(startOfLocalDay(noon));
  });
  it('1439 minutes equals 23:59 local', () => {
    expect(dayEndEpochFor(noon, 1439)).toBe(startOfLocalDay(noon) + 1439 * 60_000);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/lib/__tests__/time.test.ts`
Expected: FAIL — `startOfLocalDay`/`dayEndEpochFor` are not exported.

- [ ] **Step 3: Implement the helpers**

Add to `src/lib/time.ts` (near the other epoch helpers like `projectedFinish`):

```ts
/** Epoch ms of local midnight for the day containing `nowMs`. Pure (no Date.now). */
export function startOfLocalDay(nowMs: number): number {
  const d = new Date(nowMs);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Epoch ms of today's end-of-day for `dayEndMin` (minutes after local midnight). */
export function dayEndEpochFor(nowMs: number, dayEndMin: number): number {
  return startOfLocalDay(nowMs) + dayEndMin * 60_000;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/lib/__tests__/time.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/time.ts src/lib/__tests__/time.test.ts
git commit -m "feat(time): add startOfLocalDay and dayEndEpochFor helpers"
```

---

### Task 2: `dayEndMin` preference in `settingsStore`

**Files:**
- Modify: `src/engine/constants.ts`
- Modify: `src/stores/settingsStore.ts`
- Test: `src/stores/__tests__/settingsStore.test.ts`

**Interfaces:**
- Consumes: `DEFAULT_DAY_END_MIN` (added this task).
- Produces:
  - `DEFAULT_DAY_END_MIN: number` (= 1260) in `src/engine/constants.ts`.
  - `useSettingsStore` state gains `dayEndMin: number` + `setDayEndMin: (minutes: number) => void`; `reset()` restores `dayEndMin` to the default.

- [ ] **Step 1: Write the failing tests**

Create `src/stores/__tests__/settingsStore.test.ts` (if a settings store test already exists, add this `describe` block to it instead):

```ts
import { useSettingsStore } from '../settingsStore';
import { DEFAULT_DAY_END_MIN } from '@/src/engine/constants';

describe('settingsStore dayEndMin', () => {
  beforeEach(() => useSettingsStore.getState().reset());

  it('defaults to DEFAULT_DAY_END_MIN', () => {
    expect(useSettingsStore.getState().dayEndMin).toBe(DEFAULT_DAY_END_MIN);
  });

  it('setDayEndMin stores a valid in-range value', () => {
    useSettingsStore.getState().setDayEndMin(22 * 60);
    expect(useSettingsStore.getState().dayEndMin).toBe(22 * 60);
  });

  it('clamps below 0 to 0 and above 1439 to 1439', () => {
    useSettingsStore.getState().setDayEndMin(-5);
    expect(useSettingsStore.getState().dayEndMin).toBe(0);
    useSettingsStore.getState().setDayEndMin(99999);
    expect(useSettingsStore.getState().dayEndMin).toBe(1439);
  });

  it('falls back to the default on a non-finite value', () => {
    useSettingsStore.getState().setDayEndMin(Number.NaN);
    expect(useSettingsStore.getState().dayEndMin).toBe(DEFAULT_DAY_END_MIN);
  });

  it('reset restores the default', () => {
    useSettingsStore.getState().setDayEndMin(8 * 60);
    useSettingsStore.getState().reset();
    expect(useSettingsStore.getState().dayEndMin).toBe(DEFAULT_DAY_END_MIN);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/stores/__tests__/settingsStore.test.ts`
Expected: FAIL — `dayEndMin`/`setDayEndMin` undefined and `DEFAULT_DAY_END_MIN` not exported.

- [ ] **Step 3: Add the constant**

Add to `src/engine/constants.ts`:

```ts
/** Default end-of-day, minutes after local midnight. 21:00 = a sane "I stop by 9pm". */
export const DEFAULT_DAY_END_MIN = 21 * 60; // 1260
```

- [ ] **Step 4: Extend the store**

Edit `src/stores/settingsStore.ts`:

```ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandKv } from '@/src/lib/kv';
import { DEFAULT_DAY_END_MIN } from '@/src/engine/constants';

export type ColorModePref = 'system' | 'light' | 'dark';

const MINUTES_IN_DAY = 24 * 60;
/** Keep a stored day-end inside [0, 1439]; guards a corrupt KV value or a bad caller. */
const clampDayEndMin = (m: number): number =>
  Number.isFinite(m) ? Math.min(MINUTES_IN_DAY - 1, Math.max(0, Math.round(m))) : DEFAULT_DAY_END_MIN;

interface SettingsState {
  colorMode: ColorModePref;
  setColorMode: (m: ColorModePref) => void;
  remindersEnabled: boolean;
  setRemindersEnabled: (v: boolean) => void;
  dailyRitualEnabled: boolean;
  setDailyRitualEnabled: (v: boolean) => void;
  /** End-of-day, minutes after local midnight (0–1439). Durable, set once, reused
   *  daily. Independent of any per-plan planner deadline. */
  dayEndMin: number;
  setDayEndMin: (minutes: number) => void;
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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest src/stores/__tests__/settingsStore.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/constants.ts src/stores/settingsStore.ts src/stores/__tests__/settingsStore.test.ts
git commit -m "feat(settings): add durable dayEndMin preference"
```

---

### Task 3: `useDayEndSetting` view-model hook

**Files:**
- Create: `src/features/settings/useDayEndSetting.ts`
- Test: `src/features/settings/__tests__/useDayEndSetting.test.ts`

**Interfaces:**
- Consumes: `useSettingsStore` (`dayEndMin`, `setDayEndMin`), `dayEndEpochFor`/`startOfLocalDay`/`formatClockMeridiem` from `lib/time`.
- Produces: `useDayEndSetting()` returning `{ dayEndMin, label, editing, open(), close(), commit(chosenMs) }`.
  - `label: string` — current day-end as a meridiem clock (e.g. `"9:00pm"`).
  - `commit(chosenMs: number)` — converts an epoch-on-today to minutes-after-midnight, persists, closes the editor.

- [ ] **Step 1: Write the failing test**

Create `src/features/settings/__tests__/useDayEndSetting.test.ts`:

```ts
import { renderHook, act } from '@testing-library/react-native';
import { useDayEndSetting } from '../useDayEndSetting';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { startOfLocalDay } from '@/src/lib/time';

describe('useDayEndSetting', () => {
  beforeEach(() => useSettingsStore.getState().reset());

  it('labels the default day-end as 9:00pm', () => {
    const { result } = renderHook(() => useDayEndSetting());
    expect(result.current.label).toBe('9:00pm');
  });

  it('commit converts an epoch-on-today to minutes-after-midnight and closes', () => {
    const { result } = renderHook(() => useDayEndSetting());
    const tenPm = startOfLocalDay(Date.now()) + 22 * 60 * 60_000; // 22:00 today
    act(() => result.current.open());
    act(() => result.current.commit(tenPm));
    expect(useSettingsStore.getState().dayEndMin).toBe(22 * 60);
    expect(result.current.editing).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/features/settings/__tests__/useDayEndSetting.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the hook**

Create `src/features/settings/useDayEndSetting.ts`:

```ts
import { useCallback, useMemo, useState } from 'react';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { dayEndEpochFor, formatClockMeridiem, startOfLocalDay } from '@/src/lib/time';

/** View-model for the Settings "End of day" row: current label + edit lifecycle. */
export function useDayEndSetting() {
  const dayEndMin = useSettingsStore((s) => s.dayEndMin);
  const setDayEndMin = useSettingsStore((s) => s.setDayEndMin);
  const [editing, setEditing] = useState(false);

  const label = useMemo(
    () => formatClockMeridiem(dayEndEpochFor(Date.now(), dayEndMin)),
    [dayEndMin],
  );

  const commit = useCallback(
    (chosenMs: number) => {
      setDayEndMin(Math.round((chosenMs - startOfLocalDay(chosenMs)) / 60_000));
      setEditing(false);
    },
    [setDayEndMin],
  );

  const open = useCallback(() => setEditing(true), []);
  const close = useCallback(() => setEditing(false), []);

  return { dayEndMin, label, editing, open, close, commit };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/features/settings/__tests__/useDayEndSetting.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/settings/useDayEndSetting.ts src/features/settings/__tests__/useDayEndSetting.test.ts
git commit -m "feat(settings): add useDayEndSetting hook"
```

---

### Task 4: `FinishTimeWheel` optional `showModes` prop

**Files:**
- Modify: `src/features/planner/FinishTimeWheel.tsx`

**Interfaces:**
- Produces: `FinishTimeWheel` accepts `showModes?: boolean` (default `true`). When `false`, the mode-chip row (`leave by / be done by / be at`) is not rendered; the wheel is a plain HH:MM time picker. All existing call sites are unchanged (default preserves current behavior).

UI-only prop guard — no unit test (project policy: UI components don't require TDD). Verified by typecheck + lint + the Task 5 sim check.

- [ ] **Step 1: Add the prop to the component's props type**

In `src/features/planner/FinishTimeWheel.tsx`, add to the component's props interface:

```ts
/** When false, hide the mode chip row so the wheel is a plain time picker. Default true. */
showModes?: boolean;
```

Destructure it with a default in the component signature: `showModes = true`.

- [ ] **Step 2: Guard the mode-chip row**

Find the JSX that renders the mode chips (the row mapping over `MODES` / rendering the `leave by · be done by · be at` `Chip`s) and wrap it so it only renders when `showModes` is true:

```tsx
{showModes ? (
  /* existing mode-chip row JSX, unchanged */
) : null}
```

Do not change the wheel columns, physics, or `onChange` contract.

- [ ] **Step 3: Verify types and lint**

Run: `npm run typecheck`
Expected: clean.
Run: `npx eslint src/features/planner/FinishTimeWheel.tsx`
Expected: 0 warnings.

- [ ] **Step 4: Commit**

```bash
git add src/features/planner/FinishTimeWheel.tsx
git commit -m "feat(planner): add optional showModes prop to FinishTimeWheel"
```

---

### Task 5: Settings "End of day" row + editor sheet

**Files:**
- Modify: `app/settings.tsx`

**Interfaces:**
- Consumes: `useDayEndSetting` (Task 3), `FinishTimeWheel` with `showModes={false}` (Task 4), the existing `SettingRow` component in `app/settings.tsx`.

UI wiring — verified on the simulator (project: founder approves UI from rendered screenshots).

- [ ] **Step 1: Wire the hook and render the row**

In `app/settings.tsx`, import and call the hook inside the `Settings` component:

```tsx
import { useDayEndSetting } from '@/src/features/settings/useDayEndSetting';

const { label: dayEndLabel, editing: dayEndEditing, open: openDayEnd, close: closeDayEnd, commit: commitDayEnd } =
  useDayEndSetting();
```

Add a `SettingRow` in the same group as Reminders / Daily ritual:

```tsx
<SettingRow
  icon="moon-outline"
  title="End of day"
  note={`Your day winds down around ${dayEndLabel}`}
  onPress={openDayEnd}
  accessibilityLabel={`End of day, currently ${dayEndLabel}. Tap to change.`}
/>
```

- [ ] **Step 2: Mount the editor**

Render the picker when `dayEndEditing` is true, inside the app's existing bottom-sheet/modal wrapper used by other pickers (match the pattern already in the codebase; if none is reused on this screen, present a simple `Modal` with `transparent` + a dismiss scrim). Header copy: `When does your day wind down?`. Content:

```tsx
{dayEndEditing ? (
  /* sheet/modal wrapper, dismiss on backdrop → closeDayEnd */
  <FinishTimeWheel
    showModes={false}
    valueMs={dayEndEpochFor(Date.now(), dayEndMin)}
    onChange={commitDayEnd}
  />
) : null}
```

Import `dayEndEpochFor` from `@/src/lib/time` and read `dayEndMin` from the hook for `valueMs`. Confirm `FinishTimeWheel`'s actual `onChange`/`valueMs` prop names against the file and adjust the call to match.

- [ ] **Step 3: Lint + typecheck**

Run: `npm run typecheck && npx eslint app/settings.tsx`
Expected: clean, 0 warnings.

- [ ] **Step 4: Sim check**

Run: `npm run ios`
Verify: Settings shows "End of day · winds down around 9:00pm"; tap → wheel with no mode chips → pick 10:00pm → dismiss → row reads "10:00pm"; kill + relaunch → still 10:00pm; run the data-reset flow → back to 9:00pm.

- [ ] **Step 5: Commit**

```bash
git add app/settings.tsx
git commit -m "feat(settings): add End of day setting row and editor"
```

---

### Task 6: Full verification + PR

- [ ] **Step 1: Run the full gate**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all green, 0 warnings.

- [ ] **Step 2: Open the PR (do NOT merge)**

```bash
git push -u origin <branch>
gh pr create --title "feat: global End of day setting (free bucket)" \
  --body "Adds a durable dayEndMin preference + pure helpers + Settings editor. Design: docs/plans/day-end-setting.md. Free-bucket item; no Pro gating, no new deps, no migration."
```

Founder reviews and merges. Never merge yourself.

---

## Self-Review

**Spec coverage** (vs `docs/plans/day-end-setting.md`): default constant ✔ (Task 2), store field+clamp+reset ✔ (Task 2), pure helpers ✔ (Task 1), hook ✔ (Task 3), `showModes` reuse ✔ (Task 4), Settings row+editor ✔ (Task 5), validation ✔ (Task 6). Consumer seam (§8 of design) is intentionally out of scope. Already-shipped free items listed as verify-only.

**Placeholder scan:** Task 4/5 are UI and reference existing JSX the executor must locate (mode-chip row; sheet wrapper) — flagged explicitly with the exact guard/usage, not left as "TBD". No "add error handling"/"write tests for the above" placeholders.

**Type consistency:** `dayEndMin: number`, `setDayEndMin(minutes: number)`, `DEFAULT_DAY_END_MIN`, `startOfLocalDay(nowMs)`, `dayEndEpochFor(nowMs, dayEndMin)`, `useDayEndSetting().{label,editing,open,close,commit}` consistent across Tasks 1–5.
