# 11 — Live Activity timer control (Stop)  ·  extends 05 Persistent presence

**Status:** spec (design approved 2026-06-20; research-backed) · **Tier:** the control itself is **FREE** (it's the timer, not a Pro payoff) · **Depends on:** `05-persistent-presence.md` (the Live Activity must exist first), the native `WhenbeePresence` module, `timerStore` · **Skills to apply at build time:** `react-native-expert`, `ui-design:mobile-ios-design` (WidgetKit/ActivityKit HIG), `creating-reanimated-animations`, `conversion-psychology` + `humanizer` (notification copy)

> **Read first:** `05-persistent-presence.md` and `docs/NATIVE-PRESENCE.md`. This spec adds **one interactive button** to the running-timer Live Activity so the user can stop the timer from the Lock Screen / Dynamic Island without opening the app — and reframes *when* a task's context is captured.

---

## 1. What it is (one paragraph)

While a task timer runs, the Live Activity already shows the honest finish-time countdown on the Lock Screen and Dynamic Island. This adds a **Stop** button there. Tapping Stop ends the timer **in the background** — it records the actual duration (the one fact that trains calibration) and dismisses the activity, **without opening the app**. The reward/summary (honest-vs-actual, honey, reasons) is no longer forced on the user at stop time: they reach it by **tapping the activity body** (which opens the app into that task's summary), or later via a **quiet notification**. Capturing *why* a task ran the way it did becomes **retroactive enrichment**, not a mandatory gate at finish.

## 2. The decisions (locked) + the evidence

| Decision | Choice | Why |
|---|---|---|
| Which controls | **Stop only** (no Pause/Resume in this cut) | Founder call. HIG: prefer a single interactive element to avoid mis-taps. Pause can be a fast-follow. |
| What Stop does | **Silent background** via `LiveActivityIntent` — logs the duration, ends the activity, no app launch | This is the platform-native pattern: Apple Clock/Timer, Stopwatch (iOS 18), Timery all stop **silently**. Flow shipped "open the app on stop," publicly called it the wrong default, and planned to move to silent. |
| Reaching the reward/summary | **Tap the activity body** opens the app into that task's summary (pull, not push) + an **optional quiet notification** after stop | Tap-body-to-open is the universal deeplink convention. The reward becomes something the user pulls toward, not an interruption pushed at them. |
| Reason / context capture | **Retroactive** — attach later from the summary drawer, never required at stop | Decouples the irreducible duration-log from optional enrichment (see §4). |

**Research basis (2026-06-20):** Apple's interactive-Live-Activity model runs `LiveActivityIntent.perform()` in the **app's own background process**, so it can write to the DB and call the engine without foregrounding — the "stop = training log" constraint is fully met silently. Apple's pre-iOS-17 "all interaction opens your app" guidance was **superseded** by the iOS 17 silent-button model. The dominant complaint about Apple's own timer (286-vote thread) is *accidental* stops, which we mitigate with affordance + the OS's lock-screen auth guard, not by forcing the app open. Sources captured in the design conversation; key ones: Apple "Adding interactivity to widgets and Live Activities", `LiveActivityIntent`, HIG → Live Activities, WWDC23 session 10194.

## 3. The retroactive-enrichment model (the important reframe)

Split a task's record into two layers:

1. **The log (irreducible, captured at stop, silent):** `actualMin` (from start/stop timestamps) → `applyLog` → trains the multiplier/sharpness, banks nothing the user must act on. This must always happen, app open or not.
2. **The context (optional, enrichable any time):** the reason it ran long/short, "what stole the time," notes — the stuff the Reward "nectar drawer" collects today. This is **no longer gated to the stop moment.** A past task stays open to gain context whenever: from the post-stop notification, from history, or from the task itself.

**Consequence:** the reward/reason capture becomes a *re-openable drawer on an existing log*, not a one-shot screen you must clear right after finishing. This is strictly better for an ADHD audience — the moment of finishing is the worst time to demand reflection; let them add it when they have bandwidth.

## 4. User flow

**Happy path:**
1. Timer running → Live Activity shows the honest countdown + a **Stop** button (Lock Screen + Dynamic Island expanded).
2. User taps **Stop** → `StopTimerIntent` (a `LiveActivityIntent`) runs in the app's background process: computes `actualMin` from the timer's start + now, writes the log via the same path `useTimer`'s stop uses, ends the Live Activity. No app launch. (On a locked device iOS requires auth first — its built-in mis-tap guard.)
3. A **quiet local notification** fires: `"<task> — done. Add what happened →"`. Tapping it opens the app into that task's summary/nectar drawer (honest-vs-actual, honey already deposited, reason chips ready but optional).
4. Alternatively the user **taps the activity body** before/instead of Stop → opens the app into the live timer / summary directly.
5. If the user never taps either, nothing is lost: the duration was logged and the model trained; the task simply has no extra context yet, and can get it later from history.

**Edge: timer already over its honest finish when stopped** — same path; `actualMin` is just larger; overrun was already amber, no guilt.

## 5. Screens & states

- **Live Activity (Lock Screen):** the existing layout from spec 05 + a **Stop** button. Per HIG, one button. Place it so the live countdown digits and the honest-finish label stay readable; the Stop button must be visually distinct from the tappable body (the body deep-links to the app; the button stops). Use the existing WB colors; Stop is a quiet, secondary affordance, not an alarm-red — a bordered/secondary treatment in `WBInk`/`WBInkSoft`, never `danger`.
- **Dynamic Island (expanded):** Stop button in a button region (e.g. `.bottom` or `.trailing`); compact/minimal stay display-only (no button — too small, mis-tap risk).
- **Notification:** title `<taskLabel> — done`, body `Add what happened, or leave it. →`. (Humanizer/conversion pass at build — no guilt, optional framing.) Quiet (no sound for a routine finish), or respect the user's existing timer-notification settings.
- **Summary/nectar drawer (existing Reward surface):** must become **openable for an already-logged task** (deep link `whenbee://task/<id>` or `whenbee://reward?taskId=<id>`), pre-filled with the logged duration + honest-vs-actual, with reason chips optional and saveable after the fact.

## 6. Data model implications

- **No new "stop" data** — `actualMin` already flows through `applyLog`; the only change is the *trigger* (a background intent instead of the in-app stop button).
- **Reason/context must be attachable post-hoc.** Check whether `task_events` reason fields can be set on an existing row after creation. If the current Reward flow only writes reason at log-time, add a path to **update** a past `task_event`'s reason/context (no schema change if the columns already exist — `task_events` already carries reason capture; verify it can be re-written). This is the one real data-layer task.
- The stop intent and the in-app stop must funnel through **one** shared "finish timer" routine so the log is identical regardless of entry point (no logic fork between lock-screen stop and in-app stop). The boot reconcile from spec 05 already handles orphaned activities.

## 7. Native / build outline

- **`StopTimerIntent`** — a `LiveActivityIntent` (App Intents) in the widget extension; `perform()` runs in the app process: read the running timer (App-Group snapshot or the timer's `startEpoch`/`finishEpoch` already in `FinishTimeAttributes`), compute `actualMin`, invoke the shared finish routine (write log + end activity). It must NOT set `openAppWhenRun` (silent). Guard `@available(iOS 17.0, *)` for interactive buttons (the Live Activity itself is 16.2+; the **button** needs 17+ — pre-17 devices get the display-only activity, no Stop button, which is an acceptable graceful degrade).
- **JS bridge** — the finish routine the intent calls must reach `timerStore`'s stop/log path. Because the intent runs natively, this likely needs the native module to write a "stop requested" signal the JS app reconciles on next foreground, OR the intent calls into a registered App Intent that the RN side handles. Decide the mechanism at build (two viable patterns; pick one — see open questions).
- **Notification** — reuse the existing guarded `timerNotifications`/`expo-notifications` path; fire-and-forget, respect Expo Go stub.

## 8. Gating

The Stop control is **FREE** — it's controlling the timer itself, not a Pro payoff. (Per HIG: buttons should control "an essential part of the activity itself.") No paywall here.

## 9. Open questions (resolve at build)

1. **Intent → app-state mechanism:** does `StopTimerIntent.perform()` (running in the app process) mutate `timerStore`/DB directly, or write a signal the RN layer reconciles on next launch/foreground? A `LiveActivityIntent` runs in the app's process but not necessarily with the full RN runtime alive — confirm what's reachable from a background App Intent in this Expo setup. This is the central build risk.
2. **iOS 16.2 devices** (Live Activity but no interactive buttons until 17): confirm graceful degrade = display-only activity, stop only in-app. Acceptable.
3. **Notification cadence:** always fire after a lock-screen stop, or only when the app stayed closed? Avoid double-surfacing if the user opened the app anyway.
4. **Accidental-stop mitigation:** rely on iOS lock-screen auth + a distinct Stop affordance, or add a lightweight two-step (a "hold to stop" / confirm)? Lean on the OS guard first; revisit if testing shows mis-taps.
5. **Pause/Resume:** explicitly deferred. `timerStore` supports it; a fast-follow can add a second button if the single-Stop cut proves too thin.

## 10. Effort

Medium. The button + intent are small; the **risk is the intent→app-state bridge** (open question 1), which needs a device + a spike. The retroactive-enrichment data path is a small, well-bounded change. The notification reuses existing infra. All device-verified (cannot be tested in CI/sim).
