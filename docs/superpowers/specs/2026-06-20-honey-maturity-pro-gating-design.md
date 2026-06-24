# Honey as calibration maturity + honey-gated Pro reveal

**Date:** 2026-06-20
**Status:** Design approved, pending spec review → implementation plan

## Problem

A brand-new user logs their first task and the honey meter does not move — or
jumps to a full seal on a single lucky guess. Both are activation-killers for an
ADHD-first, retention-sensitive product.

### Root cause (verified)

Honey = `sharpness` = `100 · (1 − mean(|1 − guess/actual|))` over the last 8
clamped ratios (`src/engine/sharpness.ts`), with a monotonic `max(prev, raw)`
guard in `applyLog` (`src/engine/update.ts`). The ratio is computed from the
user's **raw guess** (`useTimer.ts:196` passes `estimateMin: guessMin`), not
Whenbee's honest number.

Consequences on the first log:

| guess | actual | honey after 1 log |
|---|---|---|
| 20m | 20m | **100%** → instant seal |
| 20m | 30m | 67% |
| 20m | 60m | 33% |
| 20m | 10m (finished early) | **0%** — meter dead |
| 20m | 8m | **0%** |

The metric measures **accuracy** — a skill a day-1 user has not built and cannot
control. The app's whole thesis is the opposite: *you don't get better at
guessing; Whenbee learns your bias for you*. A user who follows Whenbee's honest
numbers perfectly still watches a dead meter, because their raw guesses stay
optimistic.

### Research basis for the fix

- **Reinforce the behavior, not the outcome** (operant conditioning): reward the
  act of logging, which the user controls, not raw guess accuracy, which they do
  not.
- **Endowed-progress + goal-gradient** (Nunes & Drèze; Kivetz): visible early
  progress toward a goal drives persistence; a 0% after genuine effort is the
  textbook opposite, at the exact moment (Day 0–1) activation is decided.
- **Competence / self-efficacy** (SDT): early wins build "I can do this"; a dead
  or randomly-maxed meter destroys the competence signal in session one.

## Goals

1. Every counted log produces visible forward movement through the
   activation-critical early window — never a dead 0%.
2. A single lucky guess cannot seal the meter — the top is earned.
3. Reuse existing engine machinery and honor all product invariants
   (monotonic honey, no guilt/streaks, on-device core loop, pricing from
   RevenueCat).
4. Connect honey to the confidence band and to a Pro reveal that adds
   anticipation and conversion lift **without** suppressing revenue.

## Non-goals

- No second meter. The companion's nectar (+1/log, feeds the bee) already exists
  as a secondary signal; a third would split attention.
- No change to RevenueCat entitlement logic or pricing. This gates
  **presentation and pitch timing**, never the actual entitlement or purchase.
- No change to the core guess → timer → learn loop's on-device-only property.

## The two existing axes (context)

- **Tier / honey** — monotonic, derived from `sharpness` (accuracy).
  Thresholds `[0, 40, 64, 82, 93]` → `Raw, Setting, Ripening, Thickening, Honest`.
- **Confidence** — bidirectional `raw → setting → honest`, from sample size +
  coefficient of variation (`src/engine/confidence.ts`). Already gates some
  reveals (`reservePriceVisible`, `firstHonestRange`).

The Pro gate must key off a **monotonic** signal so Pro never re-locks. Honey
stays the gate; we redefine *how it ripens*. Confidence contributes to the
earned-seal condition only.

## Section 1 — Honey redefined as calibration maturity

Three ingredients, all already in the engine's vocabulary:

- **Effort floor** `floor(n)` — concave, strictly increasing per counted log,
  capped at the Thickening threshold (`HONEY_FLOOR_CAP = 82`). Guarantees visible
  movement through the first logs. Pure showing-up reaches *most* of the way,
  never to seal.
- **Accuracy term** `A` — the existing `sharpnessFromWindow(window)` over the
  last `SHARPNESS_WINDOW` clamped ratios. Unchanged.
- **Trust weight** `t(n) = n / (n + k)` — the same cold-start blend already used
  (reuse `GLOBAL_PRIOR_K`, or a dedicated `HONEY_TRUST_K`).

Combine:

```
honeyRaw = floor(n) + max(0, A − floor(n)) · t(n)
honey    = max(prevHoney, honeyRaw)        // monotonic invariant preserved
```

Properties:

- **No dead 0%** — `floor(1) > 0`; every counted log raises `floor(n)`, so
  `honey` strictly rises each log until the floor saturates near 82, after which
  accuracy drives further rises.
- **No instant seal** — at `n = 1`, `t ≈ 1/(1+k)` (≈0.14 with k=6), so a perfect
  20/20 guess lifts honey only slightly above the floor (~38%, not 100%).
  Accuracy fully expresses only as data accumulates.
