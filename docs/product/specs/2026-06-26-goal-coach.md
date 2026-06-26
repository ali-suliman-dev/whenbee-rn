# Goal Coach — per-category goals reworked from marker to coach

**Status:** approved (design locked 2026-06-26). Supersedes the passive parts of
[`10-per-category-goals.md`](10-per-category-goals.md): the target + monotonic
honey-fill stay; everything else becomes a **coach**.

## Why

A target band + a progress bar is the *free* tier across the category
(RescueTime, Oura, WHOOP). People pay for the **verb** — "coach me there" — not
the number. Whenbee already owns the expensive inputs (per-context bias, the
honest number, trend), so turning them into active guidance is near-pure-margin
Pro. It stays fair because the calibration loop is free: we gate the *payoff*,
not the loop.

**Invariants (never violate):** no guilt, no streaks, worst case reads
"typical" never "behind"; honey/best is monotonic; coach *invites* ("you might
like to"), never scolds; core loop stays free + on-device. Pricing from
RevenueCat. One filled indigo CTA per screen (the goal's amber coin CTAs are not
indigo and never compete with the screen primary).

## The one control

The user sets **one thing — the target accuracy band** ("aim to land within
X%"). Presets come from `GOAL_PRESETS` (`[40,25,15,10]`), always filtered to
bands strictly tighter than current (`presetsForAccuracy`). The PICK UI adds an
**adjustable drawer**: a draggable honey marker on a band from `spot on` (0%) to
`±{current}% now`; tap a preset or drag to fine-tune to any integer band between
a floor and the current band. Selecting a preset moves the marker; dragging
updates the live number and de/highlights the matching preset.

## The 4 coach mechanics

All from existing engine primitives; all statistically gated (speak only when
real); all no-guilt copy.

### 1. Assist at guess time (flagship)
**Where:** the Add-task screen, a NEW separate `GOAL · COACH` card *below* the
existing amber `HonestSuggestionCard` (which is unchanged). Only renders when the
task's category has an active goal.
**Engine:** `resolveSuggestion({guess, categoryFit, recurringFit, prior})` →
`honestMinutes` (the bias-corrected number). Biggest-lever phrasing from
`biggestLever` (below) when present.
**UI/copy:** "Mornings run longest for you on Coding — ~35m keeps you inside
±15%." + honey coin `Use 35m` (writes honestMinutes into the guess field) +
`or keep 25m`. **No "based on your last N logs" subline.** Plain fallback when no
real lever: "~35m keeps this inside ±15%."
**Gate:** basis flips to personal at `PERSONAL_MIN_LOGS`; below that, stay quiet
or say "typical patterns". Apply writes the value to the guess; never auto-apply.

### 2. Biggest lever
**Where:** active goal card (category screen), one coach row.
**Engine:** NEW `biggestLever(dims)` — runs `correlateContext(key, samples)` over
each dimension (time-of-day, reason tag, task size) and returns the single
correlation with the largest `gap` that clears the gates, or `null`.
**Gate:** `correlateContext` already returns null unless a bucket ≥
`ACCURACY_MIN_BUCKET` (4) AND `gap` ≥ `ACCURACY_MIN_GAP` (12). If all null, the
row does not render.
**Copy:** "Your mornings miss widest — tighten those first." (factual, invite).

### 3. ETA projection
**Where:** active goal card, a quiet stat line with "Best so far".
**Engine:** NEW `logsToGoal({ratios, currentAccuracy, targetAccuracy})` — uses
the recent slope (reuse `buildAccuracySeries` bucket deltas / a simple
per-log gain) → `ceil((target − current) / gainPerLog)`.
**Gate:** if `gainPerLog ≤ 0` or `ratios.length < ACCURACY_TREND_MIN_LOGS`,
return `null` → UI shows "keep logging, it'll come" (no number, no deadline).
**Copy:** "Best so far ±17% · about 6 logs to ±15%."

### 4. Post-log feedback
**Where:** the Reward screen, one amber line under the hero number / honey bar.
Only for a goaled category.
**Engine:** NEW `postLogQuality({thisError, recentErrors})` — percentile / is-min
of this log's |error| vs the recent 7-day window. Returns a small enum
(`tightest_week | tighter_than_usual | typical`) — never a negative verdict.
**Copy:** "That one landed within 8% — your tightest this week · ±15% goal
getting closer." Worst case: "Logged — that's another honest data point." (the
existing neutral reward line; never "you missed").

## Surfaces & states (locked visuals)

Tokens only (`src/theme/tokens.ts`); amber-only; coin language
(`CoinHex`/coin-edge). Buttons: horizontal pairs, ≤12px text, ~34pt tall (NOT the
44/52 slabs), coin-edge press. Mocks in scratchpad (`goal-card-states2.html`,
`goal-assist-sep.html`, `goal-context.html`).

**Category goal card (`GoalCard` / `GoalLocked`), order = above "Tune how I
learn":**
1. **Not enough** (`!canSetGoal(n)`): "A few more logs and you can aim here ·
   {n} of {GOAL_MIN_LOGS}" + muted thin track.
2. **Locked** (free, can set): coin-edge PRO pill, "Set a target and I'll coach
   you there" + chevron + "The number to guess, your biggest miss, how close you
   are." + muted thin track + honey teaser tick (no real numbers — Pro-gate-leak
   rule). Tap → paywall `trigger:'goals'`.
3. **Pick**: "Pick how close to aim · you're within ±{current}% now", preset row
   + adjustable drawer (drag marker), horizontal `Not now | Set goal`.
4. **Active (coach)**: `within X%` chip, "Closing in", honey progress track
   (driven by monotonic best), stat line "Best so far ±{best}% · about {eta}
   logs to ±{target}%" (eta omitted if null), ONE coach row (biggest lever) when
   present. Calm — progress first, one lever.
5. **Reached**: ✦ seal coin, "You did it · landed within X%", full honey track,
   horizontal `I'm happy here | Aim tighter ✦` (re-opens Pick with tighter
   presets).

**Add screen:** the `GOAL · COACH` card (mechanic 1).
**Reward screen:** the feedback line (mechanic 4).

## New engine functions (pure, TDD first)

- `biggestLever(dims: {key, samples}[]): ContextCorrelation | null`
- `logsToGoal(input): number | null`
- `postLogQuality(input): 'tightest_week' | 'tighter_than_usual' | 'typical'`

All in `src/engine/`, exported via `index.ts`, exhaustively unit-tested
(boundaries: empty, below-min, slope ≤ 0, ties). No clock, no React.

## Out of scope / unchanged

`goals.ts` (presets, progress, reconcile, met) stays. The monotonic honey-fill
stays. No new data class; optional tags never train calibration. Phrasing may use
Apple Foundation Models on-device with a template fallback (per voice-intake
eval) — not required for v1.
