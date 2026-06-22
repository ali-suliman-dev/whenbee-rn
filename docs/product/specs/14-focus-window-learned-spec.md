# 14 — Learned Focus Window (Pro)

**Status:** spec · self-approved 2026-06-22 · **Tier:** Pro (`pro` entitlement)
**Covers:** turning the shipped *manual* focus window into a **learned** one — Whenbee computes your most productive logged hours from calibration history and presents them as a window, editable but framed as learned. Adds the **Plan → Focus** mode, the data-true illustration states, and the contextual **Today hook**.

**Supersedes** [09-focus-window-planner.md](09-focus-window-planner.md) where they disagree (this file wins). The existing engine packing (`fitFocusWindow`, `promoteIntoWindow`), the `FocusWindowResult` type, and the `windowStartMin/windowEndMin` settings **stay** — this spec adds the *learning* layer on top and *moves* the surface out of `BuildView`.

> Decision trail (2026-06-22, founder): Focus stays **Pro** (market research — Lifestack/Motion/RISE/Reclaim all monetize "right work in your best hours"; the payable wedge is *personalization*, not the block-time mechanic). **Option A** — learned window default from day one. Lives **only in Plan → Focus** (not Patterns). Honesty framing: **"your most productive logged hours,"** never "biological peak." Today hook appears **only once a window is genuinely learned.**

---

## A. Product framing

- **Why it's payable:** generic time-blocking is free/commodity (Google Cal, Notion, TickTick). The moat is *"YOUR peak hours, learned from YOUR data"* — Whenbee's on-device per-category calibration is the personal-data equivalent of RISE's sleep data or Motion's calendar. Lead every surface on the learning, not the mechanic.
- **Honesty (non-negotiable):** we only have data for hours the user *chose* to work — so the claim is **"when your logged work goes sharpest"**, not a circadian/biological peak. No overclaim in copy. This is also the stronger story: it's about your real work, not a horoscope.
- **No-guilt invariants hold:** spill is "can wait"; no red, no streaks; the fill bar's "full" state is amber, the single CTA is the one filled indigo (see [[one-primary-cta-per-screen]] — Focus must never add a second primary CTA to a screen).

---

## B. Data-model change (required for correctness)

**Persist the local time-of-day at task START on every `TaskEvent`.** Recomputing hour-of-day from `createdAt` epoch is wrong: travel/DST shift it, and retroactive logs carry the *logging* time, not the *doing* time.

Add to `TaskEvent` (`src/domain/types.ts`) and the DB row + migration:

```ts
/** Local minute-of-day (0–1439) at the moment work STARTED, captured at log time.
 *  null = no trustworthy start time (retroactive/backfilled log) → excluded from
 *  focus-window learning. Never recomputed from createdAt. */
startLocalMinute: number | null;
```

