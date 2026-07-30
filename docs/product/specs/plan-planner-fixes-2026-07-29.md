# Plan — Plan-my-day correctness fixes (2026-07-29)

Audit of the Pro "Plan my day" feature found the scheduler drops tasks while hours
sit free, fabricates a deadline nobody set, ignores a pinned early start, and
reports clocks in the past. This plan fixes the confirmed defects in dependency
order. Every defect below was reproduced against the real engine; the existing
76 tests in `src/engine/__tests__/planDayAroundAnchors.test.ts`,
`src/features/today/__tests__/useDayPlan.test.ts` and
`src/features/today/__tests__/DayTimeline.test.tsx` pass today, so these are
untested behaviours, not regressions.

## Global Constraints

- **TDD is required.** Write the failing test first, watch it fail, then fix.
  Logic layers (engine, hooks, stores) are TDD-mandatory in this repo.
- **`src/engine/` is pure TypeScript.** No React, RN, Expo, `Date.now()`, or any
  clock access. All times arrive as epoch ms arguments.
- TypeScript `strict`, `noUncheckedIndexedAccess` and `noImplicitOverride` are on.
  Indexed access yields `T | undefined` — handle it; do not silence with `!`
  unless provably safe (the file already uses `!` after explicit bounds checks —
  match that local style).
- **Never break the existing 76 tests.** They encode intended behaviour.
- Any UI value (spacing, size, colour, font) must come from a token in
  `src/theme/tokens.ts` via `useTheme()`. No raw numbers or hex.
- `src/app/**` and `src/components/**` must not import `@/src/services/*` or
  `@/src/db/*`. Route through a store / provider / feature hook.
- Product invariants: no guilt, no shame, no red for overrun (amber only); the
  core loop stays on-device.
- Conventional Commits. **No AI/co-author attribution of any kind** in commit
  messages — no `Co-Authored-By`, no "Generated with", no robot emoji.
- Work happens on `main` (the founder gave explicit consent for this plan).
  **Never create a branch, never merge, never push.**
- Before reporting a task done: `npx jest <touched test paths>` **and**
  `npx eslint <touched files>` (flat config `eslint.config.js`; there is no
  `.eslintrc.js`). Then `npm test` for the full suite on the last task of a
  layer.

---

## Task 1 — Fill passes stop poisoning later tasks; unplaced tasks gap-fill

**File:** `src/engine/planDayAroundAnchors.ts` (`forwardFill`, `backwardFill`).

### The defect

Both fills carry a single monotonic window index. In `forwardFill` (lines ~262-300)
`winIdx` is incremented until it passes the end of the window list when a task is
too big to fit anywhere; every later task then enters `while (winIdx < freeWindows.length)`
with a false condition and is silently left `null` → rendered as `overflow`.

Reproduced: free window 08:00–12:00 (240 min), tasks `huge` (300 min) and
`tiny` (30 min), forward fill from 08:00:

```
overflow huge 12:00-17:00
overflow tiny 17:00-17:30      ← 4 free hours were never offered to `tiny`
```

`backwardFill` (lines ~187-229) has the exact mirror bug with `winIdx -= 1`.

### Required behaviour

1. **Per-window cursors.** Replace the single `cursor` with an array of cursors,
   one per free window: forward initialises each to `window.start`, backward to
   `window.end`. A placement advances only its own window's cursor.
2. **Pass 1 — order-preserving, non-poisoning.** Walk tasks in queue order,
   holding a current window index. For each task, scan from the current index
   forward (backward pass: backward) for the first window whose remaining space
   holds the whole block. On success, place it and move the current index to that
   window. **On failure, leave the task `null` and leave the current index where
   it was** — a task that fits nowhere must not consume the scan position of the
   tasks after it.
3. **Pass 2 — gap-fill.** After pass 1, for every task still `null`, scan *all*
   windows chronologically (backward pass: reverse-chronologically) and place it
   in the first one with room. A task only reaches this pass if it would
   otherwise be dropped, so filling an earlier gap out of queue order is
   preferable to reporting it as overflow.
