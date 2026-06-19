# Honest-time calibration: regularized affine model + cold-start prior + pre-estimate label

**Date:** 2026-06-19
**Status:** Design — approved in brainstorm, pending spec review
**Area:** `src/engine` (pure), `src/stores/calibrationStore`, `src/db` (migration), `src/features/shared/HonestSuggestionCard`, `src/features/today/FocusCard`

## Problem

The honest number is `honest = round5(guess × M)`, where `M` is one scalar per category
(`blendWithPrior`: `M = exp((n·logEwma + k·ln(prior)) / (n + k))`, `k = 4`).

Two real weaknesses, confirmed in code:

1. **One multiplier for every task size.** A 5-minute task and a 90-minute task in the
   same category share one `M`. Reality isn't proportional: bigger tasks tend to blow up
   by a *larger* factor (hidden sub-steps), and tiny tasks carry fixed setup overhead. A
   single scalar is a midpoint approximation that's least accurate at the extremes. There
   is no fixed-cost / intercept term.
2. **Cold start feels canned.** With `n < 3` the `k·ln(prior)` term dominates, so the
   on-screen number is literally `guess × population_prior` (e.g. admin `2.2`). It is
   shown with no signal that it isn't the user's own calibration yet. This is the state
   that reads as "dumb / placeholder."

Adaptation itself is **correct and wired** (`calibrationStore.applyLog:392` reads prev
stats → `engineApplyLog` → persists updated stats; `useTimer`/`useRetro` call it on
completion). `M` does converge to the user's true ratio — just slowly, anchored by `k=4`.
This design does not fix a bug; it raises the ceiling on smartness and honesty.

## Goals

- Replace the single multiplier with a model that captures **scale-dependence** (fixed
  cost + slope) without destabilizing the cold start or splitting data into starved buckets.
- Make a **new/thin category** start at a number informed by the user's *own* cross-category
  bias, not a generic population number.
- **Tell the user** when the number is still a starting estimate, framed as "sharpens with
  use" — no guilt, no shame.
- Ship behind the **existing output contract** so the core UI flows need no changes.

## Non-goals (explicitly rejected in brainstorm)

- **Size bands (S/M/L multipliers).** Subsumed by the affine model; bands split the user's
  logs into buckets that starve on everyday-task data volume and introduce boundary jumps.
- **Both affine + bands.** Redundant, two cold-start problems, risk of the two disagreeing.
- **Folding time-of-day / weekday context into the point estimate.** Already surfaced
  read-only in Patterns; folding in overfits on thin data.
- **Per-label fuzzy matching, decomposition prompts.** Out of scope.
- **Faster-convergence tuning (item C).** Documented follow-up, not in this spec.
- **Surfacing the fixed cost as separate copy** ("~10m to start, then 1.4×"). Enhancement
  the model unlocks; not v1.

## Product invariants preserved

No guilt (the label is encouraging, never red/shame). Monotonic sharpness (untouched —
`sharpness` logic in `update.ts` is unchanged). Core loop on-device-only (all of this is
pure TS + local SQLite/kv; no network). Pricing untouched.

---

## Part 1 — Regularized affine model (engine)

### Model

Per category, fit `actual ≈ a + b·guess` (x = guess minutes, y = actual minutes) by
**recency-weighted ridge regression anchored to the multiplicative prior**:

Minimize over `(a, b)`:

```
J = Σ wᵢ (a + b·xᵢ − yᵢ)²  +  λ_a·a²  +  λ_b·(b − m0)²
```

- `λ_a·a²` shrinks the intercept toward **0** — a fixed-cost term only appears when varied
  data earns it. Guesses clustered at one size → no leverage → stays a pure multiplier
  (correct: scale-dependence is unlearnable without spread).
