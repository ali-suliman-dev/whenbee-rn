# Forgot-to-stop — manual retro-finish on the live timer

**Status:** design approved (founder, 2026-07-16) — awaiting spec review → plan → build
**Approach:** A (of 4 brainstormed). Mock: reviewed + revised live in the browser.

---

## Problem

On the live Timer screen the only stop control is **Stop & log**, which logs the
**full elapsed** time. If you finish a task but leave the timer running (walked
away, got distracted), stopping later logs an inflated `actualMin` — which
**poisons calibration** (the one thing the app exists to get right). Today the
only recourse is Abandon (loses the log entirely) or the auto-recovery
`ForgotCard`, which only fires when a session is closed **while you're away** —
never for a session you're actively looking at.

We need a **manual** affordance on the running timer: "I forgot to stop — I
actually finished a while ago" → pick when → log the **corrected** actual.

## Non-goals

- Not a pause/resume control (separate, still unbuilt).
- Not touching the auto-recovery `ForgotCard` path (that stays as-is).
- No new picker paradigm — reuse the existing `FinishTimeWheel`.
- Approach B (a third disc in the control row) was explicitly rejected.

## Product invariants honored

- **No guilt.** Copy frames it as help ("when did you actually stop?"), never a
  correction or scold. No red, no shame.
- **Honey/sharpness monotonic** — a retro log trains normally (never subtracts).
- **On-device only** — pure store/engine, no network.

---

## User-facing design (approved)

### Entry — indigo text link, above the controls

Under `PaceLabel`, above the `✕ Abandon · Stop & log` row, a single quiet line:

```
        Past your finish time · Forgot to stop?
   [ ✕ ]        [  ■  Stop & log  ]
```

- **`Forgot to stop?`** is a text button in **CTA indigo** (`primaryBright` on
  dark), underlined. It is *text*, not a filled button, so **Stop & log remains
  the one filled CTA** — the one-primary-per-screen rule holds.
- Lead micro-text is the existing pace copy; the link trails it (`·` separator).
- Lives inside the bottom controls block, so it **inherits the dim** when the
  hyperfocus guardrail card is up (`pointerEvents:'none'`, `opacity.pressed`).
