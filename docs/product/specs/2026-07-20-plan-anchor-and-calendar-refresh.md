# Plan anchor, overflow-in-place, and calendar refresh

Approved by the founder 2026-07-20 from mock rounds v1–v6
(`docs/product/mocks/brainstorm-2026-07-20*.html`). Three independent features
shipping on one branch.

Design invariants that constrain every decision here: **no guilt** (amber never
becomes red, no shame copy), **honey/sharpness stays monotonic**, **the core loop
stays on-device**, **every spacing/size/colour comes from a `tokens.ts` token via
`useTheme()`**, and **no bounce/slide entrances on content**.

---

## A · The anchor control

### The idea

The user chooses **which end of the day is fixed**. Fix the start and Whenbee
derives the finish; fix the finish and Whenbee derives the latest start. Done-by
stops being a standalone setting — it becomes one of the two answers.

Today the planner only ever fills **backward** from the deadline
(`backwardFill`, `planDayAroundAnchors.ts:144`), which packs work as late as
possible. With a 15:30 done-by and a 13:00 meeting, tasks fill 14:00–15:30 first
and only then spill backward past the meeting, producing a needlessly early
start-by of 11:00. Dragging a task cannot fix this: a drag rewrites `orderIndex`
only (`dayTasksStore.ts:441`), never which free window a task occupies, so the
engine re-derives the drag away on the next render. **That is the bug this
feature closes.**

### Copy — locked

| Row | Label | Value pill | Derived line |
|---|---|---|---|
| 1 | `Start at` | `Now ›` or `09:30 ›` | `finish 14:55` |
| 2 | `Finish by` | `15:30 ›` or `Set ›` | `start by 11:00` |

**The at/by split is load-bearing, not decoration.** A number the *user* set says
`at` (a plan built forward from it). A number *Whenbee* derived says `by` (the
latest moment you can still begin). Collapsing both to "start by" would turn a
plan into a deadline. Derived clocks are always mono, quiet, and prefixed with a
lowercase verb so they never read as settable. The fixed clock is the only
tappable number in each row.

### The chooser (mock v4, E1)

Two radio rows in a single `surfaceSunken` group, hairline between them, replacing
the standalone Done-by cell in the plan sheet footer:

- Selected row lifts to `surfaceRaised`; its derived clock is `accent`.
- Unselected row keeps `inkSoft` label / `inkFaint` derived clock, and **still
  shows its derived clock** — seeing both outcomes at once is the point, so the
  choice is a comparison rather than a guess.
- Tapping either value pill selects that row *and* opens the picker in one
  gesture.
- Row height ≥ 52 (clears the 44pt HIG floor with room for the derived line).

### The picker (mock v6, G1)

Reuse `FinishEditorSheet` + `FinishTimeWheel` untouched — same modal shell, same
gesture root, same Android wheel-only constraint. Two additions:

1. A `title` prop: `Start at` / `Finish by` (today it is hard-coded `Finish by`).
2. On the **start row only**, a quiet `Use now` link right-aligned on the title
   line — label left, shortcut right, the same header shape as the Today
   `CALENDAR · 3` row and the plan header's `Clear`. Tapping it sets the row back
   to Now and closes. The footer keeps only `Done`.

`Use now` is deliberately *not* rendered for the finish row — "finish by now" is
meaningless.

### State

```ts
startAtMin: number | null   // minute of day; null = Now
```

Mirrors `doneByMin`'s existing nullable-minute-of-day shape in `dayTasksStore`,
so this is one new field, not a new concept. Which row is selected is **derived,
not stored**: the finish row is selected when `doneByMin !== null` and the user's
last edit was the finish row. Store an explicit `planAnchor: 'start' | 'finish'`
if deriving proves ambiguous — decide in Phase 2, do not guess in Phase 1.

**Now is a live anchor, not a clock value.** `startAtMin: null` re-derives from
the current time on every render (floored at `now + MIN_START_LEAD_MIN`), so it
reads 09:05 this morning and 14:20 this afternoon. A spun `09:30` is pinned and
does not move. The two behave differently tomorrow; never silently convert one
into the other.

### Edge case — the chosen start time has passed

