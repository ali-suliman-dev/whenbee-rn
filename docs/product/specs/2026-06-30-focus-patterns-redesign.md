# Focus section redesign — Patterns screen

**Date:** 2026-06-30
**Status:** Approved design (mock v2), ready to plan
**Mock:** `docs/product/specs/mocks/focus-section-redesign-v2.html`
**Area:** `src/features/patterns/`, `src/features/planner/`, `src/engine/`

---

## 1. Problem

The Focus section (`FocusPatternsCard`) is the **last block in the Numbers tab** of Patterns, below the identity card, Honest Week, segment control, Progress, and the calibration map. Three failures:

1. **Dead position.** Only Numbers-tab visitors who scroll to the bottom ever see it. Insights/Correlations users never do. Its daily-planning home is Today/Plan — on Patterns its job is **insight payoff + Pro hook**, not a utility.
2. **No hierarchy.** The payoff (the window range) renders at `type.eyebrow` size — smaller than its own meta line. The identity card screams `1.5×`; Focus whispers.
3. **No "why".** It shows a curve and "Based on 137 sessions" — zero explanation of *why* this window, so the "the app knows me" moment never lands.
4. **Format bug.** Current build renders `13:30pm–16:00pm` (24-h clock with a `pm` suffix).

## 2. Goal

Make Focus a **premium, glanceable identity fact** that's seen on every tab, explains itself, and tap-expands to a rich detail view. Honor invariants: no guilt (qualitative energy labels, never shame), honey/sharpness untouched, core loop stays on-device, pricing from RevenueCat.

## 3. Decisions (locked from brainstorm)

- **Placement:** lift Focus out of the Numbers tab into the **pinned identity zone**, directly **under the archetype card, above Honest Week**. Visible on all three tabs.
- **Card form:** compact — eyebrow + window hero + full curve (with axes) + one why-line + `Open ›`.
- **Curve axes:** Y axis labelled **Hi / Low** (short, qualitative, no-guilt); X axis = time (`6a…9p`). Window band + peak dot retained.
- **Why-line copy:** *"Mornings warm up slow — you peak after lunch, 2.3× above your dip."* (the `2.3×` clause degrades gracefully — see §6 Tier 2).
- **Open detail:** bottom sheet — large curve with `peak · 2:42p` annotation, why paragraph, a **vertical rows list** of every available metric, `Edit window` as a quiet ghost.

## 4. Component architecture

```
patterns.tsx (MODIFY)
  ├─ [pinned] ArchetypeHero
  ├─ [pinned] FocusPeakCard            ← NEW  (was buried FocusPatternsCard)
  ├─ [pinned] ReviewRitualCard
  ├─ [pinned] PatternsSegment
  └─ [routed] Numbers | Insights | Correlations   (Focus removed from Numbers)

FocusPeakCard.tsx (NEW · src/features/patterns/)
  - self-gates 3 states (forming / locked-free / personal-pro), like today's card
  - reuses FocusCurve (yAxis variant) + opens FocusDetailSheet
FocusDetailSheet.tsx (NEW · src/features/planner/ or patterns/)
  - the "Open ›" detail; hosts FocusWindowEditorSheet for Edit
FocusCurve.tsx (MODIFY · add yAxis + gridlines + optional peak annotation)
focusWindowInsights.ts (NEW · src/engine/, PURE) — Tier-2 metrics
constants.ts / tokens.ts (MODIFY) — thresholds + axis geometry
```

`FocusPatternsCard.tsx` is **replaced** by `FocusPeakCard` + `FocusDetailSheet`. Delete it once the new pair lands.

## 5. Placement change — `patterns.tsx`

- Remove the `{/* Your focus */}` block from `renderNumbers()` (lines 94–98).
- Insert `<FocusPeakCard />` as a pinned `Animated.View entering={rise()}` **between** the archetype block (item 1, ~line 167) and the review-ritual block (item 2, ~line 175).
- `FocusPeakCard` self-gates (forming/locked/personal) exactly as `FocusPatternsCard` does today — **no `ProGate` wrapper at the layout level**, so the forming and locked states still render for free users (the locked state IS the Pro hook).

## 6. Data availability — the honest split

`useLearnedFocusWindow()` → `LearnedFocusWindow`: `{ startMin, endMin, basis, confidence (0.3–1 personal), scoreByBin (38 normalized bins), sampleCount, distinctDays, held }`.

**`scoreByBin` is normalized 0→1** (min→0, max→1). It carries *shape*, not *magnitude* — so any "X× sharper" ratio is **not** derivable from it.