- `λ_b·(b − m0)²` anchors the slope to the prior multiplier `m0` (this constant replaces
  the role of today's `k = 4`).
- `wᵢ` are recency weights (see below).

### Closed form (O(1) per log)

Maintain weighted sufficient statistics: `Sw, Swx, Swy, Swxx, Swxy`.

```
A = Sw + λ_a
B = Swx
C = Swxx + λ_b
P = Swxy + λ_b·m0
det = A·C − B²

a = (C·Swy − B·P) / det
b = (A·P     − B·Swy) / det
```

**Cold-start guarantee:** with all sums = 0 → `A = λ_a`, `B = 0`, `C = λ_b`, `P = λ_b·m0`,
`det = λ_a·λ_b` → `a = 0`, `b = m0`. So `honest = m0·guess` — **byte-identical to today's
behavior**. No new cold-start instability. (Pinned by a unit test.)

`honestNumber(guess) = max(5, round5(a + b·guess))`. The `max(5, …)` floor is retained.

### Recency weighting

On each counted log `(x, y)`, decay the existing sums by `d = (1 − α)` then add the new
point at weight 1:

```
Sw   = d·Sw   + 1
Swx  = d·Swx  + x
Swy  = d·Swy  + y
Swxx = d·Swxx + x²
Swxy = d·Swxy + x·y
```

`α = alphaFor(adaptSpeed, source)` — reuses the existing `ALPHA_BY_SPEED`
(steady/balanced/reactive) and `RETRO_ALPHA_FACTOR` (retro at half α). `λ_a`, `λ_b` are
**not** decayed: the prior anchor stays constant-strength while recent likelihood
dominates — same saturating-memory character as today's EWMA.

### New constants (`src/engine/constants.ts`)

- `RIDGE_INTERCEPT_LAMBDA` (`λ_a`) — intercept shrink strength.
- `RIDGE_SLOPE_LAMBDA` (`λ_b`) — slope-to-prior anchor strength.

Defaults are chosen and **pinned by tests** against two constraints:
1. Cold start output equals the current `guess × prior` exactly (λ cancels — holds for any
   λ; the test guards the formula).
2. With logs whose guesses lack spread, the fit reduces to a pure multiplier matching the
   current model's converged `M` within a small tolerance, so the "feel" of the number
   does not regress.

The ratio clamp (`clampRatio`, `[1/6, 6]`) is applied to `y/x` before a point enters the
regression, so one disaster can't tilt the line — same robustness as today.

### Files

- New: `src/engine/affine.ts` — sufficient-stat update + closed-form solve + `honestNumber`.
- `src/engine/multiplier.ts` — `resolveSuggestion` now calls the affine solver; still
  returns `CalibrationSummary` unchanged (see Backward-compat).
- `src/engine/update.ts` — `applyLog` updates regression sums instead of `logEwma`/`mEffective`.
- `src/engine/index.ts` — exports.

---

## Part 2 — Cold-start global-personal prior (item D)

### Idea

A brand-new category should start near *its own* population prior but **nudged by the
user's global bias**, so day 1 of "Calls" reflects that this user personally runs
optimistic everywhere — without erasing category specificity.

### Mechanism

Maintain a global personal bias in `kv` (or companion store): an EWMA of
`ln(clampedRatio)` across **all** counted logs, plus a count.

```
globalLnEwma = α_g·ln(r) + (1 − α_g)·globalLnEwma     // α_g = balanced default
globalN      += 1
```

The anchor `m0` for a category `c` becomes a geometric blend of population and personal-global:

```
population = CATEGORY_PRIORS[c] ?? GLOBAL_PRIOR
if globalN ≥ GLOBAL_PRIOR_MIN_LOGS:
    wPers = min(globalN / (globalN + GLOBAL_PRIOR_K), GLOBAL_PRIOR_MAX_WEIGHT)
    m0    = exp((1 − wPers)·ln(population) + wPers·globalLnEwma)
else:
    m0    = population
```

`m0` is only the regression *anchor*; once a category has its own logs, its own data moves
`b` away from `m0` via the likelihood, so the global-personal influence auto-fades exactly
to the cold-start window. New constants: `GLOBAL_PRIOR_MIN_LOGS`, `GLOBAL_PRIOR_K`,
`GLOBAL_PRIOR_MAX_WEIGHT` (cap so a new category is never fully overridden by the global
average — keeps category specificity).

### Files

- New: `src/engine/globalPrior.ts` — pure blend function + global EWMA update.
- `src/stores/calibrationStore.ts` — read/update the global stat around `applyLog`; pass the
  blended `m0` as the regression anchor.
- Persistence: one small global row (see Part 3).

---

## Part 3 — Persistence & migration

`CategoryStatRow` today: `{ categoryId, n, logEwma, mEffective, sharpness, priorMult,
adaptSpeed, updatedAt, reclaimedMinutes }`.

### Changes

- **Add** regression sums: `sw, swx, swy, swxx, swxy`.
- **Keep** `n` (drives `basis` label and `sampleSize`), `sharpness`, `priorMult`,
  `adaptSpeed`, `updatedAt`, `reclaimedMinutes`.
- **Keep** `mEffective` but redefine it as a *representative* scalar = effective multiplier
  at the user's **median logged guess** for the category (`(a + b·med) / med`). This keeps
  every existing "×1.8" display working with no component edit (see Backward-compat).
- **Drop** `logEwma` after migration (or retain nullable for one version for safety).
- **New global row** (kv key or a `companion` field): `{ globalLnEwma, globalN }`.

### Migration (lossless)

For each existing category row, seed the regression as a **pure multiplier** carrying the
user's current converged state:

```
m_old = mEffective (current)         // or exp(logEwma) if preferred
seed the sums as λ-free pseudo-data equivalent to (a=0, b=m_old) with weight ≈ n
```

Concretely: set `sw = min(n, 1/α_steadystate)`, and the cross sums consistent with all mass
on the line `y = m_old·x` at the median historical guess. Result: immediately after
migration the number is unchanged; subsequent logs refine the slope/intercept normally.
Global row seeds from the `n`-weighted average of existing per-category `logEwma`.

Migration runs once via the DB layer's versioned setup (memory + sqlite implementations).

---

## Part 4 — Pre-estimate label (UI)

### Trigger

`basis === 'prior'` (i.e. `n < PERSONAL_MIN_LOGS`, currently 3) — already computed in
`resolveSuggestion`. Pass a `preEstimate: boolean` (or the existing `basis`) down to the chip.

### Copy

Quiet second line, rendered in the chip's existing second-line slot (the one `reasonNote`
uses; mutually exclusive in practice — `reasonNote` needs ≥4 over-runs, well past `n < 3`):

