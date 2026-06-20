# 03 — Confidence band (honest range)  ·  Pro

**Status:** spec · **Tier:** Pro (`pro` entitlement) · **Skills applied:** ui-design:visual-design-foundations, ui-design:react-native-design, svg-animations, motion-design, react-native-architecture, typescript-expert, humanizer

> Read [README.md](README.md) first — shared invariants (no-guilt, monotonic, on-device, RevenueCat gating, theming, motion, analytics, copy rules) are defined there and not repeated here.

---

## 1. What it is (one paragraph)

Instead of a single honest number, Pro shows the honest **range** the task actually tends to land in — "this usually takes **40–55 min**" — drawn as a slim band around the point number. The band is built from the real spread of your own logs: noisy categories get a wide band, settled ones a narrow one. The point of the feature is the *narrowing*: as you log more of a category, the band visibly tightens, frame by frame, and that shrinking is the felt proof the model is learning you specifically. Free users keep the single honest point number (the core loop is never fogged); Pro unlocks the range and the narrowing visualization. There is no extra logging step — the range is computed from data you already have on device.

## 2. The user problem + evidence

A point estimate hides its own uncertainty, so a "30 min" task that really swings 25–55 reads as a broken promise the first time it runs 50. People with ADHD distrust a number that pretends to be exact. Showing the honest spread *and* watching it shrink turns the subscription into something that visibly compounds — the value grows every week you keep logging.

- **TimeNinja's single marketed differentiator is a "25–75% variability band"** ([07-PRO-VALUE-IDEAS §1.3](../07-PRO-VALUE-IDEAS.md)) — direct evidence people will pay for the range, and we ship it on-device/deterministic where they ship cloud-AI.
- **RISE** proves an uncertainty-aware, legible number drives behavior better than a bare figure ([§1.3](../07-PRO-VALUE-IDEAS.md)).
- Ties to research truth **#3 ("it learns ME" is the strongest WTP trigger)** and **#5 (value must regenerate / compound)** — the narrowing band is the literal animation of "it's learning me" ([§The 5 hard truths](../07-PRO-VALUE-IDEAS.md)).

## 3. Where it lives

The range is a property of the honest number, so it appears **everywhere the honest number already appears**, gated by Pro. Three surfaces, in priority order:

| # | Surface | Component today | Range behavior |
|---|---|---|---|
| A | **Decision moment** (Add Task / live guess banner) | `src/features/shared/HonestSuggestionCard.tsx` | Pro: band line + narrowing micro-anim on reveal. Free: point number only. **Primary surface.** |
| B | **Category detail** | the category screen (consumes `CalibrationSummary`) | Pro: a static band strip under the headline number + a one-line "tightened from X to Y" caption. The home for the *narrowing-over-time* proof. |
| C | **Timer / running view** | running focus card | Pro: the honest finish shown as a soft range on the projected-finish label. Lowest priority — opt-in via the same `range` prop; ship A+B first. |

- **Free vs Pro view:** free always sees the existing point number (`~40m · +10m more`). Pro sees `40–55m` with the band. The point number is identical math in both — Pro only *adds* the bracket, so nothing about calibration is hidden from free.

## 4. User flow

**Happy path (Pro), surface A:**
1. User picks a category + types/dials a guess on Add Task.
2. The store resolves a `CalibrationSummary` (already happens) with `confidence` + `range` populated.
3. The card renders the point number, then the band line `40–55m` with a 1-frame narrowing wipe (§6).
4. As the user logs more of this category over days, the band the engine returns gets narrower; on each new visit the band reads tighter. (No live animation between sessions — the proof is the lower static width plus the category-detail caption.)

**Locked path (non-Pro), surface A:**
1–2 identical. 3. The card renders the point number exactly as today. A single quiet affordance sits to the right of the number: a faint bracket glyph + `Range` label that, tapped, opens the paywall with `trigger: 'honest_range'`. No band is drawn. The teaser shows the *shape* (a greyed bracket) without revealing the user's actual low/high.

**Category detail, narrowing proof (Pro):** band strip + caption `Tightened from 30–60 to 42–52 as you logged.` Non-Pro sees a locked teaser strip (§9).

## 5. Screens & states

All values are tokens from `src/theme/tokens.ts` via `useTheme()` and roles from `src/theme/typography.ts`. No raw hex/number.

### 5.1 Surface A — decision-moment band (Pro)

Extends the existing `HonestSuggestionCard`. The band is **not** a chart; it is a single hairline track with a filled segment marking [low, high] and a tick at the point number. Reuses the honey/amber identity the card already owns.

