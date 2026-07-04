# 2026-07-04 — User Validation, 10x Moves, and Build-Truth Audit

*Session synthesis. Two live-web research passes (ADHD/time-blindness app sentiment + planning-fallacy demand) run fresh against the repo's own 2026-06 research, plus a code-verified audit of what is actually built vs. what the docs claim. Skills applied: niche-research, game-changing-features, conversion-psychology, humanizer, retention-optimization, market-research-expert, customer-research, reddit-opportunity-research.*

---

## 1. Verdict — would users actually like/use it?

**Yes, conditionally.** Demand is strong and multi-segment, the wedge is real but closing (two live clones now), and the product lives or dies on three things:

1. **Land the multiplier aha in session 1** (~50% of convert/cancel happens Day 0). Day-1 priors do this — protect them.
2. **Make data capture survive a forgetful brain.** The biggest under-weighted risk: the whole value needs logged actuals, but the target audience is definitionally bad at remembering to start/stop timers (*"came back hours later, forgotten what I was timing"*). Forgiving/automatic timing is survival, not polish.
3. **Never let the honest number sound like an accusation.** The audience named the detonator: *"AI estimates 7 min, you took 9 — what's the problem?"* Descriptive, never evaluative. Highest-risk copy surface in the app.

## 2. Demand — strong, multi-segment, culturally named

- Pain expressed unprompted across communities: *"I constantly underestimate how long things take. I started adding 15 minutes… still late most of the time."*
- **Killer signal:** people already hand-build Whenbee's multiplier ("just double it," "add 20%") and report it fails — *because bias is per-category*, not a flat fudge factor. Whenbee automates the exact hack thousands describe.
- Established, searchable vocabulary = marketing/ASO gift: "time blindness," "time optimist," "planning fallacy," Hofstadter's Law, "5 minutes or 5 years."
- Segments (lead ADHD, expand outward): (1) ADHD/neurodivergent — most acute, self-identifying, already paying; (2) software developers — estimation is a known professional pain with career/money stakes; (3) freelancers/consultants — underestimating = undercharging, an ROI purchase; (4) general planning-fallacy population — broadens the market; (5) students.
- WTP proven adjacent: Tiimo 50k paying subs (~$100k/mo), Llama Life *"I regret not buying lifetime,"* devs/freelancers already pay for estimate-accuracy.

## 3. Competitive — wedge is closing

Two same-thesis clones now shipping:
- **TimeNinja** — near-verbatim clone at $4.99/mo · $29.99/yr · $79.99 lifetime. Ships **streaks** (RSD churn trigger), cloud-AI, iPhone-only.
- **TimeBoxer** (iOS, Dec 2025, $4.99/mo) — markets on "estimation accuracy," and hands us our own conversion testimonial: *"I went from completing 45% to 85% of my plan — not because I got disciplined, but because I stopped planning based on fantasy."*

Differentiate on **no-guilt + genuine on-device privacy + whole-day depth + no surprise-bill**, not price. Add a dedicated TimeBoxer teardown to the watchlist. Monitor both changelogs monthly.

## 4. Low-hanging fruit to 10x (ranked)

1. **Marketing/onboarding hook = the failed hand-multiplier** (copy-only, highest leverage). See §8.
2. **Kill the capture-failure mode** — retro log-from-memory, "still on this?" nudge, quick-start. Some built; make it the spine.
3. **No-streak positioning made explicit** (copy-only) — named contrast vs TimeNinja/Tiimo.
4. **Shareable "time personality" archetype card** — free acquisition. (Archetype share IS built; Start-By plan share is dead code — see §10.)
5. **Insight→action bridge** (first-smallest-step, if-then triggers, gentle hyperfocus interrupt) — cheap, on-brand, targets insight-churn. Ship basics free.
6. **Confidence band that visibly narrows** — felt compounding value. (Built — surface the narrowing more.)

## 5. Pro vs Free — the calls

Model B (loop free, gate the payoff) is correct — live research says "pay to understand your own data" is the #1 hated pattern; gate the payoff, never the sensor.

