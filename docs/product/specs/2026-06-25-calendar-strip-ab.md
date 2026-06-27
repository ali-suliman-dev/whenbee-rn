# Calendar Strip Redesign — A/B build (Focus Lens vs Sliding Segment)

**Date:** 2026-06-25
**Status:** Spec → build
**Owner:** founder review

## Goal

Replace the current 7-day calendar strip with **two** fully-built, production-grade
variants, both live behind a **runtime toggle** so the founder can A/B them on-device,
then **delete the loser** with a one-file-plus-one-line removal.

Two variants (designed + screenshot-approved in `scratchpad/strip-a.html`):

- **A1 — Focus Lens.** The selected day's number scales up; neighbours shrink and
  fade with distance. Every day keeps its weekday label (faded by distance) so the
  strip stays fully scannable. Editorial, focal.
- **B — Sliding Segment.** A sunken, borderless track with an elevated chip that
  **slides** to the selected day. Mirrors the app's own List/Timeline `ViewToggle`
  — in-app consistency, tactile, premium. Nothing hidden.

Both are dark + light, reduced-motion safe, token-only, no-bounce (project animation
rule), and preserve the existing a11y contract (`role=button`, `accessibilityState.selected`,
descriptive label, `selectDate` on tap).

## Non-negotiable invariants (carry over)

- **No guilt / no red.** Activity markers are neutral (inkFaint) or indigo — never amber
  (amber = honey/reward only) and never red.
- **Token-only.** Every size/space/color/duration comes from `src/theme/tokens.ts`
  via `useTheme()`. New geometry tokens are added under `strip` (below).
- **No-bounce.** Entrances settle; selection uses `withTiming` + `easing.out`. No spring
  overshoot on content, no translate-in slide, no scale-from-0.
- **Pure paging logic stays.** The ±52-week FlatList paging, scroll-to-selected, and
  store wiring are variant-agnostic and shared.

## Architecture — maximise reuse, trivial swap

```
src/features/today/calendarStrip/
  weekDays.ts                 (reuse — DayCell, weekFor, dayCells)        [unchanged]
  useCalendarStripData.ts     (NEW)  shared logic hook — anchors, scroll, store, pageWidth
  WeekPager.tsx               (NEW)  generic horizontal paging FlatList; props: renderWeek
  stripVariant.ts             (NEW)  variant type + default constant (single source)
  CalendarStripLens.tsx       (NEW)  variant A1 — own container + lens WeekPage + lens cell
  CalendarStripSegment.tsx    (NEW)  variant B  — own container + segment WeekPage + chip
  CalendarStrip.tsx           (MODIFY) thin selector: reads variant → renders A or B
  __tests__/…                 (MODIFY/ADD) keep contract tests green for both
```

**Selector (`CalendarStrip.tsx`):**

```tsx
export function CalendarStrip() {
  const variant = useStripVariant();           // runtime, from settingsStore
  return variant === 'lens' ? <CalendarStripLens /> : <CalendarStripSegment />;
}
```

**Shared logic hook (`useCalendarStripData.ts`)** — extracts everything non-visual from
today's `CalendarStrip.tsx`: `weekAnchors`, `selectedWeekIndex`, `today`, `selectedDate`,
`datesSet`, `handleSelectDate`, `pageWidth`, `listRef`, `getItemLayout`,
`onScrollToIndexFailed`, `reducedMotion`, and the `scrollToIndex` effect. Both variants
consume it; neither re-implements paging.

**Generic pager (`WeekPager.tsx`)** — the `FlatList` (horizontal, paging, ±52 weeks)
with all the perf props (`removeClippedSubviews`, `getItemLayout`, `initialScrollIndex`,
`bounces={false}`, etc.). Takes `renderWeek(anchor: string) => ReactNode`. Each variant
passes its own week renderer. The **container chrome differs per variant** (surface card
vs sunken track), so the container wraps `<WeekPager>` inside each variant component, not
in the pager.

### Swap / live A-B / deletion

- **`stripVariant.ts`:** `export type StripVariant = 'lens' | 'segment';` and
  `export const DEFAULT_STRIP_VARIANT: StripVariant = 'segment';`
- **`settingsStore`:** add `stripVariant: StripVariant` (default `DEFAULT_STRIP_VARIANT`)
  + `setStripVariant(v)`. Persisted (zustand persist, like every other setting) so the
  choice survives reload. Expose `useStripVariant = () => useSettingsStore(s => s.stripVariant)`.
- **Settings (TEMP dev row):** a segmented control "Calendar style — Lens / Segment" in
  Settings → flips live, no rebuild. Marked `{/* TEMP A/B — remove after decision */}`.
- **Deletion path (after decision):** delete the loser's `CalendarStrip*.tsx`, remove its
  import + branch in the selector (selector collapses to the winner), delete the Settings
  TEMP row, the `stripVariant` store field, and `stripVariant.ts`. Winner stays as a plain
  component. ≈4 deletions, no logic touched (logic lives in the shared hook).

## Tokens — add under `strip` in `tokens.ts`