```
┌─────────────────────────────────────────────┐
│  (◍)   Honestly  40–55m            still      │   ← line 1: amber number, sm/12
│        ├────────▓▓▓▓▓▓▓▓───────┤   learning    │   ← line 2: band track (NEW)
└─────────────────────────────────────────────┘
        low 40 ·····|····· high 55
                   ▲ point 48
```

- **Band track:** full-width `View`, height `tokens.progress.track` (6), `borderRadius: t.radii.full`, bg `t.colors.surfaceSunken` (the established well color). Inset `paddingHorizontal: t.space[2]` to align with the text column.
- **Filled segment:** absolute child, bg `t.colors.accent`, `borderRadius: t.radii.full`, left/width as % of the track mapped from [low,high] over a display domain (§8.4). At low confidence the fill is `t.colors.accentSoft` (calmer, signals "still wide").
- **Point tick:** `tokens.progress.tickW` (3) × full track height, `t.colors.accentEdge`, positioned at the point %; reads as "the single best guess inside the spread."
- **Numbers line:** reuse `HonestNumber` is overkill at 12px; keep the card's existing inline `num`/`unit` styles. Render `{low}–{high}` in `num` (amber bold), `m` in `unit`. Drop the `~` prefix when a range is shown (the range already communicates approximation).
- **Spacing:** `content` column gap stays `t.space[0.5]`; band sits as a third row under the honest line with `marginTop: t.space[1]`. One spacing source per axis — the column `gap`, no per-child margins beyond the single band offset.

### 5.2 Surface B — category-detail band strip (Pro)

A taller, labelled version under the category's hero honest number.

```
   48 min                          ← existing hero (honestNumberLg)
   ┌───────────────────────────┐
   │ 40 ├──────▓▓▓▓▓▓▓──────┤ 60 │  ← band, with low/high end labels (caption)
   └───────────────────────────┘
   Tightened from 30–60 to 42–52 as you logged.   ← caption, inkSoft
```

- Track height `tokens.progress.gapTrack` (8) for a more deliberate strip; same fill/tick tokens as A.
- End labels: `type.caption`, `t.colors.inkSoft`, flanking the track with `gap: t.space[2]`.
- Caption: `type.bodySm`, `t.colors.inkSoft`, `marginTop: t.space[2]`. Only shown when a narrowing actually happened (§10).

### 5.3 States (every surface)

| State | Trigger | Render |
|---|---|---|
| **Not enough data** (`confidence === 'raw'`, n < 3) | new category | No band. Point number only, even for Pro. Surface A caption: `Still learning — roughly {low}–{high}.` using the prior-derived wide band (§8.5), in `t.colors.inkSoft`. No tick. |
| **Setting** (`confidence === 'setting'`) | 3 ≤ n < 6 or still noisy | Band shown with `accentSoft` fill (wide, calm). Suffix `still learning` (existing copy). |
| **Honest** (`confidence === 'honest'`) | n ≥ 6 AND CV ≤ 0.35 | Tight band, `accent` fill, no "still learning" suffix. This is the payoff state. |
| **Loading** | resolving summary | Card already handles its own mount; band fades in with the card (no separate skeleton). |
| **Error** | engine returns `range: null` | Degrade silently to the point number. Never show a broken/empty track. |
| **Zero data** | n = 0 | Existing live-guess banner shape — no `confidence`/`range` passed, no band. |

## 6. Motion

Owner skills: `svg-animations` + `motion-design`. The band is RN `View`s (not SVG) on surfaces A/B — no SVG needed for a rectangle track, which keeps it cheaper and avoids a `react-native-svg` mount on the hot Add-Task path. (SVG is reserved only if the category-detail narrowing becomes a multi-segment historical sparkline later; not in this spec.)

- **Reveal (on band mount):** the filled segment animates from the *full track width* inward to its [low,high] width — the "narrowing" gesture in miniature, so even first-time users feel the band tightening to their data. `withTiming(targetWidth, { duration: t.motion.base /*220*/, easing: t.motion.easing.out })`. Drive an `useSharedValue` width via `useAnimatedStyle`; read/write with `.get()/.set()`.
- **Point tick:** fades in `opacity 0→1`, `withTiming(1, { duration: t.motion.fast /*120*/ })`, delayed by `t.motion.fast` so it lands after the segment settles.
- **Confidence transition** (setting → honest across sessions): no cross-session animation; the lower static width carries it. Within a session, if the band re-resolves (e.g. user changes guess), animate width with `t.motion.base`.
- **Reduced motion:** honor `ReduceMotion.System` — pass it on the timing config; with reduce-motion the segment renders at final width immediately, tick at full opacity. No narrowing wipe.
- **No-guilt guard:** the band only ever animates *inward* (narrowing) or to a new resolved width; it never flashes red and never animates "expanding to punish." The honest point number itself remains monotonic per the engine's sharpness guard (the *band width* may widen if the user's spread genuinely grows — that is honest, not guilt — but it is never colored as a regression; same amber throughout).