The user set 09:30 this morning; it is now 14:15. **Keep their 09:30** (it is
their intent, not an error) and state what is actually happening in the derived
line: `09:30 has passed · starting 14:20`. No red, no "you missed it", no
rewriting their number behind their back.

### Engine

Add `forwardFill` to `planDayAroundAnchors.ts` — a mirror of `backwardFill`,
reusing `normalizeAnchors` and `computeFreeWindows` unchanged, walking free
windows left-to-right from the anchor instead of right-to-left from the deadline.
Pure TS, no clock access, `nowMs` stays an argument. **TDD — write the tests
first.** Cover at minimum: fill with no anchors; fill around one meeting; a task
too big for the first window jumping to the next; a task that fits no remaining
window (returns unplaced); the `MIN_START_LEAD_MIN` floor.

---

## B · Overflow in place

Replaces `OverflowBanner` (`DayTimeline.tsx:300`) entirely. Delete it and
`overflowLabel` (`:78`).

Today an overflowing task is **named in a banner but not shown**, and a task the
engine genuinely cannot place is dropped from the timeline in silence
(`planDayAroundAnchors.ts:336`). Both stop.

**Layout** (mock v2, option B):

- A boundary row where the day runs over: mono `15:30 DONE BY` label + a hairline
  at `accent` ~28% alpha. No banner, no alert.
- One plain sentence beneath it naming both exits:
  `Past here you run over. Push it to 16:20, or move a task to tomorrow.`
- Overflowing task blocks render **in place, below the line**: `accentChip`
  background, `accent` title, `+50m over` as the meta line, and a filled
  `accentSoft` "Tomorrow" chip inside the block.
- **No left border, no inset accent edge, no banner.** Flat tinted card only.
- The footer's `finish` clock turns `accent` and reads the real overrun (16:20)
  while `Done by` still shows the target. The gap between the two numbers is the
  message.
- At three or more overflowing tasks the treatment holds (verified in mock v2);
  do not add a second design.

**Drag — both directions, always.** Overflow rows are ordinary
`ReorderableList` cells: same grip, same drag, same drop. Drag one up and the
engine re-runs; if it now fits it becomes a normal block and whatever got pushed
out takes its place. Drag a fitting task down and it becomes the overflow one.

A task dragged above the line that **still** does not fit is never rejected or
snapped back — it lands where it was dropped and the boundary line moves up above
it. The line is a readout of where the day runs over, not a wall. Nothing
bounces, nothing is refused.

Reuse the existing optimistic-order path (`DayTimeline.tsx:493`) — reconcile on
the stable task-id **string**, never the plan object, or `useDayPlan`'s
fresh-every-render plan will clear the override on the next frame and the drop
lag returns.

---

## C · Calendar refresh

`useDayCapacity` fetches once per day-selection and never again (dep array,
`useDayCapacity.ts:122`). Add an event in the OS calendar while Whenbee is open
and it never appears. There is no refresh affordance anywhere in the app and no
`RefreshControl` in `src/`.

**Three parts:**

1. **Auto-refetch** on app foreground and on screen focus, for both
   `useDayCapacity` and `useHonestDay`. `useFocusEffect` is already the house
   pattern (`usePatterns.ts:424`); calendar is the one hook that never got it.
   This is the missing 90% and needs no UI.
2. **A refresh glyph in the `CalendarOverlaySection` header**
   (`CalendarOverlaySection.tsx:160`), grouped right with the existing chevron.
   Alongside it, a quiet `updated 6m ago` stamp at `inkFaint` that appears
   **only** once data is older than 2 minutes — silent in normal use, loud
   exactly when a tap is worth it. The glyph tints to `primaryBright` on
   `primaryChip` in that stale state.
3. **Pull-to-refresh** on Today, the Plan drawer and Honest Day. Standard
   `RefreshControl`, indigo tint.

**Calendar event rows do not change.** Their design is approved and stays exactly
as it is — the only edit in that component is the header.

No refresh control in the Plan drawer header: it reads the same cache as Today
(`useDayPlan.ts:82`), so a third glyph would buy nothing. Pull-to-refresh covers
it.

---

## Out of scope

Per-task window pinning (drag pins a task above/below a meeting permanently) was
considered and deferred — it needs a new domain concept. The direction toggle is
the smaller honest fix and ships first.
