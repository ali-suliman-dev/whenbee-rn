# Today screen — deletable tasks & guess-led time display

**Date:** 2026-06-18
**Status:** Approved (visual mockup signed off from `docs/superpowers/plans/today-delete-and-time-display.html`)
**Scope:** Today screen only (`src/app/(tabs)/index.tsx` + `src/features/today/*`). No engine/db/domain changes.

## Goal

Two Today-screen changes, both approved from rendered mockups:

1. **Every task is removable** — queued rows, done rows, and the focus (NEXT) task — via swipe + long-press, with a first-run cue so the hidden gesture is discoverable.
2. **Each list row leads with the user's guess** — guess is the bold hero, our learned number reads as quiet support text `plan ~35 min` (no +delta, no background pill). The focus card is unchanged **except** its gap bar is toned down so Start is the only strong indigo.

Product invariants honored: no guilt language; amber stays in its honey/learned lane; core loop stays on-device; nothing hardcoded — all values from `tokens.ts`.

## Decisions (locked)

| Question | Decision |
| --- | --- |
| Delete mechanism | Swipe-to-delete on rows + long-press menu (also covers the focus card) |
| Discoverability | First-run peek: top row auto-nudges left ~30px revealing a red "Delete" sliver, springs back once; one-time coach pill "Swipe a task to remove it" |
| Row time display | Guess hero + `plan ~35 min` support — "plan" muted, `~35` amber, `min` muted. No pill/background. |
| Done row | Unchanged: `took 12 min` lead + `guessed 10` support |
| Focus card | Unchanged except gap bar |
| Focus gap bar | **B1 striped** — guess segment becomes a soft indigo diagonal hatch (not a solid block); amber overrun unchanged; Start becomes the sole solid indigo |

## Feature 1 — Deletable tasks

### Data
No store change. `useTasksStore.removeTask(id)` already exists and is the single mutation. Deletion is a hard delete from the kv-persisted list (consistent with the existing comment in `tasksStore.ts`).

### Swipe-to-delete (rows)
- Wrap `TaskRow` (queued **and** done) in `ReanimatedSwipeable` (`react-native-gesture-handler` 2.28).
- Trailing action only: red panel (`colors.danger`) with a trash glyph + "Delete" label, revealed on left-swipe.
- Full-swipe past threshold commits; otherwise it snaps to the open action which taps to delete.
- On commit: `haptics` medium, row collapses (height + opacity), `removeTask(id)`.
- The focus card is **not** a row → no swipe; it uses long-press.

### Long-press menu (all cards, incl. focus + a11y path)
- `Gesture.LongPress` on the focus card and each row → `ActionSheetIOS.showActionSheetWithOptions` (built-in, no new dep, native feel).
- Options: **Delete** (destructive index) + **Cancel**. "Start" is omitted — tapping the card/row already starts; "Edit" is out of scope (no edit-task flow exists yet).
- Provides the accessible, discoverable route and the only way to delete the focus task.

### Forgiving deletion (tap-to-confirm, no undo modal)
- Swipe **reveals** the red Delete action; it does **not** auto-commit on a full fling. The user taps the revealed Delete to remove (iOS Mail pattern) — deletion is always a deliberate two-step.
- Long-press route uses `ActionSheetIOS` with a **destructive** Delete + Cancel — itself a confirm.
- The existing `Toast` is `pointerEvents="none"` (non-interactive), so it cannot host an Undo button; an undo snackbar is out of scope. Tap-to-confirm + destructive sheet are the safety net (low friction, no guilt). On commit: `haptics.medium`, row height/opacity collapse, `removeTask(id)`.

### First-run peek cue
- New kv flag (e.g. `today.seenSwipeHint`) via `src/lib/kv.ts`.
- On Today mount, if unset **and** ≥1 queued row exists and reduced-motion is off: the first row's swipeable translateX animates to ~-30 then springs back (~600ms, `ease-out`), once. Show the coach Toast/pill "Swipe a task to remove it". Set the flag so it never repeats.
- Respects `useReducedMotion()` — when reduced, skip the animation but still set the flag (optionally still show the coach pill once).

## Feature 2 — Guess-led row time display

### Data
`TodayRow` already exposes `guessMin` and `honestMin`. Thread `guessMin` into `TaskRow` (the index already maps it).

