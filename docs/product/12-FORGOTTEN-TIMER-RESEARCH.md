# Forgotten-Timer: research + 10x strategy

Session 1 · 2026-07-04 · area: the "I forgot to stop the timer" problem

> **Shipped (P0) — 2026-07-04.** The free safety net (#7 forgot-card, #8 overrun-amber,
> #5 recovery presets, #10 train-guard) plus the #2/#6/#4/#9 auto-close + learned nudge
> landed on branch `worktree-feat+forgot-timer-autoclose`. Spec:
> [`docs/superpowers/specs/2026-07-04-forgotten-timer-autoclose-design.md`](../superpowers/specs/2026-07-04-forgotten-timer-autoclose-design.md).
> Plan: [`docs/superpowers/plans/2026-07-04-forgotten-timer-autoclose.md`](../superpowers/plans/2026-07-04-forgotten-timer-autoclose.md).
> On-device end-to-end flow (runaway → auto-stop → recovery card) still needs a device verify pass.
> iOS Live Activity + native background close (#1 P2) is a separate, paid-account-gated plan.

> Founder's problem, verbatim: *"The top problem for this app is I forget to stop
> the timer. Phone on silent, I don't feel the notification / vibration. I'm
> elsewhere."* Wanted: (1) a friendly, non-negative over-guess notification,
> (2) a ranked list of 10x fixes, (3) an honest evaluation of his own idea
> ("auto turn off after a number you provide").

---

## TL;DR

The forgotten stop is a **surface problem** ("I didn't notice") stacked on a
**data problem** ("the garbage overrun trains my calibration"). Generic timers
only solve the surface, badly — they nag on a blind interval and force you to
hand-fix a bogus number.

**Whenbee has one asset no other timer has: it already knows when you'll
actually finish** (the honest number = guess × learned bias). Every fix below is
just *spending that asset*:

1. **Make the running timer un-missable but silent** — a live countdown on the
   lock screen / Dynamic Island (iOS) and the persistent notification (Android,
   already built), with a one-tap **Done** on it. Silent phone stops mattering
   because it's *ambient and visual*, not a buzz you miss. **This is the biggest
   single lever.**
2. **Auto-close near the *predicted* finish, and recover the data** — not a
   fixed cap that records a fake number. Log the recovered stop as a
   low-confidence retro entry (half-weight machinery already exists) so a
   forgotten stop can't degrade calibration. **This is the 10x, and it's the
   smart version of your auto-off idea.**
3. **One gentle nudge, fired at the honest number — not on a dumb repeat.**

Compounding moat: better calibration → smarter auto-close → cleaner data →
better calibration. No competitor can copy it without first building the
calibration model.

---

## What successful apps actually do (and why it doesn't fully transfer)

| Pattern | Who | What it does | Why it's incomplete for Whenbee |
|---|---|---|---|
| **Idle detection** | Toggl, Clockify | No keyboard/mouse for X min → "discard idle time or keep?" | Desktop-only signal. A phone has no keyboard idle — you set a timer and *walk away from the phone*. Doesn't transfer as-is. |
| **Auto-stop at threshold** | Clockify | Hard-stops the timer after a set duration | Records the threshold as the duration → **poisons the model** with a fake number. The naive version of your idea. |
| **"Discard idle & continue"** | Toggl | Retroactively trims the forgotten tail | Right instinct (recover, don't just stop). Whenbee can do it *better* because it can guess the real finish. |
| **Remind every X min** | Hubstaff, Clockify | Periodic "still tracking?" ping | Blind interval = nag. Trains you to ignore it. No-guilt invariant makes dumb repetition a non-starter. |
| **Live Activity / persistent surface** | iOS system, delivery/rideshare apps | Glanceable live status on lock screen + Dynamic Island, no app open | **The transferable gold.** Silent-proof because it's visual. Android version already built here. |
| **No-nag co-pilot, no streak-shaming** | ADHD Timer Collection, Finch, Looptimer | Gentle escalation, verbal/visual nudges "like a supportive friend, never judgey"; over-time = soft flashing, not a harsh alarm | Confirms the *tone* Whenbee already commits to (no guilt, amber never red). Validates the nudge-ladder approach. |

**The gap in the whole market:** every app treats a forgotten stop as *your*
mistake to clean up. None of them can *predict* your real finish, so none can
auto-recover intelligently. That gap is Whenbee's opening.

---

## Why the data problem is real (grounded in the engine)

- `RATIO_CEIL = 6` (`src/engine/constants.ts`) clamps a runaway overrun to 6× the
  guess. Good — one disaster can't fully poison the model. **But** a 30-min task
  left running 5 hours still trains a *clamped 6× overrun* into the EWMA. Enough
  forgotten stops and your learned bias drifts pessimistic — the exact opposite
  of the product's promise.
- Only `status:'completed'` events train. So **status is the lever**: an
  auto-recovered stop that's flagged (not a clean `completed`) can be kept out of
  training, or trained at reduced weight, until the user confirms it.
- Precedent already in the code: **retro logs train at half weight**
  (`RETRO_ALPHA_FACTOR = 0.5`). An auto-closed forgotten stop is *exactly* a
  noisy retro memory — reuse this path. No new engine concept required.

This is why "auto-off after a number" done naively is a downgrade, and why done
right it's a moat.

---

## Massive opportunities

### 1. Presence surface + one-tap Done — the silent-proof fix 🔥
**What**: The running timer lives on the lock screen and Dynamic Island (iOS
Live Activity) / persistent notification (Android — **already built**,
`modules/whenbee-presence`), showing a **live countdown to your honest number**
and a **Done** button right on it. Overrun flips the surface to **amber** (never
red) with a live "+12m over".
**Why 10x**: The founder misses the buzz because the timer is *buried in the
app*. A glanceable, always-present, silent surface removes the dependence on
sound/vibration entirely — you *see* it every time you check your phone, and you
stop it without opening the app. Android already flips to overrun natively via
AlarmManager; iOS is pending the paid Apple account (static widget "never cut").
**Unlocks**: Zero-friction stop from anywhere; kills the #1 cause of forgotten
stops (out of sight).
**Effort**: Android — done. iOS — medium, gated on paid team.
**Score**: 🔥 Must do.

### 2. Smart auto-close with a recoverable "pending" log — the 10x 🔥
**What**: When a timer runs past the honest number by a *learned* per-category
margin (not a fixed cap), Whenbee auto-closes it at the **most-likely real
finish** — anchored on the honest prediction, not on "now". It banks this as a
**low-confidence pending entry**, trained at half weight (or excluded until
confirmed) so it can't degrade calibration. Next time you open the app: *"I
guessed you wrapped Workout around 6:10 — right? [Yep] [Adjust]"*.
**Why 10x**: This is your "auto turn off after a number" idea, fixed. It solves
both halves at once — the timer never runs for 5 hours *and* the model never
learns a fake number. No other timer can do the "most-likely finish" part
because no other timer has a per-category learned duration.
**Unlocks**: A forgotten stop becomes a 1-tap confirm instead of a data
disaster + a manual edit. Calibration stays clean silently.
**Effort**: Medium (engine: reuse retro/half-weight path + a pending status;
UI: a confirm card).
**Risk**: Auto-closing too eagerly on a genuinely long task. Mitigate with the
*learned* margin + confidence band + the always-recoverable confirm.
**Score**: 🔥 Must do.

### 3. Context-aware "still going?" — fire the nudge at the right moment 🤔
**What**: Use on-device signals (motion via `CMMotionActivity`; "you've been in
other apps for 20 min past the honest number") to fire **one** supportive check
*exactly* when a forgotten stop is probable — not on a clock interval.
*"Still on Workout? Tap if you wrapped."*
**Why 10x**: A nudge you get *only when you probably forgot* is a helper; a nudge
every 10 min is a nag you'll mute. Turns the reminder from noise into signal.
**Effort**: Medium-high (motion permissions, on-device heuristic — stays on the
on-device core loop, no network).
**Risk**: Permission friction; false positives. Ship it as an opt-in refinement
*after* #1 and #2, which don't need any new permission.
**Score**: 🤔 Explore (strong upside, do after the基础).

---

## Medium opportunities

### 4. Honest-number nudge ladder (gentle, no-guilt) 👍
**What**: Nudges timed off the *honest number*, not the guess. At honest → say
nothing (finishing there is success, not lateness). At honest × learned overrun
margin → one soft glance nudge. Later → the auto-close (#2). Amber, never red;
no counter of "how late", no streak.
**Why it matters**: Timing the first nudge to the honest number is what makes it
feel like a smart friend instead of a stopwatch yelling. Directly honors "amber
never becomes red" and "no shame mechanics."
**Effort**: Low-medium (scheduling logic; leans on presence + notifications).
**Score**: 👍 Strong.

### 5. "When did you actually finish?" recovery presets 👍
**What**: Open the app to a still-running/overrun timer → a one-tap slider with
**smart presets built from Whenbee's own predictions**: *at your honest number
(6:10) · at your guess (5:45) · a few minutes ago · still going*. Pick → logs
that as the real stop.
**Why it matters**: Toggl's "discard idle time" reimagined — but the presets are
*intelligent* because Whenbee can propose the honest finish as the default. Turns
a data-repair chore into a single tap on the likeliest answer.
**Effort**: Low-medium.
**Score**: 👍 Strong (this is the manual fallback for #2; ships together).

### 6. Learned per-category auto-close threshold (opt-in, adjustable) 👍
**What**: The *number* in "auto-off after N" is **learned per category** from how
much you typically overrun, not typed once and wrong forever. Surfaced and
adjustable in settings, default on.
**Why it matters**: This is the salvageable core of the founder's idea — but the
number comes from the model, so it's right for Workout *and* for Deep Work
without the user tuning anything.
**Effort**: Low (it's the trigger condition for #2).
**Score**: 👍 Strong.

---

## Small gems

### 7. "Did you forget to stop?" card on next app open 🔥
**What**: If the app opens to a timer that's been in overrun a while, lead with a
warm one-tap recovery card (feeds #5's presets). One line: *"Looks like Workout
kept running — want to set when you actually wrapped?"*
**Why powerful**: Catches the miss with **zero new tech** — no motion, no Live
Activity, no paid account. Pure UI + existing state. Ships this week and already
removes most of the pain.
**Effort**: Low.
**Score**: 🔥 Must do (cheapest win on the board).

### 8. Overrun = amber + live "+Nm over" on every surface 🔥
**What**: One consistent overrun visual (amber, live over-count) on the timer
screen, the widget, and the notification.
**Why powerful**: A single glance tells the whole story; makes forgetting
*visible* everywhere at once. Cheap, on-brand (amber never red).
**Effort**: Low.
**Score**: 🔥 Must do.

### 9. Silent-respecting haptic tick at the honest number 🤔
**What**: A single gentle haptic (not a sound) at the honest number, for
phone-in-pocket. Distinct, soft, one-time.
**Why powerful**: Reaches you when the phone's on silent but on your body —
without a sound. (Caveat: the hardware silent switch can suppress haptics; treat
as a bonus, not the primary fix — that's #1.)
**Effort**: Low.
**Score**: 🤔 Maybe.

### 10. Never-train-on-unconfirmed-overrun guardrail 🔥
**What**: One engine rule: an auto-closed / unconfirmed overrun trains at half
weight (retro path) or not at all until confirmed. Invisible to the user.
**Why powerful**: Protects the calibration moat — the whole product's promise —
from the exact failure mode this doc is about. Punches far above its size.
**Effort**: Low (reuse `RETRO_ALPHA_FACTOR`).
**Score**: 🔥 Must do (ships inside #2).

---

## Evaluation of your idea: "auto turn off after a number you provide"

**Verdict: right instinct, wrong three details. Fix them and it becomes the 10x.**

| Your version | Problem | The fix |
|---|---|---|
| A **fixed** number | 45 min is right for a workout, absurd for deep work. One cap can't fit all categories. | **Learn the threshold per category** from typical overrun (#6). |
| **You type it** | Friction, and you'll guess it wrong — the same estimation problem the app exists to solve. | Default it from the model; let you adjust, don't make you author it. |
| It **records the cap** as the duration | Trains a **fake number** into calibration — actively harms the thing that makes Whenbee special. | Record the **predicted honest finish**, flag it low-confidence, **half-weight or exclude from training** until you confirm (#2, #10). |

So: **yes, build auto-off — as smart auto-close (#2) with a learned threshold
(#6) and a recovery confirm (#5), guarded by #10.** Don't build the fixed-cap
hard-stop; it would quietly degrade the model.

---

## Recommended priority

### Do now (cheap, no new tech, ships this week)
1. **#7 "Did you forget to stop?" card** on next open — biggest pain, lowest cost.
2. **#8 overrun = amber + live over-count** everywhere.
3. **#5 recovery presets** built from honest-number predictions.
4. **#10 never-train-on-unconfirmed-overrun guardrail** (reuse half-weight path).

### Do next (the 10x)
1. **#2 smart auto-close + recoverable pending log**, driven by **#6 learned
   threshold** and **#4 honest-number nudge ladder**.
2. **#1 iOS Live Activity + one-tap Done** (Android presence already built) —
   gated on the paid Apple team.

### Explore (after the base lands)
1. **#3 context/motion-aware "still going?"** — highest cleverness, needs a
   permission and tuning; only worth it once #1/#2 exist.

---

## The one sentence to hold onto

Every other timer nags you on a blind clock and makes you hand-fix garbage.
**Whenbee is the only timer that knows when you'll actually finish** — so it can
show that finish on your lock screen, close near it when you forget, and refuse
to let a forgotten stop lie to its own model. That's not a feature; it's the
calibration moat spent on the app's #1 pain.

---

## Open decisions (need founder input)

- **Auto-close default: on or opt-in?** On = it just works, but it's an
  automatic action on your data (recoverable, but still). Recommend **on with a
  visible, adjustable threshold** + always-recoverable confirm.
- **iOS Live Activity now or fast-follow?** Blocked on the paid Apple team.
  Given the "no fast-follow" principle, the *static widget + notification* path
  may need to be the v1 iOS answer, with the full Live Activity when the account
  clears. Needs a call.
- **How aggressive is "probable forget"?** The learned margin — 1.5× honest?
  2×? Category-dependent. Decide the starting heuristic before building #2.

---

## Sources

- [Toggl idle detection](https://support.toggl.com/individual-user-guide) · [Toggl time-tracking reminders](https://support.toggl.com/en/articles/2216601-time-tracking-reminders)
- [Clockify idle detection, reminders & auto-stop](https://clockify.me/help/track-time-and-expenses/idle-detection-reminders) · [Clockify forum: forgetting to start/stop](https://forum.clockify.me/t/forgetting-to-start-stop-timer/33)
- [Hubstaff time-tracking reminders](https://support.hubstaff.com/reminder-track-time-start-timer-desktop-application/)
- [iOS Live Activities / Dynamic Island guide (2026)](https://newly.app/guides/ios-live-activities) · [Apple ActivityKit — WWDC23](https://developer.apple.com/videos/play/wwdc2023/10184/)
- [ADHD Timer Collection — "no-nag co-pilot"](https://apps.apple.com/us/app/adhd-timer-collection/id6634579526) · [Looptimer — gentle over-time flash](https://looptimer.com/) · [Finch — no streak-shaming](https://www.saner.ai/blogs/best-neurodivergent-apps-for-adults)