- Always present during a live session (it's cheap and quiet). Presets inside the
  sheet self-gate to what's valid for the current elapsed, so an early tap simply
  offers the wheel.

### Sheet — reuses the ForgotCard overlay language

Tapping opens a bottom overlay identical in construction to `ForgotCard`:
`scrimOverlay` cool dim + bottom-anchored `surfaceRaised` card, radius `sheet`,
`FadeIn` (opacity-only, per the animation rule; reduced-motion → final state).

**Choices mode:**

```
When did you actually stop?
The timer kept running past your finish. Pick when you really
stopped — I'll log that, not the full 32m.

[  ~5 min ago   ·  27m  ]      ← amber (real log actions)
[  ~15 min ago  ·  17m  ]      ← amber
[  Pick the exact time  ]      ← ghost (navigation)
────────────────────────
[ Still going ]   Not sure yet
```

- **Amber emphasis on the presets** (they write the log), **ghost on "Pick the
  exact time"** (it only navigates). Decided 2026-07-16. Amber = the honey/log
  semantic, so it marks what actually logs — the reverse (amber on nav) was the
  rendered bug we corrected.
- **No "About now" option** — stopping "now" is just Stop & log; a preset for it
  is redundant (removed at founder's request).
- **`Still going`** reopens/keeps the session (no log) and dismisses.
- **`Not sure yet`** writes a `partial` record that never trains (mirrors
  ForgotCard's escape hatch), then dismisses.

**Presets:**

- Fixed offsets **5 and 15 minutes** (founder-chosen; the ×1.15/×1.25 multiplier
  and "common overrun research" ideas were considered and dropped).
- `actual(N) = floor(elapsedMin) − N`, label `~{N} min ago · {actual}m`.
- A preset renders **only if `actual(N) ≥ 1`** (hidden otherwise). If neither
  preset is valid (elapsed < 6m), the sheet shows just "Pick the exact time".

**Picker mode (Pick the exact time):**

```
When did you finish?
Spin to the time you actually stopped.

┌─────────────────────────┐
│   2  :  50   PM   (wheel)│   ← FinishTimeWheel, mode="be done by", showModes=false
└─────────────────────────┘
[  Log 2:50 PM  ·  22m  ]       ← amber (the confirm/log)
            Back
```

- Reuses `FinishTimeWheel` exactly as `ForgotCard` does.
- **Default** the wheel to the honest finish clock (`startedAt + honestMin`),
  clamped `≤ now` and `≥ startedAt + 1min` — the same sensible anchor ForgotCard
  uses.
- Confirm label previews the corrected minutes before commit
  (`Log {clock} · {actual}m`).
- Bounds: chosen finish clamped to `[startedAt + 1min, now]`; `actual = max(1,
  round((finishMs − startedAt) / 60000))`.

---

## Architecture & data flow

Layered per the repo rules — the route stays thin; logic in `useTimer` + the
engine; the sheet is presentation.

```
timer.tsx (TimerScreen)
  ├─ renders PaceLabel  +  <ForgotStopLink onPress={() => setForgotOpen(true)} />
  ├─ state: forgotOpen: boolean
  └─ when forgotOpen: <ForgotStopSheet
                         startedAt, elapsedMin, honestMin,
                         onConfirm={(finishMs) => …}  onCancel={() => setForgotOpen(false)} />

useTimer  →  new onForgotStopAndLog(finishMs)  →  timerStore.stop(finishMs)  →  calibrationStore.applyLog({ source:'retro' })
```

### New / changed units

1. **`useTimer.onForgotStopAndLog(finishMs: number): Promise<void>`** (new)
   - Mirrors `onStopAndLog`'s log→reward→navigate tail, with two differences:
     - `actualMin` comes from **`stop(finishMs)`** (the store computes
       `actualMin` from `finishMs − startedAt − pausedAccum`), not `stop(now)`.
     - **`source: 'retro'`** instead of `'timed'` → half-weight training
       (`RETRO_ALPHA_FACTOR` in `engine/ewma.ts`), the honest weight for an
       approximate finish. Same choice `ForgotCard` makes.
   - Sets `stoppingLocallyRef` first (so the external-clear reaction stays out of
     the way), clears the overrun timer, cancels notifications, ends the Live
     Activity — identical teardown to `onStopAndLog`.
   - Still fires the reward, `completeTask`, and plan bookkeeping, then
     `router.replace('/(modals)/reward')`.
   - **DRY:** extract the shared "log + reward + Today/plan bookkeeping + navigate
     to reward" tail of `onStopAndLog` into a private helper
     `logCompletedAndReward({ actualMin, source, label, category })` that both
     `onStopAndLog` and `onForgotStopAndLog` call. Avoids a copy-paste of ~60
     lines. (Quick-start's frozen-actual path keeps using it via `onStopAndLog`.)

2. **`ForgotStopSheet`** — `src/features/timer/ForgotStopSheet.tsx` (new)
   - Presentation-only. Props: `startedAt`, `elapsedMin`, `honestMin`,
     `onConfirm(finishMs)`, `onCancel()`. No store reads (keeps it testable and
     inside the component boundary — timer.tsx owns the store calls).
   - Two internal modes (`choices` | `picker`), same shape as `ForgotCard`.
   - Reuses `FinishTimeWheel`, `AppButton`, `SheetGrabber`? — it's an overlay, not
     a native sheet, so no grabber (matches ForgotCard). `haptics`, tokens.

3. **`ForgotStopLink`** — small indigo text button.
   - Either a tiny component in `src/features/timer/` or inline in `timer.tsx`
     (a `Pressable` + `AppText`). Leaning **inline** (it's ~8 lines) unless it
     needs reuse; revisit in the plan.

4. **`timer.tsx`** — add `forgotOpen` state, render the link + sheet, wire
   `onConfirm`:
   - **Non-quick-start (has category):** `void timer.onForgotStopAndLog(finishMs)`.
   - **Quick-start (no category):** freeze at the chosen finish
     (`timerStore.stop(finishMs)` equivalent via a freeze that accepts a
     timestamp) then open the existing `PostStopCaptureSheet`; Save logs with the
     frozen corrected actual. **Simplest v1 alternative:** hide the Forgot link on
     quick-start sessions (no honest anchor to correct against anyway) and revisit
     later. **Decision needed in the plan** — see Open questions.

### What we deliberately reuse

- `FinishTimeWheel` (picker), the `ForgotCard` overlay construction
  (`scrimOverlay` + `surfaceRaised` card + FadeIn), `applyLog` with `source:
  'retro'`, `stop(timestamp)` for corrected `actualMin`, `AppButton`
  `amber`/`ghost` variants, `haptics`, all tokens.

---

## Copy (drafts — to pass through conversion-psychology + humanizer at build)

- Link: **`Forgot to stop?`**  (lead: the live `PaceLabel` text)
- Sheet title: **`When did you actually stop?`**
- Body: **`The timer kept running past your finish. Pick when you really stopped — I'll log that, not the full {elapsed}m.`**
- Presets: **`~5 min ago · {a}m`**, **`~15 min ago · {a}m`**
- Ghost: **`Pick the exact time`**
- Picker title/body: **`When did you finish?`** / **`Spin to the time you actually stopped.`**
- Confirm: **`Log {clock} · {a}m`**
- Footer: **`Still going`** / **`Not sure yet`**

No guilt/shame language anywhere (invariant).

---

## Analytics

- `forgot_stop_logged` `{ method: 'preset' | 'wheel', corrected_min: number, elapsed_min: number, delta_min: number }` — how far the correction moved the number, and via which path. Feeds "is the manual forgot flow used / needed?"

## Testing

- **`useTimer` / calibration:** `onForgotStopAndLog(finishMs)` logs
  `source:'retro'`, `actualMin` derived from `finishMs` (not now), navigates to
  reward, flips the Today task done. (Extends the existing timer/calibration
  suites.)
- **Preset math (pure):** given `elapsedMin`, presets = `E−5`, `E−15`, each shown
  iff `≥ 1`; neither shown when `E < 6`.
- **`ForgotStopSheet` (interaction):** renders valid presets with correct labels;
  "Pick the exact time" toggles to the wheel; confirm calls `onConfirm(finishMs)`
  with the clamped timestamp; Back returns to choices.
- **Regression:** normal `Stop & log` still logs `source:'timed'` full elapsed
  (guard the shared-helper refactor).

## Edge cases

- `elapsedMin < 6` → only the wheel path is offered.
- Chosen finish clamped to `[startedAt + 1min, now]`; `actual ≥ 1`.
- Reduced motion → overlay renders final state, no travel.
- Guardrail card up → the link is in the dimmed/`pointerEvents:none` footer, so it
  can't be tapped underneath the card (correct).
- External clear mid-sheet (auto-close on unlock) → `ForgotCard` owns that; the
  manual sheet is dismissed with the route like the other stop paths.

## Visual-verify checklist (before "done")

- Two amber presets stacked: confirm they don't read as **two competing filled
  primaries**. If heavy on device, keep amber semantics but consider the
  `accentSoft` tinted-face treatment (warm, lower weight) — founder's call from a
  rendered screenshot.
- Indigo link weight vs the ring/CTA — founder asked to try CTA indigo; if it
  pulls the eye too hard for a rare action, drop to `inkSoft` (one token).
- Sheet spacing/type against the token scale (no eyeballed values).

## Resolved decisions (founder, 2026-07-16)

1. **Quick-start sessions:** **hide the Forgot link on quick-start sessions for
   v1** — a quick-start has no category / honest anchor to correct against.
   `TimerScreen` renders the link only when `!timer.isQuickStart`. The capture
   path can be added later if the flow proves needed.
2. **Link visibility:** **always visible** during a non-quick-start live session;
   the sheet's presets self-gate to what's valid for the current elapsed. No
   `elapsed ≥ honestMin` gate — cheaper mental model.