## 7. Data model

No new persisted state. Everything needed is already in the engine's per-category rolling window.

- `src/domain/types.ts` — **already present**, no change needed:
  - `HonestRange { lowMinutes: number; highMinutes: number }`
  - `CalibrationConfidence = 'raw' | 'setting' | 'honest'`
  - `CalibrationSummary.range?: HonestRange | null` and `.confidence?: CalibrationConfidence`
- **For surface B's "tightened from X to Y" caption** we need an earlier band to compare against. Add a tiny, optional field rather than persisting history:
  - In `CategoryStats` (already persisted via `categoryStatsRepo`) add **`firstHonestRange?: HonestRange | null`** — captured once, the first time `confidence` reaches `'setting'` (the first time a band is meaningful). Frozen thereafter. This is the "from" anchor; the "to" is the live range. Append-only migration on the `category_stats` table (`alter table … add column first_honest_low integer, first_honest_high integer`).
  - **Do not** store a full range time-series — the felt proof is "then vs now", and a series would be a second data class for marginal value. (Open question 13.2 revisits this for surface C / long-range history.)
- `clampedRatios` (the input to the range math) is **not** newly persisted — it is the same `recentClampedRatios` window the store already assembles for `applyLog` / `sharpnessFromWindow` (`src/engine/update.ts:23`, last `SHARPNESS_WINDOW` ratios). The resolver reads that window.

## 8. Engine / logic

The engine **already ships** `confidenceFor`, `honestRangeFor`, `reservePriceVisible` in `src/engine/confidence.ts` (CV-heuristic band). This spec **upgrades `honestRangeFor` to a true P25–P75 quantile band** so the marketed "25–75%" claim is literally what we compute, and keeps the CV only as the confidence gate. TDD required — extend `src/engine/__tests__/confidence.test.ts`.

### 8.1 The math (P25–P75 from the log-ratio distribution)

The honest multiplier is `M = exp(EWMA(ln r))`. The *spread* lives in the distribution of `ln r` over the recent clamped ratios. Working in log space keeps the band multiplicative and symmetric in ratio terms (a task is as likely to run 1.5× as 0.67×), which is the correct shape for durations.

1. Take the recent clamped ratios `R = recentClampedRatios` (newest-last, length n, already clamped to `[RATIO_FLOOR, RATIO_CEIL]`).
2. Map to log space: `L = R.map(Math.log)`.
3. Compute the **25th and 75th percentiles of `L`** via linear interpolation between order statistics (type-7 / R default — the most common, matches the "25–75%" framing):
   - sort `L` ascending; for quantile `q`, `pos = (L.length − 1) · q`; interpolate between `floor(pos)` and `ceil(pos)`.
4. Convert back to multipliers: `mLow = exp(p25L)`, `mHigh = exp(p75L)`.
5. Apply to the guess and round to the 5-grid, **bracketing the point** so the band always contains the honest number:
   - `lowMinutes  = clamp5floor( min(honest, guess · mLow) )`
   - `highMinutes = clamp5ceil(  max(honest, guess · mHigh) )`
   - `clamp5floor` / `clamp5ceil` reuse the existing `floor5`/`ceil5` helpers (floor at 5, multiples of 5).

This makes the band a **direct percentile of the user's own data**, so it narrows exactly when their spread narrows — the compounding proof — and the "usually" copy is literally true (50% of past runs fell inside it).

### 8.2 Low-n behavior (the honest part)

Percentiles of 1–2 points are meaningless, so blend toward a **prior band** until there is enough data — mirroring how `blendWithPrior` handles the point estimate:

- `n === 0`: return the **prior band** only (§8.5). UI shows "still learning — roughly L–H".
- `1 ≤ n < QUANTILE_MIN_N` (new const, **= 4**): widen the empirical band toward the prior band by a pseudo-count blend in log space: `pBand = (n·empiricalHalfWidthL + k·priorHalfWidthL)/(n+k)` with `k = BLEND_PSEUDO_COUNT (4)`. Guarantees a fresh category never shows a falsely tight band off two lucky logs.
- `n ≥ QUANTILE_MIN_N`: pure empirical P25–P75.
- A hard floor `RANGE_MIN_HALF_WIDTH (0.18)` and ceiling `RANGE_MAX_HALF_WIDTH (0.5)` on the final half-width stay, so the band is never absurdly tight (false precision) nor absurdly wide (useless). Reuse the existing constants.

### 8.3 Pure function signatures

File: `src/engine/confidence.ts` (extend; keep exports stable via `src/engine/index.ts` which already re-exports them).

```ts
// NEW internal helper — type-7 linear-interpolated quantile of a numeric array.
function quantile(sorted: number[], q: number): number;   // q in [0,1]; sorted ascending

// UPGRADED — same signature, now P25–P75 in log space with low-n prior blend.
export function honestRangeFor(input: {
  honestMinutes: number;
  guessMinutes: number;        // NEW required field — needed to map mLow/mHigh → minutes
  clampedRatios: number[];
  prior: number;               // NEW — category prior, for the low-n band (§8.5)
}): HonestRange;

// UNCHANGED — confidence stays CV-based (it gates whether to SHOW the band, §5.3).
export function confidenceFor(input: { n: number; clampedRatios: number[] }): CalibrationConfidence;
```

`resolveSuggestion` (`src/engine/multiplier.ts`) is extended to populate `range` + `confidence` on the returned `CalibrationSummary` (currently it does not — the fields are optional and filled by the store today). Pass the resolved `guessMinutes`, `honestMinutes`, the category `prior`, and the `clampedRatios` window through. Keep it pure (the window is an input, not read from db).

> **Signature change note:** `honestRangeFor` gains `guessMinutes` + `prior`. Update the two existing test call sites and the store caller. This is a deliberate contract change (the old heuristic multiplied `honestMinutes` directly, which double-applied the multiplier; percentiles-on-ratios × guess is the correct composition).

### 8.4 Display-domain mapping (UI, not engine)

The band track needs a fixed visual domain so the segment width is comparable across renders. Map minutes → % using `[domainLow, domainHigh] = [floor5(low·0.6), ceil5(high·1.4)]` clamped to a sane min span. This is a **pure UI helper** in the band component (or `src/features/shared/`), not the engine — it is presentation only. Keep the engine returning minutes.

### 8.5 Prior band

`priorHalfWidthL` derives from the category prior's typical noise. Add `PRIOR_BAND_HALF_WIDTH = 0.4` (log-space half-width ≈ a ±0.4 → roughly ÷1.5…×1.5 spread) to `src/engine/constants.ts`. The n=0 band is `[exp(lnHonest − 0.4), exp(lnHonest + 0.4)]` on the guess, 5-grid clamped. One tunable constant, not a per-category table (matches the project's "tune in constants.ts" rule).

### 8.6 TDD cases (extend `confidence.test.ts`)

`describe('honestRangeFor — P25–P75')`:
1. **brackets honest, 5-grid** — for honest 5..120, tight + noisy ratio sets: `low%5===0`, `high%5===0`, `5 ≤ low ≤ honest ≤ high`, `low ≤ high` (port the existing regression loop; add `guessMinutes`+`prior`).
2. **percentile correctness** — for `R = [1,1,1,2,2,2,3,3]`, `guess=10`, `M≈exp(mean ln)`: assert `low === floor5(10·exp(p25(lnR)))` and `high === ceil5(10·exp(p75(lnR)))` (hand-computed expected).
3. **noisier ⇒ wider** — keep existing assertion (noisy width > tight width).
4. **narrows as data settles** — same guess, ratios `[1,3,1,3]` (noisy) vs `[2,2,2,2,2,2]` (settled): settled width strictly smaller. *This is the feature's core promise — assert it.*
5. **n=0 ⇒ prior band** — empty ratios returns the §8.5 prior band, low<honest<high, 5-grid.
6. **n=1..3 ⇒ blended, never falsely tight** — two near-identical logs `[2.0, 2.01]` still yields width ≥ the prior-blended floor (not a 0-width band).
7. **half-width floor/ceiling honored** — degenerate `[2,2,2,2,2,2]` clamps to `RANGE_MIN_HALF_WIDTH`; extreme `[1/6, 6, 1/6, 6]` clamps to `RANGE_MAX_HALF_WIDTH`.
8. **quantile() helper** — unit-test type-7 interpolation against known R `quantile()` outputs (e.g. `quantile([1,2,3,4], .25)===1.75`).

