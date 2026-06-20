# 09 — Focus-window planner  ·  Pro

**Status:** spec · **Tier:** Pro (`pro` entitlement) · **Skills applied:** react-native-architecture, ui-design:react-native-design, ux-principles, conversion-psychology, humanizer

> Reads the shared conventions in [README.md](README.md) (invariants, layer rules, theming, motion, gating, copy). This file only states what is specific to the focus-window planner. **No health data, no medical claims, no diagnosis, no calendar, no EventKit.** The window is a plain local time range the user types in; the app never asks why, never names a condition, never infers a medical state. It stores only `windowStartMin` / `windowEndMin` (two integers, minutes-after-midnight) in KV.

---

## 1. What it is

Most people get a stretch of the day when their head actually works — early morning before the house wakes up, the hours a med is doing its job, the quiet block after lunch. The focus-window planner lets you mark that window once (say 9:00 to 12:00) and then sorts your honest-numbered tasks into two piles: **what fits inside the window** and **what spills past it**. It uses your learned per-category bias, so the times it packs against the window are your real durations, not your optimistic guesses. The point is not "fit the whole day" — that is the day-capacity check (spec 04). The point here is narrower and more personal: you have a limited number of good hours, so spend them on the right things and let the rest wait. It is deterministic, on-device, and says nothing about health — it is just your window and your tasks.

**Relationship to the day-capacity check (spec 04) — coordinate, do not duplicate:**

| | Day-capacity check (04) | Focus-window planner (09) |
|---|---|---|
| Question | "Will the *whole day* fit?" | "Do the *right things* fit my *good hours*?" |
| Window | now → day-end (`dayEndMin`, a single shrinking ceiling) | a fixed good-hours band (`windowStartMin` → `windowEndMin`) inside the day |
| Output | one total vs one window + "move one to tomorrow" | a packed in-window list + a spilled-out list, ordered by priority |
| Engine | `checkCapacity` (sum vs ceiling) | `fitFocusWindow` (greedy fill of a fixed-length band) |
| Surface | Plan-tab card + Today strip | Plan-tab section below the capacity card |

They share the honest-number resolution and the `largest-first`/stable-order discipline from `planner.ts`, and they share the Plan tab. They do **not** share a window value: capacity uses `dayEndMin`; this feature owns its own `windowStartMin`/`windowEndMin`. A user can run both — capacity tells them the day is overpacked; the focus window tells them which three things to do while their head is clear.

---

## 2. The user problem + evidence

The felt problem (conversion-psychology): you get a few hours where focus is genuinely available, and they leak away on whatever was loudest — email, a meeting, a small errand — and the one thing that actually needed a clear head gets pushed to the dead hours when it is now twice as hard. By the time the good window is gone, the important work hasn't moved.

From [07-PRO-VALUE-IDEAS §2.4](../07-PRO-VALUE-IDEAS.md):

