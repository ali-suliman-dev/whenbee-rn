# Category delete + "Manage this area" card — design

**Date:** 2026-07-14
**Status:** Approved (visual + copy), ready for implementation plan
**Screen:** Category detail (`src/app/category/[category].tsx`), reached by tapping an area on the Whenbee tab.

## Problem

A category can be *reset* (wipe its learning, keep the area) but there is no way to *delete* it — remove the area and its data entirely. The reset control today is a lone inline pill at the bottom of the detail screen. We want a real Delete beside Reset, both guarded by a confirmation.

Founder decision: approach **B — a grouped "Manage this area" card**, with **both** rows confirmed by a focal overlay.

## What "reset" vs "delete" mean

- **Reset** (exists) — `calibrationStore.resetCategory(id)`: deletes the category's task-event logs, re-seeds `category_stats` back to the prior, clears its goal. The category **stays tracked**. Honey/tier untouched. Gentle, indigo, recoverable-feeling.
- **Delete** (new) — removes the area from the tracked list **and** deletes its `category_stats` row (plus logs + goal). The area disappears. Truly destructive → the app's only red, guarded by a can't-undo confirm.

Delete is always visually **subordinate** to Reset — never a same-weight twin.

## UI

### 1. "Manage this area" card (replaces the inline reset block)

At the bottom of the detail ScrollView, replace the current `resetBlock` (`category/[category].tsx:165–202`) with a grouped card — iOS Settings-style, borderless, hairline row dividers:

- Header: `Manage this area` (crumb caption, `inkFaint`).
- **Reset learning** row — `refresh` glyph (`inkSoft`), title `Reset learning`, sub `Clears the guess history, keeps your honey`, chevron. Taps → Reset overlay.
- **Delete area** row — `trash` glyph (`danger`), title `Delete area` (`danger` text), sub `Removes this area and its data`, chevron. Taps → Delete overlay.

**Last-area guard:** when only one area is tracked (`categories.length <= 1`), the **Delete row is hidden**; Reset stays. Mirrors `categoriesStore.removeCategory` already refusing to remove the last category.

### 2. Confirmation overlay (both rows)

One reusable centered dialog over the app's `scrimOverlay` dim (same layer idea as `ForgotCard`). Two variants:

| | Reset | Delete |
|---|---|---|
| Glyph disc | `refresh` on `primarySoft` / `primary` | `trash` on `dangerSoft` / `danger` |
| Title | `Reset Cooking's learning?` | `Delete Cooking?` |
| Body | `Whenbee starts over learning this area. Your honey and tier stay — only the guess history resets.` | `Removes this area along with its logs, learning, and goal. This can't be undone.` |
| Cancel | `Keep it` (ghost) | `Keep it` (ghost) |
| Confirm | `Reset` (indigo) | `Delete area` (filled `danger` + `dangerEdge` coin-edge) |

Cancel = tap "Keep it" **or** the scrim. The title interpolates the real category label.

### Motion (per the no-tacky-entrance rule)

Dialog **fades + settles scale 0.95 → 1** (ease-out, ≤ `motion.base`). No slide, no bounce, no spring overshoot. Scrim fades in. Buttons press-feedback `scale.pressIn`/0.97. Reduced-motion → final state, no travel.

## Data / logic layer (new work)

There is no per-category `category_stats` delete today (only a wholesale account reset drops the table). Add a real path:

1. **db** — `deleteCategoryStats(category)`: `DELETE FROM category_stats WHERE category = ?` in `sqliteDatabase.ts`; mirror in `memoryDatabase.ts`; add to the `Database` interface.
2. **repo** — `categoryStatsRepo.delete(category)` → `db.deleteCategoryStats`.
3. **calibrationStore** — new action `deleteCategory(categoryId)`:
   - `taskEventsRepo.deleteByCategory(categoryId)` (logs)
   - `categoryStatsRepo.delete(categoryId)` (stats row)
   - `get().clearGoal(categoryId)` (KV goal + celebrated flag)
   - remove the key from the in-memory `statsByCategory` cache.
4. **categoriesStore** — `removeCategory(id)` already exists (filters the tracked list, refuses the last one). Reuse as-is.

### Delete orchestration (detail screen)

A `deleteArea()` (in `useCategoryDetail` or a small `useCategoryDelete` hook):
1. `categoriesStore.removeCategory(categoryId)` — drop from tracked list.
2. `calibrationStore.deleteCategory(categoryId)` — wipe stats/logs/goal.
3. Navigate back to the Whenbee tab (`router.back()` / replace) and show a toast: `Area removed`.

Reset keeps calling the existing `resetCategory` / `handleReset`; only its trigger moves from the inline pill to the Reset overlay (the inline confirm state is removed).

## Invariants to honor

- **Honey/sharpness is monotonic.** Deleting an area removes only that area's stats. Verify the global companion tier cannot drop as a side effect of a delete (the plan must add a check/test).
- **No guilt.** Delete copy is neutral and factual — no shame, no warning-red beyond the single destructive accent.
- **On-device only.** All of this is local db/KV; no network.
- **Pricing / Pro** — unaffected.

## Components touched / added

- New: `src/features/category-detail/ManageAreaCard.tsx`
- New: a reusable confirm dialog — `src/components/ConfirmDialog.tsx` (variant `indigo | danger`), or reuse an existing overlay primitive if one fits. Buttons via `AppButton`; confirm the button component has (or gets) a `danger`/destructive variant with the `dangerEdge` coin-edge.
- Edit: `src/app/category/[category].tsx` — swap `resetBlock` for `<ManageAreaCard>`, drop the inline reset confirm state.
- Edit: `src/stores/calibrationStore.ts`, `src/db/repositories/categoryStatsRepo.ts`, `src/db/sqliteDatabase.ts`, `src/db/memoryDatabase.ts`, `Database` interface.

## Tests (TDD for the logic layer)

- `calibrationStore.deleteCategory`: logs deleted, `category_stats` row gone, goal cleared, `statsByCategory` key removed.
- `categoryStatsRepo.delete` (memory + sqlite).
- Orchestration: after delete the category leaves the tracked list; the last-category case is a no-op (Delete row never shown).
- `ManageAreaCard`: Delete row hidden when `categories.length <= 1`; both rows open their overlay.
- Regression: deleting a category does not lower the global honey tier (monotonic invariant).

## Out of scope

- Undo/restore of a deleted area.
- Deleting from the Whenbee tab row (swipe / overflow) — considered (approaches C/D) and set aside; Manage card is the single home.
- Rename area (the card's grouped shape leaves room for it later; not built now).
