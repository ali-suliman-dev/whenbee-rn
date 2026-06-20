# 04 — Day-capacity check  ·  Pro

**Status:** spec · **Tier:** Pro (`pro` entitlement) · **Skills applied:** react-native-architecture, ui-design:react-native-design, ux-principles, conversion-psychology, motion-design, humanizer

> Reads the shared conventions in [README.md](README.md) (invariants, layer rules, theming, motion, gating, copy). This file only states what is specific to the day-capacity check. **No calendar, no EventKit, no calendar permission — ever.** The only source of "today's commitments" is the in-app Today list (`tasksStore`) and the Plan-tab draft (`planStore`).

---

## 1. What it is

A calm reality check that answers one question before the day starts: **"will today actually fit?"** It adds up the honest numbers of everything you've planned for today — your guesses already corrected by your learned per-category bias — and compares that total to the real hours you have left. When the planned work is more than the window can physically hold, it says so kindly and offers to move one task to tomorrow. It is the in-app, zero-calendar replacement for the dropped Honest-Day calendar padding: the same "will my day fit?" payoff, with no calendar access. It is the no-guilt inverse of a streak — it warns you *before* you overcommit instead of shaming you *after* you fall behind.

---

## 2. The user problem + evidence

Time-optimists chronically plan more than the day can hold, then feel behind by noon. Per-task calibration is only half the win; the decision that actually changes their day is the *sum* against real available time. From [07-PRO-VALUE-IDEAS §1.4](../07-PRO-VALUE-IDEAS.md):