- Strong, specific demand: *"anyone else only get ~3 good hours out of meds, then it falls off a cliff?"* ([r/adhdwomen](https://www.reddit.com/r/adhdwomen/comments/17f1u5v/)).
- "Nobody helps them spend that window well." Calendars block time; they don't tell you what *belongs* in the good hours given how long things actually take you.
- *Why they pay recurringly:* re-run daily around a deeply personal, shifting window — the window itself is the recurring decision.

This is the natural partner to truth #3 in 07 ("it learns ME") — the window is the user's, the durations packed into it are the user's learned numbers, so the fit reads as *their* plan, not a generic template.

**No medical framing, by rule.** The evidence comes from a medication thread, but the feature never references medication, energy levels, symptoms, or any condition. The user-facing frame is *"your focus window"* / *"when you do your best work."* This keeps it honest (it really is just a time range), avoids an App Store health-claim review surface, and respects the no-guilt invariant (a window you didn't fill is not a failure).

---

## 3. Where it lives

**Decision: a `FocusWindowSection` on the Plan tab's BuildView, mounted directly below the `CapacityCard`.** The two read as a pair: capacity ("does it fit at all?") then focus window ("what goes in the good hours?"). Rejected alternatives:

- *Its own tab/route* — adds a navigation step to a planning decision that wants to sit beside the other planning surfaces (ux-principles, recognition-over-recall). Focus-window reasoning needs the same task set the user is already building.
- *A Today-screen surface* — Today is a FIFO focus queue, not a "shape my day" surface. Window-shaping is the Plan tab's job (same rationale as capacity in spec 04).
- *Folding it into the capacity card* — overloads one card with two different questions and two different windows. Keep them as sibling sections so each answers one thing (ux-principles, aesthetic-and-minimalist).

| Surface | What shows | Who sees it |
|---|---|---|
| **Plan tab — BuildView, section below CapacityCard** (primary) | `FocusWindowCard`: editable window chip, packed in-window list, spilled list, fit verdict | Pro: live card. Non-Pro: `FocusWindowLocked` teaser (§9). |

The section is the whole feature. It never appears in the guess → timer → learn loop and never fogs calibration.

**Input source:** the same planned set the capacity check uses — `planStore.draft.tasks` when a draft is active, otherwise `tasksStore` queued tasks (union, deduped by id; done tasks excluded). Honest minutes resolved exactly as the planner does (§8). No new task source.

**Window set once, remembered:** the window is two local times (start, end). Default off (no window set → an invite state, §5). Once set, it persists and the user re-uses it daily; editing is a tap on the window chip.

---

## 4. User flow

**First run (Pro, no window yet):**

1. User opens the Plan tab with tasks in the draft.
2. `FocusWindowCard` shows the invite state: "Mark the hours your head works best. I'll fit the right tasks into them." with a single **Set your focus window** action.
3. Tap → a two-stop time sheet (reuses `FinishTimeWheel`, run twice — start then end). User picks 9:00, then 12:00.
4. Stored in `settingsStore` (`windowStartMin = 540`, `windowEndMin = 720`). Card re-renders with the fit.

**Happy path (Pro, everything fits the window):**

1. Window is 9:00–12:00 (180 min). Planned honest work is 150 min.
2. Card lists the in-window tasks in order with a running fill, and a quiet positive verdict: "These fit your focus window with 30m to spare."
3. Verdict = `fits`. No spill list. Nothing to act on.

**Spill path (Pro, more wants the window than holds):**

1. Window 180 min; planned honest work 320 min.
2. The engine greedily fills the window in the draft's order (the order the user arranged = their priority — see §8 ordering note), then everything that didn't fit goes to a **spills past your window** list.
3. Card reads: "About 3 of these fit your focus window. The rest spill past it." Verdict = `spills`.
4. In-window list shows what made it (with the running fill bar reaching the window edge). Spill list shows what's left, each with its honest number and a one-tap **Move up** that promotes it into the window (bumps the smallest in-window task out to make room — see §8 `promoteIntoWindow`). No multi-select, no guilt.
5. The user can leave the spill as-is — it is informational, never a block, never red.

**Locked / non-Pro path:**

1. Non-Pro opens the Plan tab. The section renders `FocusWindowLocked` — same frame, the window concept shown as a labelled empty band, the value (the packed fit) veiled with a lock.
2. CTA "Fit your focus window" → `router.push({ pathname: '/(modals)/paywall', params: { trigger: 'focus_window' } })`.

---

## 5. Screens & states

All values are tokens (`t.*` from `useTheme()` + `type` from `typography.ts`). Components reused: `Card`, `AppText`, `AppButton` (ghost + coin-edge), `Chip`, `FinishTimeWheel`, `CapacityBar` (the same animated band, reused as the window fill). New components: `FocusWindowCard`, `FocusWindowList`, `FocusWindowLocked`.

### Shared layout — FocusWindowCard (Plan tab, primary)

- Container: `Card` (radii.card, borderWidth.card, surface) — flat, hairline only, no shadow (Frontend craft rule: flat over heavy).
- Internal vertical rhythm: `gap: t.space[3]` (12). No per-child margins (one spacing source per axis).
- Type scale: eyebrow (`type.eyebrow`, label), window chip (`type.caption`), the in-window count headline in `type.honestNumberMd` (numeric), task rows in `type.bodySm`, the spill heading in `type.caption` (inkSoft), verdict line in `type.body`.
- A horizontal fill band (reused `CapacityBar`) shows packed-minutes against the fixed window length. Unlike capacity, this band's track length is the *window* (fixed), and the fill is the in-window total — it should read full or near-full when work spills.

```
┌─────────────────────────────────────────────┐
│ YOUR FOCUS WINDOW                 9:00–12:00 ✎│   ← eyebrow + editable window chip
│                                               │
│  3 of 5  fit your window                      │   ← honestNumberMd "3" + caption "of 5"
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░  150m / 180m         │   ← fill band + caption
│                                               │
│  In your window                               │   ← type.caption, inkSoft
│   ·  Deep work block          90m             │   ← bodySm rows; honest min right-aligned
│   ·  Review doc               40m             │
│   ·  Reply to client          20m             │
│                                               │
│  Spills past your window                      │   ← type.caption, inkSoft
│   ·  Inbox sweep              45m   Move up    │   ← ghost "Move up" action, inkSoft
│   ·  Plan next sprint        125m   Move up    │
│                                               │
│  3 of these fit. The rest can wait.           │   ← type.body, ink
└─────────────────────────────────────────────┘
```

### State: `fits` (all planned tasks fit inside the window)

- Fill band fill = `t.colors.primarySoft`, track = `t.colors.surfaceSunken`, fill ≤ track.
- No spill heading, no spill list.
- Verdict ink = `t.colors.ink`. Tone: quiet positive (mirrors capacity `fits`). No action.
- Headline reads `5 of 5 fit your window` (or `All 5 fit` when count == total — see copy §10).

### State: `spills` (one or more tasks don't fit the window)

- Fill band fill = `t.colors.accent` (amber) at ~100% of track (the window is full). Amber = "window is full" attention, never alarm; never red.
- Spill heading + spill list shown. Each spill row has a ghost **Move up** (`inkSoft`) that calls `promoteIntoWindow(id)`.
- Verdict line names the count that fits, calmly. No "you're behind" framing.

### State: no window set (invite)

```
┌─────────────────────────────────────────────┐
│ YOUR FOCUS WINDOW                             │
│                                               │
│  Mark the hours your head works best.         │   ← type.body, ink
│  I'll fit the right tasks into them.          │
│                                               │
│  ┌─────────────────────────────────────────┐ │
│  │          Set your focus window            │ │   ← AppButton, indigo (one filled indigo)
│  └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

- No band, no lists. One indigo `AppButton` (the single filled indigo on this section). No lock — this is the Pro invite, not a paywall (Pro already owns the feature).

### State: empty / no tasks (window set, nothing planned)

- Window chip stays (it's set). Body: "No tasks yet. Add some and I'll fit them into 9:00–12:00." (`type.body`, inkSoft). Band hidden. No lock, no nag.

### State: all-prior basis (no learned bias yet)

- The fit still computes (engine always returns honest numbers via priors). Add a quiet caption under the band: "Times from typical patterns. Gets sharper as you log." (`type.caption`, inkSoft). Same honesty-without-withholding rule as capacity (§5 of spec 04).

### State: window already passed today

- If the whole window is earlier than `nowMs` (e.g. it's 3pm, window was 9–12), the band still shows the *shape* of the fit (so tomorrow's planning works), with a gentle caption: "Today's window has passed. This is ready for tomorrow." (`type.caption`, inkSoft). No action, no guilt. The fit is time-of-day relative, not now-relative — it does not shrink as the day goes (that is capacity's job).

### FocusWindowLocked (non-Pro, Plan tab)

```
┌─────────────────────────────────────────────┐
│ YOUR FOCUS WINDOW                       🔒    │
│                                               │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  your window   │   ← labelled empty band (the shape)
│                                               │
│  Spend your best hours on the right things.   │   ← type.body, ink
│  ┌─────────────────────────────────────────┐ │
│  │           Fit your focus window           │ │   ← AppButton, indigo (Pro CTA)
│  └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

- Shows the *shape* of the value (a window band, the concept) without the packed fit (the paid payoff). Lock glyph `t.iconSize.sm`, inkFaint.
- CTA = indigo `AppButton`. Never amber for the Pro CTA (amber = honey/reward semantics — visual-approval memory).

---

## 6. Motion

Personality: **Premium/Calm** (motion-design) — a planning surface, not a celebration. Easing `tokens.motion.easing.standard` / `.calm`; durations from `tokens.motion`.

- **Fill band on mount / recompute:** width animates current → target over `tokens.motion.base` (220ms), `easing.standard`, via Reanimated `useAnimatedStyle` (shared value read/written with `.get()/.set()`). Reuses the `CapacityBar` animation exactly.
- **Verdict colour cross-fade:** when verdict flips (a `Move up` pushes `spills` → still `spills` with a different set, or trimming makes it `fits`), the band fill colour and verdict line cross-fade over `tokens.motion.base`. Colour + width animate together — never opacity-only for a state change (motion-design CRITICAL rule).
- **List re-order on `Move up` / `promoteIntoWindow`:** the promoted row moves from the spill list into the in-window list using the planner's existing **entering-only** layout pattern. **No `exiting` layout animation** (Fabric SIGABRT — see README + plan.tsx note). The bumped-out task appears at the top of the spill list with an entering fade; the rows settle calmly, no overshoot, no particles (no celebration motion on a planning surface).
- **Window edit:** opening the `FinishTimeWheel` sheet uses the existing sheet motion (`tokens.motion.sheet`). On confirm, the band + lists recompute with the standard 220ms settle.
- **Reduced motion:** all of the above honour `ReduceMotion.System` — width/colour snap, rows reorder without animation.

No pulsing, no blinking, no urgency motion anywhere (invariant: no shame mechanics).

---

## 7. Data model

**Domain types (add to `src/domain/types.ts`):**

```ts
/** The focus-window fit verdict. Amber-never-red by construction. */
export type FocusWindowVerdict = 'fits' | 'spills';

/** One task placed by the focus-window fit (in-window or spilled). */
export interface FocusWindowPlacement {
  id: string;
  label: string;
  honestMin: number;
  /** true = fits inside the window; false = spilled past it. */
  inWindow: boolean;
}

/** Pure result of the focus-window fit (minutes; clock/time-of-day supplied by caller). */
export interface FocusWindowResult {
  windowMin: number;            // fixed window length = windowEndMin − windowStartMin
  packedMin: number;            // sum of honestMin of in-window tasks
  inWindow: FocusWindowPlacement[];   // ordered (priority order; see §8)
  spilled: FocusWindowPlacement[];    // ordered (priority order)
  verdict: FocusWindowVerdict;
  fitCount: number;             // inWindow.length
  totalCount: number;           // inWindow.length + spilled.length
  basis: 'personal' | 'prior';  // 'prior' if EVERY task fell back to priors
}
```

**KV (add to `settingsStore`):**

- `windowStartMin: number | null` — minutes-after-midnight of the window start. `null` = no window set (invite state). Setter `setFocusWindow(startMin, endMin)`.
- `windowEndMin: number | null` — minutes-after-midnight of the window end. `null` = unset.
- Persisted via the existing `settingsStore` KV. Reset in `settingsStore.reset` to `null`/`null` (no default window — the window is too personal to guess; ux-principles smart-defaults does not apply to a deeply personal value, and an invite is more honest than a wrong guess).
- A single setter writes both atomically so the card never sees a half-set window. Guard in the engine: if either is null, the feature is "unset" (invite state).

**No new DB table.** Inputs come from `tasksStore` (KV) + `planStore` (KV). Nothing about the fit is logged or trained on — it is a read-only derived view. (Honors: core loop on-device-only; no new persisted class of data; no health data — only two integers.)

---

## 8. Engine / logic

New pure module **`src/engine/focusWindow.ts`**, exported via `src/engine/index.ts`. PURE TS — no RN/Expo, no `Date.now()` (caller passes everything time-related). **TDD required — write `src/engine/__tests__/focusWindow.test.ts` first.**

```ts
// src/engine/focusWindow.ts
import type { FocusWindowResult, FocusWindowVerdict } from '../domain/types';

/** One planned item already resolved to an honest block (minutes), in priority order. */
export interface FocusWindowTask {
  id: string;
  label: string;
  honestMin: number;   // resolved honest number (round5(guess × M)); never the raw guess
}

export interface FocusWindowInput {
  /** Tasks in PRIORITY order (caller supplies the order = the user's draft order). */
  tasks: FocusWindowTask[];
  windowStartMin: number;  // minutes-after-midnight, window start
  windowEndMin: number;    // minutes-after-midnight, window end (> start)
}

/** Window length in minutes, floored at 0 (handles start ≥ end defensively). */
export function focusWindowMinutes(input: { windowStartMin: number; windowEndMin: number }): number;

/**
 * Pure focus-window fit. Greedily packs tasks IN GIVEN ORDER into the fixed-length
 * window: a task goes in-window if it fits in the remaining window space, else it
 * spills. Order-preserving within each list. Never mutates inputs.
 */
export function fitFocusWindow(input: FocusWindowInput, basis: 'personal' | 'prior'): FocusWindowResult;

/**
 * Promote a spilled task into the window by bumping out the SMALLEST in-window
 * task(s) until the promoted task fits (largest-first eviction is wrong here — we
 * want to displace the least valuable / smallest, keeping the user's promoted item).
 * Returns a NEW result; pure. If the task already fits with no eviction, just moves it.
 */
export function promoteIntoWindow(
  result: FocusWindowResult,
  taskId: string,
): FocusWindowResult;
```

**Constants (add to `src/engine/constants.ts`):**

```ts
// ── Focus-window planner (Pro) ───────────────────────────────────────────────
// No tight-ratio threshold: the verdict is binary (everything fits, or something
// spills). The window length is whatever the user set; there is no default window.
```

(No tunable constants needed for v1 — the fit is exact. Left as a named section so future tuning has a home.)

**Fit rules (deterministic; reuses the planner's stable-order discipline):**

1. `windowMin = focusWindowMinutes(...)` (floored at 0).
2. Walk `tasks` in the given (priority) order. Maintain `remaining = windowMin`.
3. For each task: if `task.honestMin ≤ remaining`, place `inWindow`, subtract from `remaining`; else place in `spilled`. (Greedy in-order — NOT largest-first; the user's order is their priority, so the first things they listed get the window. This is the key difference from `planner.cutLadder`, which drops largest-first to free the most time. Here we *keep* the user's top priorities, not the smallest tasks.)
4. `packedMin = sum(inWindow honestMin)`; `fitCount = inWindow.length`; `totalCount = all`.
5. `verdict = spilled.length > 0 ? 'spills' : 'fits'`.
6. `basis = 'prior'` only when *every* task fell back to priors (drives the caption).

**`promoteIntoWindow` rules:**

1. Find the task in `spilled`. If not there, return `result` unchanged.
2. Compute free space `= windowMin − packedMin`. If `honestMin ≤ free`, move it into `inWindow` (appended, keeping order) and return.
3. Else evict the **smallest** in-window task(s) (smallest `honestMin` first, ties → last in order, so the user's earlier-listed priorities survive) until the promoted task fits, moving evicted tasks to the top of `spilled`. Then place the promoted task in-window.
4. Recompute `packedMin`, `verdict`, counts. Pure; new object.

**Resolving each task's `honestMin` (in the hook, not the engine):**

Reuse `resolveSuggestion`/`honestNumber` exactly as the planner does (`usePlanner.suggestedDuration`): `round5(guessMin × mEffective)` per category from `calibrationStore.statsByCategory`, prior fallback via `priorFor`. Plan draft tasks already carry `durationMin` (the honest block) → use directly. `basis = 'prior'` only when every task fell back to priors.

**Ordering note (priority):** v1 uses the draft's existing task order as priority (the user arranges the Plan list; top = most important). No new priority field. A future "rank by category importance" is out of scope (open question §13).

**TDD cases (`focusWindow.test.ts`):**

| # | Setup | Expect |
|---|---|---|
| 1 | 0 tasks, window 180m | `fits`, packedMin 0, inWindow [], spilled [] |
| 2 | tasks [90,40,20] sum 150, window 180 | `fits`, all in-window, packedMin 150 |
| 3 | tasks [90,40,20] sum 150, window exactly 150 | `fits` (≤ remaining is in-window), packedMin 150 |
| 4 | tasks [90,40,50] order, window 130 | in-window [90,40] (130), spilled [50]; `spills` |
| 5 | greedy IN ORDER not largest-first: [50,90,40] window 130 | in-window [50,90] not [90,40]? — 50 fits (rem 80), 90 > 80 spills, 40 ≤ 80 fits → in-window [50,40], spilled [90] (order preserved, skip-if-too-big) |
| 6 | first task alone exceeds window: [200,10] window 180 | in-window [10], spilled [200] (the 10 still fits after 200 skipped) |
| 7 | window length 0 (start==end) | all spilled, `spills`, windowMin 0 |
| 8 | start > end defensively | windowMin floored to 0; all spilled |
| 9 | `promoteIntoWindow` with free space, no eviction | task moves in-window, nothing evicted |
| 10 | `promoteIntoWindow` needs eviction | smallest in-window task bumped to top of spilled; promoted task placed; counts/verdict recomputed |
| 11 | `promoteIntoWindow` ties on smallest | later-in-order evicted first (earlier priority survives) |
| 12 | `promoteIntoWindow` unknown id | result unchanged |
| 13 | all tasks prior-basis | `basis: 'prior'` |
| 14 | one personal + rest prior | `basis: 'personal'` |
| 15 | inputs not mutated (frozen-array check) | no mutation |

**Note on case 5 semantics:** confirm the greedy rule is "skip a task that doesn't fit and keep trying later, smaller tasks" (a first-fit pack), not "stop at the first task that doesn't fit." First-fit keeps the window full and respects priority order while still using leftover space — the right behavior for "spend the window well." The test pins this.

**Hook:** `src/features/planner/useFocusWindow.ts` (feature layer; composes engine + stores, mirrors `useDayCapacity` from spec 04). Reads `tasksStore`, `planStore.draft`, `calibrationStore`, `settingsStore` (`windowStartMin`/`windowEndMin`); resolves honest numbers in draft order; returns `FocusWindowResult | null` (null when window unset → invite state) + `promote(id)` (calls engine `promoteIntoWindow`, holds result in local state so the UI reflects the bump before any store write) + `setWindow(startMin, endMin)`. Components consume the hook only (respects the `src/components/**` → no `services/db` boundary; route through a feature hook).

**Dedupe with capacity:** both `useDayCapacity` and `useFocusWindow` resolve honest numbers from the same task union. Extract the shared resolver into a small helper `src/features/planner/resolveHonestTasks.ts` (returns `{ id, label, honestMin, done }[]` from the draft/tasks union) so the two hooks share one source of truth and can't drift. (react-native-architecture: one source per concern.)

---

## 9. Gating

- **Plan section:** `<ProGate fallback={<FocusWindowLocked />}><FocusWindowCard /></ProGate>` below the `CapacityCard` in `BuildView`.
- **Paywall trigger:** add `'focus_window'` to the `paywall_view.trigger` union in `analytics.ts` and pass it on the locked CTA: `router.push({ pathname: '/(modals)/paywall', params: { trigger: 'focus_window' } })`.
- **Locked teaser** (§5 `FocusWindowLocked`): same card frame; the window *concept* shown as a labelled empty band (the hook — "you have a window"), the packed fit veiled (the paid payoff), indigo CTA. Never fogs calibration; never gates the core loop.

---

## 10. Copy

Every string below is humanizer-checked (no em-dash, no AI vocab, no rule-of-three, sounds like one honest person) and obeys no-guilt (no "behind", "failed", "wasted", "should", no medical words). The window is always *"your focus window"* / *"the hours your head works best"* — never "energy", "meds", "symptoms", or any condition.

**Card label (eyebrow):** `YOUR FOCUS WINDOW`

**Window chip (set):** `{startClock}–{endClock}` (e.g. `9:00–12:00`, via `formatClock`) with an edit glyph

**Invite (no window set):**
- Body: `Mark the hours your head works best. I'll fit the right tasks into them.`
- Action: `Set your focus window`

**fits:**
- Headline: `{fitCount} of {totalCount} fit your window` (when `fitCount === totalCount`, use `All {totalCount} fit your window`)
- Verdict line: `These fit your focus window with {spare} to spare.` (when no spare: `These fit your focus window. Right to the edge.`)

**spills:**
- Headline: `{fitCount} of {totalCount} fit your window`
- In-window heading: `In your window`
- Spill heading: `Spills past your window`
- Spill row action: `Move up`
- Verdict line: `{fitCount} of these fit. The rest can wait.` (when `fitCount === 1`: `One fits your window. The rest can wait.`)
- After a `Move up` that still spills: no toast, just the calm reorder.

**empty (window set, no tasks):** `No tasks yet. Add some and I'll fit them into {startClock}–{endClock}.`

**prior-basis caption:** `Times from typical patterns. Gets sharper as you log.`

**window passed today:** `Today's window has passed. This is ready for tomorrow.`

**Window editor (FinishTimeWheel sheet headers):**
- Start step: `When does your focus window start?`
- End step: `And when does it end?`

**Locked teaser:**
- Body: `Spend your best hours on the right things.`
- CTA: `Fit your focus window`

Banned here (no-guilt + no-health invariants): "energy", "medication", "meds", "symptoms", "ADHD", "focus deficit", "wasted", "behind", "too much", "you won't finish", any red. The spilled list is framed as "can wait", never "didn't fit because you overcommitted."

---

## 11. Edge cases & guardrails

- **Window unset (`windowStartMin`/`windowEndMin` null):** invite state, no fit computed, no lock for Pro. The hook returns `null`.
- **Window length 0 (start == end) or start > end:** `windowMinutesFor` floors to 0 → everything spills, verdict `spills`, calm copy. The window editor should validate end > start before writing (the sheet's end step pre-selects start+60 and disallows end ≤ start), so this is a defensive engine guard, not a normal path.
- **Zero tasks (window set):** calm empty state, no lock for Pro.
- **All prior-basis:** still show the fit (engine always returns honest numbers) + the "gets sharper" caption; never withhold the value for low-n (don't fog).
- **A single task larger than the whole window:** it spills (case 6). `promoteIntoWindow` on it would evict everything and still not fit → guard: if even an empty window can't hold it, `promoteIntoWindow` returns the result unchanged (it can't honestly fit, and we never tell the user a necessary task is "impossible" — it just stays in the spill list, calmly).
- **Window passed today:** show the fit (time-of-day relative, for tomorrow), gentle caption, no shrink, no guilt. The fit does NOT depend on `nowMs` — only capacity (spec 04) shrinks with the clock.
- **Day rollover:** `tasksStore.clear()` at rollover recomputes the fit to empty automatically (derived view, nothing to migrate). The window persists across days (it's a daily-reused setting).
- **Plan draft vs Today dedupe:** when a Plan draft is active, dedupe Today queued tasks already in the draft by id (shared resolver `resolveHonestTasks.ts`).
- **Done tasks:** excluded from the fit (the window is for remaining work). Never surfaced as a deficit.
- **Monotonic invariant:** the fit is not a tier/honey metric, so monotonicity doesn't apply; but the band must never animate as a "score dropping" — it settles to a new total as a neutral recompute.
- **Privacy / no health:** `windowStartMin`/`windowEndMin` are two local time-of-day integers. No calendar, no dates, no health data, no condition, nothing leaves the device. No string anywhere references medication, energy, or a diagnosis.
- **No-guilt audit:** no red; spilled list is "can wait"; no streak, no count of unfilled windows, no "you do this every day" framing; an empty or unfilled window is never a failure.

---

## 12. Analytics

Add to `src/services/analytics.ts` (`AppEventProps`), fire-and-forget:

```ts
focus_window_viewed: { verdict: FocusWindowVerdict | 'unset'; fit_count: number; total_count: number; window_min: number; is_pro: boolean };
focus_window_set: { window_start_min: number; window_end_min: number; window_min: number };
focus_window_spills: { fit_count: number; spill_count: number; window_min: number };  // fired on entering 'spills'
focus_window_promoted: { saved_min: number; evicted_n: number; verdict_after: FocusWindowVerdict };
focus_window_paywall: { source: 'plan_section' };                                      // locked CTA tap
```

Also extend the existing `paywall_view.trigger` union with `'focus_window'` so the paywall funnel sees the source. (Note: spec 04 adds `'day_capacity'` to the same union — coordinate the edit so both land.)

---

## 13. Build manifest & effort

**Add:**

| File | What | Size |
|---|---|---|
| `src/engine/focusWindow.ts` | `fitFocusWindow`, `promoteIntoWindow`, `focusWindowMinutes`, types | S |
| `src/engine/__tests__/focusWindow.test.ts` | TDD cases (§8) — write first | S |
| `src/features/planner/useFocusWindow.ts` | hook: engine + stores + `promote`, `setWindow` | M |
| `src/features/planner/resolveHonestTasks.ts` | shared honest-number resolver (also used by `useDayCapacity`) | S |
| `src/features/planner/FocusWindowCard.tsx` | primary Plan section (all states) | M |
| `src/features/planner/FocusWindowList.tsx` | in-window + spilled list rows (with `Move up`) | S |
| `src/features/planner/FocusWindowLocked.tsx` | non-Pro teaser | S |

**Edit:**

| File | Change |
|---|---|
| `src/domain/types.ts` | add `FocusWindowVerdict`, `FocusWindowPlacement`, `FocusWindowResult` |
| `src/engine/index.ts` | export `fitFocusWindow`, `promoteIntoWindow`, `focusWindowMinutes`, focus-window types |
| `src/engine/constants.ts` | add the (currently constant-free) focus-window section comment |
| `src/stores/settingsStore.ts` | add `windowStartMin`, `windowEndMin` (null default) + `setFocusWindow`; null/null in `reset` |
| `src/features/planner/BuildView.tsx` | mount `<ProGate fallback={<FocusWindowLocked/>}><FocusWindowCard/></ProGate>` below `CapacityCard` |
| `src/services/analytics.ts` | add 5 events + `'focus_window'` trigger |

**Token check:** reuses `CapacityBar` (band) → reuses `progress.track` (6) + `radii.full` + `colors.primarySoft`/`accent`. No new geometry tokens needed (the band, rows, and chip all map to existing `space`/`type`/`progress`/`iconSize` tokens). If a distinct "window band" height is wanted later, add `tokens.progress.windowTrack` and a matching `useTheme` resolver line (memory: new tokens.ts group needs a matching `t.<key>` line or it's undefined) — not required for v1.

**Effort:** **Medium** overall (engine is small and exact; the polish is the two-list card, the `Move up` reorder motion, the window two-stop editor, and the locked teaser).

**Dependencies:** none new. Reuses planner's `FinishTimeWheel`, `CapacityBar` (from spec 04 — soft dependency: build spec 04 first, or build `CapacityBar` as a shared component when this lands), the engine's `resolveSuggestion`/`honestNumber`/`priorFor`, `ProGate`, `useEntitlement`, `formatClock`.

**Open questions (for the founder):**

1. **Priority order:** v1 uses the draft task order as priority (top = first into the window). Confirm, or do we want an explicit "important" flag / a "rank by category" option? (deferred — adds a field + UI.)
2. **`CapacityBar` sharing:** this feature reuses the capacity bar. If spec 04 hasn't shipped, do we promote `CapacityBar` to a shared `src/components/FillBar.tsx` now? Recommend yes, so both specs consume one band component.
3. **Multiple windows:** v1 is a single primary focus window. A second window (e.g. a morning block + an afternoon block) is plausible but multiplies the fit logic and the UI. Out of scope for v1 — flagged. (07 §2.4 implies one window: "their good-hours window".)
4. **Window default:** v1 has NO default (invite state) because the window is too personal to guess and a wrong guess is worse than an ask. Confirm, or seed a soft suggestion from the user's most-common log hour later (deferred — needs a log-hour aggregate).
5. **Interaction with capacity's "move to tomorrow":** if a task is moved to tomorrow by capacity, it leaves the focus-window set too (shared task union). Confirm the two actions composing cleanly is acceptable (they should — both read the same deduped union).
