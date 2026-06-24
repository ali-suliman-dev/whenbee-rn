# Today screen — calm pass (Next card + Done list)

**Date:** 2026-06-22
**Status:** approved (founder approved the rendered mock; this is the build spec)
**Scope:** visual/interaction only. No engine, store, or data changes. The
running-timer card (`RunningFocusCard`) is the calm north star and is **not
touched**.

## Problem

The pre-start "Next" focus card (`FocusCard`) reads chaotic. Root cause: it
encodes one insight — *"you under-guessed; this really takes ~15"* — **three
times in amber** (the gap-bar amber segment, the `+5 learned` pill, and the
`OptimismNudge` pill), plus a heavy full-width CTA. Three amber elements on one
card = three warnings; nothing leads. Amber is the app's alarm/honey accent and
the invariant is *"amber states a fact, never a scold."* The screen also keeps a
`DONE TODAY` list permanently expanded, adding noise.

Mocks (real dark-mode tokens) the founder reviewed:
`docs/product/specs/mocks/today-focuscard-options.html` and
`docs/product/specs/mocks/today-nudge-options.html`.

## Decisions (locked)

### 1. FocusCard — collapse three ambers to one

- **Remove `OptimismNudge` completely** from the card: the import, the `showNudge`
  gate, and the rendered pill. No replacement sentence. The amber `+ N learned`
  on the labels row is the sole optimism signal.
- **`+N learned` badge → plain amber bold text.** Drop the `accentSoft` pill
  background and its padding. Render as bold `amberText` (dark: `#EEAE4D`) at
  caption size. Copy: `+ N learned` — **a space after the `+`** (e.g. `+ 5
  learned`).
- **Labels row layout** stays: a left cluster `guessed {N}` + `+ {delta} learned`
  with a tight **4px gap** (`space[1]`) between them; `done {clock}` pushed to the
  right. (Was `space[1.5]` = 6px.)
- The gap bar and the `done {clock}` finish projection are unchanged.

### 2. FocusCard — tame the CTA

- Keep the Start button **full-width** and at **md height (44pt — HIG floor)**.
  Narrowing/centering is explicitly rejected (leaves the same footprint, looks
  broken).
- Reduce the perceived bulk via a **shallow coin-edge** (depth 8→4) — matches the
  approved mock. Implement as an opt-in `depth?: 'standard' | 'shallow'` prop on
  `AppButton` (default `'standard'`, so every other button is unchanged). Add
  `depth.shallowEdge = 4` and `depth.shallowDrop = 3` tokens; the shallow path
  reads those instead of `depth.edge`/`depth.drop`.

### 3. Done list — collapsible

- `DONE TODAY` section becomes a collapsible header in `(tabs)/index.tsx`.
- **Collapsed by default.** Header shows the section label + a quiet summary:
  `DONE TODAY · {count}` (e.g. `DONE TODAY · 1`), with a chevron affordance
  (`chevron-down` collapsed / `chevron-up` expanded), 44pt tappable row.
- Tap toggles the rows open/closed. Expand state is ephemeral (component state),
  default collapsed every visit — the day's progress is reachable, never in the
  way.
- The first-session swipe coach-mark on the first done row only needs to fire
  when the list is expanded; gate it on the expanded state so it isn't spent
  while collapsed.
- Animate the expand with a height/opacity reveal (`motion.base`, standard
  easing), entering-only (no exit animation — Fabric `exiting` crash invariant).

## Out of scope (this pass)

- Honey HUD, quick-start chips, Up Next rows, RunningFocusCard, retro chip.
- Any copy change to `done {clock}` / `guessed {N}`.

## Token additions

- `depth.shallowEdge: 4`, `depth.shallowDrop: 3` in `tokens.ts`.

## Verification

- `npx eslint` the touched files clean; `npm run typecheck`; existing
  `FocusCard`/`TaskRow`/`todayScreen` tests pass (update assertions that referenced
  the removed nudge / badge background).
- Render on the sim and eyeball against the founder's approved image: one amber,
  `+ 5 learned` plain text 4px from `guessed 10`, shallow-edge CTA, Done collapsed.