Geometry only (mode-agnostic). No new colors (reuse `primary`, `primarySoft`,
`primaryWash`, `ink`, `inkSoft`, `inkFaint`, `surface`, `surfaceSunken`, `border`,
`hairline` — all defined in both light + dark).

```ts
strip: {
  …existing…,
  // ── A1 Focus Lens ──
  lens: {
    cardPadV: 14, cardPadH: 6,
    heroNum: 23,            // selected number font size (base size; neighbours SCALE down)
    label: 10, heroLabel: 11,
    // scale factors relative to heroNum, applied via transform (UI-thread, crisp enough @≥2x)
    scaleD1: 0.74, scaleD2: 0.65, scaleD3: 0.57,   // |dist| = 1 / 2 / ≥3
    opacityD0: 1, opacityD1: 0.9, opacityD2: 0.66, opacityD3: 0.42,
    gap: 7,                 // weekday→number gap
    dotSize: 4, heroDotSize: 5, dotGap: 4,
    cellMinH: 52,           // fixed row height so the hero scale never reflows neighbours
  },
  // ── B Sliding Segment ──
  segment: {
    trackPadV: 5, trackPadH: 5,
    chipRadius: 15, chipInsetX: 3,
    cellPadTop: 9, cellPadBottom: 8,
    label: 11, num: 17,
    gap: 5, dotSize: 4, dotGap: 4,
    chipShadowOpacity: 0.4,   // Platform.select iOS shadow; android elevation 2
  },
}
```

Add matching keys to `useTheme` `resolveTheme` if `strip` is enumerated there (see
`[[usetheme-token-enumeration]]` gotcha — a new nested group must be reachable as
`t.strip.lens` / `t.strip.segment`).

## Variant A1 — Focus Lens (full spec)

### Layout
- Container: surface card, `radii.card`, `hairline` 1px border, `overflow:hidden`,
  padding `lens.cardPadV` / `lens.cardPadH`. (Same shell as today.)
- One `WeekPage` = a `flexDirection:row`, 7 **equal-width** columns
  (`cellWidth = pageWidth/7`). Fixed `cellMinH` so scaling the hero number never reflows
  siblings (`row` cross-aligns at `flex-end` baseline).
- Cell = column: weekday label (top) + number wrapper (animated scale) + activity dot
  (selected only; see "markers").

### Visual states (per cell, by distance `d = |col − selectedCol|`)
| State | Number | Weekday | Notes |
|---|---|---|---|
| Hero `d=0` | size `heroNum`, **`ink`**, weight 700, scale 1.0, opacity 1 | `heroLabel`, **`primary`**, weight 600 | activity dot = `primary`, `heroDotSize` |
| `d=1` | scale `scaleD1`, `inkSoft`, opacity `opacityD1` | `label`, `inkFaint`, opacity `opacityD1` | |
| `d=2` | scale `scaleD2`, `inkSoft`, opacity `opacityD2` | faded | |
| `d≥3` | scale `scaleD3`, `inkSoft`, opacity `opacityD3` | faintest | |
| **No hero in week** (selected on another week) | all render as `d=1` (uniform medium), weekday all `inkFaint`, no dot | | calm, invites a tap |

> Markers: only the **hero** shows its activity dot (indigo). Non-hero has-tasks days are
> intentionally quiet in the lens (the lens trades per-day density for focus). Has-tasks
> data still drives the Segment variant's dots.

### Motion (the lens morph)
- One shared value per `WeekPage`: `selCol` (float). Init = selected column (or a sentinel
  when absent → render uniform via a `heroPresent` flag).
- Each cell's `useAnimatedStyle` (worklet) reads `selCol`:
  ```
  const d = Math.abs(col - selCol.value);
  scale   = interpolate(d, [0,1,2,3], [1, scaleD1, scaleD2, scaleD3], CLAMP);
  opacity = interpolate(d, [0,1,2,3], [1, opacityD1, opacityD2, opacityD3], CLAMP);
  ```
  Number color via `interpolateColor(d, [0,1], [ink, inkSoft])`; weekday via
  `interpolateColor(d,[0,1],[primary, inkFaint])` + opacity.
- On select: `selCol.value = withTiming(newCol, { duration: motion.base /*220*/, easing: easing.out })`.
  Because every cell interpolates off the **same animating `selCol`**, neighbours grow/shrink
  continuously as the hero "slides" — a true lens morph, no per-cell choreography, no bounce.
- **Press feedback:** pressed cell number wrapper `scale ×0.97` on `pressIn` →
  `withTiming(…, {duration: motion.press /*110*/})`, restore on `pressOut`. (Emil: pressables
  must feel responsive.) Multiplied into the lens scale in the worklet.
- **Reduced motion:** `selCol.value = newCol` (no timing); press scale skipped.
- Week-swipe paging unchanged (native FlatList). No entrance animation on mount (rule).

Personality = **Premium/Corporate**: `easing.out` (`0.23,1,0.32,1`), 220ms, 0 overshoot.

## Variant B — Sliding Segment (full spec)

### Layout
- Container: **sunken** track (`surfaceSunken`), `radii.card`, **no border**,
  padding `segment.trackPadV/H`, `overflow:hidden`.
