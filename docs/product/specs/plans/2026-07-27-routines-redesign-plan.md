# Routines redesign — implementation plan

Founder-approved 2026-07-27. Mocks (open these before implementing):
`docs/product/mocks/2026-07-27-routines-v2.html` (authoritative — V1 chips, full
builder, gap control) and `docs/product/mocks/2026-07-27-routines-redesign.html`
(superseded except for the swipe/manage rationale).

The routines surface has no way to delete a routine, no way to reorder steps, a
list card where the name and the total shout at the same volume, and a gap
between steps that nobody can change. Everything below is UI wiring plus one
new persisted field — `removeRoutine`, `reorderSteps`, `scheduleDays` and
`setSchedule` all already exist in `src/stores/routinesStore.ts` and are used by
nothing.

## Global Constraints

These bind every task. A reviewer should treat a violation as a defect.

1. **Every spacing / size / font / colour value comes from a token** in
   `src/theme/tokens.ts` via `useTheme()`. No inline numbers, no hex. If a
   token is missing, add it to `tokens.ts` and add the matching line to
   `useTheme`'s `resolveTheme` (a new token group without that line resolves
   `undefined`).
2. **No amber on the routines list or builder.** Amber (`accent`, `amberText`)
   is the overrun/honest signal on Today and the timer; spending it here
   devalues it. Indigo (`primary`) is rationed to exactly one thing per
   surface — see the per-task specs.
3. **No guilt language**, no streaks, no shame. Deleting or changing a routine
   is never framed as loss.
4. **Destructive confirmation uses the app's `ConfirmSheet`**, never
   `Alert` and never `ActionSheetIOS` (iOS-only, crashes Android). Any
   menu/picker uses `src/components/ActionSheet.tsx`.
5. **Animation:** no spring/bounce/overshoot, no translate-in on content.
   Opacity fades and subtle scale only. Reduced motion → final state.
6. **`Pressable` stays a bare touch wrapper** — all visual style lives on an
   inner `View` (reactCompiler + nativewind drop function-form styles).
   Reanimated shared values use `.get()/.set()`, never `.value`.
7. **TDD for logic** (engine, stores, db, `src/lib/*`): write the test first.
   Run `npx jest <path>` for the suite you touched **and** `npm test` before
   reporting done. `npm run lint` and `npm run typecheck` must both be clean.
8. **Conventional Commits. No AI/co-author attribution of any kind** — no
   `Co-Authored-By`, no "Generated with", no robot emoji. Project policy.
9. Do not touch anything under `modules/whenbee-presence/` or the presence
   services — unrelated and add-only by founder rule.

## Task 1 — Persist a per-routine gap override