4. Unchanged rules: a block never straddles an anchor; `breatherMin` is inserted
   only between two tasks that share a window (a window jump is its own gap);
   the returned array stays parallel to `effectives`, `null` where nothing fits.
5. `PlacedTask.windowIdx` must still be the window the task actually landed in —
   `buildTimeline`'s breather items and `computeTotalMin` both key off it.

### Tests (write first, in `src/engine/__tests__/planDayAroundAnchors.test.ts`)

- `forward: an unplaceable task does not block the tasks after it` — the repro
  above; assert `tiny` is a `task` item at 08:00–08:30 and `huge` is the only
  `overflow` row.
- `backward: an unplaceable task does not block the tasks before it` — the mirror.
- `forward: a task that fits nowhere ahead is placed in an earlier free window` —
  day 08:00–18:00, meeting 10:00–11:00, tasks `[a 90m, b 240m, c 30m]`: `c`
  cannot follow `b`'s window and must land in a gap rather than overflow.
- `breathers are still applied between two tasks sharing a window` and
  `no breather across a window jump` — assert the existing behaviour survives.
- Existing suite stays green.

---

## Task 2 — Pull a later task forward into an empty earlier window

**File:** `src/engine/planDayAroundAnchors.ts`.

### The defect

Greedy first-fit leaves the pre-meeting gap empty whenever the first queued task
is too large for it. Day starts 08:00, meeting 10:00–11:00, deadline 18:00,
tasks `[big 180m, small 30m]` →

```
event  10:00-11:00
task   big   11:00-14:00
task   small 14:00-14:30      ← 08:00-10:00 stayed empty
```

The user pinned an 08:00 start and nothing happens at 08:00.

### Required behaviour

Add a third pass after Task 1's passes, applied to **placed** tasks only:

1. Walk free windows chronologically (backward fill: reverse-chronologically).
   For each window with remaining room, find the **last-placed** task (queue
   order, from the end) that currently sits in a *later* window (backward:
   earlier) and fits entirely in this window's remaining room.
2. Move it: clear its old window's contribution, place it at that window's
   cursor, update both cursors and its `windowIdx`.
3. Repeat until a full sweep moves nothing. Bound the outer loop by
   `effectives.length` sweeps so termination is guaranteed regardless of input.
4. Never move a task into a window that starts before the fill's own start bound
   (`startMs` for forward, i.e. the pinned start floor) — the pass may not
   schedule work before the user's start.
5. Order guarantee to document in the file header: tasks that fit in sequence
   keep the user's order; only the tail is pulled forward to fill an hour that
   would otherwise be wasted.

### Tests

- `a later short task is pulled into the gap before a meeting` — the repro above;
  assert `small` lands 08:00–08:30 and `big` still starts 11:00.
- `nothing is pulled before the pinned start` — same day with
  `fill.startAtMs = 09:00`: the 08:00–09:00 slice stays empty.
- `the pass terminates on a day where nothing can move` — a fully packed day
  returns the same timeline as before the pass.
- `backward fill mirrors the pull` — one equivalent case.

---

## Task 3 — Overflow blocks never report clocks in the past

**File:** `src/engine/planDayAroundAnchors.ts` (`withOverflowTasks`, ~line 519).

### The defect

The overflow chain starts at `max(latest placed end, deadline)`. When the
deadline has already passed, the rows read as times in the past:

```
nowMs = 23:30, deadline = 22:00
overflow a 22:00-22:30
overflow b 22:30-23:00
```

The header compounds it: with nothing placed, `startBy` falls back to `deadline`
(line ~420), so the sheet prints "Start by 22:00" at 23:30.

### Required behaviour

1. `withOverflowTasks` takes `nowMs` and starts the chain at
   `max(latest placed end, deadline, nowMs)`. Overflow clocks are always in the
   future.
