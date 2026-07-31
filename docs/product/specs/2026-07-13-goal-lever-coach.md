# Goal Lever Coach — replace the add-sheet "Use Xm" apply button

**Date:** 2026-07-13 · **Status:** spec, awaiting founder approval
**Replaces:** the add-assist mechanic ("Use Xm" apply button) of `2026-06-26-goal-coach.md` §1. The other goal-coach mechanics (goal card, reward feedback, lever on the category screen) are untouched.
**Mock:** `mocks/goal-coach-options.html` (Option A) · flaw walkthrough: `mocks/goal-coach-latch.html` (superseded — the latch is NOT being built).

---

## 1 · Why (the flaw being fixed)

The add-sheet goal coach (`GoalCoachCard`) shows the honest number and a **"Use Xm"** button that writes it into the guess field (`useAddTask.applyHonest` → `setGuessMinState(suggestion.honestMinutes)`).

Three defects, confirmed in code:

1. **Escalation loop.** The suggestion is recomputed from the guess (`useAddTask.ts` → `resolveSuggestion({ guessMinutes: guessMin })`). Applying writes machine output into the guess slot; the engine multiplies it again: 15 → 25 → 40 → 60, unbounded. `alreadyInside = honestMinutes === guessMinutes` (`GoalCoachCard.tsx:40`) is only true at multiplier 1.0, so the button never disappears.
2. **Model pollution.** The calibration ratio trains on the guess field (`useTimer.ts:485` — `applyLog({ estimateMin: guessMin })`; the event field named `estimateMin` **is** the gut guess). Accepted machine numbers produce ratios ≈ 1.0, decay the multiplier, and corrupt honest numbers for genuinely raw guesses.
3. **False promise.** The goal (`CategoryGoal`) measures **sharpness of gut guesses** (`bestAccuracy`, reconciled from live sharpness). A button cannot move that number honestly. "~25m keeps you inside ±10%" is untrue under any wiring. It also contradicts the honest card one gap above it: *"Not a target. Keep guessing with your gut."* — the sentence the whole calibration thesis depends on.

**Decision (founder, 2026-07-13):** Option A — the coach stops touching the guess entirely and becomes a truthful status + lever card. No latch is needed: once nothing writes machine numbers into the guess field, there is nothing to latch.

---

## 2 · What the card becomes

A read-only Pro card, rendered only while the category has an **active, un-met goal** (unchanged gating). Three stacked zones:

```
┌──────────────────────────────────────────────┐
│ GOAL · FOCUSED WORK              [goal ±10%] │   header: eyebrow + target chip
│                                              │
│ ±14% your best so far                  ±10%  │   meter head
│ ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░                          │   fill = goalProgress() 0..1
│ 3 of your last 7 logs landed inside the band │   countable sub-line
│                                              │
│ ☀︎  You land closest to your guess in the    │   lever row (only when a real
│    mornings — within ±18%, vs ±42% in the    │   lever exists)
│    afternoons.                               │
└──────────────────────────────────────────────┘
```

**Deleted forever:** the coin "Use Xm" button, `onApply`, `applyHonest`, `alreadyInside`, "or keep Xm", the `honestMinutes`/`guessMinutes` props. The card mentions **no minutes value at all** — the honest number lives exclusively in the amber card above.

### 2.1 Zones in detail

**Header.** Eyebrow `GOAL · {CATEGORY NAME}` (existing `type.eyebrow` style); right-aligned amber chip `goal ±{targetBand}%`. Same visual shell as today's card (surface, `radii.card`, `space[4]` padding, `space[3]` gap) — only the contents change.

**Progress meter.** The same forward-only progress already shown on the category GoalCard, now at the decision moment:
- Left: `±{bestBand}%` strong + `your best so far` muted (`bestBand = accuracyToErrorBand(goal.bestAccuracy)`).
- Right: `±{targetBand}%` in amber.
- Track: existing meter idiom (6px `radii.full` track on `surfaceSunken`, amber fill). Fill fraction = `goalProgress(goal)` — engine function, monotonic, clamped 0..1, already handles `baselineAccuracy ≥ targetAccuracy` (returns 1).
- Sub-line: `{inside} of your last {window} logs landed inside the band` — countable evidence (§3.2). Hidden when `window === 0`.