The gap between steps is currently derived: `buildRoutineRail` spreads
`honestTotalMin - sum(perStep)` across the gaps, where `honestTotalMin` comes
from the learned `transitionFactor`. The founder wants it settable, with
"Learned" as the default. `null` means learned (today's behaviour, unchanged).

- `src/domain/types.ts`: add to `Routine`:
  ```ts
  /** User-set minutes between every step, or null to use the learned
   *  transition factor. A number here means the honest total is the sum of the
   *  steps plus these gaps — deliberately less learned, more controlled. */
  gapMin: number | null;
  ```
- `src/db/migrations.ts`: append a new migration string to `MIGRATIONS`:
  `ALTER TABLE routines ADD COLUMN gap_min INTEGER;` (nullable — no default,
  so existing routines read as learned).
- Map the column in the routines repository / queries both directions.
- `src/features/routines/routineRailModel.ts`: `BuildRoutineRailInput` gains
  `gapMin: number | null`. When `gapMin === null` keep today's derivation
  exactly. When it is a number: `breatherEach = gapMin`, and
  `honestTotalMin = sum(perStep) + gapMin * nGaps`. Breather rows render when
  `gapMin > 0`; `gapMin === 0` renders no breather rows and advances the clock
  by 0.
- `src/stores/routinesStore.ts`: `gapMin` on the draft (default `null`), a
  `setGap(min: number | null)` action, persisted through `saveDraft` and read
  back in the loader.

Tests first: `routineRailModel` for learned (unchanged output), `gapMin: 0`,
and `gapMin: 10` (total = steps + 10 × gaps, clocks anchored to the finish);
store round-trip; migration applies to an existing DB.

## Task 2 — The list card (mock section 1, V1)

`src/features/routines/RoutinesList.tsx`, `RoutineCard`.

Structure: a head row (name left, delete affordance right), then one wrapping
chip row. Delete the `StepChip` top-right, the `honestNumberMd` total, the
basis caption (`model.summary.label` — "based on typical patterns" says
nothing) and the start-by icon row.

- Name: `type.bodyLg`-scale, `fontWeight` semibold-or-above, `colors.ink`,
  `numberOfLines={1}`.
- Chips, in this order: **duration**, **start**, **steps**. Each is a pill
  (`radii.full`, `overflow: 'hidden'`) on a neutral fill; the **number is
  `fontFamily.mono`, `colors.ink`, bold** and the trailing unit word is
  `colors.inkSoft` regular. Content: `42 min` · `7:12am start` · `5 steps`.
- Exactly one chip is tinted — the **start** chip (`primaryWash` fill,
  `primarySoft` border). It is the only fact the user acts on. If the routine
  has no `doneByMinuteOfDay`, that chip is **not rendered at all** (no "not
  set" placeholder) and the row reflows.
- Delete: an icon button in the head row (`trash-outline`, `iconSize.sm`,
  `colors.inkFaint`, hairline-bordered circle, `size.hitSlop`). Tapping opens
  `ConfirmSheet`; confirming calls `routinesStore.removeRoutine(id)`. Its
  `accessibilityLabel` is `Delete ${name}`. The card's own press-to-open must
  not fire when the delete button is pressed.
- Confirm copy — no guilt, states what is and isn't lost:
  title `Delete ${name}?`, body
  `The steps' own timing stays learned — only this routine goes.`,
  confirm `Delete`, cancel `Keep it`.

Snapshot/interaction tests: the three chips render with the right numbers, the
start chip is absent when there is no finish time, no amber token appears
anywhere in the tree, and delete → confirm calls `removeRoutine` exactly once
while a plain card tap opens the routine.

## Task 3 — The rail: step rows, read-only finish, quiet breather

`src/features/routines/RoutineRail.tsx`.

- **Step row:** title stays. The meta line becomes the **category name only** —
  drop `· {honestMin}m honest` and `· {clock}`. The minutes move to a
  right-aligned value in the row: `fontFamily.mono`, bold, `colors.ink`, with a
  `m` suffix at ~0.6em in `colors.inkSoft`. The clock already lives in the
  `PlanRail` gutter; stating it twice is what made the line feel cluttered.
- **Finish cap row:** stop being a control. Today it is a `Pressable` that
  opens the finish editor and, with no time set, renders
  `＋ set a finish time`. It becomes a plain readout: when a finish exists,
  the `done by` cap renders exactly as now but non-interactive; when none is
  set the row renders **nothing at all**. The finish time is set from the
  "This routine" block (Task 4). Remove `onEditFinish` from
  `RoutineRailProps` and its call site.
- **Breather row:** stays exactly as it is — a quiet, non-interactive
  `+{min}m in-between` caption. It is NOT a control (the founder chose the
  settings-row door only). Do not add a chevron, a "change" link or a press
  handler.
- Swipe-left-to-delete a step stays as-is.

## Task 4 — Builder bottom blocks + dock

`src/features/routines/RoutineBuildView.tsx`. Mock section 2, right-hand phone.

Order down the scrolling column: back → name field → honest total → rail →
`＋ add step` (rail tail, unchanged) → **This routine** → **Manage this
routine**. The dock stays pinned above the safe-area inset throughout.

- **Dock:** remove the `＋ Step` ghost button entirely (the rail's
  `＋ add step` is the single add affordance). `Save` becomes the only dock
  button, `fullWidth`, keeping its current variant/size and disabled rule.
- **"This routine"** — a grouped card (`radii.card`, `surface`,
  hairline border, `overflow: 'hidden'`) with an eyebrow header and three
  rows, each `label` left and `value ›` right (value in `fontFamily.mono`,
  `colors.inkSoft`, with the value word itself in `colors.ink`):
  - `Finish by` → `7:55am` or `Not set` → opens the existing
    `FinishEditorSheet`.
  - `Gap between steps` → `Learned · 5m` when `gapMin === null` (the number is
    the currently derived per-gap value), else `5m` → opens the gap sheet
    (Task 5).
  - `Runs on` → `Weekdays` / `Every day` / `Mon, Wed, Fri` / `Not scheduled`
    → opens the schedule sheet (Task 6).
- **"Manage this routine"** — the same grouped card, rendered last, with an
  eyebrow header and exactly **two** rows: `Duplicate`, then
  `Delete routine` in `colors.danger` (mark the colour use
  `// audit-ok: destructive`). No "Reset what it's learned" row — the founder
  explicitly excluded it.
  - `Duplicate` creates a copy named `${name} copy` with the same steps,
    finish, gap and schedule, then navigates to it.
  - `Delete routine` uses the same `ConfirmSheet` + copy as Task 2, then
    navigates back to the list.
- The scroll content keeps bottom padding ≥ the dock height so
  `Delete routine` can always be scrolled clear of `Save`.

## Task 5 — Gap sheet

A sheet opened only from the "This routine" → `Gap between steps` row.

- Follows the modal/sheet hard rules: `headerShown: false` if it is a route,
  `SheetGrabber` first if it slides up. Prefer the existing in-view sheet
  pattern (`StepEditorSheet` / `FinishEditorSheet`) over a new route.
- Title `Gap between steps`; one line of body:
  `Applies to every gap in this routine.`
- Options as a wrapping row of chips, in this order: **`Learned · {n}m`**
  (first, selected by default when `gapMin === null`), then `0`, `5`, `10`,
  `20` (from `BREATHER_CHIPS` in `src/engine/constants.ts`). Selected chip:
  `primarySoft` fill, transparent border, `colors.ink`. Unselected: hairline
  border, `colors.inkSoft`.
- Footnote: `Learned uses what your run-throughs actually cost between steps.`
- Picking `Learned` sets `gapMin = null`; picking a number sets that number.
  The builder's honest total and every step clock recompute immediately.

## Task 6 — Schedule sheet (wire `scheduleDays`)

`scheduleDays: number[]` (0 = Sunday) and `setSchedule` already exist and are
wired to nothing; `ScheduledRoutineBlock` on Today already renders scheduled
routines. This task only adds the picker.

- Same sheet pattern as Task 5. Title `Runs on`.
- Seven weekday toggles (device-locale first day of week), plus quick
  `Weekdays` / `Every day` / `None` shortcuts.
- Writes through `setSchedule`; empty array = unscheduled.
- Verify a saved schedule makes the routine appear in `useScheduledRoutines`
  and render a `ScheduledRoutineBlock` on Today.

## Task 7 — Drag to reorder steps

`RoutineRail` + `RoutineBuildView`, wiring the unused
`routinesStore.reorderSteps(ids)`.

- **Long-press on a step card lifts it**; drag moves it; drop persists. No new
  grip, handle, or button is added — long-press is currently unused on these
  rows (tap = edit, swipe = delete).
- Only step rows are draggable. Start/finish caps, breather rows and the
  `＋ add step` tail are never drag sources and never drop targets — mirror
  `DayTimeline`'s approach: the reordered array is filtered down to step ids
  before it is persisted.
- **The known reorder flash:** `react-native-reorderable-list` swaps its whole
  `data` array on drop, re-mounting cells and replaying any `entering`
  animation. Let the entrance fade play once on mount, then drop the
  `entering` prop behind a state flag (see `DayTimeline`'s `entrancesDone`).
- Reconcile optimistic order by comparing a **stable id string**, never object
  identity.
- If the rail must move inside a `ScrollView`, use the library's nested list
  support rather than nesting a plain list.

## Out of scope

Swipe-to-delete on the list card (the visible icon is the chosen affordance),
per-gap values, alert lead time UI (`alertEnabled` / `alertLeadMin` stay
unwired), and anything on the routine **run** view.
