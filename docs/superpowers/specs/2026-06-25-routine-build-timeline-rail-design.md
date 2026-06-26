# Routine Build — Timeline Rail Redesign

**Date:** 2026-06-25
**Surface:** `src/features/routines/RoutineBuildView.tsx` (Pro, inside the Plan tab)
**Status:** Approved design, pending implementation plan

## Problem

The current build screen has six UX defects:

1. **Save** sits top-right at `size="sm"` — out of the thumb arc, weak target, competing with the heading.
2. **Two titles fight:** a `"New sequence"` heading plus a `"Name this routine"` underline field. Neither reads as *the* title; the name field looks like a body input.
3. **The payoff is buried.** `About 85 min` (the honest total) is the whole point of the screen but sits mid-page, static, below a generic heading.
4. **Step rows are cramped:** title + category + honest + `DurationWheel` + "Remove" jammed in one row. "Remove" is a tiny destructive text target; no swipe.
5. **A sequence doesn't look like a sequence.** A routine is ordered steps with transitions between them ("including the in-between time"), but it renders as a flat card list — the story is told in words, not shown.
6. **Finish-by is dumped at the bottom** — a full wheel for an optional field, buried and easy to miss.

## Approved direction: Timeline Rail (Direction B)

Reframe the builder as a vertical **timeline rail** — the same `PlanRail` component `RoutineRunView` already uses — so build and run read as one product. The in-between time becomes a visible breather node instead of a caption, and the finish-by becomes the rail's terminal node with real clock times derived from the reverse Start-By planner.

### Decisions locked

- **Drop the `"New sequence"` / `"Edit sequence"` heading.** The editable routine name *is* the title (`type.heading`). Empty state shows `Name this routine` as a heading-sized placeholder.
- **Transition is display-only.** The honest total already bakes in the in-between via `TRANSITION_PRIOR ×1.15` (`routineHonestTotal`). The breather node label shows the distributed gap `(honestTotal − Σ perStepHonest) / (n − 1)`, rounded to 5. No engine or data change; `breatherMin` per gap is explicitly **not** adopted in v1.

## Layout & hierarchy

```
┌─────────────────────────────────────┐
│  Morning routine              ✎      │  name = the title (inline-edit)
│                                       │
│         About 85 min                  │  HERO honest total (count-animates)
│       incl. in-between time           │  quiet caption beneath
│                                       │
│   ┌ 7:15   start                      │  clock times only when finish-by set
│   ●── Get ready            35m        │  step node = "next"
│   ┊   +5m settle              ◦       │  breather node = the in-between
│   ●── Breakfast            25m        │
│   ┊   +5m settle              ◦       │
│   ●── Commute prep         15m        │
│   └ 8:40   done by              ✓     │  terminal node = finish-by
│        ＋ add step                    │
│············· scroll ends ············ │
├─────────────────────────────────────┤
│  [   ＋ Step   ]   [    Save    ]     │  sticky dock, thumb zone
└─────────────────────────────────────┘
```

The editable name carries the title role (tap → caret + keyboard). The hero honest total owns the top third. Everything below is the rail.

## The rail

- One `PlanRail` per row (gutter + node + spine), identical to `RoutineRunView`.
- Step nodes are `state="next"` (quiet hairline spine) in build mode.
- **Breather node** (`RailNode` already supports `breather`) between consecutive steps, labeled with the distributed in-between minutes — the "including the in-between time" caption made visible.
- **Terminal node** = finish-by: `✓ 8:40` when set; a `＋ set a finish time` affordance when not.

## Clock times — Start-By payoff

The rail shows real clock times **only when a finish-by is set**, derived backward through `planDayAroundAnchors` → `startBy`. Set "done by 8:40" → the rail fills in `start 7:15` and each node's clock time. No finish-by → durations only, and the terminal node becomes the CTA `＋ set a finish time`. This replaces the buried bottom wheel and surfaces the Pro Start-By anchor where it is actually useful.

## Interactions

| Action | Now | New |
|---|---|---|
| Edit duration | inline `DurationWheel` in the row | tap step card → `formSheet` with `DurationWheel` + `CategoryChips`; row breathes |
| Delete step | tiny "Remove" text link | swipe-to-delete (native iOS); no link in the row |
| Add step | dashed row expands inline composer | `＋ add step` at the rail tail opens the edit sheet (empty); dock `＋ Step` does the same |
| Set finish-by | wheel at page bottom | terminal node / dock → finish-by `formSheet` |

All sheets: `formSheet`, `headerShown: false`, open with `<SheetGrabber />`, render their own title (per the project modal hard rule).

## Bottom dock

Non-scrolling footer pinned above the tab bar:

- `[＋ Step]` — secondary (ghost).
- `[Save]` — the single primary, `variant="indigo"`, **default `AppButton` size (not `lg`)**, disabled until name + ≥1 step (reuse `canSave`), same a11y hint.
- Footer adds `useSafeAreaInsets().bottom`; scroll content pads by the dock height so nothing hides beneath it.

## Motion (within the no-bounce hard rule)

- Hero total **count-animates the number only** (opacity/Text, no translate, no overshoot) when steps change — the payoff reacting is the one delight moment.
- New rail row: opacity fade + ≤1px settle, no slide-up, no spring. Reduced-motion → final state.
- Step card press: `scale(0.97)`, ~160ms ease-out (Emil press feedback).
- Swipe-delete: the spine above re-flows by fade, not a jarring collapse.

## Reuse vs. new

**Reuse:** `PlanRail`, `RailNode` (incl. `breather`), `DurationWheel`, `FinishTimeWheel`, `CategoryChips`, `TaskTitleField`, `categoryName`; engine `stepHonestMinutes`, `routineHonestTotal`, `planDayAroundAnchors`, `TRANSITION_PRIOR`.

**New:**
- Edit-step `formSheet` route under `src/app/(modals)/` (listed in `_layout.tsx` with `headerShown: false`), or an in-surface sheet if the build view stays a non-route sub-view — to confirm in the plan.
- Sticky dock footer.
- Rail-row card component (label · category · honest, duration as tap target).
- Count-animate on the hero total.
- Swipe-to-delete wrapper for rows.

**Tokens:** any missing spacing/size value is added to `src/theme/tokens.ts` (with the matching `useTheme` resolver line) and consumed as a token — never inlined.

## Product invariants honored

- No guilt / no streaks / no shame — overrun stays amber, never red (unchanged from run view).
- Honey/sharpness monotonic — untouched.
- Pricing read from RevenueCat — untouched.
- Core loop on-device-only — the reverse planner is pure engine, no network.

## Out of scope (v1)

- Explicit per-gap `breatherMin` editing (display-only distribution stands).
- Reordering steps via drag (kept as add/edit/delete; revisit post-launch).
- Any change to `RoutineRunView` beyond what shared-component reuse forces.