### Tier 1 — ships with the current engine (no new math)

| Detail row | Source |
|---|---|
| Window `1:30–4:00 pm` | `startMin` / `endMin` |
| Peak focus `2:42 pm` | `argmax(scoreByBin)` → bin-center minute (`FW_WAKING_START_MIN + (peakIdx+0.5)·30`) |
| Your foggiest stretch `9–10 am` | `argmin(scoreByBin)` over eligible interior bins → bin-center minute |
| Confidence `High` | bucket `confidence`: `≥0.75 High · ≥0.5 Building · else Low` |
| Evidence `137 sessions · 3 wks` | `sampleCount` + `distinctDays` (weeks ≈ `round(distinctDays/7)`, floor 1) |
| The curve | `scoreByBin` |

The compact **why-line narrative** ("mornings warm up slow — you peak after lunch") is a Tier-1 **template** chosen from the peak bin's position (morning / midday / afternoon / evening) and the morning-vs-peak shape.

### Tier 2 — needs a new pure engine function

These three require **raw** (pre-normalization) signal magnitude or per-event partitioning by window, which the engine does not currently expose:

| Detail row | Why it's Tier 2 |
|---|---|
| `2.3× sharper than your slump` | ratio of **raw** focus score `exp(peakS − troughS)`; normalized bins lose this |
| `Most accurate · Closest to your guess` | accuracy in-window vs out-of-window — not computed by the focus engine |
| `Longest sessions · Land here` | mean duration in-window vs out — not exposed |

**New pure function** (`src/engine/focusWindowInsights.ts`, no clock/random, TDD):

```ts
export interface FocusInsights {
  peakMin: number;          // bin-center minute of argmax(shrunk)
  troughMin: number;        // bin-center minute of argmin over eligible interior bins
  contrast: number | null;  // exp(peakS - troughS); null if < FW_INSIGHT_MIN_EVENTS
  accuracyBetterInWindow: boolean | null;   // mean |honest-actual|/honest lower inside
  durationLongerInWindow: boolean | null;   // mean actualMin higher inside
}

export function computeFocusInsights(
  events: readonly FocusEventInput[],
  fitByCategory: Record<string, AffineFit>,
  windowStartMin: number,
  windowEndMin: number,
): FocusInsights
```