`describe('confidenceFor')`: keep all existing tests green (unchanged).

## 9. Gating

- **Engine math is NOT gated** — `range`/`confidence` are always computed (cheap, on-device). Gating is purely a render decision, so the paywall can show a real, accurate teaser shape without leaking the user's numbers.
- **Render gate:** in `HonestSuggestionCard` (and the category-detail band), branch on `useEntitlement((s) => s.isPro)` — not `ProGate` wrapper here, because the same card renders for both tiers and only the band sub-region differs. Pro → draw band; free → draw the point number + locked bracket affordance.

  > **Correction to current code:** `HonestSuggestionCard` today renders the band for *anyone* who passes `confidence`+`range` (line ~42 `showRange`). This spec makes the band **Pro-only**: add `&& isPro` to `showRange`, and add the locked affordance for `!isPro`. The point number stays free.

- **Paywall trigger:** add `'honest_range'` to `paywall_view.trigger` union in `src/services/analytics.ts`. Locked affordance + category-detail locked strip route to `/(modals)/paywall` carrying `trigger: 'honest_range'`.
- **Locked teaser (surface A):** to the right of the point number, a faint bracket `[ ]` glyph (`Ionicons` `code-outline` or a hairline `View` bracket) + `Range` micro label, `t.colors.inkFaint`, in a bare `Pressable` (visual on inner `View` per the RN gotcha). Communicates "there's a range here" without drawing the user's actual low/high.
- **Locked teaser (surface B):** a greyed band strip with a blurred/placeholder fill (`t.colors.surfaceSunken` track, `t.colors.primarySoft` ghost segment at a generic width) + caption `See the range your tasks land in, and watch it tighten.` + a `Pro` chip. Tapping opens the paywall. Shows the *shape* of value (a band that narrows) using placeholder geometry, never the user's real data.

## 10. Copy

Every string humanizer-checked (no em-dash, no rule-of-three, no AI vocab, no guilt), conversion-psychology framed (felt benefit, honest, no fake urgency).

| Context | String |
|---|---|
| Surface A, honest band (no suffix) | `Honestly  {low}–{high}m` |
| Surface A, setting band suffix | `still learning` (existing) |
| Surface A, raw / n<3 (Pro) | `Still learning — roughly {low}–{high}m` |
| Surface A, locked affordance label | `Range` |
| Surface B, end labels | `{low}` … `{high}` (numerals only) |
| Surface B, narrowing caption (Pro) | `Tightened from {wasLow}–{wasHigh} to {nowLow}–{nowHigh} as you logged.` |
| Surface B, narrowing caption, no narrowing yet | `Log a few more and watch this tighten.` |
| Surface B, locked strip caption | `See the range your tasks land in, and watch it tighten.` |
| Locked strip chip | `Pro` |
| Paywall row (if listed in paywall feature list) | `Honest ranges that narrow as you go` |
| a11y, Pro band | `Honest range {low} to {high} minutes{, still learning}.` |
| a11y, locked affordance | `Unlock the honest range with Pro.` |

- The em-dash in "Still learning — roughly…" reads as a natural spoken pause and is the established voice in the existing card; the humanizer ban targets *decorative* em-dashes, and here it separates a state from a value. If preferred, swap to `Still learning. Roughly {low}–{high}m`. (Open question 13.3.)
- Never "your estimate was wrong", "you're off by", "should have", or any red/deficit framing. The range is descriptive ("usually lands"), never corrective.

## 11. Edge cases & guardrails

- **Low n (1–3):** prior-blended band (§8.2); never a falsely tight band. Raw state shows "roughly", no tick.
- **Zero data / n=0:** prior band or (live-guess banner) no band at all — depends on whether `confidence` is passed.
- **Single distinct ratio (all logs identical):** CV=0 → `confidenceFor` may say honest, but `honestRangeFor` clamps to `RANGE_MIN_HALF_WIDTH` so the band has a real, non-zero width (no "30–30" band).
- **Honest point outside raw percentile band:** the EWMA point can sit slightly outside the raw P25–P75 (EWMA weights recent logs; percentiles weight all). The `min(honest, …)/max(honest, …)` bracket in §8.1 guarantees the band always contains the point. Tested (case 1).
- **Band width genuinely grows** (life got noisier): allowed and honest. Stays amber, never red, never captioned as a regression. The "tightened from" caption only renders when `nowWidth < wasWidth`; otherwise show the neutral "log a few more" line.
- **`range: null` from engine:** degrade to point number silently.
- **Privacy:** all on-device; no ratios or ranges leave the device. Analytics sends only bucketed widths + confidence enum (§12), never raw minutes or ratios.
- **Monotonic invariant:** the honest *point* number is guarded by the engine's sharpness/EWMA logic (unchanged). The band is a descriptive spread, not a tier — it is exempt from the monotonic rule by design, but is never *colored* as going backward.
- **Performance:** band renders on the hot Add-Task path. Keep it `View`-based (no SVG), memoize the % math, and drive the single width with one shared value. No re-layout on guess change beyond the width interpolation.

