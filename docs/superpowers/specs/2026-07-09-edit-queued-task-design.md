# Edit a queued task — design

**Date:** 2026-07-09
**Status:** approved (entry pattern + coach), ready for implementation plan
**Surface:** Today list (`src/app/(tabs)/index.tsx`, `TaskRow`, `FocusCard`, `ShelfSection`), Add-Task drawer (`src/app/(modals)/add-task.tsx`, `useAddTask`), `dayTasksStore`.

## Summary

Let the user change a task after it's been added — its name, category, guess, and
scheduled day — by **long-pressing** the row and choosing **Edit** from the action
menu that already exists there. Edit opens the **same Add-Task drawer**, pre-filled,
retitled, with a **Save** CTA. A one-time coach hint teaches the long-press so the
entry is discoverable.

No new screen. No new gesture. The core loop's speed is untouched: **tap still starts
the timer**; long-press is the only manage affordance and it already exists.

## Decision log (why this shape)

- **Entry = long-press context menu, not a per-row pen or a single-tap menu.**
  - HIG designates the long-press context menu as the home for a row's secondary
    actions (Reminders, Mail, Files). Matching the platform, not fighting it.
  - HIG *deference* + Emil *"fewer elements, less cramping"*: a pen on every row is
    persistent chrome competing with content — the exact "too busy" the founder
    rejected with the play-buttons idea. Long-press adds **zero** row chrome.
  - Single-tap → menu was considered and rejected: tapping a queued row currently
    **starts its timer** (`startRow`). Gating start behind a menu taxes the app's
    highest-frequency action (guess→timer→learn) to serve an occasional one —
    backwards by Emil's frequency rule and HIG's "primary action gets the cheapest
    gesture." Start stays a single tap.
- **Scope = queued tasks only.** A queued task carries a non-`completed` `TaskEvent`
  — nothing has trained the calibration model, so editing name/category/guess/day is
  **100% calibration-safe**. Done rows hold a real logged actual that trained the
  multiplier; they are **not** editable here (out of scope — see below).
- **Reuse the Add-Task drawer**, don't build an edit screen. It already renders every
  field edit needs (title, category chips, guess wheel, live honest suggestion, day
  chip). One drawer, two modes.

## Scope

**In:**
- Edit a queued task's: **title**, **category**, **guess (min)**, **scheduled day**.
- Entry from long-press on: an `upNext` `TaskRow`, the `FocusCard` (next-up), and
  `ShelfSection` rows (shelf = queued, no day).
- One-time long-press discoverability coach.

**Out (this spec):**
- Editing a **done / logged** task or its `actualMin` — that mutates a calibration
  event and needs its own careful design. Done rows show no Edit affordance.
- Editing the **currently-running** task's guess mid-timer (see Edge cases — Edit is
  suppressed while that task's timer is live).
- Bulk / multi-select edit, an "Edit mode" toggle.

## Entry point — extend the existing action menu

Long-press already calls `promptRowActions(id, label)` → opens the cross-platform
`ActionSheet` with **Move to tomorrow / Pick a day… / Remove**. Add **Edit** as the
**first** item:

```
┌─────────────────────┐
│ ✎  Edit             │   ← new, first
│    Move to tomorrow │
│    Pick a day…      │
│ 🗑  Remove          │   (destructive, last)
└─────────────────────┘
```

- `Edit` → navigate to the Add-Task drawer in edit mode (below). Light haptic.
- Order rationale: Edit is the constructive primary; Remove stays last + destructive.
- Applies wherever `promptRowActions` is wired today (upNext rows, FocusCard, shelf).
- **Done rows never get Edit** — `DoneSection` rows don't open this menu with an Edit
  item (they carry a logged actual; out of scope).

## The drawer — Add-Task in "edit" mode

Reuse `src/app/(modals)/add-task.tsx` + `useAddTask`. The route already accepts params;
add an optional `editId`.

**Route:** `router.push({ pathname: '/(modals)/add-task', params: { editId: task.id } })`

**When `editId` is present, the drawer:**
1. **Pre-fills** title, category, guess, and target day from the task record (loaded
   via a repo read / the day store, not re-guessed). The category auto-guess and the
   spoken-title seed are **skipped** in edit mode — we show what's stored.
2. **Retitles** the header: `New task` → **`Edit task`**, and the sub drops the
   "What are you working on?" prompt (or becomes a quiet "Adjust the details").
