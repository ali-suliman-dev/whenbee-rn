# 12 — Widget & Presence Strategy (lineup + free/Pro split)

> **Status:** ✅ APPROVED by founder 2026-07-03 (both the paywall refinement in §5 and the build order in §6). Written from two web-research passes (competitive widget lineups; widget/presence monetization) + the `retention-optimization` and `monetization-strategy` skills. Not yet built beyond the current single Android widget + the live-timer notification (see `docs/NATIVE-PRESENCE.md`). Build order note from founder: **do not drop W1 Live Focus** — it stays a first-class item (already shipped on Android; iOS = existing `FinishTimeActivity`).
>
> **Trigger:** the shipped single "next task" widget feels dead — it shows one static thing and barely updates. This doc defines a real lineup and the free-vs-Pro split. It **refines** (does not silently override) the LOCKED paywall thesis in `03-RETENTION-MONETIZATION.md` / `specs/05-persistent-presence.md` — see §5.

Honors the product invariants throughout: **no guilt, no streaks, amber-never-red, on-device-only core loop, pricing from RevenueCat.**

---

## 1. Why the current widget is "dead" (diagnosis)

The shipped widget hits the single most-cited widget failure mode:

- **It's effectively a launch button showing one static item.** AndroidPolice: *"If the widget's primary job is to launch the app, it hasn't earned its place."* MacRumors users call this pattern *"useless blown-up app icons."*
- **It barely changes.** It repaints only when the app writes a snapshot (on a focus-task change) plus Android's **30-minute** background floor. NN/g: widgets are *"ideal for tracking frequently changing information"* — static data reads as broken.
- **It shows the least-differentiated thing** (a task title), which is exactly where Todoist/Things/Fantastical already dominate.

Three success criteria the research converges on — a widget earns its slot only if it: (1) shows data that **changes**, (2) is **complete at a glance**, (3) reflects **progress/state** or lets you **act in one tap**. The memorable apps also lead with a **distinctive at-a-glance visual**, not a plain list (Timepage Heatmap, Opal Focus-Score %, Structured Energy Monitor, Streaks ring+dots).

---

## 2. What successful apps do (the pattern)

Standout apps ship a **family of widgets keyed to distinct jobs**, sized to the job — not one hero card. Counts range from focused (Todoist ~3, Structured 4) to sprawling (TickTick ~15, Fantastical ~16).

| Job | Size | Nailed by |
|---|---|---|
| Single next thing | S / lock | Fantastical Up Next, Things Today |
| Today / agenda | M/L | Structured Timeline, Fantastical, Things Up Next |
| Stats / progress (one number/gauge) | S/M | Opal Focus-Score %, Todoist Karma, fitness rings |
| Streak / heatmap | S | Timepage Heatmap, TickTick Habit Heat Map, Duolingo |
| Quick-add / action | S | Todoist / TickTick Quick-Add |
| Collection / list | L | Todoist, Things, Reminders |
| **Live in-progress** | Live Activity / Dynamic Island | **Flighty**, Session, Apple/Google Clock |

