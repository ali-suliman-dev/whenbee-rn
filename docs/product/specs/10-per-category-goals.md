# 10 — Per-category goals / experiments  ·  Pro

**Status:** spec · **Tier:** Pro (`pro` entitlement) · **Skills applied:** retention-optimization, ui-design:react-native-design, ui-design:visual-design-foundations, conversion-psychology, humanizer, react-native-architecture, typescript-expert, motion-design

> Read [README.md](README.md) first — the shared invariants (no-guilt, monotonic, on-device, RevenueCat gating, theming, motion, analytics, copy rules) live there and are not repeated here.

---

## 1. What it is (one paragraph)

A per-category **goal** is a target the user sets on a metric the engine already computes — "get my admin estimates within 25%" — and a calm, forward-only progress read toward it. It does not add a new number to track; it points at the category's existing sharpness/accuracy and says "here's where you are, here's where you're aiming, here's the gap closing." A goal is never "done" and never "broken": when the category reaches the target, Whenbee celebrates once and offers a tighter target to keep going, so there's always a reason to log the next task *after* the multiplier is learned. It only ever shows the best you've reached — if a rough week pulls accuracy down, the goal read does not move backward and never frames the dip as failure. Pro-gated; free users see the locked teaser. Fully on-device, no calendar, no network.

## 2. The user problem + evidence

Calibration has a graduation cliff: once a category's multiplier is learned and the honey cell seals at Honest, the headline insight is resolved and the reason to keep logging evaporates. That is the exact "insight that resolves once will churn" risk ([07-PRO-VALUE-IDEAS — the 5 hard truths #5](../07-PRO-VALUE-IDEAS.md)). A goal converts a finished fact into an open, forward pursuit, which is what retains a self-insight subscription.