3. **Swaps the primary CTA**: `Add to <day>` → **`Save`**. Secondary keeps a
   **`Save & start`** (mirrors today's `Add & start`) so the user can edit then launch.
4. **The day chip** ("Adding to Thursday") reads **"Scheduled for Thursday"** and its
   picker moves the task's day on save — unifying the menu's Move/Pick-a-day into the
   same sheet.
5. On **Save**: patch the task (see Data), dismiss with a toast ("Saved"), no navigation.
   On **Save & start**: patch, then `replace` to the timer with the updated honest
   number + guess (same threading `onAddAndStart` uses).

The live **honest suggestion** recomputes as the user changes category/guess — same as
add — so an edit shows its honest consequence at the moment of change.

## Data — `updateTask` on the store

Add one method; no schema change.

```ts
// dayTasksStore
updateTask(id: string, patch: {
  label?: string;
  category?: string;
  guessMin?: number;
  plannedDate?: string | null;
}): Promise<void>
```

- Backed by a `taskEventsRepo.update(id, patch)` (or `recurringRepo` equivalent) that
  writes only the queued (non-`completed`) row's editable columns.
- After write: reload the selected day + shelf + dots (same reconcile the other
  mutations do), so the row reflects the edit instantly.
- **Calibration invariant:** `updateTask` only touches a non-`completed` `TaskEvent`.
  The engine trains solely on `status: 'completed'` rows, so a queued edit **cannot**
  move any multiplier. A test asserts this (below).
- `useAddTask` gains an edit branch (or a sibling `useEditTask` sharing the field
  state) that calls `updateTask` instead of `addTask`. Keep the field/state logic
  shared so the two modes never drift.

## Discoverability — the long-press coach (required)

Long-press is discoverable, not visible — HIG's own mitigation is a one-time hint.
The founder asked explicitly to keep this so users learn the gesture.

- **What:** a quiet pill on the **first queued row** (the next-up task): **"Press &
  hold for options"**. Muted `inverseSurface` pill + `inverseText`, same visual family
  as the existing done-row swipe coach (`showCoachMark`).
- **One-shot:** new KV key `today.seenLongPressHintV1`. Show while unset; retire (set
  it) the first time the user **either** long-presses a row **or** the hint has been
  on screen for one session. Reuse the `TaskRow` coach-mark plumbing
  (`showCoachMark`/`onCoachMarkDismiss` props) — new key, new copy, same mechanism.
- **Reconcile with the existing swipe teaching:** today the first *queued* row plays a
  swipe **peek** (`peekFirstRow` / `today.seenSwipeHint`) and the first *done* row shows
  "← swipe to remove". Two hints on the same queued row = clutter. **Decision: retire
  the queued-row swipe peek** and let the long-press hint own the first-run slot on
  that row. Swipe-to-remove/-move still works (unchanged) and is now *also* discoverable
  through the menu's own labels; the done-row swipe coach is untouched. Never show two
  first-run hints on one row.
- **Motion:** opacity fade only (`t.motion.base`), no slide, no bounce — per the
  animation hard rule. Reduced motion → appears at final opacity, no travel.

## Copy (conversion-psychology + humanizer)

| Slot | Text | Note |
| --- | --- | --- |
| Menu item | **Edit** | Plain verb; matches Remove/Move register. |
| Drawer header | **Edit task** | Mirrors "New task". |
| Primary CTA | **Save** | Not "Update"/"Confirm changes" — shortest true verb. |
| Secondary CTA | **Save & start** | Mirrors existing "Add & start". |
| Day chip (edit) | **Scheduled for Thursday** | Honest — it's already on the day. |
| Save toast | **Saved** | One word; the row already shows the change. |
| Coach pill | **Press & hold for options** | Teaches the gesture, not just "edit" (menu also moves/removes). No guilt, no exclamation. |

## Edge cases

- **Task is the running timer:** if the focus row's timer is live, suppress **Edit**
  in its menu (editing guess mid-run is ambiguous). Move/Remove behaviour there is
  unchanged.
- **Editing the day to a past/other day:** reuses the existing day-picker range
  (tomorrow…+7) plus "Today"; the save reconciles the source and target days.
- **Empty title on save:** same gate as add — Save disabled until title non-empty +
  category set (no scold).
- **Category changed to one with different learned bias:** honest number recomputes
  live; expected, not a bug.
- **Concurrent edit + swipe-delete:** deleting wins; a Save on a since-removed id is a
  no-op (guard the repo update on row existence).

## Testing

- `updateTask` unit: patches label/category/guess/day on a queued row; leaves
  `completed` rows and calibration stats untouched (assert no multiplier change).
- Edit-mode prefill: opening `add-task?editId=X` shows the stored title/category/
  guess/day, and does **not** run the category auto-guess/seed.
- Save path: patch persists; day reload reflects it; toast shows; no navigation.
- Save & start: patch persists then routes to timer with updated honest + guess.
- Coach one-shot: hint shows once, retires on long-press or session, never co-occurs
  with the swipe peek on the same row.
- Menu: Edit is absent on done rows and on the running task's menu.

## Files touched (implementation sketch)

- `src/app/(tabs)/index.tsx` — add **Edit** to the `rowActions` items; suppress it for
  the running task; add the long-press coach state (`today.seenLongPressHintV1`);
  retire the queued-row swipe peek.
- `src/app/(modals)/add-task.tsx` — read `editId`; edit-mode header/CTA/day-chip copy;
  Save / Save & start handlers.
- `src/features/add-task/useAddTask.ts` — edit branch (prefill + `updateTask`), shared
  field state; skip auto-guess/seed when editing.
- `src/stores/dayTasksStore.ts` — `updateTask(id, patch)` + reconcile.
- `src/db/*` repo — `update(id, patch)` on the queued row.
- `src/features/today/TaskRow.tsx` — reuse coach-mark props for the long-press hint copy.
- Tests alongside each.