- The explicit reason ADHD users pay $20/mo for Sunsama: *"Most task managers make you feel behind. Sunsama warns you when you're overcommitted."* ([SaskADHD](https://saskadhd.com/sunsama-review-a-therapists-take-on-the-daily-planner-that-actually-works-with-your-brain/)).
- It turns per-task accuracy into a daily planning decision — the single most actionable thing the multiplier enables, used every planning session.
- It replaces calendar padding entirely (§1.6, CUT 2026-06-19): same payoff, zero calendar access.

The felt problem (conversion-psychology): the user has lived the *"I packed eight things into a four-hour afternoon and hated myself by 3pm"* loop many times. The check names that before it happens, with the user's own honest numbers as proof — believable because it's their data, not a generic warning.

---

## 3. Where it lives

**Decision: a dedicated capacity card at the top of the Plan tab's BuildView, plus a one-line capacity strip on the Today screen.** Rejected alternatives and why:

- *Today-only banner* — the Today list is a FIFO focus queue (oldest queued = the one Next card), not a "see my whole day" surface. Capacity reasoning wants the full planned set in view, which is the Plan tab's job.
- *Separate route/modal* — adds a navigation step to a check that must be glanceable at planning time. Friction kills a "every planning session" habit (ux-principles, recognition-over-recall: show the verdict where the planning happens).

So:

| Surface | What shows | Who sees it |
|---|---|---|
| **Plan tab — BuildView, top card** (primary) | Full `CapacityCard`: total honest vs window, verdict, "move one to tomorrow" action | Pro: live card. Non-Pro: locked teaser (blurred-shape, §9). |
| **Today screen — one-line strip** (secondary, glance) | `CapacityStrip`: "~6½h planned · 4h left" + a small dot in verdict colour | Pro: live strip when ≥1 queued task. Non-Pro: not shown (no nag on the free core surface). |

The Plan card is the full feature. The Today strip is a passive glance that deep-links to the Plan tab on tap. The check **never** appears inside the guess → timer → learn loop and never fogs calibration.

**Input sources (union, deduped by id):**

1. `tasksStore` — queued Today tasks (each has `guessMin` + `category`; honest number resolved via the engine, see §8).
2. `planStore.draft.tasks` — Plan-tab draft tasks (already carry a resolved `durationMin` = honest block).

Done/completed tasks are excluded from the *remaining* total but shown as already-spent context (see §8 `spentMin`). When a Plan draft is active, its tasks are the source of truth and Today queued tasks already represented in the plan are deduped out by id.

---

## 4. User flow

**Happy path (Pro, day fits):**

1. User opens the Plan tab to plan the day (or adds Today tasks).
2. `CapacityCard` sits at the top: "About 3h 10m of honest work. You've got 5h 30m. Comfortable."
3. Verdict = `fits`. Card is a quiet positive (low-emphasis indigo). No action needed. User builds the plan.

**Over path (Pro, day is over-packed):**

1. Same entry; planned honest total exceeds the window.
2. Card reads: "This is about 6h 30m of honest work in a 4h window. One thing wants tomorrow." Verdict = `over`.
3. A single calm action: **"Move [task] to tomorrow"** — the largest task, ranked by the planner's cut-one logic (§8). Tapping it removes that task from today's set (Plan draft: `removeTask`; Today: `removeTask`) and re-runs the check. If still over, the card offers the next-largest. Each move is one tap; no multi-select, no guilt copy.
4. User can dismiss the action and keep the over-packed day — the card stays informational (amber dot), never blocks, never turns red.

**Setting the window (how "hours available today" is supplied):**

The window is **now → a day-end time**, defined once and remembered:

- Default day-end = **21:00 local** (a sane "I stop planning work by 9pm" default; ux-principles smart-defaults — 80% never change it).
- The card shows the window inline: "now → 9:00pm" with an edit affordance (a tappable time chip). Tapping opens the existing `FinishTimeWheel` (reused from the planner) to pick a day-end hour:minute.
- Stored in `settingsStore.dayEndMin` (minutes-after-midnight, persisted KV). It is a *plain local time-of-day*, not a date and not a calendar event.
- **Window minutes** = `dayEndMs(now, dayEndMin) − now`, floored at 0. If now is already past day-end, the window is 0 and the card shows the "day's done" rest state (§5).

**Locked / non-Pro path:**

1. Non-Pro opens the Plan tab. The `CapacityCard` slot renders `CapacityLocked` — same card frame, real numbers softened to shapes (the *total* is shown honestly; the verdict + action are veiled with a lock).
2. CTA "See if today fits" → `router.push('/(modals)/paywall')` with `trigger: 'day_capacity'`.

---

## 5. Screens & states

All values are tokens (`t.*` from `useTheme()` + `type` from `typography.ts`). Components reused: `Card`, `AppText`, `AppButton` (ghost + coin-edge variants), `Chip`, `FinishTimeWheel`, `Screen`. New components: `CapacityCard`, `CapacityStrip`, `CapacityLocked`, `CapacityBar`.

### Shared layout — CapacityCard (Plan tab, primary)

- Container: `Card` (radii.card, borderWidth.card, surface) — flat, hairline only, no shadow.
- Internal vertical rhythm: `gap: t.space[3]` (12). No per-child margins (one spacing source per axis).
- Type scale used: eyebrow (`type.eyebrow`, label), the honest total in `type.honestNumberMd` (numeric, tabular), supporting line in `type.body`, window chip text in `type.caption`.
- A horizontal **CapacityBar** (see geometry token §7) shows planned vs window: planned fill against a window track.

```
┌─────────────────────────────────────────────┐
│ TODAY'S CAPACITY                  now → 9:00pm│   ← eyebrow + editable window chip
│                                               │
│  3h 10m  planned                              │   ← honestNumberMd + caption suffix
│  ▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░  5h 30m left     │   ← CapacityBar + window caption
│                                               │
│  Comfortable. This fits with room to spare.   │   ← type.body, ink
└─────────────────────────────────────────────┘
```

### State: `fits` (planned ≤ ~85% of window)

- Bar fill = `t.colors.primarySoft`, track = `t.colors.surfaceSunken`, fill ≤ track width.
- Verdict line ink = `t.colors.ink`. No action button.
- Tone: quiet positive (mirrors VerdictCard `fits`).

### State: `tight` (planned > ~85% and ≤ window)

```
┌─────────────────────────────────────────────┐
│ TODAY'S CAPACITY                  now → 9:00pm│
│                                               │
│  4h 45m  planned                              │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░  5h 00m left      │
│                                               │
│  This fills your day. Doable, but no slack.   │   ← ink, calm; NO action
└─────────────────────────────────────────────┘
```

- Bar fill = `t.colors.accent` (amber) at ~95% of track. Amber here = "near the edge" attention, never alarm.
- No action button (it still fits). Informational only.

### State: `over` (planned > window)

```
┌─────────────────────────────────────────────┐
│ TODAY'S CAPACITY                  now → 9:00pm│
│                                               │
│  6h 30m  planned                       •      │   ← amber dot, top-right
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│           │   ← fill exceeds track; spill cap at edge
│  4h 00m window · about 2h 30m over            │
│                                               │
│  More than today holds. One thing wants       │   ← type.body, ink
│  tomorrow.                                     │
│                                               │
│  ┌─────────────────────────────────────────┐ │
│  │   Move "Deep work block" to tomorrow      │ │   ← AppButton, amber coin-edge
│  └─────────────────────────────────────────┘ │
│  Keep it all                                  │   ← ghost dismiss, inkSoft
└─────────────────────────────────────────────┘
```

- Card frame stays neutral surface (NOT a red/danger card — red is reserved for Abandon, per VerdictCard precedent).
- Amber dot = `t.colors.accent`, diameter `t.iconSize.xs` (12), `radii.full`, aligned to cap-height of the planned number (optical center, not box center).
- Bar: planned fill exceeds the window track; clamp the fill at `100%` of track width and draw a 2px amber **spill cap** (`t.colors.accentEdge`) on the trailing edge to signify overflow without making the bar grow.
- Primary action: `AppButton` amber filled with coin-edge (`tokens.burst.coinEdge` technique) — the one recommended tappable action gets the tactile edge (mirrors VerdictCard push-deadline). Label names the specific task to move.
- Secondary: ghost "Keep it all" (`inkSoft`), dismisses the suggestion for this session; card reverts to informational (dot stays).

### State: empty / not-enough-data

- **No tasks today:** card shows a calm rest state — eyebrow + "Nothing planned yet. Add a task and I'll tell you if it fits." (`type.body`, inkSoft). Bar hidden. No lock, no nag.
- **Tasks present but all in `prior` basis (no learned bias yet):** the total is still computed from priors (the engine always returns a number). Add a quiet caption under the bar: "Estimate from typical patterns — gets sharper as you log." (`type.caption`, inkSoft). This is honest about confidence without withholding the value (mirrors `CalibrationSummary.basis === 'prior'`).

### State: day already over (window ≤ 0)

- "Today's window has closed. This resets in the morning." (`type.body`, inkSoft). Bar hidden, no action. No guilt about unfinished tasks.

### CapacityStrip (Today screen, secondary glance)

```
 ~3h 10m planned · 5h 30m left  •          →
```

- One row, `type.caption`, inkSoft, with a verdict dot (`fits` = primarySoft, `tight`/`over` = accent). Tappable → Plan tab.
- Height ≤ `t.space[8]` (32), `gap: t.space[1.5]`. Sits below the Today HUD, above the focus card. Hidden when 0 queued tasks or non-Pro.

### CapacityLocked (non-Pro, Plan tab)

```
┌─────────────────────────────────────────────┐
│ TODAY'S CAPACITY                       🔒     │
│                                               │
│  3h 10m  planned                              │   ← real total shown (the hook)
│  ▓▓▓▓▓░░░░░░░░  · · · left                     │   ← window veiled to dots
│                                               │
│  See if today actually fits.                  │   ← type.body, ink
│  ┌─────────────────────────────────────────┐ │
│  │            See if today fits              │ │   ← AppButton, indigo (Pro CTA)
│  └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

- Shows the *shape* of the value: the planned total is real (proof the math works), the window + verdict are veiled (the paid payoff). Lock glyph `t.iconSize.sm`, inkFaint.
- CTA = indigo `AppButton` (the one filled indigo on this screen). Never amber for the Pro CTA (amber is reward/honey semantics — see visual-approval memory).

---

## 6. Motion

Personality: **Premium/Calm** (motion-design) — this is a reassurance surface, not a celebration. Easing `tokens.motion.easing.standard` / `.calm`; durations from `tokens.motion`.

- **Bar fill on mount / recompute:** width animates from current → target over `tokens.motion.base` (220ms), `easing.standard`. Reanimated `useAnimatedStyle` on width, shared value via `.get()/.set()`. Distance is small (≤ card width) so 220ms is right per the duration table.
- **Verdict colour cross-fade:** when verdict changes (e.g. a "move" drops over → tight), the bar fill colour and verdict line cross-fade over `tokens.motion.base`. Colour + width animate together (never opacity-only for a state change — motion-design CRITICAL rule).
- **"Move to tomorrow" task removal:** the named task animates out on the Plan list with the planner's existing entering-only pattern; the CapacityCard recomputes and the bar eases to the new total. **No `exiting` layout animation** (Fabric SIGABRT — see README + plan.tsx note). The over→fits transition is the reward beat: a single calm settle of the bar, no overshoot, no particles (no guilt/celebration motion on a capacity surface).
- **Amber dot (over):** a one-time gentle fade-in (`tokens.motion.fast`, 120ms) when entering `over`. It does **not** pulse or blink (no urgency/alarm motion — invariant: no shame mechanics).
- **Reduced motion:** all of the above honour `ReduceMotion.System` — width/colour snap instantly, dot appears without fade.

---

## 7. Data model

**Domain types (add to `src/domain/types.ts`):**

```ts
/** The day-capacity verdict tier. Amber-never-red by construction. */
export type CapacityVerdict = 'fits' | 'tight' | 'over';

/** Pure result of the day-capacity check (minutes; clock supplied by caller). */
export interface CapacityResult {
  plannedMin: number;          // sum of honest numbers of REMAINING planned tasks
  windowMin: number;           // available minutes (now → day-end), floored at 0
  spentMin: number;            // honest/actual minutes of already-done tasks today (context only)
  verdict: CapacityVerdict;
  overshootMin: number;        // max(0, plannedMin − windowMin)
  /** Largest remaining task, the suggested "move to tomorrow" pick (null when none / fits). */
  moveSuggestion: { id: string; label: string; savedMin: number } | null;
  basis: 'personal' | 'prior'; // 'prior' if EVERY task falls back to priors (drives the caption)
}
```

**KV (add to `settingsStore`):**

- `dayEndMin: number` — minutes-after-midnight of the day-end (default `21 * 60 = 1260`). Setter `setDayEndMin`. Persisted via the existing `settingsStore` KV. Reset in `settingsStore.reset` to `1260`.
- Add `dayEndMin` to the `useTheme`/store enumeration is N/A (it's a settings value, not a theme token).

**No new DB table.** Inputs come from the existing `tasksStore` (KV) and `planStore` (KV). Nothing about capacity is logged or trained on — it is a read-only derived view. (Honors: core loop on-device-only; no new persisted class of data.)

---

## 8. Engine / logic

New pure module **`src/engine/capacity.ts`**, exported via `src/engine/index.ts`. PURE TS — no RN/Expo, no `Date.now()` (caller passes `nowMs` and `dayEndMin`). **TDD required — write `src/engine/__tests__/capacity.test.ts` first.**

```ts
// src/engine/capacity.ts
import type { CapacityResult, CapacityVerdict } from '../domain/types';

/** One planned item already resolved to an honest block (minutes). */
export interface CapacityTask {
  id: string;
  label: string;
  honestMin: number;       // resolved honest number (round5(guess × M)); never raw guess
  done: boolean;           // true = already completed today (counts toward spent, not remaining)
}

export interface CapacityInput {
  tasks: CapacityTask[];
  nowMs: number;           // wall clock, injected
  dayEndMin: number;       // minutes-after-midnight of the day-end window edge
  /** Local midnight (epoch ms) for `nowMs`'s day; supplied by caller (clock-free engine). */
  dayStartMs: number;
  basis: 'personal' | 'prior';
}

/** Window minutes remaining: (dayStart + dayEndMin) − now, floored at 0. */
export function windowMinutesFor(input: { nowMs: number; dayStartMs: number; dayEndMin: number }): number;

/** Pure capacity check. Never mutates inputs; deterministic for fixed inputs. */
export function checkCapacity(input: CapacityInput): CapacityResult;
```

**Constants (add to `src/engine/constants.ts`):**

```ts
// ── Day-capacity check (Pro) ─────────────────────────────────────────────────
export const CAPACITY_TIGHT_RATIO = 0.85;   // planned > 85% of window → 'tight'
export const DEFAULT_DAY_END_MIN = 21 * 60; // 21:00 local default day-end
```

**Verdict rules (deterministic ladder, reuses the planner's "largest-first" cut concept):**

1. `windowMin = windowMinutesFor(...)`.
2. `plannedMin = sum(honestMin where !done)`; `spentMin = sum(honestMin where done)`.
3. `overshootMin = max(0, plannedMin − windowMin)`.
4. Verdict:
   - `over` when `plannedMin > windowMin`.
   - `tight` when `plannedMin > windowMin * CAPACITY_TIGHT_RATIO` (and not over).
   - `fits` otherwise.
5. `moveSuggestion`: when `over`, the **largest remaining task** (`honestMin` desc, ties → original order — mirrors `planner.cutLadder` stable largest-first), with `savedMin = its honestMin`. `null` for `fits`/`tight` or when no remaining tasks.

**Resolving each task's `honestMin` (in the hook, not the engine):**

Reuse `resolveSuggestion`/`honestNumber` exactly as the planner does (`usePlanner.suggestedDuration`): `round5(guessMin × mEffective)` per category from `calibrationStore.statsByCategory`, prior fallback via `priorFor`. Plan draft tasks already carry `durationMin` (the honest block) → use directly. `basis = 'prior'` only when *every* task fell back to priors.

**TDD cases (`capacity.test.ts`):**

| # | Setup | Expect |
|---|---|---|
| 1 | 0 tasks, 5h window | `fits`, plannedMin 0, moveSuggestion null |
| 2 | tasks summing 190m, window 330m | `fits` (190 ≤ 0.85×330=280) |
| 3 | tasks 290m, window 330m | `tight` (290 > 280, ≤ 330) |
| 4 | tasks 390m, window 240m | `over`, overshootMin 150, moveSuggestion = largest |
| 5 | over, two equal-largest tasks | suggestion = first in original order (stable tie-break) |
| 6 | window edge: planned == window exactly | `tight` not `over` (≤ is fits-side of over) |
| 7 | now past day-end | windowMin 0; any task → `over`; 0 tasks → `fits` |
| 8 | mix done + queued | plannedMin excludes done; spentMin = done sum |
| 9 | windowMinutesFor floors negative to 0 | 0, not negative |
| 10 | all tasks prior-basis | `basis: 'prior'` |
| 11 | one personal + rest prior | `basis: 'personal'` |
| 12 | inputs not mutated (frozen-array check) | no mutation |

**Hook:** `src/features/planner/useDayCapacity.ts` (feature layer; composes engine + stores, mirrors `usePlanner`). Reads `tasksStore`, `planStore.draft`, `calibrationStore`, `settingsStore.dayEndMin`; resolves honest numbers; computes `dayStartMs` from `nowMs`; returns `CapacityResult` + `moveToTomorrow(id)` (calls the right store's `removeTask`) + `setDayEnd`. Components consume the hook only (respects the `src/components/**` → no `services/db` boundary; route through a feature hook).

---

## 9. Gating

- **Plan card:** `<ProGate fallback={<CapacityLocked />}><CapacityCard /></ProGate>` at the top of `BuildView`.
- **Today strip:** `useEntitlement((s) => s.isPro)` branch — render `CapacityStrip` only when Pro AND ≥1 queued task. Non-Pro sees nothing on Today (no nag on the free core surface).
- **Paywall trigger:** add `'day_capacity'` to the `paywall_view.trigger` union in `analytics.ts` and pass it on the locked CTA: `router.push({ pathname: '/(modals)/paywall', params: { trigger: 'day_capacity' } })`.
- **Locked teaser** (§5 `CapacityLocked`): same card frame; real planned total visible (proof the math works), window + verdict veiled, indigo CTA. Never fogs calibration; never gates the core loop.

---

## 10. Copy

Every string below is humanizer-checked (no em-dash, no AI vocab, no rule-of-three, sounds like one honest person) and obeys no-guilt (no "behind", "failed", "too much", "should").

**Card label (eyebrow):** `TODAY'S CAPACITY`

**Window chip:** `now → {clock}` (e.g. `now → 9:00pm`, via `formatClock`)

**fits:**
- `{plannedClock} planned` / suffix line: `Comfortable. This fits with room to spare.`
- Lighter variant when barely under tight: `This fits. You've got time.`

**tight:**
- `This fills your day. Doable, but no slack.`

**over:**
- Body: `More than today holds. One thing wants tomorrow.`
- Sub-caption: `{windowClock} window · about {overshoot} over`
- Primary action: `Move "{taskLabel}" to tomorrow`
- Dismiss: `Keep it all`
- After a move that lands it in `fits`/`tight`: `That fits now. Nice.`

**empty (no tasks):** `Nothing planned yet. Add a task and I'll tell you if it fits.`

**prior-basis caption:** `Estimate from typical patterns. Gets sharper as you log.`

**day closed:** `Today's window has closed. This resets in the morning.`

**Today strip:** `~{plannedClock} planned · {windowClock} left`

**Locked teaser:**
- Body: `See if today actually fits.`
- CTA: `See if today fits`

**Window editor (FinishTimeWheel sheet header):** `When does your day wind down?`

Banned here (no-guilt invariant): "overcommitted", "too much", "you won't finish", "behind", any red. The competitor framing ("warns you when you're overcommitted") is the *positioning* — the in-app copy stays gentle ("one thing wants tomorrow").

---

## 11. Edge cases & guardrails

- **Window ≤ 0** (now past day-end): windowMin 0, render "day closed" rest state, no action, no guilt.
- **Zero tasks:** calm empty state, no lock for Pro, nothing for non-Pro.
- **All prior-basis:** still show the number (engine always returns one) + the "gets sharper" caption; never withhold the value for low-n (don't fog).
- **Single task that alone exceeds the window:** `over`, `moveSuggestion` = that task; moving it → 0 tasks → empty/fits. The card never tells the user a single necessary task is "impossible" — it just states the overshoot calmly.
- **Day rollover:** when `tasksStore.clear()` runs at rollover (existing behavior), the check recomputes to empty automatically (derived view, nothing to migrate).
- **Plan draft vs Today dedupe:** when a Plan draft is active, dedupe Today queued tasks already in the draft by id so work isn't double-counted. If no draft, Today queued tasks are the set.
- **Done tasks:** excluded from `plannedMin` (the remaining-work question), surfaced only as `spentMin` context — never as a deficit ("you've done X" framing is allowed; "you have Y left undone" is not).
- **Monotonic invariant:** capacity is not a tier/honey metric, so monotonicity doesn't apply — but the bar must never animate in a way that reads as a "score dropping" (it eases to a smaller total as a *relief*, the over→fits settle).
- **Privacy:** dayEndMin is a local time-of-day integer; no calendar, no dates, no health data, nothing leaves the device.
- **No-guilt audit:** no red anywhere; over-state uses amber + neutral surface; no streak, no count of missed days, no "you do this every day" framing.

---

## 12. Analytics

Add to `src/services/analytics.ts` (`AppEventProps`), fire-and-forget:

```ts
day_capacity_viewed: { verdict: CapacityVerdict; planned_min: number; window_min: number; n_tasks: number; is_pro: boolean };
day_capacity_over: { overshoot_min: number; n_tasks: number };               // fired on entering 'over'
day_capacity_moved: { saved_min: number; remaining_n: number; verdict_after: CapacityVerdict };
day_capacity_window_set: { day_end_min: number };
day_capacity_paywall: { source: 'plan_card' | 'today_strip' };               // locked CTA tap
```

Also extend the existing `paywall_view.trigger` union with `'day_capacity'` so the paywall funnel sees the source.

---

## 13. Build manifest & effort

**Add:**

| File | What | Size |
|---|---|---|
| `src/engine/capacity.ts` | `checkCapacity`, `windowMinutesFor`, types | S |
| `src/engine/__tests__/capacity.test.ts` | TDD cases (§8) — write first | S |
| `src/features/planner/useDayCapacity.ts` | hook: engine + stores + `moveToTomorrow`, `setDayEnd` | M |
| `src/features/planner/CapacityCard.tsx` | primary Plan card (all verdict states) | M |
| `src/features/planner/CapacityBar.tsx` | animated planned/window bar (+ spill cap) | S |
| `src/features/planner/CapacityLocked.tsx` | non-Pro teaser | S |
| `src/components/CapacityStrip.tsx` | Today one-line glance | S |

**Edit:**

| File | Change |
|---|---|
| `src/domain/types.ts` | add `CapacityVerdict`, `CapacityResult` |
| `src/engine/index.ts` | export `checkCapacity`, `windowMinutesFor`, capacity types |
| `src/engine/constants.ts` | add `CAPACITY_TIGHT_RATIO`, `DEFAULT_DAY_END_MIN` |
| `src/stores/settingsStore.ts` | add `dayEndMin` + `setDayEndMin`; default + reset |
| `src/features/planner/BuildView.tsx` | mount `<ProGate fallback={<CapacityLocked/>}><CapacityCard/></ProGate>` at top |
| `src/app/(tabs)/index.tsx` (Today) | mount `<CapacityStrip/>` (Pro + ≥1 queued) below HUD |
| `src/services/analytics.ts` | add 5 events + `'day_capacity'` trigger |
| `src/theme/tokens.ts` | add a `capacity` geometry group (bar height, spill-cap width, dot size) if not covered by existing `progress`/`iconSize` tokens |

**Token check:** the bar can mostly reuse `progress.track` (6) + `radii.full`. Add `tokens.capacity = { spillCapW: 2 }` for the overflow cap if `progress.gapStripe.lineW` (2) isn't a clean semantic fit. Verdict dot reuses `iconSize.xs`. Add any new group's resolver line to `useTheme` (memory: new tokens.ts group needs a matching `t.<key>` line or it's undefined).

**Effort:** **Medium** overall (engine sum is small; the polish is the card's verdict states + bar motion + locked teaser).

**Dependencies:** none new. Reuses planner's `FinishTimeWheel`, the engine's `resolveSuggestion`/`honestNumber`/`priorFor`, `ProGate`, `useEntitlement`, `formatClock`.

**Open questions (for the founder):**

1. **Default day-end:** 21:00 assumed. Confirm, or infer from the user's most-common log hour later (deferred).
2. **Window model:** now → day-end (a single shrinking window). A future option is a fixed daily *budget* of hours independent of the clock — out of scope for v1, flagged for the focus-window planner (spec 09) which owns the richer good-hours window.
3. **Today strip placement:** below the HUD vs above the focus card — verify on the sim for vertical rhythm (founder approves UI from rendered screenshots only).
4. **"Move to tomorrow" semantics:** v1 = remove from today's set (it returns to a normal queued task tomorrow / stays in Plan draft removal). A true "scheduled for tomorrow" bucket needs a date field on tasks — deferred; confirm v1 remove-only is acceptable.