**Lever row.** Only when the engine returns a statistically real lever (`biggestLever` → non-null; gates: ≥4 logs per bucket, ≥12 accuracy-point gap — `ACCURACY_MIN_BUCKET`, `ACCURACY_MIN_GAP`). Copy is **strength-first, no-guilt** (leads with the best bucket, never scolds the worst):

> ☀︎ You land closest to your guess in the **mornings** — within **±{bestLeverBand}%**, vs ±{worstLeverBand}% in the {worstValue}.

- `bestLeverBand = 100 − lever.bestAccuracy`, `worstLeverBand = 100 − lever.worstAccuracy` (same accuracy scale as the goal — the numbers are directly comparable to the ±10% target, which is the point).
- Icon well: existing `accentSoft` square + Ionicon; icon per best bucket: mornings `sunny-outline`, afternoons `partly-sunny-outline`, evenings `moon-outline`, late nights `cloudy-night-outline`.
- No lever → row simply absent; the card is meter-only. **Never invent a lever** (engine already guarantees this — `correlateContext` returns null below the gates).

### 2.2 What the card never does

- Never renders a button or any tap action that changes the guess, the time chips, or the date. (The whole card MAY stay non-interactive; no `Pressable`.)
- Never shows the honest number, a suggested minutes value, or any "use/apply/bump" affordance.
- Never turns red / never shames: the worst bucket is a comparison clause, not a warning. Amber stays the only accent (per product invariant + one-primary-CTA rule — this card competes with nothing).

---

## 3 · Data contract

### 3.1 Store API — reshape `loadGoalCoach`

`loadGoalCoach` is consumed **only** by `useAddTask` (verified: GoalCard uses the lever from `loadCategoryDetail` independently). Reshape its return in place — no v2 duplicate:

```ts
// src/stores/calibrationStore.ts
export interface GoalCoachInfo {
  /** "within ±X%" target — accuracyToErrorBand(goal.targetAccuracy). */
  targetBand: number;
  /** Best band reached since the goal began — accuracyToErrorBand(goal.bestAccuracy). */
  bestBand: number;
  /** Forward-only 0..1 meter fill — goalProgress(goal). */
  progress: number;
  /** Of the last `windowCount` completed logs, how many landed inside targetBand. */
  insideCount: number;
  /** min(7, completed logs available). 0 → hide the sub-line. */
  windowCount: number;
  /** Statistically real time-of-day lever, or null. Bands on the goal's ±% scale. */
  lever: {
    bestValue: string;   // e.g. 'mornings'  (timeOfDayBucket vocabulary)
    worstValue: string;
    bestBand: number;    // 100 − bestAccuracy
    worstBand: number;   // 100 − worstAccuracy
  } | null;
}

loadGoalCoach: (categoryId: string) => Promise<GoalCoachInfo | null>;
```

Rules (mostly existing code, kept):
- `null` when the category has **no goal** or the goal is **met** (`loadGoal` reconciles the monotonic best against live sharpness first — unchanged).
- Events source: `taskEventsRepo.listByCategory(categoryId, 30)` (newest first), filtered to `status === 'completed' && actualMin !== null` — same as `loadGoalLogFeedback`.
- **Inside-band count:** over the newest `min(7, completed.length)` logs, per-log error on the engine's accuracy scale — `err = min(1, |1 − 1/clampRatio(estimateMin, actualMin)|)`; inside ⇔ `Math.round(err * 100) <= targetBand`. Same `errOf` formula as `loadGoalLogFeedback` — extract it to a shared local helper instead of duplicating.
- **Lever:** existing `biggestLever([{ key: 'timeOfDay', samples }])` call, but now returns the four fields above instead of collapsing to `worstValue` only.
- Pure derivation: no writes, no KV, bounded reads — same discipline as today.

### 3.2 Why "last 7 logs"

