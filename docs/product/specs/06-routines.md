# 06 — Routines  ·  Pro

**Status:** spec · **Tier:** Pro (`pro` entitlement) · **Skills applied:** react-native-architecture, react-native-expert, ui-design:react-native-design, ui-design:interaction-design, clean-code, coding-standards, humanizer

> Read the shared conventions in [README.md](README.md) first — product invariants, architecture rule, theming, motion, RN gotchas, analytics, copy. This spec references them instead of repeating.

---

## 1. What it is (one paragraph a non-engineer understands)

A routine is a saved, ordered list of steps you do together over and over — "morning routine", "leave for work", "bedtime". You build it once. Whenbee then learns how long the **whole chain** actually takes you (not just one step), the same way it already learns single tasks, and gives you one honest answer: **"this usually takes you 1h 5m — start by 7:55 to be out by 9:00."** You tap into a routine, run the steps one after another with the same one-tap timer, and over a few real runs the number stops being a guess and becomes your real number. It is the fix for the thing every late ADHD person knows: a routine *sounds* like 20 minutes and is reliably 50, and no per-task estimate ever catches that because the lateness lives in the seams between steps — the transitions, the re-starts, the "oh wait I forgot my keys."

## 2. The user problem + evidence

The unsolved gap from [07-PRO-VALUE-IDEAS §2.1](../07-PRO-VALUE-IDEAS.md): *"ADHD makes normal routines an 800-step process… always sounds quicker than it is"* ([r/ADHD](https://www.reddit.com/r/ADHD/comments/1hj42un/)). Chronic lateness on recurring sequences is the relationship wound — "leave for work", "get the kids out the door" — and it is exactly the case single-task calibration *misses*, because the error compounds across steps and hides in the transitions. Competitors validate the demand and leave the wedge open: **TimeNinja, Tiimo, and Numo all ship Routines**, and **Tiimo's removal of *timed* routines drew angry reviews** — proof that the timed, honest-total version is the part people actually depend on. Whenbee's edge is that it already learns a personal multiplier per category; a routine is the natural extension of that learning to an ordered chain, with the same on-device, no-guilt, deterministic math. Why they pay recurringly: a routine is used daily, at the highest-stakes lateness moments, and the honest total keeps tightening with every run (the model visibly learns *them* — research truth #3 + #5).

## 3. Where it lives

**Decision: Routines is a peer surface to the Start-By plan, reached from the Plan tab — NOT a new tab, NOT folded into the single active plan.**

Justification:
- The Plan tab is already the "shape my time" surface and already owns the backward Start-By planner (`src/app/(tabs)/plan.tsx` → `BuildView`/`RunView`). A routine *is* a saved, reusable Start-By plan with a learned total, so it belongs to the same mental model and reuses the same engine (`planBackward`) and run UI patterns.
- It must NOT be a new bottom tab: the app guards tab count hard (Today / Plan / Patterns / Whenbee), and routines are a Pro depth feature, not a top-level destination for free users. Adding a 5th tab would advertise a locked surface to everyone and dilute the core loop.
- It must NOT replace the single `active` plan in `planStore`: a one-off "today's plan" and a saved reusable "morning routine" have different lifecycles (one is ephemeral and cleared; the other is durable and re-run). Conflating them would force a routine to be rebuilt every day — the exact friction this feature removes.

Concrete placement:
- **Plan tab header gets a segmented control: `Today` · `Routines`.** `Today` is the existing one-off Start-By plan (unchanged, free). `Routines` is the new Pro surface: a list of saved routines + a "New routine" affordance.
- Tapping a routine opens **Routine detail** (the learned honest total, the steps, "Start by…", and a Run button).
- Running a routine reuses the existing `RunView` run rail (the `planRail` geometry + node/step-advance), seeded from the routine's steps.
- **Free vs Pro:** the `Routines` segment is visible to everyone (so the value is discoverable), but its content is `<ProGate>`-wrapped — non-Pro sees the locked teaser (§9). The `Today` segment is never gated.

## 4. User flow

**Happy path (Pro):**
1. Plan tab → tap the **Routines** segment.
2. Routines list. Empty first time → "Build your first routine" CTA. Tap **New routine**.
3. **Build:** name it ("Morning routine"), add steps in order — each step is a short label + a category (the category is what drives learning, exactly like a single task). Each step shows its honest per-step estimate (`round5(guess × M_category)`); the screen shows the running **honest total**.
4. Optionally set a **be-done-by anchor** (e.g. "out the door by 9:00") so the routine can show "start by…". Save.
5. Back on the routine detail: the honest total reads "About 50 min · based on typical patterns" (priors on day 1). A **Run** button and, if an anchor is set, **"Start by 8:10"**.
6. **Run:** tap Run. The run rail shows the steps; the current step has a one-tap timer. Finish a step → it advances to the next, marks the step done, records its actual. Skipping is allowed (§11).
7. When the last step finishes, the **whole-routine actual** is distributed back to the steps and fed to the learning model (§8). The honest total tightens. A calm, no-guilt recap shows: "That run took 47 min. Your morning routine is settling — next time I'll expect about 50."
8. Next morning: same routine, the total is now "based on your last N runs" and the start-by is sharper.

**Locked / non-Pro path:**
1. Plan tab → tap **Routines** segment.
2. Sees the locked teaser (§9): a realistic-looking sample routine (greyed, non-interactive) showing the *shape* — ordered steps, one honest total, one "start by" — with a single calm CTA. No fog over any free calibration; the core loop is untouched.
3. Tap CTA → `/(modals)/paywall` with `trigger: 'routines'`.

## 5. Screens & states

All values are tokens (`t.space`, `t.colors`, `t.radii`, `t.size`, `t.iconSize`, `t.borderWidth`) + roles from `src/theme/typography.ts` (`type.*`). No raw numbers/hex. New tokens to add are called out inline and collected in §13.

### 5.1 Routines list (Pro)

- **Container:** `Screen`-padded scroll; horizontal pad `t.space[5]` (20), section gap `t.space[4]` (16).
- **Header row:** the segmented control (`Today` · `Routines`) reuses the existing segmented-control primitive used elsewhere on Plan; `type.heading` labels; active segment uses the one indigo (`t.colors.primary` indicator), per the 60-30-10 rule.
- **Each routine card:** `t.colors.surface`, `t.radii.card` (16), `t.borderWidth.card`, inner pad `t.space[4]`. Layout (one shared vertical structure per card so siblings align — global rule):
  - Line 1: routine name — `type.bodyLg`, `t.colors.ink`.
  - Line 2: honest total — `type.honestNumberMd` (the number, tabular) + a quiet `type.caption` basis label in `t.colors.inkSoft` ("based on your last 4 runs" / "based on typical patterns").
  - Line 3 (only if a be-done-by anchor exists): `type.caption` "Start by 8:10" with the clock glyph at `t.iconSize.sm`, aligned to the cap-height of the text (`alignItems: 'center'`), in `t.colors.inkSoft`.
  - Trailing: a small step-count chip ("5 steps", `type.micro`, `t.colors.surfaceSunken` fill, `t.radii.sm`).
- **New routine** affordance: an `AppButton` (secondary) pinned under the list, label "New routine", plus-icon `t.iconSize.sm`. Footer adds `useSafeAreaInsets().bottom` (RN gotcha).

```
┌─────────────────────────────────────────────┐
│  [ Today ]  ( Routines )                      │  ← segmented; Routines active (indigo)
├─────────────────────────────────────────────┤
│  ┌───────────────────────────────────────┐  │
│  │ Morning routine                5 steps │  │
│  │ 50 min                                 │  │  ← honestNumberMd
│  │ based on your last 4 runs              │  │  ← caption / inkSoft
│  │ ◷ Start by 8:10                        │  │
│  └───────────────────────────────────────┘  │
│  ┌───────────────────────────────────────┐  │
│  │ Leave for work                 3 steps │  │
│  │ 25 min · based on typical patterns     │  │
│  └───────────────────────────────────────┘  │
│                                               │
│            [  +  New routine  ]               │
└─────────────────────────────────────────────┘
```

- **Empty state (no routines yet, Pro):** calm, no guilt. A single line `type.body` in `t.colors.inkSoft` — "Save a sequence you do a lot, like your morning. I'll learn how long the whole thing really takes." + the **New routine** button. No illustration required beyond the existing calm-empty pattern; never a "you have nothing" deficit tone.
- **Loading:** routines load from SQLite (fast, on-device) — render a single skeleton card (`t.colors.surfaceSunken` block at card height) for at most one frame; no spinner.
- **Error:** DB read failure → keep the list empty and show the calm empty copy (read failures never block; analytics notes it). Never a red error.

### 5.2 Build / edit a routine

- **Name field:** single-line input, `type.bodyLg`, placeholder "Name this routine" (`t.colors.inkFaint`). Input radius `t.radii.md`, hairline edge.
- **Steps list:** reuses the `PlanTaskCard` row shape from `src/features/planner` (label + category + per-step honest duration + drag handle via `gripW`). Each step row, min height `t.size.planCardMin` (70). Drag-reorder uses the existing reorder gesture/`reorderTasks` pattern. Per-step honest duration is shown read-only (`type.honestNumberMd` small) — it is `round5(stepGuess × M_category)`; tapping the duration opens the existing `DurationWheel` to edit the *guess*, not the learned number.
- **Add step:** an inline "+ Add step" row at the bottom of the list (same affordance as BuildView's add-task), opening the label + category + guess capture (reuse BuildView's add flow).
- **Be-done-by anchor:** an optional `FinishTimeWheel` (the existing component) labelled "Be done by" — off by default; when set, the detail/list shows "Start by…". Without it, a routine still has a learned total, just no start-by.
- **Running honest total** pinned at the top of Build, `type.honestNumberLg`, updates live as steps are added/edited, with the transition factor applied (§8). Label beneath in `type.caption`/`inkSoft`.

```
┌─────────────────────────────────────────────┐
│  New routine                          [Save] │
│  ┌───────────────────────────────────────┐  │
│  │  Name this routine                    │  │
│  └───────────────────────────────────────┘  │
│  About 50 min                                 │  ← honestNumberLg (running total)
│  including the in-between time                 │  ← caption / inkSoft
│                                               │
│  ⠿  Shower            getting-ready    20m   │  ← PlanTaskCard shape
│  ⠿  Get dressed       getting-ready    10m   │
│  ⠿  Breakfast         meals            15m   │
│  +  Add step                                  │
│                                               │
│  Be done by   [  9:00  ]   (optional)         │
└─────────────────────────────────────────────┘
```

- **Not-enough-data state:** before any full run, the total is prior-based; the basis label reads "based on typical patterns" and the build total uses the default transition factor (§8). No band, no false precision.
- **Validation:** a routine needs a name and ≥1 step to save. Save is disabled (at `t.opacity.disabled`) until both hold; no error toast, just a disabled control.

### 5.3 Run a routine

Reuses `RunView` + `PlanRail` (`tokens.planRail` geometry — gutter 46, node 20, nowRing, connector, dashed done-links). Seeded from the routine's steps (mapped to `PlanTaskInput`). The single **"Start by"** anchor is computed by `planBackward` against the be-done-by time, exactly as the one-off plan does — this is the explicit reuse the prompt asks for: routines compose on the same backward pass and the same run rail, with the *only* new math being the learned chain total + transition factor that feeds each step's `durationMin`.

- **Current step:** the active rail node pulses (`tokens.motion.halo`); the step shows its label, category, and the one-tap timer (reuse the Today/Plan timer affordance — visual style on an inner `View`, `Pressable` bare, per the RN gotcha).
- **Step advance:** finishing a step (timer stop) marks it done, advances `running` to the next `upcoming` (same `startTask`/`completeTask` semantics as `planStore`), and re-projects the remaining start-by against the anchor. Done links render with the dashed `planRail.dashOn/dashGap` spine.
- **Whole-routine progress:** the rail shows the chain; the header shows "About 50 min · 2 of 5 done" (`type.caption`).
- **Completion recap:** calm card — actual total, the new expectation, no guilt if it ran long. Amber accent only (`t.colors.accent`), never red, never "you were late."

## 6. Motion

- **Honest total recount on Build:** when a step is added/edited the total animates with a number cross-fade (no count-up that overshoots), `tokens.motion.base` (220), `easing.standard`. Honey/learning is monotonic in spirit; the displayed total may move both ways as you edit steps (that is composition, not a learned regression), but the *learned* total only ever tightens across runs.
- **Routine card mount:** entering-only `FadeIn.duration(tokens.motion.base).reduceMotion(ReduceMotion.System)` — no `exiting` layout anim on conditionally-unmounted views (Fabric SIGABRT, per README). Stagger list items with `tokens.motion.stagger` (40), capped under ~500ms total.
- **Step advance on the rail:** the now-ring moves to the next node with the existing rail pulse (`tokens.motion.halo`), and the just-completed link draws its dashed done state at `easing.honey`.
- **Completion recap:** gentle fade-in (`tokens.motion.base`); no celebratory burst that implies a streak — calm, not gamified.
- **Reduced motion:** every `entering` uses `ReduceMotion.System`; the total recount falls back to an instant swap.

## 7. Data model

**Decision: add TWO new SQLite tables (`routines`, `routine_steps`) via a new append-only migration — do NOT overload `recurring_stats`. Reuse `recurring_stats` only as the per-step learning store, by giving each step a stable recurring key.**

Justification:
- `recurring_stats` is a *learning* table (one rolling EWMA/M per `${categoryId}:${normalizedLabel}` key). It has no concept of order, ownership, a routine name, or a be-done-by anchor. Storing routine structure in it would conflict with its single-purpose contract and break the architecture rule that `domain/types.ts` is the contract changed first.
- But step-level learning is *exactly* what `recurring_stats` already does, and the engine (`applyLog`) already trains it. So each routine step gets a recurring key `routine:{routineId}:{stepId}` (a distinct namespace so it never collides with the existing free recurring-task keys), and per-step actuals train through the *same* `applyLog` recurring path. This reuses recurring memory as the prompt requires, without inventing a parallel learning store.
- The **chain total** is not a stored stat — it is *derived* at read time from the steps' learned per-step M plus a learned chain-level transition factor (the one genuinely new stat, stored on the routine row). Deriving avoids a third source of truth that could drift from the steps.

### 7.1 Domain types (add to `src/domain/types.ts` — contract first)

```ts
/** A saved, reusable, learned multi-step sequence (Pro). */
export interface Routine {
  id: string;
  name: string;
  /** Optional local be-done-by minute-of-day (0–1439), or null for no anchor. */
  doneByMinuteOfDay: number | null;
  /** Learned chain-level transition factor (≥1). Captures the seam time between
   *  steps that per-step estimates miss. Defaults to TRANSITION_PRIOR until runs
   *  exist; only ever moves via EWMA over full timed runs. */
  transitionFactor: number;
  /** Count of completed full runs that have trained the routine. Monotonic. */
  runCount: number;
  createdAt: number;
  updatedAt: number;
}

/** One ordered step within a routine. Order is `position` (0-based, contiguous). */
export interface RoutineStep {
  id: string;
  routineId: string;
  position: number;
  label: string;
  category: Category;
  /** The user's guess for this step (minutes). The learned per-step honest number
   *  is derived: round5(guessMin × M_for(category|recurringKey)). */
  guessMin: number;
}

/** Per-step recurring key used to train step-level learning via the existing
 *  recurring_stats path. Namespaced so it never collides with free recurring keys. */
export type RoutineStepKey = `routine:${string}:${string}`; // `routine:{routineId}:{stepId}`

/** The derived, display-ready honest summary of a whole routine. */
export interface RoutineSummary {
  routineId: string;
  /** Sum of per-step honest minutes × transitionFactor, round5'd. */
  honestTotalMin: number;
  /** 'personal' once enough full runs exist, else 'prior'. */
  basis: 'personal' | 'prior';
  label: string; // "based on your last N runs" | "based on typical patterns"
  runCount: number;
  steps: { stepId: string; honestMin: number }[];
}
```

### 7.2 New migration (append as `0006` in `src/db/migrations.ts`)

```sql
-- 0006 — Routines (Pro): saved multi-step sequences + ordered steps.
CREATE TABLE IF NOT EXISTS routines (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  done_by_minute_of_day INTEGER,            -- null = no be-done-by anchor
  transition_factor REAL NOT NULL DEFAULT 1.15,
  run_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS routine_steps (
  id TEXT PRIMARY KEY,
  routine_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  label TEXT NOT NULL,
  category TEXT NOT NULL,
  guess_min REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_routine_steps_routine
  ON routine_steps (routine_id, position);
```

Notes: append-only, `IF NOT EXISTS`, never reorder existing entries (matches the migrations.ts contract). Per-step learning reuses the existing `recurring_stats` table — no schema change there; only a new key namespace. The `Database` port gains routine CRUD methods (both `memoryDatabase` and `sqliteDatabase` implement them); a new `routinesRepo` wraps them (features never touch raw SQL).

### 7.3 What's persisted where

- **Routine structure** (name, steps, order, anchor, transitionFactor, runCount): SQLite (`routines`, `routine_steps`) — durable, the system of record.
- **Per-step learned stats** (M, EWMA, n): SQLite `recurring_stats`, keyed `routine:{routineId}:{stepId}`.
- **Active routine run state** (which step is running/done, per-step actuals during a live run): KV via a routine-run slice (mirror `planStore`'s `active` persistence), so a backgrounded run survives reopen. Cleared on completion/abandon.

## 8. Engine / logic

All new math is **pure, clock-free, dependency-free TS** in `src/engine/`, exported via `src/engine/index.ts`, tuned via `src/engine/constants.ts`. **TDD required — write the engine tests first.** New file: `src/engine/routine.ts`.

### 8.1 New constants (`src/engine/constants.ts`)

```ts
// ── Routines (Pro) ───────────────────────────────────────────────────────────
/** Day-1 chain transition factor: per-step honest numbers, summed, underestimate
 *  the whole because the seams (transitions, re-starts) aren't in any single step.
 *  1.15 = +15% prior overhead; only ever replaced by the learned factor. */
export const TRANSITION_PRIOR = 1.15;
/** EWMA learning rate for the transition factor over full timed runs. */
export const TRANSITION_ALPHA = 0.3;
/** Below this many completed full runs, the routine total is prior-based
 *  ("based on typical patterns") and the transition factor stays at TRANSITION_PRIOR. */
export const ROUTINE_PERSONAL_MIN_RUNS = 3;
/** Clamp the learned transition factor so one chaotic run can't poison the chain. */
export const TRANSITION_FLOOR = 1.0;
export const TRANSITION_CEIL = 2.0;
```

### 8.2 Pure functions (`src/engine/routine.ts`)

```ts
/** Per-step honest minutes for the chain: round5(guess × stepM). stepM comes from
 *  the step's recurring stat if it has ≥RECURRING_MIN_LOGS, else its category M
 *  (resolveSuggestion already encodes this fallback — reuse it). */
export function stepHonestMinutes(
  guessMin: number,
  stepM: number,
): number; // = honestNumber(guessMin, stepM)

/** The whole-chain honest total. Sum the per-step honest numbers, apply the
 *  transition factor, round5. Pure: takes resolved per-step minutes + factor. */
export function routineHonestTotal(
  perStepHonestMin: readonly number[],
  transitionFactor: number,
): number {
  const base = perStepHonestMin.reduce((s, m) => s + m, 0);
  return Math.max(5, Math.round((base * transitionFactor) / 5) * 5);
}

/** basis + label for the summary, parallel to resolveSuggestion's labelling. */
export function routineBasis(runCount: number): {
  basis: 'personal' | 'prior';
  label: string;
};

/**
 * Distribute a whole-routine timed run's per-step actuals + derive the next
 * transition factor. Pure — caller passes the recorded per-step actuals from the
 * run and the prior factor; this returns what to train.
 *
 * - Each step trains via the EXISTING applyLog recurring path with its own
 *   (estimateMin = step.guessMin, actualMin = recorded step actual).
 * - The transition factor is updated only from the CHAIN-LEVEL ratio:
 *     observedFactor = sum(stepActuals) / sum(stepHonestBaseline)
 *   where stepHonestBaseline = sum of round5(guess × stepM_before). Clamp to
 *   [TRANSITION_FLOOR, TRANSITION_CEIL], EWMA with TRANSITION_ALPHA, clamp again.
 *   This isolates seam time from per-step error: per-step error trains the steps;
 *   the *residual* (chain actual vs summed step actuals would double-count, so we
 *   compare chain actual vs summed step BASELINE) trains the factor.
 */
export function distributeRoutineRun(input: {
  steps: { stepKey: RoutineStepKey; guessMin: number; actualMin: number; stepMBefore: number }[];
  priorFactor: number;
}): {
  /** One applyLog-ready payload per step (caller feeds each to the recurring path). */
  stepTrainings: { stepKey: RoutineStepKey; estimateMin: number; actualMin: number }[];
  /** The new clamped, EWMA'd transition factor to persist on the routine. */
  nextTransitionFactor: number;
};
```

**How a whole-routine timed run distributes actuals to steps:** during a run the rail records each step's real elapsed minutes (step timer start→stop). On completion the store calls `distributeRoutineRun` with those per-step actuals. Each step is trained individually through the *same* `applyLog` recurring branch (so a step's own bias keeps learning, exactly like a free recurring task). The **transition factor** is trained separately from the chain-level residual: it compares the *total actual* against the *summed per-step honest baseline* (what the steps would have predicted before this run), clamped + EWMA'd. This cleanly separates the two error sources — per-step misjudgment vs the between-step seam time — so neither double-counts the other.

**If a run is partial (some steps skipped/abandoned):** only the completed steps train their step stats; the transition factor is trained only on a *full* completed run (all steps done), because a partial chain's total isn't comparable to the full baseline. `runCount` increments only on a full completed run. (See §11.)

### 8.3 TDD cases (write first, `src/engine/__tests__/routine.test.ts`)

1. `routineHonestTotal([20,10,15], 1.0)` → 45; with `1.15` → round5(51.75)=50.
2. `routineHonestTotal([], f)` → 5 (floor; never zero).
3. `stepHonestMinutes` equals `honestNumber` (delegation guard).
4. `routineBasis(0|2)` → prior + "typical patterns"; `routineBasis(3)` → personal + "based on your last 3 runs".
5. `distributeRoutineRun`: 3 steps, each over by 1.2×; transition prior 1.15; assert each `stepTrainings` carries the right (estimate, actual); assert `nextTransitionFactor` = clamp+EWMA of (chainActual / summedBaseline) toward observed.
6. Transition clamp: a single 3× chaotic run can't push the factor past `TRANSITION_CEIL` (2.0).
7. Transition floor: an unusually fast run can't drop the factor below `TRANSITION_FLOOR` (1.0) — a routine never claims to be faster than the sum of its honest steps.
8. Monotone-tightening property: across repeated identical runs the learned total converges and does not oscillate beyond the EWMA step (stability).
9. Purity: same inputs → same outputs; inputs never mutated; no `Date.now`/clock.
10. Single-step routine: transition factor still trains (baseline = that one step); start-by reuses `planBackward` with one task.

### 8.4 Composition with the existing planner

The routine's per-step honest minutes feed `PlanTaskInput.durationMin`, and `planBackward({ deadline: doneByToday, tasks, nowMs })` produces the single **"Start by…"** and the run timeline — no new planner code. The chain transition factor is folded into the steps before they reach `planBackward` (the total the planner sees already includes the seam overhead), so the start-by is honest end-to-end.

## 9. Gating

- **ProGate placement:** the `Routines` segment content (list + build + run) is wrapped in `<ProGate fallback={<RoutinesLocked />}>` (`src/features/paywall/ProGate.tsx`). The `Today` plan segment is never gated. The segmented control itself is always visible so the value is discoverable.
- **Paywall trigger:** `'routines'`. **Add `'routines'` to the `Trigger` union in `src/features/paywall/Paywall.tsx`** (currently `'make_day_honest' | 'settings_upgrade' | 'steals_your_time'`) and to its `isTrigger` guard. Tapping the teaser CTA routes to `/(modals)/paywall?trigger=routines`.
- **Locked teaser (`RoutinesLocked`) design:** shows the *shape* of the value, calm, no fog over anything free:
  - A single realistic sample routine card, rendered at `t.opacity.disabled` (0.4) and non-interactive: name "Morning routine", 4 sample steps, one honest total "About 50 min", one "Start by 8:10". This is the "show the shape" pattern from README gating.
  - One line of plain value copy (§10) and one `AppButton` (primary, the single indigo) → paywall. No looping upsell, no second CTA (avoids the documented backlash).

```
┌─────────────────────────────────────────────┐
│  [ Today ]  ( Routines )                      │
├─────────────────────────────────────────────┤
│   ░░ Morning routine            4 steps ░░    │  ← sample, 0.4 opacity, non-interactive
│   ░░ About 50 min                       ░░    │
│   ░░ ◷ Start by 8:10                    ░░    │
│                                               │
│   Save your morning once. Whenbee learns      │
│   how long the whole thing really takes,       │
│   so "start by" is a number you can trust.     │
│                                               │
│            [  See Whenbee Pro  ]              │
└─────────────────────────────────────────────┘
```

## 10. Copy (every exact string · humanizer-checked · no-guilt)

- **Segment label:** `Routines`
- **List empty:** `Save a sequence you do a lot, like your morning. I'll learn how long the whole thing really takes.`
- **New routine button:** `New routine`
- **Build name placeholder:** `Name this routine`
- **Build total label (prior):** `based on typical patterns`
- **Build total label (personal):** `based on your last {n} runs`
- **Build total sub-line:** `including the in-between time`
- **Add step:** `Add step`
- **Be-done-by label:** `Be done by`
- **Start-by chip:** `Start by {time}`
- **Save (disabled hint, only if needed):** none — disabled control, no nag.
- **Run completion recap (ran short or on time):** `That run took {actual}. Your {name} is settling — next time I'll expect about {honest}.`
- **Run completion recap (ran long):** `That run took {actual}. Good to know — I'll fold that into your {name} so the next "start by" is more honest.` (No "you were late", no red, no apology framing.)
- **Locked teaser body:** `Save your morning once. Whenbee learns how long the whole thing really takes, so "start by" is a number you can trust.`
- **Locked CTA:** `See Whenbee Pro`

Humanizer pass: no em-dashes used as drama, no rule-of-three lists, no "seamless/effortless/elevate", no fake urgency, sounds like one honest person. No-guilt pass: every long-run path is curiosity/"good to know", never shame; amber accent only.

## 11. Edge cases & guardrails

- **First run, no history:** all steps fall back to category priors (via `resolveSuggestion`'s existing fallback), transition factor = `TRANSITION_PRIOR` (1.15). Total reads "based on typical patterns". No band, no false precision.
- **Skipped step (during a run):** the step is marked skipped (a status, not a failure), does NOT train its step stat, and the run can still complete. A run with any skipped step is **not** a "full run" → it does not train the transition factor and does not increment `runCount`. No guilt copy for skipping.
- **Partial run / abandoned mid-chain:** completed steps still train their own step stats (self-knowledge is kept), the transition factor is left untouched, `runCount` unchanged. The active routine-run KV slice is cleared. Calm "Picked up where you stopped — nothing lost" tone if resumed.
- **Editing a routine after it has learned:** editing a step's guess re-derives its honest number from the *existing* learned M (we don't reset learning on an edit). Adding a step gives the new step a fresh recurring key (priors until it has runs). Removing a step drops its recurring key from future totals but never deletes its history rows (append-only system of record). Reordering changes `position` only; learning is per-step-key, order-independent.
- **Low-n transition factor:** clamped to `[1.0, 2.0]`; a routine can never claim to be faster than the sum of its honest steps (`TRANSITION_FLOOR = 1.0`), so it never under-promises and re-creates lateness.
- **Monotonicity:** the *learned* honest total only tightens across runs (EWMA, clamped). The *displayed* total may move while you edit steps — that's composition, not a learned regression, and is never framed as "going backward."
- **Be-done-by rollover:** `doneByMinuteOfDay` is a minute-of-day; the run computes today's deadline epoch (and tomorrow if the anchor is already past) before calling `planBackward`. Pure planner stays clock-free (caller passes `nowMs`/deadline).
- **No-guilt checks:** no red anywhere; no "late"/"behind"/"failed" strings; skipping and abandoning are first-class, not penalized; no streak across runs; the recap celebrates learning, not compliance.
- **Privacy / on-device:** routines, steps, learned stats, and run state are all SQLite/KV on device. No network in build/run/learn. Honors the on-device invariant; no calendar (the be-done-by anchor is a local time-of-day, never an EventKit read/write).
- **Pro lapse:** if entitlement lapses, existing routines and their learned data are preserved (never deleted); the surface re-locks to the teaser. Re-subscribing restores access to the already-learned routines (no data loss — avoids the "rug pull" backlash).
- **Tier/honey untouched:** routine runs train per-step recurring stats which already feed category sharpness via `applyLog`; routines never introduce a separate guilt/tier mechanic.

## 12. Analytics

Add to `AppEventProps` in `src/services/analytics.ts` (fire-and-forget, never throws):

```ts
routines_tab_viewed: { is_pro: boolean; routine_count: number };
routines_paywall: { trigger: 'routines' };               // teaser CTA tapped
routine_created: { step_count: number; has_anchor: boolean };
routine_edited: { routine_id_hash: string; step_count: number };
routine_run_started: { step_count: number; basis: 'personal' | 'prior' };
routine_step_completed: { position: number; over: boolean };
routine_step_skipped: { position: number };
routine_run_completed: {
  step_count: number;
  full_run: boolean;            // all steps done → trained transition factor
  total_actual_min: number;
  total_honest_min: number;
  run_count_after: number;
};
routine_run_abandoned: { steps_done: number; step_count: number };
```

No PII: labels/names are never sent; use a non-reversible `routine_id_hash` only where a routine must be distinguished. The retention signal to watch: `routine_run_started` recurrence per user (daily routines are the highest-frequency Pro surface). Also fold `routines` into the existing `paywall_view { trigger }` funnel.

## 13. Build manifest & effort

**Engine (pure, TDD first):**
- `src/engine/routine.ts` — new (`stepHonestMinutes`, `routineHonestTotal`, `routineBasis`, `distributeRoutineRun`). **M**
- `src/engine/__tests__/routine.test.ts` — new (cases §8.3, written first). **M**
- `src/engine/constants.ts` — add the Routines block (§8.1). **S**
- `src/engine/index.ts` — export the new routine functions + types. **S**

**Domain / data:**
- `src/domain/types.ts` — add `Routine`, `RoutineStep`, `RoutineStepKey`, `RoutineSummary` (§7.1). **S**
- `src/db/migrations.ts` — append `0006` (§7.2). **S**
- `src/db/types.ts` — add `RoutineRow`, `RoutineStepRow` DTOs. **S**
- `src/db/Database.ts` + `memoryDatabase.ts` + `sqliteDatabase.ts` — add routine CRUD to the port + both adapters. **M**
- `src/db/repositories/routinesRepo.ts` — new semantic wrapper. **S**
- `src/db/__tests__/` — repo + migration tests. **M**

**Store / feature hook:**
- `src/stores/routinesStore.ts` — new: routines list + draft (build/edit) + active routine-run slice (KV-persisted like `planStore`), wiring `distributeRoutineRun` → `recurringRepo`/`routinesRepo` on completion. **L**
- `src/features/routines/useRoutines.ts` — composes the store + engine (derive `RoutineSummary`, run `planBackward` for start-by). **M**

**UI (route + components):**
- `src/app/(tabs)/plan.tsx` — add the `Today`·`Routines` segmented control; render `Today` (existing) or the routines surface. **M**
- `src/features/routines/RoutinesList.tsx` — list + empty + New routine. **M**
- `src/features/routines/RoutineBuildView.tsx` — name + steps (reuse `PlanTaskCard`, `DurationWheel`, `FinishTimeWheel`) + running total. **L**
- `src/features/routines/RoutineRunView.tsx` — reuse `RunView`/`PlanRail` seeded from steps; completion recap. **M**
- `src/features/routines/RoutinesLocked.tsx` — locked teaser (§9). **S**

**Paywall / analytics:**
- `src/features/paywall/Paywall.tsx` — add `'routines'` to `Trigger` + `isTrigger`. **S**
- `src/services/analytics.ts` — add the events (§12). **S**

**Theme:**
- `src/theme/tokens.ts` — confirm/add a `stepChip` reuse (the "N steps" chip can reuse `surfaceSunken` + `radii.sm`; no new token unless the locked-teaser greyed card needs a dedicated opacity — `opacity.disabled` already exists). Likely **no new tokens**; if the routine card needs distinct geometry, add a `routine` group and (per the useTheme gotcha) a matching line in `useTheme`'s `resolveTheme`. **S**

**Total effort:** **Med-High** (matches 07-PRO-VALUE-IDEAS §2.1 estimate). The heavy lift is the store + Build UI; the engine and planner reuse keep the math small and well-tested.

**Dependencies:** none new — composes on the existing engine (`honestNumber`, `resolveSuggestion`, `planBackward`), recurring memory (`recurring_stats` + `applyLog`), the planner run UI, `ProGate`, and analytics. No native modules, no network, no calendar.

**Open questions:**
1. **Transition-factor model:** chain-residual EWMA (this spec) vs. learning a per-routine additive seam-minutes term instead of a multiplicative factor. Multiplicative is chosen for parity with the per-task multiplier mental model and bounded clamps; revisit if real runs show seam time is more constant-additive than proportional.
2. **Step actual capture during a run:** rely on the live step timer only, or also allow a quick retro per-step adjust on completion (down-weighted like retro logs)? Leaning timer-only for v1 to keep the run frictionless.
3. **Convert a one-off `Today` plan into a saved routine** ("save this as a routine") — natural bridge from the existing planner, but adds UI; defer to fast-follow unless it tests as a strong activation path.
4. **Per-step confidence band** inside a routine (compose with spec 03) — out of scope for v1; the chain total stays a point number until the single-task band ships and stabilizes.