## 12. Analytics

Add to `src/services/analytics.ts` (`AppEventProps`):

```ts
honest_range_shown: {
  surface: 'add_task' | 'category_detail' | 'timer';
  confidence: CalibrationConfidence;        // 'raw' | 'setting' | 'honest'
  width_min: number;                        // high − low, bucketed to nearest 5
  is_pro: boolean;
};
honest_range_locked_tap: { surface: 'add_task' | 'category_detail' };
honest_range_narrowed: {                    // category-detail, when now < was
  was_width_min: number;
  now_width_min: number;
};
```

- Extend the existing `paywall_view.trigger` union with `'honest_range'`.
- Fire `honest_range_shown` once per card mount (debounced on the Add-Task path so guess-dialing doesn't spam). All fire-and-forget per the analytics contract; never throw into the loop.

## 13. Build manifest & effort

**Edit:**
- `src/engine/confidence.ts` — add `quantile()`, upgrade `honestRangeFor` to P25–P75 + low-n prior blend (sig adds `guessMinutes`, `prior`). **[M]**
- `src/engine/constants.ts` — add `QUANTILE_MIN_N = 4`, `PRIOR_BAND_HALF_WIDTH = 0.4`. **[S]**
- `src/engine/multiplier.ts` — `resolveSuggestion` populates `range` + `confidence`. **[S]**
- `src/engine/__tests__/confidence.test.ts` — TDD cases §8.6 (write first). **[M]**
- `src/domain/types.ts` — add `CategoryStats.firstHonestRange?` (+ the two range fields already exist). **[S]**
- `src/db/…` — append-only migration: `category_stats` gains `first_honest_low`/`first_honest_high`; `categoryStatsRepo` reads/writes them. **[S]**
- `src/features/shared/HonestSuggestionCard.tsx` — Pro-gate the band (`showRange && isPro`), render band track + tick + reveal anim, locked affordance for free. **[M]**
- `src/services/analytics.ts` — new events + `'honest_range'` trigger. **[S]**

**Add:**
- `src/components/HonestBand.tsx` — the reusable band track (segment + tick + width shared-value + display-domain helper), consumed by surfaces A/B/C. Props: `{ range, point, confidence, height, fillTone }`. **[M]**
- `src/features/shared/HonestBandLockedTeaser.tsx` (or inline) — greyed strip + caption + Pro chip for non-Pro. **[S]**
- category-detail band strip wiring (in the existing category screen) — consume `HonestBand` + the "tightened from" caption from `firstHonestRange`. **[S]**

**Dependencies:** none new — Reanimated + tokens + existing repos only. No `react-native-svg` (band is Views).

**Effort:** **Medium** overall (engine math is the only real work; the heuristic + types + free-tier card already exist). ~M for engine+tests, ~M for the band component + gating, S for the rest.

**Open questions:**
1. **13.1** Should surface C (timer/running view) ship in v1 or fast-follow? (Spec recommends A+B first; C behind the same prop, ship when the running card is next touched.)
2. **13.2** Do we ever want a true narrowing *time-series* (multi-point sparkline of band width over weeks) on category detail or in long-range history (spec 07)? Currently we store only `firstHonestRange` (then-vs-now). A series is a second data class — defer unless review-ritual (spec 02) wants it.
3. **13.3** "Still learning — roughly" em-dash vs two-sentence form (§10) — pick one in copy review.
4. **13.4** Should the point-number `~` prefix stay when a band is shown? (Spec drops it — the band already says "approximate".) Confirm with the founder on the rendered screenshot.
5. **13.5** P25–P75 (50% of runs) vs a wider P10–P90 — TimeNinja markets "25–75%". Spec ships P25–P75 to match the claim; the quantile constants make widening a one-line change if user testing wants a wider net.