> **Starting estimate · sharpens as you log**

Run through conversion-psychology (frames the cold start as the app's payoff — it gets
sharper, the calibration wedge — not a weakness) and humanizer (plain, specific, no slop,
no em-dash). No guilt language. If `reasonNote` and `preEstimate` ever coincide,
`preEstimate` takes priority.

Line 1 is unchanged: `Honestly ~35m · +20m more`. The delta still shows.

### Placement

- `src/features/shared/HonestSuggestionCard.tsx` — add `preEstimate?: boolean`; render the
  qualifier line when true (and no `reasonNote`). Styling reuses `noteText` (`fontSize.sm`,
  `colors.inkSoft`) — no new tokens, follows the established flat one-line-plus-quiet-note
  pattern already in the file.
- `src/features/today/FocusCard.tsx` — pass `preEstimate` through (it already passes
  `summary.multiplier` / honest number to the card).
- **Not** the compact Today `TaskRow`, timer, or other surfaces (kept clean — decided).

### Accessibility

Extend the chip's `accessibilityLabel`: when `preEstimate`, append ", starting estimate,
sharpens as you log".

### Data flow

`useAddTask` / `useToday` already call `resolveSuggestion` and have `basis`. Thread
`preEstimate = summary.basis === 'prior'` into the card props. No store changes for the
label itself.

---

## Backward-compatibility for multiplier displays

These render a single scalar and must keep working with zero JSX change:
`reward.tsx:228`, `patterns/PredictionCard.tsx:27`, `patterns/CalibrationMap.tsx:97`,
`category-detail/AhaCard.tsx:87`, `category-detail/TrendChart.tsx`, `HonestNumber.tsx`.

Resolution: `CalibrationSummary.multiplier` is populated as the **effective** multiplier at
the relevant guess (`honestMinutes / guessMinutes`). For category-level reads with no guess
in hand (Patterns, Trend), they read the stored representative `mEffective` (effective mult
at median guess, Part 3). "×1.8" stays truthful — it now means "effective at a typical
task." No component edits required.

---

## Testing

Engine (pure, exhaustive — the bar for `src/engine`):

- Cold start: `affine.honestNumber(guess)` equals current `guess × prior` for the full
  prior table and a range of guesses (the byte-identical guarantee).
- No-spread data: guesses all equal → fit is a pure multiplier ≈ current converged `M`.
- Scale-dependence: synthetic data with a real fixed cost (`y = 10 + 1.3·x + noise`)
  recovers `a ≈ 10`, `b ≈ 1.3` once enough varied points exist; before that, `a ≈ 0`.
- Stability: the two-noisy-nearby-points case that breaks raw OLS (slope went −2) stays
  sane under ridge.
- Recency: a step-change in pace moves the fit at the rate implied by `adaptSpeed`.
- Ratio clamp still applied (one 10× outlier can't dominate).
- Global prior: blend math, `MIN_LOGS` gate, `MAX_WEIGHT` cap, auto-fade as category data
  grows.
- Migration: post-migration number equals pre-migration for seeded categories.

Store: `applyLog` persists the new sums and the representative `mEffective`; global row
updates; `resolveSuggestion` returns unchanged `CalibrationSummary` shape.

UI: `HonestSuggestionCard` renders the qualifier line iff `preEstimate && !reasonNote`;
a11y label includes it; `FocusCard` threads the flag.

## Rollout

Single PR (founder reviews/merges — never auto-merge). `npm run lint`, `typecheck`, `test`
green before opening. No native deps, no Expo-Go-only paths affected.