- Reuse `buildSignals` for `peakS`/`troughS` from the **raw `scoreBins().shrunk`** array (not normalized). `contrast = exp(max - minEligible)`, clamped to a sane display ceiling (e.g. `≤ 9`).
- `accuracy`/`duration` partition the same filtered events by `startLocalMinute ∈ [windowStart, windowEnd)`; require ≥ `FW_INSIGHT_MIN_EVENTS` on **each** side or return `null` (row hidden).
- Surfaced to the card via a thin feature hook `useFocusInsights()` (mirrors `useLearnedFocusWindow`'s store wiring; reuses the already-loaded events + fits — do not re-query the DB).

**Graceful degradation:** any Tier-2 value that is `null` → the row is omitted, and the why-line drops its `, 2.3× above your dip` clause. The card never shows a placeholder or a fabricated number.

## 7. `FocusCurve` changes

Add an opt-in axis treatment; default behavior (Today/Plan) unchanged.

- New prop `yAxis?: boolean` (default `false`). When true:
  - render a left gutter (`type.micro`, `colors.inkFaint`) with **two** labels `Hi` (top) / `Low` (bottom), vertically space-between, height = SVG height.
  - draw 3 horizontal gridlines (`colors.hairline`, `t.focusCurve` new `gridW`) at the Hi / mid / Low levels inside the SVG.
- New optional prop `peakLabel?: string` → renders an SVG `<text>` (`Inter`, `colors.primary`) centered above the peak dot. Used only by the detail view.
- Keep `viewBox`, band, area, peak-dot logic intact. The compact card uses `t.focusCurve.viewH`; the detail uses a taller height via a new `t.focusCurve.detailH` token.

## 8. `FocusPeakCard` spec (tokens exact)

Container: `card` surface, `borderRadius t.radii.card`, padding `t.space[5]`, inner `gap t.space[4]`.

**Forming (`basis === 'prior'`):** eyebrow `WHEN YOU'RE SHARP` (indigo) · title `Learning your focus hours` (`type.subtitle`, `ink`) · `FocusCurve variant="forming" yAxis` · progress `sampleCount / FW_GATE_MIN_COMPLETED sessions` (`type.caption`, `inkSoft`) · ghost `Set my hours myself` → `FocusWindowEditorSheet`.

**Locked (personal + free):** eyebrow · `FocusCurve variant="locked" yAxis` under a frost scrim (`colors.scrim`, 🔒) · why-line teaser *"We found your sharpest stretch — {contrast}× above your slump."* (contrast clause drops if null) · `meta` "Learned from N sessions." · **one** filled indigo CTA `Unlock my focus window` → `/(modals)/paywall?trigger=focus_window`.

**Personal + Pro:**
- eyebrow `WHEN YOU'RE SHARP` (indigo, ⚡ glyph)
- window hero: `Inter-Bold` tabular, `fontSize t.fontSize['2xl']`-ish (mock 34) — `1:30–4:00` with `dash` in `inkFaint` and ` pm` in `inkSoft` at `type.honestNumberMd` size. (See §11 format helper.)
- `FocusCurve variant="learned" yAxis windowStartMin windowEndMin`
- why-line (`type.body`, `ink`) with the `contrast` number in `colors.accent` `Inter` bold
- footer row: `meta` `{sampleCount} sessions · steady for {weeks} weeks` (`inkFaint`) ↔ `Open ›` (`colors.primary`, `type.captionBold`)
- whole card `Pressable` → opens `FocusDetailSheet` (the `Open ›` is the affordance; no separate top chevron).

## 9. `FocusDetailSheet` spec

Bottom sheet (modal route `(modals)/focus-window`, `presentation: 'formSheet'`, **`headerShown: false`**, listed in `(modals)/_layout.tsx` — HARD RULE). Starts with `<SheetGrabber />`.

Content, top→bottom (`gap t.space[5]`):
1. eyebrow `WHEN YOU'RE SHARP` (centered)
2. window hero, centered, `type.honestNumberHero` (`Inter`, tabular)
3. `FocusCurve variant="learned" yAxis peakLabel="peak · {time}"` at `detailH` height
4. why paragraph (`type.body`): *"Mornings warm up slow — you peak after lunch, {contrast}× above your dip. Your last {N} sessions agree, and it has held for {weeks} weeks."*
5. **rows list** — `surfaceSunken`, `radii.md`, each row label (`inkSoft`) ↔ value (bold/`Inter`), `hairline` dividers. Render only available rows:
   - Peak focus · `{peakMin}` *(T1)*
   - Sharper than your slump · `{contrast}×` (accent) *(T2)*
   - Most accurate · `Closest to your guess` *(T2)*
   - Longest sessions · `Land here` *(T2)*
   - Your foggiest stretch · `{troughMin}` *(T1)*
   - Confidence · `{bucket}` *(T1)*
   - Evidence · `{N} sessions · {weeks} wks` *(T1)*
6. `Edit window` — ghost button (`border`, not filled) → `FocusWindowEditorSheet`
7. footer `meta` (centered): *"Whenbee plans your day around this stretch."*

Min rows guaranteed = 4 (all Tier 1). If all Tier-2 are null the sheet still reads complete.

## 10. Copy (humanized, no-guilt, persuasion-aware)

- Eyebrow: `WHEN YOU'RE SHARP`
- Why-line: `Mornings warm up slow — you peak after lunch{, {n}× above your dip}.`
  - peak-bucket variants: morning → `You start sharp and fade after lunch.` · midday → `You hit your stride around midday.` · evening → `You're a slow burn — you peak in the evening.`
- Locked teaser: `We found your sharpest stretch{ — {n}× above your slump}.`
- Y-axis: `Hi` / `Low`. Energy words only — never "good/bad", never a streak or a miss.

## 11. Time format — follow the user's own clock (bug fix)

The window currently renders via `clockFor` → `formatClockMeridiem`, which **always appends am/pm even for 24-h users** (and the old build showed `13:30pm`). The app already has a global clock knob: `hour12Default` in `src/lib/time.ts`, set once at boot from the device's "24-Hour Time" toggle (`setClockHour12(!prefers24Hour())`). **Every focus time must honor it** — window range, peak time, foggiest stretch.

Add two pure, minute-based helpers in `src/lib/time.ts` (the existing helpers are epoch-based; focus values are minutes-after-midnight):

```
formatClockMin(min, hour12 = hour12Default)      // 12h → "1:30" · 24h → "13:30"
formatWindowRange(startMin, endMin, hour12 = hour12Default)
```

Behavior:
- **24-h user:** `13:30 – 16:00` — no meridiem, zero-padded hour (matches `formatClock`'s 24h branch).
- **12-h user:** `1:30 – 4:00 pm` — no leading zero, keep `:00` for tabular alignment; **one** trailing meridiem when both ends share a half-day, **two** when they cross (`11:30 am – 1:00 pm`).
- Single time (peak `2:42`, foggiest hour band `9 – 10 am`) routes through the same helper so it never disagrees with the window.
- Unit-test both modes × boundaries (am↔pm crossing, noon, midnight, 24h padding). No `13:30pm` possible.

## 11a. No placeholders — every value is live

The example strings in this spec (`2:42 pm`, `137`, `3 wks`, `9–10 am`, `2.3×`) are **illustrations of real fields**, not literals to ship. Shipped components bind every number/label to live engine/store data:

- window/peak/trough/sessions/days/confidence ← `useLearnedFocusWindow()` + `computeFocusInsights()`
- contrast/accuracy/duration ← Tier-2 hook; **null → the row is omitted and the why-line drops its clause** (§6). Never render a dash, a zero, or a fake number.
- No hardcoded "137" / "2.3×" anywhere in component source — lint/review gate: grep the new files for stray numeric literals in JSX before each commit.

## 12. Tokens to add (`tokens.ts` → `focusCurve` group + ramp)

- `focusCurve.detailH` (≈ 140) — detail-view SVG height
- `focusCurve.gridW` (1) — gridline weight
- `focusCurve.yLabelW` (≈ 28) — Y-gutter width
- Confidence/insight thresholds go in `engine/constants.ts`: `FW_CONF_HIGH = 0.75`, `FW_CONF_BUILDING = 0.5`, `FW_INSIGHT_MIN_EVENTS`, `FW_CONTRAST_MAX = 9`.

No raw numbers inline — every value above is a token or constant.

## 13. Testing

- **engine/`focusWindowInsights.test.ts` (TDD, write first):** contrast math (`exp(peakS−troughS)`, clamp, null under min events), trough selection, accuracy/duration partition + null-on-thin-side, determinism (no clock/random).
- **`formatWindowRange` unit tests:** am/pm shared + crossing, noon/midnight, no `13:30pm`.
- **`FocusPeakCard`:** snapshot per state (forming / locked / personal); Tier-2-null hides rows + drops why-clause; locked shows exactly one filled indigo CTA (one-primary-CTA audit).
- **`patterns.tsx`:** Focus no longer in Numbers tab; FocusPeakCard pinned (visible on Insights/Correlations).
- Run `npm run lint && npm run typecheck && npm test` before each commit.

## 14. Analytics (optional, on-device-safe)

PostHog (guarded): `focus_detail_open` (from card), `focus_window_edit` (from sheet), `focus_unlock_tap` (locked CTA → existing paywall trigger). No new data class.

## 15. Invariants check

- No guilt: Hi/Low + "slow/foggiest" are energy descriptors, no shame, no streak, no red. ✓
- Honey/sharpness monotonic: untouched. ✓
- Core loop on-device: focus insights computed locally from existing events. ✓
- Pricing from RevenueCat: locked CTA reuses existing paywall trigger. ✓
- One filled indigo CTA/screen: locked state's Unlock is the only one; pinned card adds no filled CTA. ✓

## 16. Suggested PR slices (bottom-up, never merged by Claude)

1. **Engine + format:** `focusWindowInsights.ts` (+tests), `formatWindowRange` (+tests), constants. Pure, no UI.
2. **FocusCurve axes:** `yAxis`/`peakLabel` props + tokens (Today/Plan unaffected).
3. **FocusPeakCard + FocusDetailSheet:** new components, modal route wired in `(modals)/_layout.tsx` (`headerShown:false`), `useFocusInsights` hook.
4. **patterns.tsx placement swap:** pin FocusPeakCard, remove from Numbers, delete `FocusPatternsCard`.

## 17. Open questions

1. Detail sheet as a **modal route** (`(modals)/focus-window`, native drag-dismiss) vs a local RN `Modal` like `FocusWindowEditorSheet`? Spec assumes the route. Confirm.
2. "Most accurate / Longest sessions" phrasing — keep qualitative (`Closest to your guess`) or show the actual delta (e.g. `12% closer`)? Spec ships qualitative; numeric is a later enhancement.
3. Weeks vs days in Evidence when `distinctDays < 7` — show `{n} days` instead of `1 wk`. Spec assumes day-fallback under 7.
