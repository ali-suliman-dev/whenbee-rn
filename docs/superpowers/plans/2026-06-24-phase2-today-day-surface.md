# Planning Expansion — Phase 2: Today Day-Surface (List) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.
>
> **Branch off Phase 1.** This plan builds directly on `feat/planning-data-foundation` (PR #46) — it consumes `dayTasksStore`, `tasksRepo`, `daySelectors`, and the day-key helpers. Branch from that branch (or from `main` once #46 merges). Do NOT start before Phase 1 is merged or branched-from.

**Goal:** Turn the Today tab into a day surface (List mode): a calendar strip selects the day; the task list, add-task, completion, and deletion all flow through the new `dayTasksStore`; undone work carries over silently with a neutral "from {day}" tag; tasks can be moved between days by swipe; past days show a banked recap; unscheduled tasks live in a "No day yet" shelf. No capacity/focus chips (Phase 3), no Timeline (Phase 4).

**Architecture:** Migrate the 7 consumers of the old `tasksStore` to the async DB-backed `dayTasksStore`, completing its API first (bound-store export, `addTask` returns the created task, `selectFocusTask`, `reload`, `nowMs` threading). Add a hand-rolled `CalendarStrip` (no new dependency — RN 0.81/Reanimated-safe). Extend the existing `TaskRow` swipe with a "Move" action. Delete the old store last, once nothing imports it.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`), Zustand, expo-router, react-native-reanimated + react-native-gesture-handler (already present), Jest + React Testing Library (existing). Source spec: `docs/product/specs/2026-06-24-planning-calendar-expansion-design.md` (§4.2, §6, §7, §9.1). Phase-1 modules: `src/stores/dayTasksStore.ts`, `src/db/repositories/tasksRepo.ts`, `src/engine/daySelectors.ts`, `src/lib/day.ts`.

## Global Constraints

- **No new runtime dependency for the strip.** Hand-roll it with `View`/`Pressable`/`Animated` + a `FlatList`/`ScrollView`. (Project gotcha: new native/RN deps must be vetted for SDK 54 / RN 0.81 / Reanimated; avoid the gate.) Range cap ±1 year of weeks.
- **No guilt, ever.** Carryover tag is neutral (`· from Mon`). NO "overdue", NO red, NO count badge. Empty future day is an invite, never a deficit. Past recap is a recap, never a score/streak.
- **All values from tokens.** Every color/space/size/font/radius/motion from `src/theme/tokens.ts` via `useTheme()`. If a token is missing, ADD it to `tokens.ts` (and to `useTheme`'s `resolveTheme` if it's a new group) — never inline a raw number/hex. (Gotcha: a new `tokens.ts` group needs a matching line in `useTheme`.)
- **Modal/sheet rule.** Any modal route renders `headerShown: false` and its own title via `type.subtitle` + `t.colors.ink`; sheets start with `<SheetGrabber />`.
- **Animation rule.** No spring/bounce/overshoot on content entrances; no translate-in slides on content (fade/scale-settle only); never animate buttons in/out; NO `exiting` layout animation on conditionally-unmounted views (Fabric SIGABRT) — entering-only. Reduced-motion → final state. Strip swipe follows the finger and settles ease-out, no bounce.
- **Reanimated rules.** Read/write shared values with `.get()/.set()`. A helper called inside a worklet needs `'worklet';` or it crashes (SIGABRT).
- **Layer rule (ESLint).** `src/app/**` and `src/components/**` must not import `@/src/db/*` or `@/src/services/*` — go through the store/hook.
- **Pressable + reactCompiler gotcha.** `style={({pressed}) => …}` silently renders nothing — put visual style on an inner `View`, keep `Pressable` a bare touch wrapper.
- **Footers/pinned-bottom add `useSafeAreaInsets().bottom`.**
- **TypeScript strict + noUncheckedIndexedAccess.** Conventional Commits; NO AI/co-author attribution (HARD RULE).
- **Before every commit:** `npx eslint <changed files>` (0 warnings), `npm run typecheck`, relevant `npx jest`. The full suite must stay green at the end of each task.

---

## Section A — Complete the store API (make it consumable)

### Task A1: `dayTasksStore` API completion

**Files:**
- Modify: `src/stores/dayTasksStore.ts`
- Test: `src/stores/__tests__/dayTasksStore.test.ts` (extend)

**Interfaces:**
- Consumes: Phase-1 `dayTasksStore` (`makeDayTasksStore`, `DayTasksState`), `selectFocus` concept, `Task`, `DayTask`.
- Produces (added to `DayTasksState`):
  - `addTask(input): Promise<Task>` — CHANGED from `Promise<void>`; returns the created task (the timer hand-off needs its id).
  - `selectFocusTask(): DayTask | null` — the first `queued` task in `dayTasks` order (carryover-agnostic).
  - `reload(nowMs?: number): Promise<void>` — re-run the current day's load (after a timer completes, account reset).
  - `nowMs?` threaded through `completeTask`/`moveTask`/`removeTask`/`addTask` for deterministic day recompute (review Minor M1).
- Also: export the bound store as a **direct `UseBoundStore`** named `useDayTasksStore` (not a function), so consumers call `useDayTasksStore((s) => s.dayTasks)` exactly like the old store. Keep `makeDayTasksStore` for tests.

- [ ] **Step 1: Write the failing tests** (append to the existing describe)

```ts
test('addTask returns the created task', async () => {
  const store = freshStore();
  await store.getState().init(NOW);
  const task = await store.getState().addTask({ label: 'Write', category: 'deep-work', guessMin: 60, nowMs: NOW });
  expect(task.id).toBeTruthy();
  expect(task.label).toBe('Write');
  expect(task.plannedDate).toBe('2026-06-24');
});

test('selectFocusTask returns the first queued task', async () => {
  const store = freshStore();
  await store.getState().init(NOW);
  await store.getState().addTask({ label: 'First', category: 'admin', guessMin: 10, nowMs: NOW });
  await store.getState().addTask({ label: 'Second', category: 'admin', guessMin: 10, nowMs: NOW + 1 });
  expect(store.getState().selectFocusTask()?.label).toBe('First');
});

test('reload re-reads the current day', async () => {
  const store = freshStore();
  await store.getState().init(NOW);
  await store.getState().addTask({ label: 'X', category: 'admin', guessMin: 10, nowMs: NOW });
  const id = store.getState().dayTasks[0]!.id;
  await store.getState().completeTask(id, { completedAt: NOW + 5, actualMin: 11, nowMs: NOW });
  await store.getState().reload(NOW);
  expect(store.getState().selectFocusTask()).toBeNull(); // the only task is done
});
```

- [ ] **Step 2: Run, confirm fail** — `npx jest src/stores/__tests__/dayTasksStore.test.ts` → FAIL (addTask returns void / selectFocusTask undefined).

- [ ] **Step 3: Implement**

In `DayTasksState`, change `addTask` return type to `Promise<Task>` and add `selectFocusTask: () => DayTask | null;` and `reload: (nowMs?: number) => Promise<void>;`. Add `nowMs?` to the mutator input types. In the store body:

```ts
    async addTask({ label, category, guessMin, date, nowMs }) {
      const createdAt = nowMs ?? Date.now();
      const plannedDate = date === undefined ? get().selectedDate : date;
      const task: Task = {
        id: makeId(createdAt), label, category, guessMin, plannedDate,
        status: 'queued', orderIndex: createdAt, doneByMin: null, createdAt,
        completedAt: null, actualMin: null, fromRoutineId: null, calendarEventId: null,
      };
      await repo.add(task);
      const today = toLocalDayKey(createdAt);
      set({ dayTasks: await loadDay(get().selectedDate, today) });
      return task;
    },

    selectFocusTask() {
      return get().dayTasks.find((t) => t.status === 'queued') ?? null;
    },

    async reload(nowMs) {
      const today = toLocalDayKey(nowMs ?? Date.now());
      set({ dayTasks: await loadDay(get().selectedDate, today) });
    },
```

Thread `nowMs` in `completeTask`/`moveTask`/`removeTask` so the post-write `today` uses it (`const today = toLocalDayKey(opts?.nowMs ?? Date.now())`). At the bottom of the file, replace the function-style `useDayTasksStore()` with a directly-bound store:

```ts
export const useDayTasksStore = makeDayTasksStore({
  repo: makeLazyRepo(),
  kvGet: (k) => kv.getString(k) ?? null,
  kvSet: (k, v) => kv.set(k, v),
});
```
(Keep `makeLazyRepo` and `makeDayTasksStore`. Remove the `bound`-caching function wrapper.)

- [ ] **Step 4: Run, confirm pass** — all dayTasksStore tests green.

- [ ] **Step 5: eslint + typecheck + commit**

```bash
git add src/stores/dayTasksStore.ts src/stores/__tests__/dayTasksStore.test.ts
git commit -m "feat(store): dayTasksStore returns task, adds selectFocusTask/reload, bound export"
```

---

### Task A2: Boot the store + day-rollover refresh

**Files:**
- Modify: `src/app/_layout.tsx` (root boot — add an init effect) — read it first to match its existing boot pattern.
- Test: `src/stores/__tests__/dayTasksStore.test.ts` (a rollover test) — or a small hook test if `_layout` has a boot hook.

**Interfaces:**
- Consumes: `useDayTasksStore` (A1).
- Produces: store `init()` called once at app start; `goToToday()` re-run when the app returns to foreground across a day boundary.

- [ ] **Step 1: Write the failing test** (store-level rollover — deterministic)

```ts
test('goToToday after a day boundary moves the selected day to the new today', async () => {
  const store = freshStore();
  const day1 = new Date(2026, 5, 24, 23, 0, 0).getTime();
  const day2 = new Date(2026, 5, 25, 8, 0, 0).getTime();
  await store.getState().init(day1);
  expect(store.getState().selectedDate).toBe('2026-06-24');
  await store.getState().goToToday(day2);
  expect(store.getState().selectedDate).toBe('2026-06-25');
});
```

- [ ] **Step 2: Run, confirm pass-or-fail** — this likely PASSES already (goToToday exists). If it passes, it documents the behavior; keep it. If `freshStore` lacks it, add the test and confirm green.

- [ ] **Step 3: Wire boot in `_layout.tsx`**

Read `src/app/_layout.tsx`. Add, alongside the other boot effects:

```tsx
import { AppState } from 'react-native';
import { useDayTasksStore } from '@/src/stores/dayTasksStore';
// …inside the root component:
useEffect(() => {
  void useDayTasksStore.getState().init();
  const sub = AppState.addEventListener('change', (s) => {
    if (s === 'active') void useDayTasksStore.getState().goToToday();
  });
  return () => sub.remove();
}, []);
```

- [ ] **Step 4: typecheck + lint + commit**

```bash
git add src/app/_layout.tsx src/stores/__tests__/dayTasksStore.test.ts
git commit -m "feat(today): boot dayTasksStore + refresh today on foreground"
```

---

## Section B — Migrate the 7 consumers (keep behavior; build stays green)

> Migrate one file per task so each is independently reviewable. After EACH, `npm run typecheck` + full `npx jest` must be green (the old store still exists until Task B7).

### Task B1: `useToday` → `dayTasksStore`

**Files:**
- Modify: `src/features/today/useToday.ts`
- Test: `src/features/today/__tests__/useToday.test.ts` (update)

**Interfaces:**
- Consumes: `useDayTasksStore` (`dayTasks`, `selectFocusTask`, `selectedDate`). `DayTask` replaces `TodayTask`.
- Produces: same `UseTodayResult` shape, but `focus: DayTask | null`, sourced from `dayTasks`.

- [ ] **Step 1: Update the test** to seed via the new store (inject through `makeDayTasksStore` or mock `useDayTasksStore`), asserting `focus`/`upNext`/`done` derive from `dayTasks`. (Read the current test to match its harness.)
- [ ] **Step 2: Run, confirm fail.**
- [ ] **Step 3: Implement.** Replace `import { useTasksStore, selectFocus, type TodayTask }` with `import { useDayTasksStore } from '@/src/stores/dayTasksStore'` and `import type { DayTask } from '@/src/engine/daySelectors'`. Replace `const tasks = useTasksStore((s) => s.tasks)` with `const dayTasks = useDayTasksStore((s) => s.dayTasks)`. Derive:
```ts
const focus = useDayTasksStore((s) => s.selectFocusTask)();
const nowSlotId = isTimerRunning ? runningTaskId : (focus?.id ?? null);
const upNext = dayTasks.filter((t) => t.status === 'queued' && t.id !== nowSlotId).map(toRow);
const done = dayTasks.filter((t) => t.status === 'done').map(toRow); // already day-scoped; keep order (newest handled by store)
```
Change `honestFor`/`toRow` to take `DayTask`. `totalCount` = `dayTasks.length`. Carry `carriedFrom` into `TodayRow` (add `carriedFrom: string | null`) so B-row rendering (Task D2) can show the tag. Keep the widget-publish + analytics effects.
- [ ] **Step 4: Run, confirm pass.**
- [ ] **Step 5: lint + typecheck + commit** `feat(today): useToday reads dayTasksStore (selected-day tasks)`.

### Task B2: `useAddTask` → async add to selected day

**Files:** Modify `src/features/add-task/useAddTask.ts`; update its test if present.
- [ ] Replace `useTasksStore` import with `useDayTasksStore`. `const addTask = useDayTasksStore((s) => s.addTask)`. Make `addToToday` async (returns `Promise<boolean>`) and `onAddAndStart` async; both `await addTask({ label, category, guessMin, date: useDayTasksStore.getState().selectedDate })`. For `onAddAndStart`, use the RETURNED task's `id` for the timer params (no longer the sync return). Add an optional `date` param to `addToToday` for Task E (shelf/date-chip) — default `undefined` (= selectedDate). Commit `feat(add-task): add to the selected day via dayTasksStore`.

### Task B3: `useTimer.completeTask` → pass `completedAt`

**Files:** Modify `src/features/timer/useTimer.ts:386`.
- [ ] Replace `useTasksStore.getState().completeTask(taskId, { actualMin })` with `useDayTasksStore.getState().completeTask(taskId, { completedAt: Date.now(), actualMin })` then `void useDayTasksStore.getState().reload()`. Commit `feat(timer): complete the day task with completedAt + reload`.

### Task B4: `index.tsx` → remove/promote via new store

**Files:** Modify `src/app/(tabs)/index.tsx:29,60-61,127`.
- [ ] Replace `useTasksStore` import + `removeTask`/`promoteToFocus`. New store has `removeTask`; for `promoteToFocus` (the switch-task path), add a `promoteToFocus(id)` to `dayTasksStore` (reorder the task to the front by setting its `orderIndex` below the current min, then reload) — add it in A1's file with a test, OR simplest: replace the switch behavior to just navigate (the running-task hiding already handles display). DECISION for the implementer: add `promoteToFocus` to the store (preferred — preserves behavior). Commit `feat(today): wire index delete/promote to dayTasksStore`.

### Task B5: `TodayFocusHook` + `useFocusWindow` → `dayTasks`

**Files:** Modify `src/features/today/TodayFocusHook.tsx:9,43` and `src/features/planner/useFocusWindow.ts:5,33`.
- [ ] Both read `const tasks = useDayTasksStore((s) => s.dayTasks)` (queued subset where they used `.tasks`). Confirm `resolveHonestTasks` input shape still satisfied (map `DayTask`→its `TodayTaskInput`). Update `src/features/planner/resolveHonestTasks.ts` `TodayTaskInput` import if it referenced the old `TodayTask`. Commit `feat(focus): focus surfaces read dayTasksStore`.

### Task B6: `useAccountReset` → wipe + reload

**Files:** Modify `src/features/settings/useAccountReset.ts:6,30,46`.
- [ ] Replace `useTasksStore.getState().clear()` with `await useDayTasksStore.getState().reload()` AFTER the existing DB wipe (Phase 1 added `tasks`/`day_meta` to `wipeAll`, so the reset already clears them); also clear the `tasks-migrated-v1` kv flag so a fresh DB re-imports cleanly if needed. Confirm the reset test still passes. Commit `feat(settings): account reset clears day tasks via wipe + reload`.

### Task B7: Delete the old `tasksStore`

**Files:** Delete `src/stores/tasksStore.ts` + `src/stores/__tests__/tasksStore.test.ts`.
- [ ] `grep -rn "stores/tasksStore" src` must return ZERO non-deleted hits first. Then delete both files. `npm run typecheck` + full `npx jest` green. Commit `refactor(store): remove the legacy kv tasksStore (migrated to dayTasksStore)`.

---

## Section C — Calendar strip

### Task C1: `weekDays` pure helper

**Files:** Create `src/features/today/calendarStrip/weekDays.ts`; Test `…/__tests__/weekDays.test.ts`.

**Interfaces:**
- Consumes: `toLocalDayKey`, `addDays` (`src/lib/day`).
- Produces: `weekFor(anchorKey: string, weekStartsOn: 0|1): string[]` → 7 day-keys (the week containing `anchorKey`); `dayCells(weekKeys, today, selected, datesWithTasks: Set<string>): DayCell[]` where `DayCell = { key; weekdayLabel; dayNum; isToday; isSelected; hasTasks }`.

- [ ] Standard TDD: test the week boundaries (a mid-week anchor returns Mon..Sun for `weekStartsOn:1`), the cell flags, and `hasTasks` membership. Implement purely (no Date beyond what `src/lib/day` provides — derive weekday via a fixed reference using `addDays`/key math; if weekday-of-key needs a Date, put that tiny helper in `src/lib/day.ts` as `weekdayOf(key): 0-6` with its own test, keeping the strip pure). Commit `feat(today): pure week-strip day-cell helper`.

### Task C2: `CalendarStrip` component

**Files:** Create `src/features/today/calendarStrip/CalendarStrip.tsx`; Test `…/__tests__/CalendarStrip.test.tsx`.

**Interfaces:**
- Consumes: `weekFor`/`dayCells` (C1), `useDayTasksStore` (`selectedDate`, `selectDate`), `datesWithTasks` (a set the store can expose — add a light `useDatesWithTasks()` selector or pass via prop; for Phase 2, compute from a repo query `listDatesWithTasks()` added to `tasksRepo` + a store field, OR pass an empty set and fill in Phase 3 — DECISION: add a minimal `datesWithTasks: string[]` to the store, populated on load, so dots are real now).
- Produces: a horizontal, swipeable 7-day row. One `FlatList` (horizontal, `pagingEnabled`, `getItemLayout`) of week pages, each rendering 7 `DayCell` pressables; tapping a cell calls `selectDate(key)`; swiping pages the week (±1yr cap). Today highlighted via `colors.primary`; selected = solid `colors.ink` pill; muted out-of-week; single amber dot when `hasTasks`. Tokens only; add `tokens.strip` geometry group if needed (+ `useTheme` line).

- [ ] **Step 1:** Render test — given a selectedDate, the cell for that date has the selected style/`accessibilityState={{selected:true}}`; tapping another cell calls `selectDate` with its key; today cell is distinct from selected. (Use the existing RN testing setup; assert via `accessibilityLabel`/`testID`, not styles where possible.)
- [ ] Implement per the interface. Swipe momentum settles ease-out, no bounce; reduced-motion → instant page set. Cap pages to ±52 weeks around today.
- [ ] Commit `feat(today): swipeable 7-day calendar strip`.

### Task C3: Mount the strip; day-aware header title

**Files:** Modify `src/app/(tabs)/index.tsx` (header area) + the title.
- [ ] Render `<CalendarStrip />` directly under `<ScreenHeader>`. Change the title: when `selectedDate === today` → "Today"; else the weekday name (e.g. "Thursday") via a small helper; subtitle becomes that day's `Mon · Jun 26`. Keep the gear + honey ring unchanged (NO ring swap). Screenshot-verify on the simulator (strip alignment, today vs selected distinct). Commit `feat(today): mount calendar strip + day-aware header`.

---

## Section D — Carryover tag + move-between-days

### Task D1: Move methods coverage

**Files:** `src/stores/dayTasksStore.ts` already has `moveTask`; add a tiny convenience `moveToTomorrow(id, nowMs?)` (computes `addDays(today,1)`); Test in `dayTasksStore.test.ts`.
- [ ] Test: a task moved to tomorrow leaves today and appears on tomorrow. Implement `moveToTomorrow` using `addDays(toLocalDayKey(nowMs ?? Date.now()), 1)` → `moveTask(id, that)`. Commit `feat(store): moveToTomorrow convenience`.

### Task D2: Carryover tag on the row

**Files:** Modify `src/features/today/TaskRow.tsx` (+ its test) and `index.tsx` to pass `carriedFrom`.
- [ ] Add optional `carriedFrom?: string | null` prop. When set (and not done), render a neutral inline tag `· from {Mon}` next to the category label, in `colors.inkSoft` (NO red, NO "overdue"). Thread `row.carriedFrom` from `useToday`'s `TodayRow` (B1) through `index.tsx`'s `upNext.map`. Test: a row with `carriedFrom='2026-06-22'` shows "from" text; without it, none. Commit `feat(today): neutral carryover tag on carried-over rows`.

### Task D3: Swipe-to-move action

**Files:** Modify `src/features/today/TaskRow.tsx` (+ test); `index.tsx` to pass `onMove`.
- [ ] Add a LEFT swipe action (`renderLeftActions`) "Tomorrow" (amber, not red) calling `onMove?.('tomorrow')`, plus the existing right Delete. For "pick a day", long-press already opens a sheet — extend `promptDelete`→a `promptRowActions` ActionSheet with "Move to tomorrow", "Pick a day…", "Remove". "Pick a day…" opens a date picker modal that calls `moveTask(id, key)`. Wire `onMove` in `index.tsx` → `useDayTasksStore.getState().moveToTomorrow(row.id)` then it leaves the list (reload happens in the store). Test the left action fires `onMove('tomorrow')`. Commit `feat(today): swipe/long-press to move a task to another day`.

---

## Section E — Add-to-day date chip + shelf

### Task E1: Date chip in the add-task sheet

**Files:** Modify `src/app/(modals)/add-task.tsx` (read it first) + `useAddTask` (B2 already added the `date` param).
- [ ] Show the target day in the sheet header ("Adding to Thursday" / "Today" / "No day yet"), always visible (never silent). Add a small date chip that opens a compact date picker (reuse RN's `DateTimePicker` if already a dep, else a minimal day-list) to retarget; "No day yet" sets `date: null` (shelf). NO natural-language parsing. Default = `selectedDate`. Screenshot-verify. Commit `feat(add-task): target-day label + date chip`.

### Task E2: "No day yet" shelf surface

**Files:** Create `src/features/today/ShelfSection.tsx` (+ test); add a `useShelf()` read (`tasksRepo.listShelf` via a store selector `shelfTasks` loaded on demand); mount a quiet "No day yet · N" entry on Today that expands the shelf list; each shelf row can be moved onto a day (reuse D3's move).
- [ ] Add `shelfTasks: DayTask[]` + `loadShelf()` to the store (reload on add/move). Render a collapsible quiet section beneath the list (only when `shelfTasks.length > 0`). Test the store `loadShelf`. Commit `feat(today): No-day-yet shelf surface`.

---

## Section F — Per-day recap (past days)

### Task F1: Recap read

**Files:** `src/features/today/useDayRecap.ts` (+ test).
**Interfaces:**
- Consumes: `useDayTasksStore` (`dayTasks` for a past selected day = the day's tasks; done bucketed by completedAt via the store's `loadDay`).
- Produces: `useDayRecap(): { doneCount; plannedCount; realFocusMin; vsGuessMin; honeyGainMin } | null` (null for today/future — recap is past-day only).
- [ ] Compute from the selected day's `dayTasks`: doneCount = done rows; realFocusMin = Σ actualMin; vsGuessMin = Σ(actualMin − guessMin) over done; honeyGain from the existing reclaim/honey read if cheaply available (else omit for Phase 2 and show the other three). Test with seeded tasks. Commit `feat(today): per-day recap read`.

### Task F2: Recap card + collapsible list

**Files:** Create `src/features/today/DayRecapCard.tsx` (+ render test); mount in `index.tsx` when `selectedDate < today`.
- [ ] The banked recap card (N of N done · real focus · vs your guess [+ honey]) + a collapsible "All tasks · {day}" disclosure beneath that expands the full per-day list (reuse `TaskRow` done/queued rendering). Past day default = recap shown, list collapsed. Empty past day → quiet "Nothing logged that day" (neutral). Tokens only; no streak/score language. Mount logic in `index.tsx`: if past day, render `<DayRecapCard>` instead of the FocusCard/empty-state hero. Screenshot-verify. Commit `feat(today): banked per-day recap card + collapsible list`.

---

## Section G — Empty states + polish

### Task G1: Future-day empty state + day-aware empties

**Files:** Modify `src/features/today/TodayEmptyState.tsx` (+ index wiring).
- [ ] Add a `future` variant: "{Weekday}'s wide open. Add what future-you should tackle — it carries over free if life happens." (humanized, no guilt). `index.tsx` picks variant by selected day (today first-run / today daily / future / past handled by recap). Commit `feat(today): day-aware empty states`.

### Task G2: Copy + motion + a11y + screenshot pass

**Files:** across the Phase-2 surfaces.
- [ ] Run all new user-facing strings through the copy rules (conversion-psychology + humanizer): carryover tag, move labels, shelf, recap, empties, date-chip. Verify motion (strip swipe ease-out no bounce; entering-only; reduced-motion final state). Verify a11y labels on strip cells, move/delete actions, recap. Deep-link to mid-flow (`whenbee:///(tabs)`/a future day) and `xcrun simctl io booted screenshot` — look critically at alignment/spacing/density. Fix before done. Commit `style(today): copy/motion/a11y polish for the day surface`.

---

## Self-Review

**Spec coverage (§4.2, §6, §7, §9.1):** strip §6 → C; add-to-day + date chip + default-day §7 → E1, B2; swipe-to-move §9.1 → D3; silent carryover tag §4.2 → D2; shelf §7 → E2; per-day recap + collapsible §9.1 → F; day-aware header/empties §9.1 → C3, G1; store migration §16 → A, B. ✅ Out of scope (correctly deferred): capacity chip + calendar overlay (Phase 3), Timeline/Plan-my-day (Phase 4), focus chip (Phase 5).

**Placeholder scan:** Section B tasks reference exact files + line numbers + the exact import/call swaps; new modules (A1, C1, C2, D, E, F) carry real signatures + test intents. Where a sub-decision exists (promoteToFocus in B4; datesWithTasks source in C2; honeyGain in F1) the plan names the decision + the preferred resolution so the implementer doesn't invent silently. **Note:** Sections C–G specify component behavior + interfaces + test intent rather than full transcribed JSX (these are new UI files with token-driven styling that must be screenshot-verified); the implementer builds them against the interface + the design skills, not by transcription. This is intentional for UI tasks — but each still ends with a test + a screenshot gate.

**Type consistency:** `DayTask` (from `src/engine/daySelectors`) replaces `TodayTask` throughout B; `addTask` returns `Task`; `TodayRow` gains `carriedFrom`. `selectFocusTask`/`reload`/`moveToTomorrow` names are used identically across A, B, D.

**Known follow-through (Phase 3):** capacity chip + calendar overlay consume `selectedDate` + the strip established here.

---

## Execution Handoff

Two execution options (same as Phase 1):
1. **Subagent-Driven (recommended)** — fresh subagent per task, review between, in the worktree, PR at the end (never merge).
2. **Inline** — execute here with checkpoints.

Recommended: continue subagent-driven in a worktree branched off `feat/planning-data-foundation` (or off `main` once #46 merges), opening a Phase-2 PR for founder review.