- One `WeekPage` = relative-positioned row, 7 equal columns. A single absolutely-positioned
  **chip** sits *behind* the text layer (zIndex 0), text columns at zIndex 1.
- Chip: `surface` fill, `chipRadius`, soft lift (iOS `shadowOpacity = chipShadowOpacity`,
  radius 4, y-offset 1; Android `elevation: 2`). Width `cellWidth − 2*chipInsetX`.

### Visual states
| State | Number | Weekday | Chip |
|---|---|---|---|
| Selected | `num`, **`ink`**, weight 700 | `label`, **`primary`**, weight 600 | visible under this column |
| Other | `num`, `inkSoft`, weight 500 | `label`, `inkFaint` | — |
| Activity dot | indigo `primary` under selected; `inkFaint` under other has-tasks days; hidden otherwise | | |

All days fully legible (no fade). This is the "nothing hidden" variant.

### Motion (the chip slide)
- Per-`WeekPage` shared value `selCol` (float). Chip `useAnimatedStyle`:
  `translateX = trackPadH + chipInsetX + selCol * cellWidth`, plus `opacity` (0 when the
  selected day is not in this week).
- On select: `selCol.value = withTiming(newCol, { duration: motion.base, easing: easing.out })`.
  The chip glides between days. No spring (segmented controls read best crisp — Emil).
- **Text color crossfade:** each cell's text color via `interpolateColor(|col − selCol|,
  [0, 0.5], [selectedColor, normalColor])` so the indigo weekday / ink number resolve as the
  chip arrives (≈ tracks the 220ms slide). Avoids a hard color snap.
- **Press feedback:** pressed column `scale ×0.97` (`motion.press`), restore on release.
- **Reduced motion:** `selCol.value = newCol` (chip jumps), no press scale.
- Cross-week selection: target week scrolls in (FlatList); its own chip is already at the
  right column — no cross-page slide.

Personality = **Corporate**: `easing.out`, 220ms, crisp, 0 overshoot.

## Accessibility (both)
- Each cell: `accessibilityRole="button"`, `accessibilityLabel` = "Wednesday June 24"
  (existing `formatA11yLabel`), `accessibilityState={{ selected }}`.
- Visual opacity/scale never affects the a11y tree (labels are full-strength regardless).
- Hit target: full column width × `cellMinH` (≥ 44pt tall) — meets touch-target minimums.
- `useReducedMotion()` drives the no-animation path in both.

## Performance
- All animation is `transform`/`opacity`/color on the UI thread (Reanimated worklets) — no
  layout-animating width/height/flex. Hero emphasis is `scale`, not `flex` grow.
- `DayCell` memoised; `selCol` is one shared value per page (cheap). `removeClippedSubviews`
  keeps off-screen weeks cheap.
- reactCompiler gotcha: `Pressable` stays a bare touch wrapper; all visual style on an inner
  `Animated.View`. Shared values read/written via `.get()/.set()` (v4) — never `.value` in
  component body; worklet bodies may read `.value` inside `useAnimatedStyle`.

## Testing
- **Keep green:** existing `CalendarStrip.test.tsx` (selected a11y state, `selectDate` on
  tap, today distinction) must pass against the default variant.
- **Shared hook test:** `useCalendarStripData` — anchors length (105), `selectedWeekIndex`
  resolves to the week containing `selectedDate`, `handleSelectDate` calls store.
- **Per-variant render tests:** for each of Lens + Segment — renders 7 buttons, selected
  has `selected=true`, tapping an unselected calls `selectDate(key)`, has-tasks day exposes
  its marker, reduced-motion path renders final state. Mock `useReducedMotion`.
- **Selector test:** `stripVariant` switch renders the right component.
- Run `npm run lint` + `npm run typecheck` + `npx jest src/features/today/calendarStrip`.

## File change list
1. `tokens.ts` — add `strip.lens`, `strip.segment` (+ `useTheme` enumeration if needed).
2. `useCalendarStripData.ts` — NEW shared hook (extract from current `CalendarStrip.tsx`).
3. `WeekPager.tsx` — NEW generic pager.
4. `stripVariant.ts` — NEW type + default.
5. `settingsStore.ts` — add `stripVariant` + `setStripVariant` (+ persist key).
6. `CalendarStripLens.tsx` — NEW variant A1.
7. `CalendarStripSegment.tsx` — NEW variant B.
8. `CalendarStrip.tsx` — MODIFY to selector.
9. Settings screen — TEMP segmented A/B row.
10. Tests — shared hook + two variants + selector; keep existing green.

## Deletion checklist (post-decision)
- [ ] Delete losing `CalendarStrip{Lens|Segment}.tsx` + its test.
- [ ] Collapse selector to the winner (remove import + branch).
- [ ] Remove Settings TEMP row.
- [ ] Remove `settingsStore.stripVariant` + setter + persisted key.
- [ ] Delete `stripVariant.ts`.
- [ ] `useCalendarStripData.ts` + `WeekPager.tsx` stay (winner uses them).
