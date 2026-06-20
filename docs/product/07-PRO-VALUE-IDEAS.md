# 07 — Pro Value Ideas (what people will actually pay for)

*Built from three live research passes — review-mining (App Store / Play / G2 / teardowns), Reddit opportunity research (r/ADHD, r/adhdwomen, r/productivity, r/getdisciplined), and deep market research (competitor Pro teardowns + WTP studies) — run 2026-06-18, filtered through the `game-changing-features`, `conversion-psychology`, and `retention-optimization` frameworks. Every non-obvious claim carries a real source. The brief: find Pro value beyond calendar padding and raw statistics, exclude anything we already ship, and exclude the couples/partner layer (deciding separately).*

---

## The 5 hard truths the research agreed on

These came back independently from all three passes. They constrain *how* we monetize, before any feature list.

1. **"Pay to understand your own data" is the #1 hated pattern — and the #1 thing that converts when done right.** Bearable's loudest complaint is *"What is the point of the free version? Why is every feature behind a paywall?"* yet its correlation grid is also called *"worth every penny."* ([r/BearableApp](https://www.reddit.com/r/BearableApp/comments/z4awkx/), [Bearable reviews](https://apps.apple.com/us/app/bearable-symptom-tracker/id1482581097)). **Lesson: keep the whole guess→timer→learn loop free. Gate the *payoff and the depth*, never the sensor.** This is exactly Model B — the research validates it hard.