Countable and honest at add-time. Percent-only progress reads abstract; "3 of your last 7" is evidence the user can recount. 7 ≈ a week of single-daily logs, matches the reward feedback's 7-day framing without introducing clock math into the count (a fixed log window is deterministic for tests; the reward screen keeps its time-window framing).

### 3.3 Engine

**No engine changes.** Everything consumed already exists and is exported: `goalProgress`, `accuracyToErrorBand`, `biggestLever`, `clampRatio`, tier constants. Engine purity untouched.

---

## 4 · Reactivity matrix (the founder's "be mindful how it changes" list)

The card's inputs are: **category → its goal + its completed logs**. Nothing else. Explicitly:

| User action in the add sheet | Honest card (amber) | Goal coach card |
|---|---|---|
| Types/edits the **guess** (chips or wheel) | Recomputes (forecast follows guess) | **Static — must not change.** No dependency on `guessMin`. |
| Taps a **time chip** (15/25/45…) | Recomputes | **Static.** |
| Changes the **date** (today/tomorrow/pick) | Unchanged | **Static.** The lever line never claims when *this* task will run (we don't know — tasks have a planned date, not a time). It states the learned pattern only. |
| Switches **category** | Recomputes for new category | **Reloads** (existing `useEffect` on `category` in `useAddTask:198-210`, kept). Loading → render nothing (no skeleton; card appears when data lands, matching current behavior). No goal / met goal → hidden. |
| Types the **title** (auto-guess re-picks category) | Recomputes | Reloads via the same category effect — identical to a manual category switch. |
| **Edit-task** mode (`?id=`) | Same rules | Same rules — the card reflects the task's category, not its stored values. |
| Anti-chase coach fires (user manually raises guess toward honest) | — | **Independent.** Anti-chase stays exactly as is; it guards *manual* chasing and no longer has a machine-applied sibling to special-case. Delete only the comment claiming `applyHonest` bypasses it. |
| Sheet stays open across a bucket boundary (e.g. 11:59 → 12:01) | — | **No live clock dependency at all** — the card contains no "right now" claim, so nothing to tick. (Deliberate: an earlier draft had an "it's 2pm now" clause; dropped — we can't know when the task will actually run, and a self-updating clock line in a modal is noise.) |
| A log completes elsewhere while the sheet is open (background timer stop) | — | Stale until next category change / sheet open. Accepted: the sheet is short-lived, and the reward screen carries the fresh feedback. |

**Invariant to regression-test:** for a fixed category, `loadGoalCoach` is referentially independent of `guessMin` — and `GoalCoachCard` receives no prop derived from the guess.

## 5 · Render conditions & gating audit (Pro-leak check)

Rendered in `add-task.tsx` where the old card sat (below honest card / anti-chase):

```tsx
{a.goalCoach ? <GoalCoachCard categoryName={…} info={a.goalCoach} /> : null}
```

- Drop the `a.suggestion &&` guard — the card no longer needs the suggestion. (Suggestion may legitimately exist while the coach doesn't, and vice versa.)
- **Free users:** cannot set goals (goal creation is Pro-gated at `GoalLocked`/`setGoal`), so `loadGoal` returns null → card never renders. No band, no meter position, no lever leaks to free (per the pro-gate-leak rule: absence of render, not hidden values).
- **Met goal:** hidden (unchanged) — celebration lives on the category GoalCard.
- **No completed logs yet but goal exists** (possible only via reset edge-cases; `GOAL_MIN_LOGS = 5` normally prevents it): meter renders from goal fields (still valid), sub-line hidden (`windowCount 0`), lever null. No crash path.

## 6 · Copy (final, through conversion-psychology + humanizer at build)

| Slot | Copy |
|---|---|
| Eyebrow | `GOAL · {CATEGORY NAME}` |
| Chip | `goal ±{targetBand}%` |
| Meter left | `±{bestBand}%` + ` your best so far` |
| Meter right | `±{targetBand}%` |
| Sub-line | `{insideCount} of your last {windowCount} logs landed inside the band` (singular: `1 of your last 1 log…` → use `log`/`logs` correctly) |
| Lever | `You land closest to your guess in the {lever.bestValue} — within ±{lever.bestBand}%, vs ±{lever.worstBand}% in the {lever.worstValue}.` (lever bands, not the meter's goal bands) |
| A11y (card) | `Goal for {category}: best within {bestBand} percent, target {targetBand} percent. {insideCount} of your last {windowCount} logs inside the band.` + lever sentence when present |

Bans (existing brand rules): no "behind/only/still", no urgency, no red, no streak language. The lever sentence names the strength first; the worst bucket appears once, as a comparison, never as an instruction ("avoid afternoons" is NOT written — the user draws the conclusion).

## 7 · Analytics

- Remove: nothing (no apply event existed; the button fired none).
- Add `goal_coach_shown: { category: string; target_band: number; best_band: number; has_lever: boolean }` — fired once per category per sheet-open (same debounce pattern as `honest_suggestion_shown`, keyed on category, in `useAddTask`).

## 8 · File-by-file change list

| File | Change |
|---|---|
| `src/stores/calibrationStore.ts` | Reshape `loadGoalCoach` → `GoalCoachInfo` (§3.1); extract shared `errOf` helper used by it + `loadGoalLogFeedback`. |
| `src/features/add-task/GoalCoachCard.tsx` | Rewrite render: header + meter + sub-line + lever row. Delete button/coin/apply/`alreadyInside`. New props: `{ categoryName, info: GoalCoachInfo }`. All styles from tokens (meter reuses the GoalCard meter idiom; add a token only if a needed value is missing). |
| `src/features/add-task/useAddTask.ts` | Delete `applyHonest` (+ interface entry + return entry); `goalCoach` state type → `GoalCoachInfo | null`; add `goal_coach_shown` capture; update the anti-chase comment. |
| `src/app/(modals)/add-task.tsx` | New props wiring; drop `a.suggestion &&` from the coach condition; delete `onApply`. |
| `src/services/analytics.ts` | Add `goal_coach_shown` event type. |
| `src/stores/__tests__/calibrationStore.goalCoach.test.ts` | Rewrite for the new shape (§9). |
| (new) `src/features/add-task/__tests__/GoalCoachCard.test.tsx` | Render-contract tests (§9). |

Out of scope: GoalCard (category screen), GoalRewardFeedback, engine, timer, anti-chase logic, quick tasks, routines.

## 9 · Tests (TDD — store first)

**Store (`calibrationStore.goalCoach.test.ts`):**
1. No goal → null; met goal → null (existing, kept).
2. Active goal → `targetBand`/`bestBand`/`progress` match `accuracyToErrorBand`/`goalProgress` for seeded goal fields.
3. Inside-count: seed 7 completed logs with known ratios spanning inside/outside `targetBand` → exact `insideCount`, `windowCount 7`; with 3 logs → `windowCount 3`; with 0 → `windowCount 0`.
4. Window cap: 10 completed logs → only newest 7 counted.
5. Lever mapping: seeded bucketed logs (≥4 per bucket, gap ≥12) → `{bestValue, worstValue, bestBand = 100 − bestAccuracy, worstBand}`; below gates → `lever: null`.
6. **Guess-independence invariant:** result contains no field derived from any guess parameter (API takes only `categoryId` — type-level guarantee; test documents it by asserting deep-equality across two calls bracketing unrelated guess churn).

**Component (`GoalCoachCard.test.tsx`):**
7. Renders meter numbers, sub-line count, lever sentence from a fixed `GoalCoachInfo`.
8. `lever: null` → no lever row; `windowCount: 0` → no sub-line.
9. **No button:** queries for any `Pressable`/button role fail; snapshot contains no "Use ", no "or keep".

**Existing suites:** `useAddTask`-related and add-task tests updated for the removed `applyHonest`. Full `npm test` + `npm run lint` + `npm run typecheck` before PR.

## 10 · Verification on device/sim

Deep-link `whenbee:///add-task`, pick a goaled category (founder's live data has goals): verify card shows meter + lever, then churn the guess wheel/chips + date and confirm the coach card does not repaint/change; switch categories and confirm reload/hide. Screenshot for the PR.
