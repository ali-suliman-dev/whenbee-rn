# Build plan — Calendar Strip A/B (Lens + Segment)

Companion to `2026-06-25-calendar-strip-ab.md`. TDD where logic; screenshot-verify where
visual. Each phase ends green (lint + typecheck + jest) before the next.

## Phase 0 — Tokens + variant plumbing (no UI yet)
1. Add `strip.lens` + `strip.segment` geometry to `tokens.ts`; verify `t.strip.lens.*`
   resolves (extend `useTheme` enumeration if `strip` is listed there).
2. `stripVariant.ts`: `StripVariant` type + `DEFAULT_STRIP_VARIANT = 'segment'`.
3. `settingsStore.ts`: `stripVariant` + `setStripVariant`, persisted; `useStripVariant`.
   **Test:** store defaults to `segment`, setter flips + persists.
✅ typecheck + jest.

## Phase 1 — Shared logic (extract, TDD)
4. `useCalendarStripData.ts`: move all non-visual logic out of the current
   `CalendarStrip.tsx` (anchors, `selectedWeekIndex`, `pageWidth`, `listRef`,
   `getItemLayout`, `onScrollToIndexFailed`, scroll effect, `handleSelectDate`,
   `reducedMotion`, `datesSet`, `today`, `selectedDate`).
   **Test first** (`useCalendarStripData.test.ts`): 105 anchors; `selectedWeekIndex`
   finds the week of `selectedDate`; falls back to `TODAY_INDEX`; `handleSelectDate`
   calls `selectDate`.
5. `WeekPager.tsx`: generic horizontal paging FlatList; prop `renderWeek(anchor)`.
   Pure presentational wrapper around the hook's list props.
✅ typecheck + jest.

## Phase 2 — Variant B (Sliding Segment) first (it's the default + lower risk)
6. `CalendarStripSegment.tsx`: sunken track container + `SegmentWeekPage` + animated chip
   + cells. Per-page `selCol` shared value; chip `translateX` `withTiming(base, out)`;
   text `interpolateColor`; press `scale 0.97`; reduced-motion jump.
7. Point selector `CalendarStrip.tsx` at the variant via `useStripVariant()`.
   **Tests:** segment renders 7 buttons; selected `selected=true`; tap → `selectDate(key)`;
   reduced-motion renders final state. Keep existing `CalendarStrip.test.tsx` green.
8. **Device/sim screenshot** both modes (light + dark): chip alignment, slide, dot colors,
   spacing rhythm. Fix until a designer's eye passes.
✅ lint + typecheck + jest + screenshot.

## Phase 3 — Variant A1 (Focus Lens)
9. `CalendarStripLens.tsx`: surface card + `LensWeekPage` + cells. Per-page `selCol`;
   per-cell worklet scale+opacity+color `interpolate`/`interpolateColor` off `selCol`;
   select → `withTiming(base, out)`; uniform-medium fallback when no hero in week; press
   `0.97`; reduced-motion jump.
   **Tests:** mirror Phase 2 variant tests for Lens.
10. **Sim screenshot** both modes: hero scale, fade gradient, weekday legibility, baseline
    alignment, no reflow on selection. Fix to taste.
✅ lint + typecheck + jest + screenshot.

## Phase 4 — Live A/B switch + polish
11. Settings TEMP segmented row "Calendar style — Lens / Segment" (wired to
    `setStripVariant`), tagged for removal.
12. Flip live on sim, compare both in real Today context; tune token values (sizes,
    opacities, durations) on real pixels — both light + dark, reduced-motion on/off.
13. Selector test (variant → component). Final `npm run lint && npm run typecheck && npm test`.
✅ everything green; open PR (never merge).

## Definition of done
- Both variants build, animate (no-bounce), respect reduced motion, token-only,
  light + dark verified on sim, a11y contract intact, all tests green, lint clean.
- Swap is one runtime toggle; deletion path is the spec's checklist.
- PR opened for founder review (no self-merge).

## Risks / watch
- **Text scaling blur (Lens):** scaling number `Text` via transform can soften glyphs;
  verify at 2x/3x on device — if soft, fall back to discrete font sizes + opacity-only
  crossfade.
- **reactCompiler + Pressable:** keep Pressable bare; visual on inner `Animated.View`.
- **Shared-value access:** `.get()/.set()` in component body; `.value` only inside worklets.
- **Chip math (Segment):** `cellWidth = pageWidth/7`; chip x includes `trackPadH + chipInsetX`.
- **`exiting` animations are banned** (SIGABRT on Fabric) — entering/none only.