**Keep FREE:** whole guess→timer→learn loop, honest number all categories, Patterns free tier, Start-By planner, **day-capacity check** (currently mis-gated to Pro — see §10), basic widget/Live Activity, archetype share. **Voice/natural-language task entry → FREE** (it feeds the engine = activation = D7; gating it would starve the model). **"What do I do next?" basic → FREE** (initiation paralysis is the #1 pain).

**Pro bundle (endorsed):** PDF export, review ritual, confidence band, rich persistent presence, routines, long-range history, hyperfocus guardrail, focus-window planner, per-category goals, correlations. **Add: Time Receipts** (billable export → Pro, reaches prosumers, ROI framing, absent today). **Add: opt-in E2E backup/sync → Pro** (kills data-loss anxiety).

## 6. Making Pro better (ranked by what regenerates value)

1. **The cadenced weekly "Honest Week" ritual = retention spine.** Make it a *moment* — *"this week you protected 47 minutes; admin tightened, creative slipped."* Buys a recurring moment, not a fact.
2. **Confidence band that narrows over months** — the felt proof it's learning *them*.
3. **Clinician/coach PDF** — a second audience re-justifies the sub every appointment.
4. **Data moat (long-range history)** — switching cost grows monthly.
5. **Optional on-device AI reflection** (prose over deterministic numbers, never in the loop) — AI apps monetize ~2× ARPU. Optional upsell.

**Pricing:** hold $34.99/yr, lead with **$89 lifetime** (audience asks for lifetime by name). Avoid every documented landmine: no paywalled basics, no trial-to-annual traps, no free-tier rug-pulls.

## 7. Notification evaluations (code-verified)

**Idea A — "guess ended" ping: the smart version is already built.** Ping #1 `scheduleTimerDone` (`timerNotifications.ts:100`) fires at the honest finish (`start + suggestedHonestMin`) — which is where the visible ring's countdown ends and overrun begins — with no-guilt copy (*"You're near the finish / log it when done"*), opt-in. Firing at the *raw guess* instead would cry wolf on every task (the app knows the guess is too optimistic) — advise against. **Real gap = discoverability:** master `remindersEnabled` is OFF by default, so most users never see it. Fix = a well-timed soft-ask, not a new ping.

**Idea B — routine/plan start reminders: split.**
- **Routines: fully built (Pro)** — `scheduleRoutineAlerts` fires weekly at `startBy − leadMin` (*"Start {routine} now to finish on time"*). Just needs device verification.
- **Day-plan "time to start" nudge: BUILT BUT ORPHANED.** `scheduleStartBy` (`timerNotifications.ts:163`) is fully formed (copy, category, snooze) and a settings toggle exists — but **nothing calls it** from plan activation; the toggle is inert. Fix = one call site (`scheduleStartBy` on plan activate + `cancelStartBy` on clear) + a copy bug (settings labels it *"when your honest week is ready"* — wrong feature, `settings.tsx:383`). High value: the "start now / leave now" moment is where days break and this audience begs for it. Keep opt-in, snoozeable, silent-if-missed.

## 8. Copy drafts (A) — the failed-multiplier hook

*Draft; needs voice approval + rendered screenshot pass before shipping. Prices must render from RevenueCat, never hardcode.*

**Onboarding**
- Screen 1 — *"This'll take twenty minutes." Then it eats your whole afternoon. And the thing you dreaded all week? Done in ten. Your internal clock has two settings: five minutes, or five years.*
- Screen 2 — *Doubling it doesn't work. You already try. Add fifteen minutes. Pad every guess. You're still late, because you don't run over by the same amount on everything. Errands slip a little. Writing blows the doors off. One rule can't catch both.*
- Screen 3 — *So Whenbee learns your number. Guess, tap start, go. Every time you finish, it sees how your guess and the real clock lined up for that kind of task. Then it hands you the honest time before you commit next time. **You don't track anything. It just learns.*** [Start]
- No-guilt line: *No streaks. Nothing turns red. The number is just information, never a grade.*

**Paywall (`make_day_honest`)**
- *Make your whole day honest. You've felt it work on one task. Pro points the same honest number at your whole day, your routines, and the week behind you.*
- Rows: *A range that tightens* · *Your Honest Week (a calm Monday recap, no scores)* · *Keep the timer on your lock screen* · *Routines that know their real total* · *See what quietly steals your time* · *Export a clean report for your coach or therapist.*
- Lead lifetime: *Pay once. No subscription to forget, ever.*
- Trust: *Free for 7 days. We'll remind you before anything is charged. Cancel in two taps. Your data stays on your phone — we can't read it.* [Try Pro free]
- Share caption: *"Turns out I'm a Time Optimist. I think everything takes twenty minutes. Whenbee finally told me the truth."*

## 9. Build-truth table (code-verified 2026-07-04)

| # | Feature | Verdict | Note |
|---|---------|---------|------|
| 1 | RevenueCat + `pro` gating | **BUILT** | `purchases.ts:47/113`, `useEntitlement.ts:31`. |
| 2 | Pricing from RC priceString | **BUILT** | No hardcoded prices in `src/`. Invariant honored. |
| 3 | 3 SKUs + picker order | **BUILT** | `PlanPicker.tsx:23/109` ordered by duration tag. |
| 4 | Trial + restore + manage + pre-charge copy | **PARTIAL** | Works — but **paywall has NO Terms/Privacy links** (App Store rejection risk). |
| 5 | Paywall + triggers + ProGate | **BUILT** | All triggers wired. |
| 6 | PDF report export | **BUILT** | `print.ts:38`, Pro-gated, real data. |
| 7 | Honest Week review ritual | **BUILT** (monthly PARTIAL) | Weekly notif only; monthly recap surfaces only if opened on the 1st. |
| 8 | Confidence band (P25–P75, narrows) | **BUILT** | `confidence.ts:91`, Pro-gated on all surfaces. |
| 9 | Day-capacity check (should be FREE) | **PARTIAL — mis-gated to Pro** | `CapacityChip.tsx:62` hides it behind Pro; one-line fix. |
| 10 | Persistent presence | **Android BUILT / iOS PARTIAL** | iOS Swift+widget written but NOT build-wired: `@bacons/apple-targets` missing from `app.json` plugins, no App-Group entitlement → degrades to stub. Android real & linked. |
| 11 | Routines w/ learned total | **BUILT** | Full loop + weekly alerts. No "Run" affordance on the list itself. |
| 12 | Long-range history depth gate | **ABSENT** | Binary report-lock, not the graduated free-window/Pro-deep gate the docs imply. |
| 13 | Hyperfocus guardrail | **BUILT** | `guardrail.ts:13`, Pro, default off. |
| 14 | Focus-window planner | **PARTIAL** | Learned hours built; the "3rd plan mode" packer (`fitFocusWindow`/`promoteIntoWindow`) is dead engine code, no UI consumer. |
| 15 | Per-category goals | **BUILT** | Full UI↔store↔engine loop. |
| 16 | Correlations (steals/accuracy/context) | **BUILT** | All 3 Pro-gated. Only `energy` context has a capture UI; sleep/meds dormant. |
| 17 | On-device share | **PARTIAL** | Archetype share built; **Start-By plan share is dead code** (renders, no trigger). |
| 18 | Time Receipts / billable export | **ABSENT** | Greenfield. |

## 10. Surprises — docs claim built, reality isn't

1. **iOS persistent presence not build-wired** (#10) — the Pro pillar; iOS degrades to no-op. Config gaps: missing `@bacons/apple-targets` plugin + App-Group entitlement (also needs paid Apple team). Android is genuinely complete.
2. **Day-capacity gated to Pro, should be free** (#9) — contradicts the 2026-06-21 decision. `CapacityChip.tsx:62`.
3. **Paywall missing Terms + Privacy links** (#4) — known App Store rejection trigger (launch-blocker doc).
4. **Long-range history depth gate doesn't exist** (#12).
5. **Start-By plan share unwired** (#17) — dead code.
6. **Start-By plan START notification unwired** (§7) — `scheduleStartBy` orphaned; settings toggle inert + mislabeled.
7. **Focus-window "3rd plan mode" packer is dead engine code** (#14).
8. **Correlations sleep/meds dormant** (#16) — only `energy` capture exists.
9. **Monthly review cadence partial** (#7).

## 11. Resulting action backlog (for planning)

- **Must-fix before submission:** paywall Terms + Privacy links (#4); un-gate day-capacity to free (#9, one-line).
- **Small wins, high value:** wire Start-By plan start-notification + fix its settings copy (§7); wire Start-By plan share (#17); reminders soft-ask for discoverability (§7).
- **Bigger:** iOS presence build-wiring (#10, needs paid team); focus-window 3rd plan mode UI (#14); monthly review notification (#7); long-range history depth gate if wanted (#12).
- **New Pro:** Time Receipts billable export (#18); opt-in E2E sync.
- **Capture-failure fixes** and **honest-number descriptive-not-evaluative audit** — queued.

*Sources: live web research 2026-07-04 (Reddit r/ADHD, r/adhdwomen, r/productivity, r/ProductivityApps, r/finch; App Store/Play reviews for Tiimo, Structured, Routinery, Sunsama, Akiflow, Motion, Amazing Marvin, Llama Life, TimeHero, Forest; TimeNinja, TimeBoxer); repo docs 03/04/07/10; code audit of `src/` at commit on branch `main`.*