Cross-cutting rules from the research:
- **Map size to job** — Small = one number / next thing; Medium = agenda or action row; Large = collection. Don't scale one layout across S/M/L.
- **Live/in-progress state belongs in a Live Activity, not a widget** (Apple's own guidance). A running timer is a Live Activity; slowly-changing data is a widget.
- **Teach installation in-app** (Duolingo ships Lottie guides) — widget discoverability is a real adoption ceiling.
- **Closest analog to Whenbee = RISE:** it puts a *learned, personal, time-varying number* (sleep debt, energy left) on the home screen and it's sticky with zero interaction. That's the lane to own.

### Update-cadence reality (design around this)
- **iOS WidgetKit is not live** — you supply a timeline of pre-rendered entries (~40–70 refreshes/day budget, entries ≥5 min apart). Whenbee's honest-number/capacity data changes on a minutes-to-hours granularity, which fits comfortably: re-render as "now" crosses each task's honest-finish threshold. Fully offline.
- **Android AppWidget** — `updatePeriodMillis` floor is 30 min and unreliable; push updates from the app on real events (task complete, plan change, day rollover) and via WorkManager (15-min min). Our native RemoteViews widget already updates on the app's `writeWidgetSnapshot` — we must call it on **more events** than just focus change.
- **Interactivity is discrete-action-only** (iOS 17+ AppIntent Button/Toggle; Android PendingIntent/Glance Action). Home widgets ≈ glance + one simple intent; save rich interaction for Live Activities / Control widgets.

---

## 3. Recommended lineup — lead with the honest number

Whenbee owns a number nobody else has: the **honest number** (your realistic finish, learned from personal per-category bias). Generic to-do widgets are a race to the bottom; every widget below leads with calibration/honesty.

### Tier 1 — build first (this IS the differentiation)

**W1 · Live Focus** — Live Activity (iOS) / Live Update (Android, **already built**)
- *Surface:* auto-starts on the one-tap timer, auto-dismisses on stop (Flighty/CARROT lifecycle).
- *Shows:* elapsed vs the **honest** estimate as a progress read; compact = honest time remaining. When the user passes their *guess* but is still inside the *honest* number, it stays calm and amber-free — **"still on your honest pace"** — the anti-guilt reframe only Whenbee can make.
- *Why:* correct home for live state; showcases calibration in the moment; strongest low-fatigue re-engagement channel.
- *Tap:* opens timer; inline pause/resume if/when that UI ships.

**W2 · Honest Finish** — small + Lock Screen (+ StandBy on iOS)
- *Shows:* next/current task + the line no other app can produce — **"Honestly done ~4:35 PM"** with a quiet **"you guessed 3:50."** Circular lock = a ring filling toward the honest finish.
- *Why:* purest expression of the unique number; cheapest to build; RISE-proven stickiness; fully offline. **This is the current widget, done right + actually updating.**
- *Tap:* opens the task / Today.

**W3 · Does Today Fit?** — medium (S variant possible)
- *Shows:* today's tasks summed at their **honest** durations vs hours left in the day → one verdict: **"Your day fits — ~40 min slack"** or gently **"Runs ~25 min long honestly."** A slim capacity bar. Whenbee's signature at-a-glance visual (its Heatmap/Score equivalent). Never red, never a scold.
- *Why:* answers the exact question the app exists for, before the user overcommits. Highly differentiated. Ties to `specs/04-day-capacity-check.md`.
- *Tap:* opens Today / plan.

### Tier 2 — fast follow
- **W4 · Your Bias** (S/M) — **"Deep Work: you run 1.4× over"** with the honey/maturity tier as a subtle mark; medium rotates top 2–3 categories. Identity-level "huh, that's me" re-engagement; guilt-free self-knowledge. Opens Patterns.
- **W5 · One-Tap Guess** (S) — a single "New guess" button feeding the core loop (Quick-Add pattern). Support widget, not a headliner. AppIntent → add-task/guess sheet.

### Tier 3 — later
- **W6 · Accuracy Trend** (M) — guess-vs-actual gap shrinking as a sparkline, framed **"getting sharper"** (never a streak/miss-count). Opens Patterns / Honest Review.
- **W7 · Honest Week** (M/L) — calm week strip, planned-honest vs actual per day; ambient hook into the Pro Honest Review ritual. Leans on a Pro surface — gate accordingly.

### Deliberately NOT first
A generic agenda/task-list widget — saturated turf (Todoist/Things/Fantastical). Whenbee should not open on that ground.

---

## 4. Free vs Pro — gate the depth, never the doorway

The profitable pattern across Flighty, Widgetsmith, TickTick, and RevenueCat's freemium data is **free surface / Pro depth**. Nobody successful hard-gates a *basic* widget in a freemium consumer app — the widget is too valuable as a free retention + organic-discovery surface.

| Surface | FREE (hook / retention) | PRO (payoff / depth) |
|---|---|---|
| Home-screen widget | **W2 Honest Finish** (1 basic) | **W3** Does-Today-Fit, **W4** Your-Bias, **W6** Accuracy, **W7** Honest-Week |
| Live timer (active session) | ✅ **W1** full live presence | richer / more-timely variant |
| Ambient presence (between timers) | — | ✅ always-on day-capacity / pace read |

**Why W2 + the live timer are free:**
- Widgets measurably lift retention — a home-screen touchpoint for the **free** users most at risk of churning — and are the organic-growth surface (App-Store screenshots, "check out my home screen").
- In-progress Live Activities are **table-stakes** for a timer app and show large 30-day-retention lift (vendor data — directional). Gating the live action kneecaps the free base.
- RevenueCat: freemium vs hard-paywall retention converge within ~12 months; aggressively gating the doorway buys a short conversion spike that evaporates. The money is in the **depth**.

**Upsell (conversion-psychology; no dark patterns, no guilt):**
- The widget **gallery** renders the Pro widgets with the user's **real** data, tagged "Pro" — value shown before purchase (reverse-trial logic), not something they must imagine.
- Once the model is mature enough to *have* a day-capacity/confidence read, add one quiet line in the free widget — e.g. *"Day capacity — unlock in Pro"* — teasing the value's **position** without revealing the number. Respect the pro-gate-leak rule: hide the number **and** its marker.
- Never guilt/shame: the tease is *"here's more honest signal you've earned,"* never *"you're behind."*

---

## 5. Relationship to the LOCKED paywall thesis (decision needed)

`03-RETENTION-MONETIZATION.md` / `specs/05-persistent-presence.md` currently file **"persistent presence" wholesale under Pro.** This doc's research recommends a **refinement**:

- **Keep FREE:** one basic widget (W2 Honest Finish) + the live-timer presence during an active session.
- **Keep PRO:** the rich/multiple widgets (W3/W4/W6/W7) + **ambient** always-on presence *between* timers.

i.e. split **live-action (free)** from **ambient-depth (Pro)**. This is the Flighty model ("Pro = live variants + more timely + richer") and is the profitable version. **This changes a LOCKED decision — founder's call before any build.**

---

## Build status (updated 2026-07-04)

**Built (Android, PR `worktree-widget-lineup`):** W1 Live Focus (notification, prior branch) · **W2 Honest Finish** now live-updating (free) · **W3 Does Today Fit?** (Pro) · **W4 Your Bias** (Pro). All Pro-gated at source (value+marker).

**Remaining (not built):** W5 One-Tap Guess (Tier 2, free) · W6 Accuracy Trend (Tier 3, Pro) · W7 Honest Week (Tier 3, Pro) · **iOS parity** for the whole family (WidgetKit in `targets/widget/`, deferred — needs a paid Apple team to device-test). See also `docs/NATIVE-PRESENCE.md` → "Remaining widgets — NOT built yet".

## 6. Build order (once approved)

1. **Upgrade the current Android widget → W2 Honest Finish done right**, and **broaden its update triggers** (write the snapshot on task complete, plan change, and day rollover — not only focus change), so it stops looking frozen.
2. **W3 Does Today Fit? (Android)** — the signature glance; reuses `04-day-capacity-check` logic.
3. **iOS parity** for W1/W2/W3 (WidgetKit timelines + the existing `targets/widget` extension; needs a paid Apple team to test on device).
4. **W1 Live Focus** — already shipped on Android; iOS Live Activity is the existing `FinishTimeActivity.swift`.
5. Tier 2 (W4 Your Bias, W5 One-Tap Guess), then Tier 3.
6. **In-app "add the widget" teach** (a short guide) — discoverability is a real ceiling.

---

## 7. Sources (research passes, 2026-07-03)

Competitive lineups: Structured, TickTick, Todoist, Things 3, Fantastical, Sunsama, Timepage, Streaks, Habitica, Waterllama, Session, Forest, Finch, Opal, Flighty, RISE, Apple/Google Clock, CARROT — via app help docs, MacStories/9to5Mac/TidBITS/TechRadar, Apple HIG (Widgets / Live Activities), Android widget docs, NN/g, Duolingo widget case study.

Monetization: Flighty (free widgets, Pro = live/timely), Widgetsmith (free shell, premium data/personalization), Fantastical (paid power-tool), Streaks/TickTick (widget free, depth paid), RevenueCat State of Subscription Apps + freemium playbook, Live-Activity retention stats (EngageLab/Pushwoosh — directional), widget-retention (Studio Mosaic / Branch).