2. When **no** task was placed, `PlanResult.startBy` must not be fabricated from
   the deadline. Change `PlanResult.startBy` to `number | null` in
   `src/domain/types.ts`, return `null` in that case, and update every reader:
   - `src/app/(modals)/plan.tsx` (`startByLabel`, the `plan-times-line` block)
   - `src/features/today/DayTimeline.tsx` (the `startBy` header)
   - `src/features/today/useStartByReminder.ts` and any other consumer — find
     them with `grep -rn "startBy" src --include='*.ts' --include='*.tsx'`.
   A `null` start-by renders nothing; it never renders a clock.
   `PlanVerdict`'s own `startBy` fields are a separate contract — leave them.
3. The empty-task-list early return (line ~363) keeps returning `startBy: deadline`
   only if that path still makes sense with a nullable type; prefer `null` there
   too and check the tests that assert on it.

### Tests

- `overflow blocks start at now when the deadline has passed`.
- `overflow blocks still start at the deadline when the deadline is ahead`
  (existing behaviour, pin it).
- `startBy is null when nothing could be placed`.
- Update any existing test that asserts the deadline fallback, and every call
  site's tests that now receive `null`.

---

## Task 4 — Backward fill drops the breather it reserved on a window jump

**File:** `src/engine/planDayAroundAnchors.ts` (`backwardFill`, lines ~191-224).

### The defect

`needsBreather` / `totalBlockMs` are computed **before** the window-retry loop and
never recomputed after `winIdx -= 1`. A task that jumps to an earlier window still
reserves the breather that only made sense in the window it left. `forwardFill`
already recomputes correctly inside its loop (line ~279).

Reproduced — deadline 18:00, day start 08:00, meeting 13:00–14:00,
`breatherMin: 15`, tasks `[a 60, b 60, c 180]`:

```
task a 10:30-11:30
breather   11:30-11:45
task b 11:45-12:45      ← the window runs to 13:00; 15 min vanish silently
event  13:00-14:00
task c 15:00-18:00
```

### Required behaviour

Recompute `needsBreather` (and therefore the reserved block length) inside the
retry loop against the window currently being tried, mirroring `forwardFill`.
After a window jump the breather is dropped, so `b` ends at 13:00.

### Tests

- `backward: a task that jumps to an earlier window does not reserve a breather`
  — the repro above, asserting `b` ends at 13:00.
- `backward: two tasks in the same window still get their breather` — pin the
  existing behaviour.

---

## Task 5 — A pinned start before 08:00 is honoured

**File:** `src/features/today/useDayPlan.ts` (lines ~204, ~222).

### The defect

```ts
const dayStartMs = Math.max(now + MIN_START_LEAD_MIN * 60_000,
                            midnight + WAKING_START_MIN * 60_000);
```

`WAKING_START_MIN` is 480 (08:00). The free windows therefore begin at 08:00 and
`forwardFill` clamps every block to `win.start`, so a start pinned at 06:30 is
silently discarded. The picker (`src/app/(modals)/plan.tsx`, the `FinishEditorSheet`
for `openPicker === 'start'`) is unbounded, so the app accepts 06:30 and ignores
it. `startHasPassed` only compares against the `now + lead` floor, so the UI never
admits the override either.

### Required behaviour

1. When `planAnchor === 'start'` and `startAtMin !== null`, the schedulable day
   begins at the user's pinned start:
   `dayStartMs = Math.max(now + MIN_START_LEAD_MIN * MS_PER_MIN, Math.min(midnight + WAKING_START_MIN * MS_PER_MIN, pinnedStartMs))`.
   The 08:00 waking floor stays exactly as-is for the live "Now" anchor and for a
   finish-anchored day.
2. The `now + MIN_START_LEAD_MIN` floor is never removed — a plan may not be
   scheduled into the past.
3. Rename nothing in the public `UseDayPlanResult` shape in this task; only the
   computation changes. `startHasPassed` keeps its current meaning (a pinned
   start earlier than the now-floor).

### Tests (`src/features/today/__tests__/useDayPlan.test.ts`)

- `a start pinned before the waking floor is used as the day start` — now 05:00,
  `startAtMin = 390` (06:30): the first task block starts 06:30, not 08:00.
- `the waking floor still applies to the live Now anchor` — now 05:00,
  `startAtMin = null`: the first block starts 08:00.