- **Earned top** — reaching Honest / seal (`honey ≥ 93`) requires `A` high
  **and** `confidence === 'honest'` (n ≥ `CONFIDENCE_HONEST_MIN_LOGS`,
  CV ≤ `CONFIDENCE_HONEST_MAX_CV`). The effort floor caps at 82, so the meter
  cannot seal by volume alone.
- **No guilt** — a bad guess means slower ripening, never a drop.

`floor(n)` shape: monotonic, concave (diminishing returns), with a meaningful
per-log step early (roughly one tier-band's worth across the first 2–3 logs) and
an asymptote at `HONEY_FLOOR_CAP`. Exact constants are tuned in implementation
and locked by tests — the spec fixes the *shape and bounds*, not the literal
numbers. Illustrative target: ~28% / ~45% / ~64% across logs 1–3, approaching ~82%.

`tierFor` and the tier thresholds are unchanged.

## Section 2 — Pro gating: anticipation without a revenue leak

**Honey gates the value and the pitch — never the purchase button.**

- Pro is **always purchasable** (preserve the day-1 impulse buyer). A quiet
  "preview Pro" escape hatch is always present, so slow loggers are never locked
  out of the pitch entirely.
- Default Pro state = **previewed + ripening**: the locked payoff is shown with a
  live honey progress bar and the line *"Unlocks meaning at [tier]."*
- The full paywall **pitch fires on an event, not a date**: the first time a
  category's `confidence` reaches `'setting'` (the confidence band first visibly
  narrows — the "Whenbee knows me now" beat) → reveal the pitch:
  *"Here's what it can do."*
- **Per-feature readiness** maps each Pro payoff to the data it genuinely needs,
  so the gate is honest (the feature would otherwise show garbage):
  - Confidence band → `confidence ≥ 'setting'`.
  - Day-capacity check / Honest Week / Honest Month → a log-count / time-span
    threshold (tuned during implementation).
  - Other payoff-bundle features → mapped to their natural data requirement.
- **Early buyers** buy into a *ripening* Pro: entitlement is granted immediately,
  but features visibly bloom as honey grows. Buying early = reserving the payoff
  and watching it fill.

This connects honey → confidence band → Pro exactly: the band narrowing is both
the maturity signal and the visceral aha that triggers the reveal.

## Section 3 — Wiring, invariants, testing

### Engine (pure)

- New pure module (`src/engine/honeyMaturity.ts`, or folded into `sharpness.ts`):
  `floor(n)` and the `honeyRaw` combine. Exported via `src/engine/index.ts`.
- New constants in `src/engine/constants.ts`: `HONEY_FLOOR_CAP = 82`,
  `HONEY_FLOOR_K` (floor curvature), trust `k` (reuse `GLOBAL_PRIOR_K` or add
  `HONEY_TRUST_K`).
- `tierFor` / `TIER_THRESHOLDS` unchanged.

### `applyLog` (`src/engine/update.ts`)

- Replace the `sharpnessFromWindow` call with the maturity combine, passing
  `n`, the window, and `prevHoney`. Keep the `max(prev, …)` guard.
- The `confidence` axis is already computed on the write path
  (`calibrationStore.applyLog` calls `confidenceFor`); reuse it for the seal
  condition.

### Pro readiness selector (pure)

- A small pure function `proReadiness({ honey, confidence, n })` →
  `{ pitchUnlocked: boolean, perFeatureReady: Record<ProFeatureId, boolean> }`.
- Consumed by the paywall / feature hooks **through the store**, never imported
  directly into `src/app/**` or `src/components/**` (layer rule).
- RevenueCat still owns pricing and entitlement; this selector only gates
  presentation and pitch timing.

### Invariants honored

- Monotonic honey ✓ (`max(prev, …)` retained).
- No guilt / no streaks ✓ (bad guess = slower ripening, never a drop).
- On-device core loop ✓ (no network in guess → timer → learn).
- Pricing from RevenueCat ✓ (gate is presentation-only).

### Testing (TDD — logic layer)

Engine tests first, then the readiness selector, then UI:

1. First log never yields 0; never yields a seal (≥93), for accurate, over, and
   under-run guesses.
2. Honey strictly rises on each counted log through the floor region.
3. Seal (≥93) requires both high accuracy **and** `confidence === 'honest'`;
   volume alone caps below 93.
4. Monotonic: a bad guess after a good streak never lowers honey.
5. `proReadiness`: `pitchUnlocked` flips true on first `confidence === 'setting'`
   and stays true (monotonic); per-feature flags match their data thresholds.

## Open items for implementation

- Final `floor(n)` constants and curvature, validated against the illustrative
  targets.
- The per-feature data thresholds for day-capacity / Honest Week / Honest Month.
- Copy for the ripening-Pro preview and the reveal pitch
  (`conversion-psychology` + `humanizer`, per project rules) — drafted at the UI
  step, not here.