- **Bearable gates Goals + Experiments behind Pro, and a goal is never "done" — met ones get replaced** ([07-PRO-VALUE-IDEAS §2.5](../07-PRO-VALUE-IDEAS.md)). Direct category evidence that this is paid surface, and that the replace-on-met loop is the mechanic that works.
- **Forward-looking goals create a reason to return** even after the core value is delivered — the "value must regenerate" truth ([§2.5](../07-PRO-VALUE-IDEAS.md), [the 5 hard truths #5](../07-PRO-VALUE-IDEAS.md)).
- Maps to the **Mirror organ** (compounding self-insight → curiosity return reason) in the three-organ retention model ([03-RETENTION-MONETIZATION Part 2](../03-RETENTION-MONETIZATION.md)).

## 3. Where it lives

A goal is a property of one category, so it lives **inside Category Detail** (`src/app/category/[category].tsx`), as a new card under the existing trend chart and above the adapt-speed control. It is the natural home: the user is already looking at this category's honest number, tier, and trend — the goal sits beside its own evidence.

| Surface | Where | Free vs Pro |
|---|---|---|
| **Goal card** (primary) | Category Detail, new `GoalCard` between `TrendChart` (card 4) and `AdaptSegment` (card 5) | Pro: live goal + progress, or "Set a goal" empty state. Free: locked teaser strip with a greyed target shape and a paywall CTA. |
| **Met celebration** | Same card, in place, on the focus visit after the target is reached | Pro only (you can't meet a goal you can't set). |
| **No new tab, no Today surface, no widget.** | — | Goals are a depth feature, not a daily nag. Keeping them off Today honors "do not optimize time-in-app" and avoids any daily "you're behind" read. |

- **Free vs Pro:** free Category Detail is unchanged except for one new locked teaser card. Calibration itself is never fogged — the honest number, tier, trend, and aha card all stay free. Pro only *adds* the goal layer.

## 4. User flow

**Happy path (Pro) — set, then pursue:**
1. User opens Category Detail for a category with enough data (`n ≥ GOAL_MIN_LOGS`).
2. The Goal card shows the empty state: "Aim for tighter estimates here" + a single "Set a goal" button.
3. Tapping it opens an inline goal picker (not a modal — expands in place): a short list of preset targets phrased as accuracy bands (§5.3), with a recommended one pre-selected from current accuracy.
4. User taps a target and confirms. The card switches to the progress state: target line, current read, and a calm honey-fill progress track showing best-reached vs target.
5. Over the following days the user logs tasks for this category as normal (core loop, free). On each return to Category Detail the progress read reflects the **best** accuracy reached since the goal was set — it only ever moves forward.
6. When best-reached crosses the target, the next focus visit shows the **met** state: a one-time warm celebration in place, then an offer to "Aim tighter" (a stricter preset) or "I'm happy here" (keep the met goal as a calm trophy, no pressure).

**Met → replace loop:** choosing "Aim tighter" sets a new, stricter goal and resets the progress track's *target* (not the user's accuracy) — the pursuit reopens. Choosing "I'm happy here" leaves the met goal displayed as a sealed, finished trophy with no further prompts. Either way there is no treadmill guilt: the user opts into the next rung; nothing is taken away.

**Locked path (non-Pro):**
1–2. User opens Category Detail; the Goal card renders as a locked teaser: a greyed target shape, the label "Goals", and one line of value copy.
3. Tapping anywhere on the card opens `/(modals)/paywall` with `trigger: 'goals'`. No real target is shown; the teaser conveys the *shape* of the value, not the user's data.

**Not-enough-data state (Pro, `n < GOAL_MIN_LOGS`):** the card shows a calm "A few more logs and you can set a goal here" line with the current log count — never a locked or failed feeling, just "not yet."

## 5. Screens & states

All values are tokens from `src/theme/tokens.ts` via `useTheme()` and roles from `src/theme/typography.ts`. No raw hex/number. The card reuses the existing `Card` primitive (`src/components/Card.tsx`), matching cards 3–5 on the screen.

### 5.1 Empty state (Pro, enough data, no goal yet)

```
┌─────────────────────────────────────────────┐
│  GOAL                                         │  ← type.eyebrow, inkSoft
│                                               │
│  Aim for tighter estimates here               │  ← type.bodyLg, ink
│  You're within about 40% right now.           │  ← type.bodySm, inkSoft
│                                               │
│  ┌───────────────────────────────────────┐   │
│  │            Set a goal                  │   │  ← AppButton, primary (the 1 indigo el.)
│  └───────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```
- Card padding from `Card`; inner `gap: t.space[3]`.
- Eyebrow → `type.eyebrow`, `t.colors.inkSoft`.
- Headline → `type.bodyLg`, `t.colors.ink`.
- Sub → `type.bodySm`, `t.colors.inkSoft`. The "within ~40%" number is the current accuracy band rounded (§8), framed as a neutral fact, never "only 40%".
- CTA → existing `AppButton` (primary). This is the single filled-indigo element in the card.

### 5.2 Progress state (Pro, active goal)

```
┌─────────────────────────────────────────────┐
│  GOAL                              within 25% │  ← eyebrow + target chip (amber soft)
│                                               │
│  Closing in                                   │  ← type.bodyLg, ink (forward, never %)
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░  │  ← honey-fill track (accent), best-reached → target
│  Best so far: within 32%                      │  ← type.bodySm, inkSoft
│                                               │
│  Keep logging admin and it tightens.          │  ← type.caption, inkFaint (quiet)
└─────────────────────────────────────────────┘
```
- **Target chip** top-right: `t.colors.accentSoft` bg, `t.colors.amberText` text, `type.caption` bold, `radii.full`, padding `space[3]`/`space[0.5]` — identical to the tier pill already in this screen's `styles().pill`, so the two read as siblings.
- **Headline** (`type.bodyLg`, ink): a forward phrase keyed off progress fraction (§10), e.g. "Just getting going" / "Closing in" / "Almost there". Never a raw percentage as the hero — the number is supporting, the direction is the message.
- **Progress track:** reuse the honey-fill bar geometry — `progress.track` height, `radii.full`, track `t.colors.surfaceSunken`, fill `t.colors.accent` (amber = honey/ripen/reward semantics; never indigo, never red). Fill fraction = `goalProgress(...)` (§8), clamped 0..1, driven off **best-reached** accuracy so it is monotonic by construction.
- **Best-so-far line** (`type.bodySm`, inkSoft): the best accuracy band reached, phrased "within X%". This is the only number, and it only ever improves.
- **Footer caption** (`type.caption`, inkFaint): a quiet, category-named nudge — the forward reason to log again.

### 5.3 Goal picker (inline, expands in place on "Set a goal")

```
┌─────────────────────────────────────────────┐
│  GOAL                                         │
│  Pick a target                                │  ← type.bodyLg, ink
│                                               │
│  ( within 40% )  (•within 25%)  ( within 15% )│  ← preset chips; recommended = filled
│                                               │
│  Recommended — a real step from where you are.│  ← type.caption, inkSoft (under selected)
│                                               │
│  ┌──────────────┐   ┌──────────────────────┐ │
│  │   Cancel     │   │      Set goal        │ │  ← ghost + primary, like reset block
│  └──────────────┘   └──────────────────────┘ │
└─────────────────────────────────────────────┘
```
- Preset chips reuse `Chip` (`src/components/Chip.tsx`); selected chip = filled amber (`accentSoft` + `amberText`), unselected = hairline outline. Single-select. Row uses `gap: t.space[2]`, wraps if needed.
- Presets come from `GOAL_PRESETS` (§8) intersected with "stricter than current accuracy" — never offer a target the user has already beaten (that would feel hollow), and always offer at least the next achievable rung.
- The recommended chip is the easiest preset that is still a genuine step tighter than current accuracy.
- Buttons mirror the existing reset block's ghost+primary pairing in `category/[category].tsx`.

### 5.4 Met / celebration state (Pro, best-reached crossed target)

```
┌─────────────────────────────────────────────┐
│  GOAL  ·  reached                  within 25% │  ← eyebrow + "reached" + sealed chip
│                                               │
│        ✦  You did it                          │  ← type.subtitle, ink; small bee/seal mark
│        Admin estimates landed within 25%.     │  ← type.bodySm, inkSoft
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │  ← full honey track (sealed)
│                                               │
│  ┌──────────────┐   ┌──────────────────────┐ │
│  │ I'm happy here│   │     Aim tighter      │ │  ← ghost + primary
│  └──────────────┘   └──────────────────────┘ │
└─────────────────────────────────────────────┘
```
- Fires **once** per goal-met event on the focus visit where `best-reached ≥ target` first holds (latched in kv like graduation, §11). Subsequent visits show the met state without the celebration motion.
- Mark: reuse the small wax-seal/`✦` motif already in the design language (the `seal`/`mark` motion tokens); a tiny `BeeMascot` at `companion.hudBee` size is optional but keep it calm.
- Full track is the sealed amber fill at 100%.
- "Aim tighter" → opens picker (§5.3) seeded with stricter presets. "I'm happy here" → collapses to a calm sealed trophy line ("Reached — within 25%") with no further prompts.

### 5.5 Not-enough-data state (Pro, `n < GOAL_MIN_LOGS`)

```
┌─────────────────────────────────────────────┐
│  GOAL                                         │
│  A few more logs and you can aim here         │  ← type.bodyLg, ink
│  3 of 5 logged                                │  ← type.bodySm, inkSoft (count, not %)
└─────────────────────────────────────────────┘
```
- No button, no lock, no red. Purely "not yet." Mirrors the calm-empty-state rule.

### 5.6 Locked teaser (non-Pro) — see §9.

### States summary
- **loading:** the parent screen already shows "Reading your patterns…"; the card renders nothing until `detail` resolves, then paints its state synchronously (goal read is derived, not a separate async).
- **error:** goal read derives from already-loaded data; if the goal kv is missing/corrupt it falls back to the empty state (treat as "no goal"), never an error surface.
- **empty / not-enough-data / active / met / locked:** as above.

## 6. Motion

Durations/easing from `tokens.motion`; Reanimated worklets; `ReduceMotion.System` honored; entering-only on conditionally-mounted views (no `exiting` layout anim).

- **Progress-track fill:** on mount/focus, the amber fill grows from 0 to its fraction with `withTiming(frac, { duration: t.motion.honeyFill, easing: t.motion.easing.honey })` — the same honey-fill beat the app already uses, so a goal "filling" feels like honey ripening. Reduced motion: paint final width, no grow.
- **Picker expand:** the card grows in place with an entering `FadeIn`/height-eased reveal at `t.motion.base` with `easing.standard`. No exiting animation (collapse is an unmount with no layout anim → Fabric-safe).
- **Met celebration:** reuse the wax-seal `seal.*` choreography tokens (border-close → honey-well → soft bloom → `✦` fade → amber spark), the same calm, no-overshoot ritual as `RitualSeal`. Capped at one calm pass; reduced motion shows the sealed end-state with a single `t.motion.toast` fade.
- **No loss/regression motion ever** — there is no animation for accuracy dipping, because the displayed progress never dips (§8). No shake, no red flash, no "broke it" beat exists in the component.

## 7. Data model

A goal is small, per-category, mutable, and **not** training data, so it is **kv, not a SQLite table** — it never touches the calibration model and must be trivially editable/replaceable. (SQLite is reserved for the append-only system of record; a goal is a user preference + a latched best, not a log.)

**Domain type — add to `src/domain/types.ts`:**
```ts
/** A per-category, no-guilt accuracy goal. Pro-only. Loss-proof by construction:
 *  `bestAccuracy` only ever rises (max-latched), and the target is the only thing
 *  that changes when a goal is met and replaced. Never a streak, never a deadline. */
export interface CategoryGoal {
  categoryId: string;
  /** Target accuracy, 0..100 (same scale as engine sharpness/accuracy). Higher = tighter. */
  targetAccuracy: number;
  /** Best accuracy reached since this goal began — MONOTONIC (max(prev, new)). Drives progress. */
  bestAccuracy: number;
  /** Accuracy at the moment the goal was set — the baseline the progress fills from. */
  baselineAccuracy: number;
  /** epoch ms the goal was set (display only — never a countdown). */
  setAt: number;
  /** True once bestAccuracy ≥ targetAccuracy has ever held (latched; never cleared). */
  met: boolean;
}
```

**Persistence (kv via `src/lib/kv.ts`):**
- One key per category: `goal.<categoryId>` → JSON of `CategoryGoal`. Synchronous, Expo Go-safe.
- A separate met-celebration ledger key `goal.celebrated` → JSON `string[]` of category ids whose met celebration already fired (mirrors the graduation ledger pattern in `calibrationStore`), so the celebration shows exactly once.
- No migration needed (kv, not SQLite). No change to `task_events`, `category_stats`, or `companion`.

**Why kv and not a table:** goals are mutable preferences that get replaced; the system-of-record tables are append-only and feed the model. Keeping goals out of SQLite guarantees they can never accidentally enter the training path.

## 8. Engine / logic

All goal math is **pure** and lives in a new engine module, exported via `src/engine/index.ts`, tuned via constants in `src/engine/constants.ts`. **TDD required — write these tests first.** No clock, no RN, no kv inside the engine; the store passes in the numbers and persists results.

**Metric choice — accuracy (engine `sharpness`), justified:** the engine already computes per-category **accuracy** as `sharpnessFromWindow(clampedRatios)` (`src/engine/sharpness.ts`): `100·(1 − mean |1 − estimate/actual|)`. It is exactly "how close your estimates are" on a 0–100 scale, already cached on `CategoryStats.sharpness`, already the thing the honey tier reads, and already monotonic-friendly. A goal of "within X%" maps cleanly: accuracy `a` means typical estimate error is `(100 − a)%`, so "within 25%" = accuracy ≥ 75. We target accuracy and *display* it as an error band ("within X%") because users think in "how far off am I", not in an abstract 0–100 score. We deliberately do **not** target the multiplier `M` (that's the plan input, not a quality the user improves) and do **not** target the honey `Tier` (already has its own sealed-at-Honest completion; a second tier-goal would be redundant).

**New file — `src/engine/goals.ts`:**
```ts
import { GOAL_PRESETS, GOAL_MIN_LOGS, GOAL_RECOMMEND_STEP } from './constants';
import type { CategoryGoal } from '../domain/types';

/** Display band: accuracy 75 → "within 25%". Inverse of accuracy. */
export function accuracyToErrorBand(accuracy: number): number {
  return Math.max(0, Math.min(100, Math.round(100 - accuracy)));
}

/** "within X%" target → required accuracy. e.g. 25 → 75. */
export function errorBandToAccuracy(errorBand: number): number {
  return Math.max(0, Math.min(100, 100 - errorBand));
}

/** Forward-only progress fraction 0..1 from baseline → target, driven by the
 *  MONOTONIC bestAccuracy. Returns 1 once the target is reached. If target ≤
 *  baseline (already there) returns 1. Never returns a value below the last —
 *  callers pass bestAccuracy, which never decreases, so this never regresses. */
export function goalProgress(goal: Pick<CategoryGoal, 'baselineAccuracy' | 'targetAccuracy' | 'bestAccuracy'>): number {
  const span = goal.targetAccuracy - goal.baselineAccuracy;
  if (span <= 0) return 1;
  const gained = goal.bestAccuracy - goal.baselineAccuracy;
  return Math.max(0, Math.min(1, gained / span));
}

/** True once best has ever reached target. Latches in the store via goal.met. */
export function isGoalMet(goal: Pick<CategoryGoal, 'targetAccuracy' | 'bestAccuracy'>): boolean {
  return goal.bestAccuracy >= goal.targetAccuracy;
}

/** Fold a fresh accuracy reading into a goal: best is max-latched (never drops),
 *  met latches true and never clears. Pure — returns a new goal, mutates nothing. */
export function reconcileGoal(goal: CategoryGoal, currentAccuracy: number): CategoryGoal {
  const bestAccuracy = Math.max(goal.bestAccuracy, currentAccuracy);
  return { ...goal, bestAccuracy, met: goal.met || bestAccuracy >= goal.targetAccuracy };
}

/** Whether this category can have a goal yet. */
export function canSetGoal(n: number): boolean {
  return n >= GOAL_MIN_LOGS;
}

/** Preset error-bands (as "within X%") offered for a current accuracy, filtered to
 *  those strictly tighter than where the user is, hardest-achievable first removed
 *  if it's not a real step. Always returns ≥1 option when canSetGoal. */
export function presetsForAccuracy(currentAccuracy: number): number[] {
  const currentBand = accuracyToErrorBand(currentAccuracy);
  // Offer bands tighter than current (smaller error than the user already hits).
  const tighter = GOAL_PRESETS.filter((band) => band < currentBand);
  return tighter.length > 0 ? tighter : [GOAL_PRESETS[GOAL_PRESETS.length - 1]!];
}

/** The recommended (pre-selected) preset: the easiest band that is still a real
 *  step (≥ GOAL_RECOMMEND_STEP points) tighter than current. Falls back to the
 *  loosest available preset. */
export function recommendedPreset(currentAccuracy: number): number {
  const options = presetsForAccuracy(currentAccuracy);
  const currentBand = accuracyToErrorBand(currentAccuracy);
  const realStep = options.find((band) => currentBand - band >= GOAL_RECOMMEND_STEP);
  return realStep ?? options[0]!;
}
```

**Add to `src/engine/constants.ts`:**
```ts
// ── Per-category goals (Pro, no-guilt) ───────────────────────────────────────
/** Need at least this many counted logs before a category can have a goal. */
export const GOAL_MIN_LOGS = 5;
/** Offered "within X%" targets, loosest → tightest (display as error bands). */
export const GOAL_PRESETS = [40, 25, 15, 10] as const;
/** A recommended target must be at least this many points tighter than current. */
export const GOAL_RECOMMEND_STEP = 8;
```

**Export from `src/engine/index.ts`:**
```ts
export {
  accuracyToErrorBand, errorBandToAccuracy, goalProgress, isGoalMet,
  reconcileGoal, canSetGoal, presetsForAccuracy, recommendedPreset,
} from './goals';
```

**Store wiring — extend `useCalibrationStore` (`src/stores/calibrationStore.ts`):** add goal read/write that lives entirely off the training path.
- `loadGoal(categoryId): CategoryGoal | null` — read `goal.<id>` from kv; on read, **reconcile against the live accuracy** (`reconcileGoal(goal, stat.sharpness)`) and write back the max-latched best (so opening the screen advances the goal). Returns the reconciled goal.
- `setGoal(categoryId, targetErrorBand): CategoryGoal` — read current `stat.sharpness` as baseline + best, build a `CategoryGoal { targetAccuracy: errorBandToAccuracy(band), baselineAccuracy: sharpness, bestAccuracy: sharpness, met: sharpness ≥ target, setAt: Date.now() }`, persist to kv, fire `goal_set` analytics.
- `clearGoalCelebration(categoryId)` / `hasCelebrated(categoryId)` — kv `goal.celebrated` ledger (mirror `markGraduated`).
- These never call `applyLog`, never read/write `category_stats` except to *read* `sharpness`, never deposit reclaim. **The goal cannot influence the model — it only reads `sharpness`.**

**Feature hook — extend `useCategoryDetail` (`src/features/category-detail/useCategoryDetail.ts`)** (or a small sibling `useCategoryGoal`): expose `{ goal, presets, recommended, canSet, setGoal, justMet, aimTighter, keepGoal }`. `justMet` latches one render when reconcile flips `met` true and the category isn't in the celebrated ledger (same pattern as `justGraduated`).

**TDD cases (`src/engine/__tests__/goals.test.ts`):**
1. `accuracyToErrorBand(75) === 25`; `accuracyToErrorBand(100) === 0`; clamps below 0 / above 100.
2. `errorBandToAccuracy(25) === 75`; round-trips with `accuracyToErrorBand`.
3. `goalProgress` — baseline 60, target 80, best 70 → `0.5`; best 80 → `1`; best 90 → clamped `1`; best 60 → `0`.
4. `goalProgress` returns `1` when `target ≤ baseline` (already there).
5. **Monotonic / loss-proof:** `reconcileGoal` with `currentAccuracy < bestAccuracy` leaves `bestAccuracy` unchanged → `goalProgress` cannot drop. (The core no-regression test.)
6. `reconcileGoal` latches `met` true once best ≥ target and never clears it even if a later `currentAccuracy` dips.
7. `isGoalMet` true exactly when best ≥ target.
8. `canSetGoal(4) === false`, `canSetGoal(5) === true` at `GOAL_MIN_LOGS`.
9. `presetsForAccuracy` — current accuracy 70 (band 30) offers `[25,15,10]` (only tighter); current 95 (band 5) offers the tightest single fallback `[10]`; never offers a band the user already beats.
10. `recommendedPreset` — picks the easiest band ≥ `GOAL_RECOMMEND_STEP` tighter than current; falls back to loosest option when none qualifies.
11. Edge: `presetsForAccuracy(100)` (band 0) → returns the fallback array, length ≥ 1 (never empty).

## 9. Gating

- **Placement:** wrap the Goal card body in `<ProGate fallback={<GoalLocked categoryId={…} />}>` (`src/features/paywall/ProGate.tsx`). The card shell (Card + eyebrow) renders for everyone; only the interactive goal content is gated.
- **Paywall trigger:** `'goals'`. Tapping the locked card calls `router.push({ pathname: '/(modals)/paywall', params: { trigger: 'goals' } })`.
- **Locked teaser design (`GoalLocked`):**
```
┌─────────────────────────────────────────────┐
│  GOAL                                    🔒   │  ← eyebrow + faint lock glyph (inkFaint)
│                                               │
│  Set a target and watch it tighten            │  ← type.bodyLg, ink
│  ▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░  │  ← greyed track (surfaceSunken fill, no amber)
│                                               │
│  Keep a forward goal on this category   →     │  ← type.bodySm, inkSoft + chevron
└─────────────────────────────────────────────┘
```
  - Track is **greyed** (`t.colors.surfaceSunken` fill on a hairline track) at a fixed illustrative fraction — it shows the *shape* of the value and reveals **none** of the user's real accuracy.
  - Whole card is a single `Pressable` (bare wrapper; visual style on inner `View`) → paywall.
  - One line of value copy; no fake numbers, no urgency.

## 10. Copy

Every string below is humanizer-checked (no em-dash, no AI vocab, no rule-of-three filler, sounds like one honest person) and passes the no-guilt rule. `{category}` = the lower-cased category name.

**Empty state (can set):**
- Eyebrow: `GOAL`
- Headline: `Aim for tighter estimates here`
- Sub: `You're within about {band}% right now.`
- Button: `Set a goal`

**Picker:**
- Headline: `Pick a target`
- Chips: `within 40%` · `within 25%` · `within 15%` · `within 10%`
- Recommended hint (under selected): `A real step from where you are.`
- Buttons: `Cancel` · `Set goal`

**Progress state:**
- Eyebrow: `GOAL` · target chip: `within {band}%`
- Headline by progress fraction `p`:
  - `p < 0.34` → `Just getting going`
  - `0.34 ≤ p < 0.67` → `Closing in`
  - `0.67 ≤ p < 1` → `Almost there`
- Best line: `Best so far: within {bestBand}%`
- Footer: `Keep logging {category} and it tightens.`

**Not-enough-data:**
- Headline: `A few more logs and you can aim here`
- Sub: `{n} of {GOAL_MIN_LOGS} logged`

**Met celebration:**
- Eyebrow: `GOAL · reached` · chip: `within {band}%`
- Headline: `You did it`
- Sub: `Your {category} estimates landed within {band}%.`
- Buttons: `I'm happy here` · `Aim tighter`

**Met, kept (collapsed trophy):**
- Line: `Reached — within {band}%.`  *(en dash via a normal hyphen-space in code: `Reached - within {band}%.`)*

**Locked teaser:**
- Headline: `Set a target and watch it tighten`
- Sub: `Keep a forward goal on this category`

**Copy guardrails — what is banned in this component (no exceptions):** no "you failed", "you broke it", "you missed", "behind", "streak", "don't lose", any countdown/deadline phrasing, any percentage framed as a deficit ("only 40%"), any red, any "keep going or else". Progress headlines are always forward-facing direction words, never a bare number presented as a verdict.

## 11. Edge cases & guardrails

- **Loss-proof (the core invariant) — how it holds:** the displayed progress is driven by `bestAccuracy`, which is `max(prev, new)` on every reconcile, so the track **physically cannot** retreat. There is no code path that lowers it and no animation that depicts a drop. This passes both halves of the two-test rule ([03 §Part 2](../03-RETENTION-MONETIZATION.md)): **intrinsic** (the reward is your own tighter estimates, not points/currency) and **loss-proof** (no state produces a loss/guilt/"you failed" read).
- **No-streak:** a goal has no time component. `setAt` is display-only and never shown as a countdown; nothing resets daily; missing days does nothing. There is no "days remaining", no per-day requirement, no decay.
- **Metric dips after a life change (meds, sleep, a hard week):** accuracy can fall, but the goal read does not move (best-latched), and the dip is never surfaced in this card at all. The footer stays a calm forward nudge. (The honest number and trend elsewhere already show current reality without blame; the goal card simply doesn't editorialize a dip.)
- **Low-n / not-enough-data:** `canSetGoal(n)` gates the set affordance; below `GOAL_MIN_LOGS` the card shows the "not yet" count state, never a lock or a failure.
- **Already-better-than-every-preset:** `presetsForAccuracy` falls back to the tightest preset so the user can always aim at something; if they've already beaten even that, `goalProgress` returns 1 and the goal sets straight into the met state (an honest, earned trophy, not a hollow one).
- **Category reset:** when a category's learning is reset (`resetCategory`), clear its `goal.<id>` and `goal.celebrated` entry too, so a fresh category starts goal-free rather than carrying a stale baseline. (Add to `resetCategory` in the store.)
- **Met celebration fires once:** latched via the `goal.celebrated` kv ledger (mirror `markGraduated`); re-visits show the met state without the seal animation.
- **Reconcile on open advances the goal:** because reconcile runs in `loadGoal`, simply opening Category Detail after logging elsewhere advances best/met — the user doesn't have to do anything special for progress to register.
- **Privacy / on-device:** goals are kv-only, never synced, never networked, contain no PII beyond category id + two integers.
- **Pro lapse:** if entitlement drops, the goal card reverts to the locked teaser; the stored `CategoryGoal` is left untouched in kv so re-subscribing restores it intact (no data destroyed on downgrade).

## 12. Analytics

Add to `AppEventProps` in `src/services/analytics.ts` (fire-and-forget, never throws). Add `'goals'` to the `paywall_view.trigger` union.

```ts
goal_card_viewed: { category: string; state: 'empty' | 'active' | 'met' | 'not_enough' | 'locked' };
goal_set: { category: string; target_band: number; baseline_band: number };
goal_paywall: { category: string };           // locked card tapped → paywall (trigger 'goals')
goal_met: { category: string; target_band: number; logs_to_meet: number };
goal_replaced: { category: string; from_band: number; to_band: number };  // "Aim tighter"
goal_kept: { category: string; band: number };                            // "I'm happy here"
```
- `paywall_view.trigger` union: add `| 'goals'`.
- `goal_paywall` and `paywall_view {trigger:'goals'}` fire together on locked-card tap so the funnel `goal_card_viewed(locked) → goal_paywall → purchase` is measurable.
- KPI tie-in: `goal_set` and `goal_met` are the forward-engagement signals; watch `goal_replaced` rate as the anti-churn proof (people opting into the next rung is the retention mechanic working).

## 13. Build manifest & effort

**Engine (pure, TDD-first):**
- `src/engine/goals.ts` — new (§8 functions). **S**
- `src/engine/__tests__/goals.test.ts` — new (§8 cases). **S**
- `src/engine/constants.ts` — add `GOAL_MIN_LOGS`, `GOAL_PRESETS`, `GOAL_RECOMMEND_STEP`. **XS**
- `src/engine/index.ts` — export the new functions. **XS**

**Domain:**
- `src/domain/types.ts` — add `CategoryGoal`. **XS**

**Store / hooks:**
- `src/stores/calibrationStore.ts` — add `loadGoal` / `setGoal` / celebration ledger / clear-on-reset; new kv keys; `goal_*` analytics. **M**
- `src/features/category-detail/useCategoryGoal.ts` — new view-model hook (or extend `useCategoryDetail`). **S**

**UI:**
- `src/features/category-detail/GoalCard.tsx` — new (empty / picker / active / met / not-enough states + honey track + seal motion). **M**
- `src/features/category-detail/GoalLocked.tsx` — new locked teaser. **S**
- `src/app/category/[category].tsx` — insert `GoalCard` between Trend (4) and Adapt (5), wrapped in `ProGate`. **XS**

**Analytics:**
- `src/services/analytics.ts` — add `goal_*` events + `'goals'` trigger. **XS**

**Tests:**
- `src/features/category-detail/__tests__/GoalCard.test.tsx` — state rendering + the loss-proof "dip doesn't move the bar" interaction test. **S**

**Dependencies:** none new. Reuses `Card`, `Chip`, `AppButton`, `BeeMascot`, honey-fill geometry, seal motion tokens, `ProGate`, kv, Reanimated — all already in the project.

**Total effort:** **Med** (matches 07-PRO-VALUE-IDEAS §2.5's "Effort: Med"). The math is small and pure; most of the work is the five-state card and the no-guilt motion polish.

**Open questions:**
1. **Metric display unit** — ship "within X%" (error band) as specified, or also offer a raw accuracy framing? Recommendation: error band only; it's how the audience thinks ("how far off am I"), and one framing avoids confusion.
2. **One goal per category vs. several** — spec assumes exactly one active goal per category (replaced on met). A multi-goal or "experiment" framing (Bearable's second word) is a possible fast-follow; keep the kv shape (`goal.<id>` single object) so it can grow to `goal.<id>.<n>` later without migration.
3. **Should the met celebration also bank a Discovery card?** A "goal reached" could append to the discoveries gallery as a banked milestone. Out of scope for v1 (keeps goals fully off the SQLite path); revisit if the gallery surface ships.
4. **Recommended-preset aggressiveness** — `GOAL_RECOMMEND_STEP = 8` points is a first guess; tune once real accuracy distributions are visible in analytics.