- `the waking floor still applies when the finish is the pinned end`.
- `a pinned start in the past is still floored to now + lead`.
- The existing test whose comment reads "A test 'now' at 07:00 — before the waking
  window (08:00), so dayStartMs = 08:00" must keep passing (it uses no pinned
  start) — verify, do not edit it to suit the change.

---

## Task 6 — Stop fabricating a 22:00 deadline

**Files:** `src/features/today/useDayPlan.ts` (~line 209),
`src/features/today/DayTimeline.tsx`.

### The defect

```ts
const doneByMin = dayMeta?.doneByMin ?? WAKING_END_MIN;   // 22:00
```

A user who never set a finish still gets a 22:00 deadline, and every block past it
is flagged `overflow` under an amber boundary reading "Past here you run over.
Push it to …, or move a task to tomorrow." The user is told they ran over a target
they never chose. After 22:00 the effect is total: `dayStartMs > deadline` → zero
free windows → the entire day renders as overflow.

### Required behaviour

1. `useDayPlan` exposes `hasFinishTarget: boolean` (`dayMeta?.doneByMin != null`).
2. With no finish target, the engine's `deadline` is the end of the local day
   (`midnight + 24h - 1 min`), not 22:00 — it is a bound for the scheduler, not a
   target the user is measured against. Add a named constant to
   `src/engine/constants.ts` (e.g. `DAY_END_MIN = 24 * 60`) with a doc comment;
   do not inline the number. `WAKING_END_MIN` keeps its other uses.
3. `DayTimeline` renders the overflow boundary row (`OverflowBoundary`) **only**
   when `hasFinishTarget` is true. With no target, tasks that do not fit still
   render as `overflow` rows (they are real: the day has run out), but with
   neutral treatment and no "you run over" sentence — keep amber, never red, and
   keep the "move to tomorrow" affordance.
4. Copy for any new or changed string must be shaped by the `conversion-psychology`
   and `humanizer` skills and must not imply fault. Invoke both before writing it.

### Tests

- `useDayPlan`: `hasFinishTarget is false when no done-by is stored` and
  `the deadline is the end of the day when no finish is set` (assert a task at
  22:30 is placed, not overflowed).
- `useDayPlan`: `hasFinishTarget is true and the deadline is the stored minute
  when a finish is set`.
- `DayTimeline`: `the overflow boundary is not rendered without a finish target`
  (query `testID="timeline-overflow-boundary"`), and `it is rendered with one`.

---

## Task 7 — The plan footer stops mislabelling and mis-measuring

**File:** `src/app/(modals)/plan.tsx`.

### The defects

1. The footer always reads `Start by {plan.startBy}` even when the user pinned the
   **start** — under a forward fill that clock is a derived first-block start, not
   a deadline. "Start by" is only true for a finish-anchored day.
2. `finishAtMs` takes `Math.max(...plan.timeline.map(i => i.endAt))` over **all**
   rows, so a meeting that ends after your last task makes the footer report the
   meeting's end as your finish.

### Required behaviour

1. Word the line by anchor: `planAnchor === 'start'` → `Starting HH:MM · finish HH:MM`;
   `planAnchor === 'finish'` → `Start by HH:MM · finish HH:MM`. Copy passes through
   `conversion-psychology` + `humanizer`; no guilt, no fault.
2. `finishAtMs` is computed from `task` and `overflow` rows only — `event` and
   `breather` rows are excluded.
3. With `startBy === null` (Task 3), render no start clock at all rather than a
   fabricated one; if the finish clock is also unavailable, render no line.
4. `finishRunsOver` keeps its amber-only treatment and only applies when a finish
   target exists (Task 6's `hasFinishTarget`).
5. Layout, spacing and colour values keep coming from theme tokens; do not restyle
   the row beyond what the wording change requires.

### Tests (`src/features/today/__tests__/todayPlanEntry.test.tsx` or a new
`src/app/__tests__/plan.test.tsx`, matching the repo's existing patterns)

- `the footer reads "Starting" when the start is the pinned end`.
- `the footer reads "Start by" when the finish is the pinned end`.
- `a calendar event ending after the last task does not become the finish clock`.
- `no start clock renders when the plan placed nothing`.