### TaskRow changes
- Add `guessMin: number` prop. Pass it from both `upNext.map` and `done.map` in `index.tsx`.
- **Queued row** time cluster (replaces current `~{honestMin} min`):
  - Line 1 (lead): `{guessMin}` in `Inter-Bold`, `fontSize.lg` (20), `colors.ink`, tabular-nums, + ` min` in `caption`/`inkSoft`.
  - Line 2 (support): `plan ` (`caption`, `inkSoft`) + `~{honestMin}` (`Inter-Bold`, ~`fontSize.sm`, `colors.amberText`) + ` min` (`caption`, `inkSoft`). No pill, no background.
- **Done row**: keep `took {actualMin} min` as the lead; **add** a `guessed {guessMin}` support line (muted) so done rows match the queued guess-led rhythm. (Today's done row has no support line — this is a small addition, not a no-op.)
- Update `accessibilityLabel` to read guess-first: e.g. "Write a short email, Admin & email, you guessed 15 minutes, we plan 35. Tap to start."

### Token additions (`tokens.ts`)
- If a distinct lead size/weight is needed beyond existing `fontSize.lg`, reuse existing tokens; only add a token if a value is genuinely missing (per project rule). Expected: no new color tokens (`ink`, `amberText`, `inkSoft` cover it).

## Feature 3 — Focus card gap bar (striped guess)

### GapLine change (`src/features/today/GapLine.tsx`)
- Replace the solid `colors.primary` guess segment with a **soft indigo diagonal hatch**: indigo lines (`colors.primary`) over a `colors.primarySoft` ground, ~45°.
- Amber overrun segment + its scaleX reveal animation are unchanged. Live elapsed marker unchanged.
- Net effect: the bar no longer reads as a second solid-indigo CTA mass; the Start button is the single filled indigo (the "one indigo per screen" rule).

### Implementation note (for the plan)
RN Views have no repeating-gradient. Two viable token-driven approaches — the plan picks one:
- **Preferred:** render the guess segment via `react-native-svg` (already a dependency) `<Pattern>` of diagonal lines, clipped to the segment width, under the existing rounded-track `overflow:'hidden'`.
- **Fallback:** a small set of layered/rotated `View` stripes inside the guess segment.
Must be static (no per-frame work) to stay GPU-friendly.

### Token additions (`tokens.ts`)
- Add stripe geometry **nested under the existing `progress` group** (already enumerated in `useTheme.resolveTheme`, so no enumeration change needed): e.g. `progress.gapStripe = { lineW, gapW, angle }`. Colors come from existing `primary` / `primarySoft`.

## Components & files touched

- `src/features/today/TaskRow.tsx` — add `guessMin` prop, new two-line guess-led time cluster, swipeable wrapper, long-press, a11y label.
- `src/app/(tabs)/index.tsx` — pass `guessMin` to rows; long-press on focus card; first-run peek orchestration; Undo toast wiring.
- `src/features/today/GapLine.tsx` — striped guess segment.
- `src/theme/tokens.ts` — `progress.gapStripe` geometry (nested, no new top-level group).
- `src/lib/kv.ts` consumer — `today.seenSwipeHint` flag (no kv API change).
- Reuse: `src/components/Toast.tsx`, `src/lib/haptics.ts`.

## Testing (TDD for logic; interaction tests for UI)

- **Store:** `removeTask` already exists and is tested — no store change.
- **useToday:** unchanged; existing tests stay green.
- **TaskRow:** snapshot/interaction — renders guess as lead + `plan ~N min` support (queued); `took N min` (done); swipe action calls `onDelete`; long-press triggers menu.
- **First-run peek:** flag gates the animation (fires once, never again); skipped under reduced motion.
- **GapLine:** renders striped guess + amber overrun at correct fractions; reveal animation intact.
- Run `npm run lint` + `npm run typecheck` + `npm test`; verify on the iOS sim (no CLI tap — screenshot the rows, the swipe-revealed state, and the striped bar).

## Non-goals

- No Edit-task flow (long-press menu is Delete + Cancel only).
- No reordering (Edit-mode option was rejected).
- No change to the focus card beyond the gap bar.
- No change to the engine, db, domain types, or the guess→timer→learn loop.
- No new third-party dependencies.

## Open risk

Leading with the guess everywhere reframes Today as "your guess, gently corrected" rather than "the honest number." Mitigated by keeping `plan ~N` (the honest number, amber) one glance away on every row and unchanged on the focus card. Accepted by the founder.