2. **This is the most subscription-hostile audience in productivity — and they say so by name.** *"A lot of people want to sell you subscriptions to magic apps that negate ADHD. They know you won't cancel ever."* ([r/ADHD](https://www.reddit.com/r/ADHD/comments/1byrzyt/)). The "ADHD tax" of forgotten subscriptions is a canonical pain ([ADDitude/adhdfriendly](https://adhdfriendly.com/when-adhd-meets-paid-subscriptions)); 74% of people forget recurring charges ([C+R 2022](https://www.crresearch.com/blog/subscription-service-statistics-and-costs)). **The $89 lifetime isn't a leak — it's the conversion tool**: it removes the "what if I forget to cancel" fear that stops this audience from ever starting. Lead with lifetime; monthly is the low-commitment trial, not the default.

3. **"It learns ME" is the strongest willingness-to-pay trigger in the whole space.** RISE's top praise: *"they used motion from my phone for 200 nights to find my rhythm… first time in my life I understand my energy"* ([RISE reviews](https://apps.apple.com/us/app/rise-sleep-tracker/id1453884781)). Whenbee's per-category multiplier *is* this — so Pro should sell **what the learned model unlocks**, not generic charts.

4. **No-guilt is a retention lever, not just ethics.** Tiimo's single most-praised trait is *"nothing turns red"* — and it won 2025 iPhone App of the Year partly on that ([Tiimo review](https://yourappland.com/tiimo-app-review/)). Forest's gentle "tangible consequence" motivates *without* shame ([Forest reviews](https://apps.apple.com/us/app/forest-focus-for-productivity/id866450515)). Every Pro idea below honors amber-never-red.

5. **Insight that resolves once will churn. Value must regenerate.** The risk with "you learned your multiplier, now you leave" is real. What retains a self-insight subscription: **(a)** insights that recompute with new data, **(b)** a *cadenced ritual* (weekly/monthly review) that buys a recurring moment not a fact, **(c)** a widening **data moat** (longer history = higher switching cost), **(d)** a **second audience** (coach/therapist) that re-justifies payment every appointment. Sunsama, Bearable, and Exist all retain on cadence + moat, not on a feature checklist.

**The biggest competitive flag:** **TimeNinja** is a near-verbatim clone of our wedge at $4.99/mo · $29.99/yr · $79.99 lifetime — but it's cloud-AI dependent. Our genuinely on-device, deterministic, no-network loop is the cleaner privacy claim. Differentiate on privacy + no-guilt + lifetime.

---

## The idea catalog

Tiered by confidence (how strongly the research backs people *paying* for it). Each: what it is · the evidence · why they pay *recurringly* · build effort · whether it's **NEW** or a **REFINEMENT** of something we have. None duplicates our shipped set; none is the couples layer.

### Tier 1 — Highest-confidence pay drivers (build these into Pro)

**1.1 — Clinician / coach / self PDF report ("bring this to your appointment")**
A clean, deterministic PDF/printout: estimation accuracy over time, per-category bias, time reclaimed — formatted to hand an ADHD coach, therapist, or psychiatrist.
- *Evidence:* Bearable's **#1 roadmap request — 228 votes — and the team itself flagged it as "likely a premium feature"** ([changemap](https://changemap.co/bearable-/bearable-roadmap/task/4070-pdf-export)). Daylio gates a therapy PDF and the segment that found Premium worth it were the ones *"using it in tandem with therapy"* ([Choosing Therapy](https://www.choosingtherapy.com/daylio-app-review/)). eMoods headlines clinician export. Highest-emotion praise in the category.
- *Why they pay recurringly:* needed at *every* appointment, not once; pulls in a second audience (the clinician) who re-justifies the subscription monthly.
- *Effort:* Medium (PDF layout; data already on-device). · **NEW**

**1.2 — "Honest Week" / monthly review (the cadenced ritual)**
A calm, deterministic recap surfaced on a schedule (Mon weekly, + a longer monthly): where your guesses landed, which categories tightened, your biggest time surprise, the time you protected.
- *Evidence:* Sunsama's weekly review and Bearable's reports are *the* retention mechanism — the subscription buys a recurring moment, not a datum. Exist: *"insights and trend info is the best part."* Closes the universally-voiced *"beautiful charts, zero actionable wisdom"* gap ([Medium](https://medium.com/@k4m1tsuki/5-5-years-of-mood-tracking-why-data-doesnt-equal-insight-67b624050b8b)).
- *Why they pay recurringly:* the value regenerates every week/month with new data; cadence = a reason to re-open.
- *Effort:* Low-Med (deterministic rollup; optional LLM phrasing later). · **REFINEMENT** (we have one-off Patterns cards; this packages them into a scheduled ritual surface)

**1.3 — Honest *range* / confidence band (P25–P75), not just a point**
Show "this usually takes 40–55 min" with a band that visibly **narrows** as you log more — instead of a single number.
- *Evidence:* TimeNinja's one marketed differentiator is exactly a "25–75% variability band" ([TimeNinja](https://www.timeninja.app/blog/what-is-adhd-time-blindness)); RISE proves an uncertainty-aware legible number drives behavior. The narrowing band makes the subscription *visibly compound* — the user watches it get more valuable.
- *Why they pay recurringly:* the band tightening over months is the felt proof the model is learning *them*; ties to truth #3 + #5.
- *Effort:* Medium (variance is already computable in the engine). · **REFINEMENT** of the honest number

**1.4 — Day-capacity / over-commitment honest check**
Sum today's honest numbers vs. the real hours you have, and flag — calmly, amber-not-red — when the day is physically over-packed. The no-guilt inverse of a streak.
- *Evidence:* the explicit reason ADHD users pay $20/mo for Sunsama: *"Most task managers make you feel behind. Sunsama warns you when you're overcommitted"* ([SaskADHD](https://saskadhd.com/sunsama-review-a-therapists-take-on-the-daily-planner-that-actually-works-with-your-brain/)). Turns per-task accuracy into a daily planning decision.
- *Why they pay recurringly:* used every planning session; the single most actionable thing the multiplier enables. **This replaces calendar padding entirely — same "will my day fit?" payoff, zero calendar access.**
- *Effort:* Medium (engine sum + UI). · **NEW** (related to the deferred capacity-warning, but as a standalone in-app check)

**1.5 — Persistent presence: lock-screen / Dynamic Island Live Activity + "it exists" widget**
Keep the running timer + honest finish visible without reopening the app, and a home/lock-screen widget that keeps the current/next task literally on screen.
- *Evidence:* the deepest Reddit pain — *"if I can't see it, it might as well have been erased from the timeline"* (out-of-sight = out-of-mind is the **#1 reason their to-do apps fail them** — [r/ADHD](https://www.reddit.com/r/ADHD/comments/myf2aj/)). The most-begged Llama Life convenience is a timer that stays visible after leaving the app. Widgets are a documented retention driver (ambient daily touchpoint).
- *Why they pay recurringly:* ambient, used dozens of times a day; the value lapses the moment they stop paying.
- *Effort:* Med-High — **but the `WhenbeePresence` widget/Live Activity module is already scaffolded** (`docs/NATIVE-PRESENCE.md`). This is the killer consumer reason to finish it. · **REFINEMENT** (finish the scaffolded native presence, gate the rich version)

**1.6 — ~~Read-only calendar import~~ — CUT (2026-06-19)**
*The founder dropped all calendar involvement — no write, no read, no import, no EventKit, no calendar permission. The "see my whole day" value is carried instead by the in-app day-capacity check (1.4) over planned/Plan-tab tasks, plus routines (2.1).*

### Tier 2 — Strong, evidence-backed, build next

**2.1 — Routines / multi-step sequences with a learned honest total**
Chain steps ("morning routine", "leave for work") and learn the honest time of the *whole chain*, not just one task — with a single honest "you need to start by…".
- *Evidence:* the real unsolved gap — *"ADHD makes normal routines an 800-step process… always sounds quicker than it is"* ([r/ADHD](https://www.reddit.com/r/ADHD/comments/1hj42un/)); chronic lateness is the relationship wound. TimeNinja, Tiimo, Numo all ship Routines, and Tiimo's *removal* of timed routines drew angry reviews. · *Why pay:* used daily for the highest-stakes lateness moments. · *Effort:* Med-High. · **NEW** (extends per-task learning to ordered chains)

**2.2 — Long-range history & re-openable report archive**
Free keeps recent history; Pro unlocks unlimited history, season-over-season views, and re-opening past weekly reviews.
- *Evidence:* the exact lever Bearable uses (gates 30d vs 60/90/365d). · *Why pay:* the **data moat grows every month** — switching cost compounds (truth #5c). · *Effort:* Small (gating + longer queries). · **NEW**

**2.3 — Hyperfocus guardrail (soft, no-guilt overrun nudge)**
Optional gentle escalating presence when a running task passes its honest number by a chosen margin ("you've been here 2× your guess — surface, or keep going?"). Dismissible, never red.
- *Evidence:* getting *out* of a task is a top pain — *"I look up and it's 7:30"*, forgetting to eat ([r/ADHD](https://www.reddit.com/r/ADHD/comments/1d2sov4/)). The honest number is the perfect personalized trigger no other app has. · *Why pay:* the safety net that makes hyperfocus survivable — an ongoing protective service. · *Effort:* Low-Med. · **REFINEMENT** (this is session-1's idea 2.5, finally built)

**2.4 — Focus-window planner (energy / medication-aware day shaping)**
User marks their daily good-hours window (e.g. 9–12); Pro fits the honest-numbered tasks inside it and flags what won't. Deterministic; stores only a local time range, no health data.
- *Evidence:* strong, specific demand — *"anyone else only get ~3 good hours out of meds, then it falls off a cliff?"* ([r/adhdwomen](https://www.reddit.com/r/adhdwomen/comments/17f1u5v/)). Nobody helps them spend that window well. · *Why pay:* re-run daily around a deeply personal, shifting window. · *Effort:* Med (constrained bin-pack over honest numbers). · **NEW**

**2.5 — Per-category goals / experiments**
Set a deterministic, no-guilt accuracy target per category ("tighten admin estimates 20%") and watch progress.
- *Evidence:* Bearable gates Goals + Experiments behind Pro; a goal is never "done" — met ones get replaced. · *Why pay:* gives a forward reason to keep logging *after* the multiplier is learned (directly fights insight-churn). · *Effort:* Med. · **NEW**

**2.6 — Optional "Estimate Coach" — LLM prose layer over deterministic insight**
The numbers stay on-device and deterministic; an *optional* LLM turns them into plain-language "why" ("your estimates tightened on admin but slipped on creative work this month"). Can be its own upsell tier.
- *Evidence:* coaching prose is the #2 most-praised insight format; a study (PMC7585773) found chart + plain-language beats either alone; Stoic charges a separate AI add-on. · *Why pay:* prose regenerates monthly; optional add-on revenue. · *Effort:* Med — **guarded network call, never in the core loop; honors the on-device-math invariant.** · **NEW (optional)**

### Tier 3 — Worth exploring / cheap goodwill

- **3.1 Day Ledger — "here's what you actually did today"** (proof-of-effort record, never a deficit). Kills *"WTF where did the time go, what did I even do?"* ([r/adhdwomen](https://www.reddit.com/r/adhdwomen/comments/1bdt7c4/)). Keep distinct from the Reclaim bank: this is *what I did*, not *what I saved*. · **NEW**, Low-Med.
- **3.2 Custom categories / sub-splits beyond the free set** (split "writing" → "email" vs "deep work", each with its own bias). Daylio/Bearable gate custom measurements. Each new category restarts a calibration journey = fresh value + bigger moat. · **NEW**, Small-Med.
- **3.3 Brain-dump capture inbox with honest triage** — one-tap "get it out of my head" → unscheduled inbox → auto-attach an honest estimate. Kills the **2.4K-upvote wish** *"an app that takes the mental load of remembering everything off me"* ([r/ADHD](https://www.reddit.com/r/ADHD/comments/1o01xfa/)) without adding an input chore. · **NEW**, Med (optional LLM voice capture off-loop).
- **3.4 Full data export (CSV/JSON)** — *"your data is yours."* Begged across Akiflow (*"biggest complaint: no export"*). Less a recurring driver, more a yearly/lifetime trust-closer that reduces cancel-anxiety. · **NEW**, Small.
- **3.5 Cosmetic personalization** (companion auras/palettes/icons; seasonal drops). Finch/Tiimo/Structured all monetize cosmetics in this audience — cheap, sticky, fully no-guilt. **Hard rule:** cosmetic only — never touches honey/tier/capability (existing invariant). · **NEW**, Small.
- **3.6 Apple Watch companion** — start the one-tap timer + glance the honest number from the wrist. Requested for Llama Life. · **NEW**, High effort.
- **3.7 "Just tell me what to do next" mode** — one button picks the next task by honest-fit to time-left. Maps to the literal wish *"an app that told me what to do"* ([r/adhdwomen](https://www.reddit.com/r/adhdwomen/comments/1k31mp4/)). Strong for initiation paralysis (the #1 pain) — but consider whether the *basic* version belongs in the free core loop (activation) with the *smart* version Pro. · **NEW**, Low-Med.

---

## Recommended Pro definition (what to actually charge for)

Pulling the highest-confidence, lowest-backlash, most-compounding items into one coherent Pro that **never gates the core loop**:

> **Whenbee Pro = the payoff layer on top of free calibration:**
> 1. **See if your day will actually fit** — in-app day-capacity check (1.4) over your planned/Plan-tab tasks. *The calendar payoff, with zero calendar access.*
> 2. **Honest ranges + presence** — confidence band that narrows (1.3) + persistent lock-screen/widget presence (1.5).
> 3. **The cadenced mirror** — Honest Week / monthly review (1.2) + long-range history (2.2).
> 4. **Take it with you** — clinician/coach/self PDF export (1.1).
> 5. **Stay ahead** — routines with learned totals (2.1) + hyperfocus guardrail (2.3) + focus-window planner (2.4).

That bundle hits all five research truths: keeps the loop free, sells what the model *learns about you*, compounds (ritual + moat + narrowing band), brings a second audience (clinician), and respects no-guilt throughout. The existing Pro correlations ("what steals your time", accuracy, context) slot in as part of "the cadenced mirror."

**This makes Pro stand on its own with NO calendar at all** (decision 2026-06-19) — the capacity check + routines + ranges carry the "will my day fit?" value with zero calendar access. Calendar code removal is tracked as B2 in [02-GAP-ANALYSIS](02-GAP-ANALYSIS.md).

---

## Pricing & packaging (from the WTP evidence)

- **Anchor at/below TimeNinja:** keep $4.99/mo · $34.99/yr, and **lead with $89 lifetime** — this exact audience asks for lifetime by name and treats ADHD subscriptions as predatory. Lifetime converts the cancel-anxious who'd otherwise never start.
- **Keep the whole guess→timer→learn loop + a real taste of the honest number free.** Bearable holds a ~4.7 rating with a 30-day free correlation window while gating depth — generous free + gated depth is the goodwill model.
- **Avoid every documented landmine** (all drew 1★ "greedy"/"scam" backlash): no looping upsell pop-ups (Tiimo), no card-before-value (RISE), no hidden cheap tier under a default-expensive one (RISE), ship a pre-charge reminder + 2-tap cancel (Inflow's $1,000 horror story), and **never move a shipped free feature behind the wall** (Forest "rug pull").
- **Lean on the privacy claim TimeNinja can't make:** genuinely on-device, deterministic, no network in the loop. This audience says on-device utilities are exactly what they trust and pay once for.

---

## Open decisions / next steps

1. **Calendar stance — RESOLVED (2026-06-19): dropped entirely.** No write, no read, no import. Capacity check + routines carry the value. Code removal tracked as B2 in [02-GAP-ANALYSIS](02-GAP-ANALYSIS.md).
2. **First Pro build order** — recommend **1.1 PDF export + 1.2 review ritual + 1.4 capacity check + 1.3 confidence band** as the opening Pro that's validated, compounding, and largely reuses existing engine output.
3. **Optional LLM Estimate Coach (2.6)** — decide if/when to add as a separate add-on tier; keep it strictly off the core loop.
4. Re-validate with your own funnel once live: does the paid cohort actually return for the weekly review? (PostHog — the cadenced-ritual return is the retention signal that matters.)

*Sources are inline. Research agents: review-mining, reddit-opportunity-research, deep-research (live web, 2026-06-18).*