- Captured from the timer's real start (`startedAt`) as `new Date(startedAt).getHours()*60 + getMinutes()` at insert. For live timer logs it's always present; for retro logs it's `null`.
- Migration: backfill existing rows `null` (they simply don't contribute until new data accrues — acceptable; the gate falls back to prior).
- **This field is local-time-of-day only — no date, no location, never trained into the multiplier.** (Mirrors the existing "window is a pure time preference, never health data" stance.)

---

## C. The learning algorithm (pure engine)

New module `src/engine/learnFocusWindow.ts`, exported via `index.ts`. **Pure + deterministic** — no clock, no ambient `Math.random` (the permutation test uses a seeded PRNG, §C.11). Caller passes events with `startLocalMinute` already resolved.

### C.1 Per-event focus signal (completed events only)
For each completed event with a non-degenerate category fit and `startLocalMinute !== null`:

```
honestᵢ  = affineHonestExact(fit[category], estimateMinᵢ)      // expected, given your bias
sᵢ       = clamp( ln(honestᵢ / actualMinᵢ),  −ln3, +ln3 )       // s>0 = beat your baseline
```

Category-normalisation (comparing to *your own* honest expectation, not raw estimate) is what stops category mix from faking a peak. Log-space + clamp stop one outlier dominating.

**Exclusions (drop the event entirely from the signal):**
- `actualMinᵢ < MIN_ACTUAL_MIN` (3) — mis-taps / instant "done" maxed the ratio.
- `actualMinᵢ / estimateMinᵢ < MIN_PLAUSIBLE_RATIO` (0.1) — implausible mis-log.
- Degenerate category fit: `b ∉ [0.2, 5]` → use `honest = median(actual)` for that category, or skip the category if even that is unavailable. Never feed `NaN`/floored honest into a bin.

### C.2 Per-event weight (capped — no single event can move a bin)
```
wᵢ = min( recencyᵢ × √min(honestᵢ, actualMinᵢ, DURATION_CAP), WEIGHT_CAP )
recencyᵢ = 0.5 ^ (ageDaysᵢ / RECENCY_HALFLIFE_DAYS)
```
`WEIGHT_CAP = 2` is half of `SHRINK_KAPPA = 4`, so **≥2 events are required to pull a bin off the prior** — kills "one long recent task = new peak." `DURATION_CAP = 90` min stops a 4-h task from carrying 4× a normal one.

### C.3 Binning (30 min, soft-assigned)
Bins of `BIN_MIN = 30` across `WAKING = [05:00, 24:00)` (38 bins). **Soft-assign** each event to its two nearest bin centres by linear interpolation (9:59 → mostly 09:30 bin, a little 10:00) so a task near a boundary can't flip the argmax between sessions.

Per bin *b*: total weight `W_b = Σ wᵢ`, weighted mean `m_b = Σ wᵢ sᵢ / W_b`.

### C.4 Shrink toward the *smoothed-local* value (not flat global)
Two-stage so the Bayes step and the kernel don't fight:
1. Kernel-smooth raw `m_b` with `[0.25, 0.5, 0.25]` → `m̃_b`.
2. Empirical-Bayes shrink each bin toward its *smoothed* neighbour value:
   `ŝ_b = (W_b · m_b + κ · m̃_b) / (W_b + κ)`, `κ = SHRINK_KAPPA = 4`.
A 1-event bin inherits its neighbourhood; a dense bin keeps its own value.

### C.5 Window candidate
Argmax over `ŝ_b`, then **grow outward** while neighbours stay above `mean(ŝ) + 0.5·sd(ŝ)`, clamped to `[WINDOW_MIN_LEN 90, WINDOW_MAX_LEN 240]` min. Deterministic earliest-bin tie-break.

### C.6 The gate — permutation test (replaces the SE test)
The naive "peak beats the mean by 1 SE" fires on noise (winner's curse across 38 bins). Instead:

```
observedPeak = max_b ŝ_b  (post smoothing+shrink)
repeat PERM_N (200) times:
  shuffle the (startLocalMinute → bin) labels across events, keep weights
  recompute ŝ; record max
fire 'personal' iff observedPeak > 95th-percentile(shuffledMaxes)   // PERM_PCTL
```
Family-wise correct, non-circular, no in-sample-baseline leakage. The shuffle is seeded (§C.11) so the verdict is reproducible — same data → same answer, no RNG flicker.

### C.7 Coverage floor + selection-bias guard
A bin may **win** the window only if it has `≥ BIN_MIN_EVENTS (6)` events across `≥ BIN_MIN_DAYS (4)` distinct days. Sub-coverage bins still contribute to the prior/smoothing but can't be the peak. This kills the morning-only-logger being told "you peak at 10am" on one-sided data, and the one-task-per-day case.

### C.8 Bimodality (don't silently pick one lobe)
If a second local maximum exists with `ŝ ≥ BIMODAL_RATIO (0.85) × peak` and separated by `≥ BIMODAL_SEP_BINS (2)`, **fall back to `prior`** for v1 (honest: "we see more than one strong stretch — still sharpening"). *(Dual-window display is v1.1, §I.)* Also gate on `sd(ŝ) > SD_MIN (0.08)` — a flat day → `prior`, never a confident random window.

### C.9 Hysteresis (stable, never stuck, never oscillating)
State persisted: `shownStartMin`, `shownEndMin`, `lastMoveAtMs`.
- Recompute the candidate each load. **Move only if** the candidate beats the shown window on **smoothed** score by `≥ HYSTERESIS_MARGIN` **and** their overlap is `< MOVE_OVERLAP_MAX (50%)` (a real shift, not a ±15-min nudge) **and** `now − lastMoveAt ≥ DWELL_DAYS (7)`.
- **Force re-evaluation** (ignore dwell) when the shown window's own support has decayed below the gate — so a stale window can't outlive the data forever.
- Snap reported edges to `EDGE_SNAP_MIN = 15` (5 min was too fine to be stable).

### C.10 Completion-rate (tiebreak tilt only — does NOT vote in the gate)
Per-bin completion reliability `completed/(completed+abandoned+partial)`, shrunk toward the *global* rate with `κ_complete = 8`. Apply as a small tilt `× (1 + COMPLETION_WEIGHT·(rate−global))`, `COMPLETION_WEIGHT = 0.15`, on the *mean only* — it must not feed the permutation gate or SE (it correlates with `s`, so counting both as independent over-states certainty). **Drop it entirely if** its across-bin correlation with `ŝ` exceeds `COMPLETION_DROP_CORR (0.6)` (redundant).

### C.11 Determinism
Seeded PRNG (mulberry32) seeded from a stable derived value (e.g. `nCompleted * 1000 + Σ startLocalMinute`). Same data → same shuffle → same verdict and window. No flicker from randomness.

---

## D. Engine API

```ts
export interface LearnFocusInput {
  events: ReadonlyArray<{
    category: string;
    estimateMin: number;
    actualMin: number;
    status: LogStatus;
    startLocalMinute: number | null;
    ageDays: number;            // (nowMs − startedAt)/86_400_000, computed by caller (engine stays clock-free)
  }>;
  fitByCategory: Record<string, AffineFit>;
  shown: { startMin: number; endMin: number; lastMoveAtDays: number } | null;  // hysteresis state
}

export interface LearnedFocusWindow {
  startMin: number;            // snapped to 15
  endMin: number;
  basis: 'personal' | 'prior';
  /** 0–1 strength for UI confidence wording (NOT shown as a %). */
  confidence: number;
  /** 38 half-hour bins of ŝ_b (05:00–24:00), normalised to [0,1] for the illustration curve. */
  scoreByBin: number[];
  sampleCount: number;         // completed events that fed the signal ("learned from N sessions")
  distinctDays: number;
  /** true → hysteresis says keep the shown window unchanged this cycle. */
  held: boolean;
}

export function learnFocusWindow(input: LearnFocusInput): LearnedFocusWindow;
```

Prior fallback window: `09:00–11:30` (late-morning analytic default; constant `PRIOR_WINDOW`). `scoreByHour` always returned (a soft illustrative curve when `basis:'prior'`) so the illustration is never empty.

**Hook** `useLearnedFocusWindow` (feature layer): fetches completed events via the calibration/events store (never the repo directly — layer rule), computes `ageDays`/`startLocalMinute`, calls the engine, and — unless `settings.focusWindowUserSet` is true — writes the learned `start/end` into `windowStartMin/windowEndMin` so the existing `fitFocusWindow` packing just works. A manual edit sets `focusWindowUserSet = true` and stops auto-moves.

---

## E. Settings / persistence
Add to `settingsStore`: `focusWindowUserSet: boolean` (default false), `focusShownStartMin/EndMin`, `focusLastMoveAtMs` (hysteresis state). Existing `windowStartMin/EndMin` remain the *effective* window the packer reads. Resetting calibration data resets these.

---

## F. UI

### F.1 Placement — Plan → Focus mode
Add **Focus** to the Plan segment: `Plan · Focus · Routines` (`PlanSegment`). **Remove** the `FocusWindowCard`/`FocusWindowLocked` block from `BuildView` (that block created the two-indigo-CTA bug — see [[one-primary-cta-per-screen]]). Focus mode is its own screen with **one** primary CTA.

### F.2 States (entitlement × data)
| | Forming (gate = prior) | Learned (gate = personal) |
|---|---|---|
| **Free** | Illustration (dashed/illustrative curve), real time axis, "Learning your focus hours · N/~M sessions", *Set my hours myself* (ghost), Pro framing. **No Today hook.** | Curve with visible peak, **hours frosted/hidden**, "We found your sharpest stretch · from N sessions", one indigo CTA *Unlock my focus window* → paywall (`trigger:'focus_window'`). **Today hook appears.** |
| **Pro** | Same forming illustration; *Set window* available; packs once a window exists. **No Today hook.** | Full reveal: data-true curve from `scoreByHour`, window band, `9:30–11:30am`, "learned from N sessions", the existing packed task list + fill bar + Move-up. **Today peek shows real hours.** |

Copy goes through `conversion-psychology` + `humanizer`; **no fake percentages** — legitimacy comes from real clock times + session counts. Honour the honesty framing ("most productive logged hours").

### F.3 Illustration component
`FocusCurve` (`react-native-svg`) driven by `scoreByBin` — the curve **is** the data (forming = the soft prior curve, dashed; learned = the real normalised scores). Time axis labels; window band when personal; peak dot with a calm 2.8s breath (`prefers-reduced-motion` aware; entering-only — no `exiting`, see [[reanimated-exiting-crash]]). Free-learned variant renders the curve but masks the band + axis behind a frost-lock. All geometry/colour from tokens (add a `focusCurve` token group if needed; verify `useTheme` enumerates it — see [[usetheme-token-enumeration]]).

### F.4 Today hook (only when `basis === 'personal'`)
Contextual slot under the HUD, render-gated: window personal **and** today **and** has tasks **and** `now ≤ endMin`. Free → teaser line *"Your focus window is ready ›"* (hides hours) → Focus mode unlock. Pro → live peek *"Focus window · 9:30–11:30 · 3 of 4 fit ›"*. **No new primary CTA on Today** — the row is the tap target; `Start` stays Today's only filled button.

---

## G. Constants (`src/engine/constants.ts`, focus-window section)
```
WAKING_START_MIN=300  WAKING_END_MIN=1440  BIN_MIN=30
S_CLAMP=Math.log(3)  MIN_ACTUAL_MIN=3  MIN_PLAUSIBLE_RATIO=0.1
FIT_B_MIN=0.2  FIT_B_MAX=5
RECENCY_HALFLIFE_DAYS=35  DURATION_CAP_MIN=90  WEIGHT_CAP=2
SHRINK_KAPPA=4  KERNEL=[0.25,0.5,0.25]
WINDOW_MIN_LEN=90  WINDOW_MAX_LEN=240  EDGE_SNAP_MIN=15
PERM_N=200  PERM_PCTL=0.95
GATE_MIN_COMPLETED=15  GATE_MIN_DISTINCT_DAYS=5
BIN_MIN_EVENTS=6  BIN_MIN_DAYS=4
SD_MIN=0.08  BIMODAL_RATIO=0.85  BIMODAL_SEP_BINS=2
HYSTERESIS_MARGIN=0.5·sd(ŝ)  DWELL_DAYS=7  MOVE_OVERLAP_MAX=0.5
COMPLETION_WEIGHT=0.15  COMPLETION_KAPPA=8  COMPLETION_DROP_CORR=0.6
PRIOR_WINDOW={start:540,end:690}  // 09:00–11:30
```

---

## H. Testing (TDD — logic-layer, write tests first)
Engine purity makes this cheap. Synthetic event generators + each review failure-mode as a named test:
1. **Category mix can't fake a peak** — same true focus, different category schedules per hour → window unchanged.
2. **Sparse bin can't spike** — one 7am event vs many 10am → 7am never wins (shrinkage + coverage floor).
3. **Single long/recent task can't move a bin** — one 4-h task yesterday → no peak (weight cap).
4. **Mis-log floor** — `actualMin<3` and ratio<0.1 events excluded.
5. **Permutation gate** — pure-noise input (random times) → `basis:'prior'` in ≥95% of seeded trials; a true injected peak → `'personal'`.
6. **Coverage floor** — morning-only logger → never claims an afternoon/evening peak; one-task-per-day → stays `prior` until ≥5 days.
7. **Bimodal** — injected morning+evening peaks → `prior` (not an arbitrary lobe).
8. **Flat day** — `sd<SD_MIN` → `prior`.
9. **Hysteresis** — jittered re-runs of the same distribution → window stable (no move); a genuine injected shift (>50% non-overlap, past dwell) → moves once; decayed-support stale window → forced re-eval.
10. **Determinism** — same input twice → identical output (seeded PRNG).
11. **Timezone/DST** — events with `startLocalMinute` set vs `null` → null excluded; travel doesn't move the window.
12. **Completion tilt** — correlated-with-`s` completion → dropped (>0.6); independent → small tilt only, gate unaffected.

UI: snapshot the three illustration states; assert Today hook hidden unless `basis:'personal'` + render gate; assert Focus mode renders exactly one primary CTA in every state (regression for the two-CTA bug).

---

## I. Out of scope / v1.1
- **Dual-window display** for genuinely bimodal users (v1 falls back to prior).
- **Weekday/weekend split** windows (v1 pools all days).
- **Category-difficulty weighting** (crediting focus more for hard categories).
- **Auto-suggesting window length** beyond the 90–240 clamp.
- **Notifications** ("you're entering your focus window") — presence/notif work is separate.
