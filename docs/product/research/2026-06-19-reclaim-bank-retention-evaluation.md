# Reclaim Bank — Retention Evaluation & Alternatives

*Date: 2026-06-19 · Research + strategy deep-dive. Evaluates whether the "Reclaim Bank" accumulating counter is the right retention mechanic to keep, reframe, or replace. Read alongside the locked model in [../03-RETENTION-MONETIZATION.md](../03-RETENTION-MONETIZATION.md).*

> **Skills driving this doc:** deep-research, market-research-expert, customer-research, reddit-opportunity-research, conversion-psychology, game-changing-features (10x). Three parallel web-research streams (retention psychology, competitor teardown, Reddit user-voice) with sources cited inline.

---

## TL;DR — the verdict

**Keep the bank. Do not delete it. But it is mis-cast and mis-worded today — fix both.**

1. **The bank is not your retention engine and was never going to be.** As a pure lifetime-only counter it has *no goal gradient* (no ceiling to approach) and *no loss-aversion hook* (it can't go down) — the two mechanisms with the strongest causal retention evidence. It will *correlate* with retained users (they log more, so their number is bigger) without *causing* their retention. Betting stickiness on it is the cargo-cult trap.
2. **What it IS good for:** a *switching-cost / endowment artifact* — visible proof of self-built history that makes leaving feel like throwing away work (IKEA effect). That protects D30+ churn *passively*. It does not bring anyone back daily. Keep it for that, and stop asking it to do more.
3. **The word "reclaimed" is your biggest risk.** Your core audience (ADHD / time-blind, skeptical-technical) reflexively does the math on any "time saved" claim and debunks it. The number is real (error avoided) but the label over-promises ("time won back" — they didn't get time back, the task still took the full duration). A made-up-feeling number in a brand built on the word **honest** is a self-inflicted trust wound.
4. **The dramatic stickiness gains are elsewhere** — they're already designed into your three-organ model (Planner / Mirror / Watchdog) and the calibration lock-in. The bank is a supporting actor. Invest the retention energy in the Watchdog resurrection loop and the widget, not in growing the counter.

**So:** reframe the bank to be unimpeachably honest + traceable, seed it non-zero, give it a bounded next-milestone, and treat it as the trophy-shelf, not the engine. Net effort: small. Net risk reduction: large.

---

## 1. What the Reclaim Bank actually is today (code reality)

One pure function, `src/engine/reclaim.ts:13`:

```
guessError  = |actual − estimate|        // how wrong the naive guess was
honestError = |actual − honestShown|     // how wrong Whenbee's number was
dividend    = max(0, round(guessError − honestError))   // ≥ 0 by construction
```

- Per completed log, deposits "minutes of prediction error the honest number spared you."
- Lifetime monotonic sum (`companion.reclaimed_minutes_lifetime`), per-category sum, per-today sum.
- Two surfaces in the screenshots: small chip **"+12m reclaimed today"** and hero card **"RECLAIMED · 1h 55m · from 2 honest logs · learned on-device · biggest area · Errands 5m."**
- Clamped ≥0 (no loss state), abandoned logs deposit 0, sub-1m hidden, non-spendable.

**The number is mathematically real and gaming-resistant.** It is not fake XP. The problem is not the math — it's the *framing* and the *job we've assigned it*. The math computes "estimation error you avoided," which the UI relabels as "time reclaimed / won back." Those are not the same claim.

---

## 2. The research, synthesized

Three streams. Confidence noted; full source URLs in §8.

### 2a. Does an accumulating "number-goes-up" drive retention? (psychology)

| Mechanism | Evidence | Does the bank get it? |
|---|---|---|
| **Endowed progress** (Kivetz/Urminsky 2006 — pre-filled stamp cards complete faster) | **Strong** | ❌ Bank starts at **zero**. Wastes the single best-evidenced lever. |
| **Goal-gradient** (effort accelerates toward a *visible goal*) | **Strong** | ❌ A lifetime total has **no ceiling = no gradient**. Motivationally flat. |
| **Loss aversion** (losses felt ~2× gains; the real engine behind streaks) | **Strong** | ❌ An only-up counter **cannot be lost → zero retention pressure.** |
| **IKEA / endowment** (we over-value what we built; switching cost) | **Strong (for lock-in)** | ✅ This is the bank's one real job — proof of self-built history. |
| **Investment phase** (Hooked — deposited value raises next-loop value) | Medium | ✅ partially — it visibly grows from the user's own logging. |
| **Variable reward** (dopamine needs unpredictability) | Medium | ❌ Deterministic tick-up = no surprise lift. (That's fine — not its job.) |

**Verdict (strong):** accumulating counters are a *weak standalone retention driver* and a *moderate switching-cost amplifier*. They move D30 (churn-protection) passively, not D1–D7 (habit). The number alone is vanity; **number + believability + a bounded loss-bearing loop** is retention. Practitioner consensus (Lenny/Reforge/Amplitude/Andrew Chen): chase only *causal* activation metrics; a counter that merely correlates with retention is the classic trap.

### 2b. How calm, no-guilt apps actually retain (competitor teardown)

The decisive variable is **what the progress object does on a bad day.** Two camps:

- **Survives imperfection by design** → Finch (pet resets energy to 0 daily, never dies; ~$30–40M ARR bootstrapped, 4.95★), Gentler Streak (an *Activity Path corridor* you stay inside, rest is valid; **2024 Apple Design Award**), one sec (time-saved bank framed as a gain, *no streak, no failure state*; PNAS-backed), YNAB / money-saved apps.
- **Punishes the miss** → Forest, Streaks, Duolingo's raw streak. **High retention, high guilt — off-limits for you by invariant and by evidence** (Trophy data: breaking a 14–90 day streak → 20–40% abandonment; >90 days → 40–60%).

Three findings that matter most:

1. **The money-saved / time-saved bank is a proven archetype — but a bare lifetime number is its documented failure mode.** Winners always pair (a) a believable *per-event win* + (b) the *accumulating total* + (c) a *milestone or re-surfacing ritual* (Rakuten "Big Fat Check," Honey Gold redemption bar, Qapital open goals). Rules from this camp: **never start at zero**, always show a **next milestone**, **never reset/expire**, and **attribute the saving to the system, not the user's discipline** (a Digit user: *"It feels weird saying 'I saved,' because I really didn't do anything"* — which, conveniently, doubles as your anti-guilt frame).
2. **Gentler Streak's corridor is the cleanest mechanical match to your monotonic / amber-never-red invariants** — a forward-moving thing to watch that survives a bad day. Your **drift-health layer already is this** (`03-RETENTION` §Whenbee companion). It's under-surfaced relative to the bank.
3. **Calm leaders (Structured, Sunsama) retain with *no* accumulating object at all** — just ritual + a satisfying check-off. Sunsama's founder, almost verbatim your premise: *"Things taking longer than expected is the norm, there's no shame in that."* **A calm, non-shaming, *monotonic* accumulating object is whitespace none of them occupy — that's a genuine wedge, not parity.**

**Name collision flag:** **Reclaim.ai** (Dropbox-acquired AI calendar) brands the entire "get time back" space and shows a stat literally labeled *"Hours reclaimed for Focus Time."* Same domain, worst case for confusion. Your differentiator is the noun **"Bank"** (an own-it ledger) and second-person "you earned this" voice. If you keep any "reclaim" language, lean hard on Bank and never echo their phrasing — but see §2c on why "reclaim" is doubly risky.

### 2c. What this niche says (Reddit user-voice)

The audience is ADHD / time-blind, skeptical of gamification, and **has already invented your core mechanic by hand** — "estimate, then double it / add a multiplier." Strongest PMF signal in the whole research. But on counters specifically:

- **"Time saved" claims get reflexively debunked by this crowd.** In every "time saved" thread (commutes, speeding, screen-time) Redditors do the math and conclude the figure is trivial or illusory. A Whenbee counter that can't survive "where did this number come from?" **will be mocked.** (Confidence: medium-high.)
- **Gamification reads as manipulation to the loud core.** *"Create artificial urgency and streaks. This sounds manipulative but it works"* (a founder admitting it, upvoted as confirmation of suspicion). Points/badges = "gimmicky."
- **What they trust is honest, traceable information** — *"Bedsheets: replaced 8 days ago. That is pure information. No action demanded and no guilt attached."* and *"this usually takes you 50 min, not 30."* That's your honest number. The bank needs to feel like *that*, not like an arcade score.
- **What makes them stick:** one-tap / zero decisions; calm app that "doesn't freak out when you stop using it"; external brain that gives the honest number; **no guilt/no red** (the #1 documented delete-trigger is broken-streak shame); honest numbers over points.

**Net:** your invariants are almost line-for-line what this niche begs for. The single flagged risk is the **Reclaim Bank counter** — it sits exactly where this audience is most cynical. It lands *trusted* only if visibly derived from real calibration deltas; it *bounces* the moment it looks like a score.

---

## 3. Scorecard — is this number worth keeping?

| Dimension | Rating | Why |
|---|---|---|
| Mathematically legit | ✅ Strong | Real measured error-reduction; gaming-resistant; honest by construction. |
| Drives D1–D7 habit | ❌ Weak | No gradient, no loss hook. Not a daily-return driver. |
| Protects D30 churn (switching cost) | ✅ Moderate | Endowment/IKEA — self-built history feels costly to abandon. |
| Believable to *this* audience | ⚠️ At risk | "Reclaimed/won back" over-claims; skeptical crowd debunks "time saved." |
| Fits invariants (no guilt, monotonic) | ✅ Strong | Only-up, zero-deposits-silent, non-spendable. Clean. |
| Differentiation | ✅ Strong | A calm, monotonic, non-shaming bank is whitespace competitors don't hold. |
| Cost to keep | ✅ Tiny | 29 lines, pure, well-tested. No reason to cut. |

**Conclusion: keep it, recast it.** Deleting it forfeits a cheap, differentiated switching-cost artifact and the one place you pay the user in the currency only a time app produces. But leaving it as "RECLAIMED — time won back" keeps a trust landmine in a brand named *honest*.

---

## 4. The fix — make the one we have clearer (recommended path)

Five changes, all small, all invariant-safe. This is the **Do-Now** package.

**4.1 Reframe the claim to exactly what the math computes — "closer, not won back."**
The number is *minutes your honest number was closer to reality than your gut* = misjudgment avoided. Say that. It's a stronger, more defensible claim *and* it reinforces the wedge ("the honest number is worth it") instead of inviting a debunk.

Copy candidates (run through conversion-psychology + humanizer; lead with the concrete personal claim, no hype, no guilt):

- *Small chip* — replace **"+12m reclaimed today"**:
  - ✅ **"12m sharper than your gut today"** (recommended — concrete, true, no over-claim)
  - "12m closer to real today"
  - "today: 12m of misjudgment dodged"
- *Hero card* — replace eyebrow **"RECLAIMED"** + sub **"time your honest numbers won back"**:
  - ✅ Eyebrow **"CLOSER TO REAL"** or **"SHARPNESS BANKED"**; sub **"minutes your honest number was closer than your gut — measured, on-device."**
  - Keep **"from 2 honest logs · learned on-device"** (this is the traceability that earns trust — make it *more* prominent, it's the antidote to the debunk).

If marketing insists on keeping "Reclaim Bank" as the internal/brand name, that's fine — but the *claim copy the user reads* must say "closer/sharper," not "won back."

**4.2 Seed it non-zero (endowed progress — strongest lever, currently wasted).**
Never show an empty bank. After the first log, the user is already mid-gradient. (Tie the seed to something real — e.g. the first log's own dividend, or the onboarding calibration — never a fabricated head-start, which would re-break trust.)

**4.3 Give it a bounded next-milestone (supply the missing goal-gradient).**
Add a single forward target beside the lifetime total: *"18m to your next reclaimed hour."* Milestones **bank permanently** (like Discoveries) — no reset, no loss, fully invariant-safe. This is what every money-saved winner does and what a lifetime-only counter structurally lacks.

**4.4 Make it traceable on tap (kill the "made-up number" failure mode).**
Tapping the hero card should show the receipt: this log guessed X, ran Y, honest said Z, so +N. The skeptical audience trusts what it can reverse-engineer. Traceability *is* the moat here.

**4.5 Attribute the win to the honest number, not the user's willpower.**
"Your honest number was closer" not "you saved." This sidesteps the over-justification trap *and* the guilt vector (nothing for the user to fail at) *and* reinforces the product's value prop in one line.

**Explicitly do NOT:** make it spendable (overjustification crowds out intrinsic motivation — already correctly deferred in `03-RETENTION`); add a resetting weekly streak (loss-framing, banned); inflate deposits (badge inflation → ignored).

---

## 5. Alternatives evaluated (10x lens)

The question "is a bank the right object?" — scored against the evidence. Several of these **already exist in your design**; the insight is mostly *re-weighting*, not net-new building.

| Alternative | What | Retention fit | Verdict |
|---|---|---|---|
| **Drift-health corridor** (Gentler-Streak analog) — *already built* | The "in good shape / something shifted" oscillating state | 🔥 High — the *daily forward-moving object that survives a bad day* the bank can't be. Apple-award-validated pattern. | **🔥 Promote it.** Under-surfaced vs the bank. This is the better daily-pull object. |
| **Watchdog resurrection loop** — *already designed* | Drift nudge pulls lapsed 7+ day users back ("mornings ran 2× long this month — re-check?") | 🔥 Highest-leverage of all — directly targets the metric that matters (resurrection rate), via the widget (silent channel) | **🔥 The real retention engine.** Fund this over the counter. |
| **Discoveries gallery** — *already built* | Monotonic collection of self-knowledge; variable-ratio but real payload | 👍 Collection-completion retains with zero stakes; can't go backward | **👍 Keep, lightly grow.** Complements the bank as the no-stakes accumulator. |
| **Companion capability unlocks** — *already built* | Growth = real planning power, not cosmetics | 👍 Endowment + utility; the "identity ladder" done as capability | **👍 Keep.** Stronger than the bank as an identity object. |
| **Weekly "closer this week" ring** (new, bounded) | Small bounded goal-gradient toward a banked milestone | 👍 Supplies gradient + soft re-surfacing without a resettable loss | **👍 Do-Next.** The §4.3 milestone in ring form. Watch the no-guilt line. |
| **Spendable Reclaim economy** | Trade minutes for something | 🤔 — overjustification risk, already deferred | **❌ Keep deferred.** |
| **Delete the bank entirely** | Remove the counter | n/a | **❌ No.** Forfeits a cheap switching-cost artifact + your unique "paid in time" hook for ~zero retention upside. |

**The 10x reframe:** you already own a *better* set of retention objects than the bank (Watchdog, drift-corridor, Discoveries, capability unlocks). The bank's mistake was being placed on the hero pedestal as if it were the engine. **The 10x move isn't a new mechanic — it's demoting the bank to trophy-shelf and promoting the Watchdog/widget resurrection loop to the hero retention investment.**

---

## 6. Does a "number / balance" even help stickiness here? Direct answer.

**Partly, and only in one narrow way.** A balance helps *churn-protection* (endowment switching cost) — it makes a 3-month user reluctant to leave. It does **not** help *habit formation* (daily return) and it is **not** what would "dramatically" move retention.

**What actually moves retention for THIS app, ranked:**

1. **Zero-friction core loop** (one tap, zero decisions). The #1 stick-factor and the #1 churn-reason in the user voice. Protect it above everything; it's already your thesis.
2. **The Watchdog resurrection loop via the widget** (the silent re-engagement channel). Directly targets resurrection rate — the one KPI that beats the graveyard. **This is where "dramatic" lives.**
3. **The honest number as a trusted external brain** — the thing the niche already hand-builds and wants automated. Each log makes the model more *yours* → genuine, compounding, single-player lock-in no competitor can clone.
4. **The drift-health corridor** as the daily forward-moving, bad-day-proof object.
5. **The bank** — switching-cost trophy + the "paid in time" emotional payoff. Supporting actor.

**If the bank disappeared tomorrow, retention would move marginally.** That's the honest read. Keep it because it's cheap, differentiated, and reinforces the value prop — not because it's load-bearing.

---

## 7. Recommendations

### Do Now (small effort, removes risk, banks the endowed-progress win)
1. **Reframe copy** on both surfaces: "closer / sharper," never "reclaimed / won back" (§4.1). *Mandatory* — it's the trust fix.
2. **Seed the bank non-zero** after first log (§4.2).
3. **Make the hero card traceable on tap** — show the per-log receipt (§4.4).
4. **Re-voice attribution** to the honest number, not the user's discipline (§4.5).

### Do Next (moderate, adds the missing gradient)
5. **Bounded next-milestone** beside the lifetime total, milestones bank permanently (§4.3 / §5 ring).
6. **Promote drift-health + Watchdog** above the bank in the hub hierarchy; wire the resurrection nudge through the widget.

### Explore (strategic)
7. Instrument it: does the bank *causally* affect D7/D30 (hold-out cohort), or only correlate? Decide future investment on data, not vibe — per the Lenny/Reforge rule. Settle the **Reclaim.ai** name question if "reclaim" survives anywhere user-facing.

### Don't
- Don't delete it. Don't make it spendable. Don't add a resetting streak. Don't inflate deposits. Don't keep the word "reclaimed/won back" in user-facing copy.

---

## 8. Sources

**Psychology / retention:** Kivetz, Urminsky & Zheng 2006 (endowed progress, JMR 43:1) https://journals.sagepub.com/doi/abs/10.1509/jmkr.43.1.39 · Duolingo streak data https://blog.duolingo.com/how-streaks-keep-duolingo-learners-committed-to-their-language-goals/ · Trophy streak-loss churn cliffs https://trophy.so/blog/what-happens-when-users-lose-streaks · IKEA/endowment switching cost https://thedecisionlab.com/biases/ikea-effect · Dark side of gamification / vanity metrics https://www.growthengineering.co.uk/dark-side-of-gamification/ · Fake-vs-real gamification (dignity / made-up numbers) https://uxmag.com/articles/gamification-2-0-beyond-points-and-badges-designing-for-players-not-metrics-conclusion · Activation must be causal https://www.lennysnewsletter.com/p/how-to-determine-your-activation · Andrew Chen, flattening curve https://andrewchen.com/retention-is-king/ · App stickiness for episodic cores https://getstream.io/blog/app-stickiness/

**Competitor teardown:** Finch ARR/teardown https://blog.sparrowapps.io/p/finch-how-a-self-care-app-hit-30m-arr-without-vc-money · Finch growth stages https://finch.fandom.com/wiki/Stages_of_Growth · Gentler Streak Activity Path https://docs.gentler.app/understanding-your-activity-path/interpret-the-activity-path · 2024 Apple Design Awards https://www.apple.com/newsroom/2024/06/apple-announces-winners-of-the-2024-apple-design-awards/ · one sec PNAS study https://pubmed.ncbi.nlm.nih.gov/36795756/ · Qapital outcomes (CFPB) https://files.consumerfinance.gov/f/documents/cfpb_qapital-savings-app-outcomes_report_2022.pdf · diminishing reward effect https://www.gamified.uk/2017/02/20/diminishing-effect-rewards/ · goal-gradient illusion (Nunes & Drèze) https://home.uchicago.edu/ourminsky/Goal-Gradient_Illusionary_Goal_Progress.pdf · Reclaim.ai stats https://help.reclaim.ai/en/articles/4133660-viewing-and-interpreting-your-stats · Sunsama doctrine https://nesslabs.com/sunsama-featured-tool

**Reddit user-voice (skeptical-technical skew noted):** abandonment — r/getdisciplined https://www.reddit.com/r/getdisciplined/comments/1u66dmi/what_makes_you_stop_using_habit_tracker_apps/ , r/Habits https://www.reddit.com/r/Habits/comments/1rigs2y/i_stopped_tracking_my_habits_and_ironically_got/ · stick — r/ProductivityApps https://www.reddit.com/r/ProductivityApps/comments/1s8i4cg/what_are_the_tools_that_actually_help_you_stick/ · time-blindness — r/ADHD https://www.reddit.com/r/ADHD/comments/73d82l/being_really_bad_at_estimating_how_long/ , r/ADHD_Programmers https://www.reddit.com/r/ADHD_Programmers/comments/1ppblu9/ · streak-shame — r/duolingo https://www.reddit.com/r/duolingo/comments/1lbsfe1/ · "time saved" debunk lens — r/nosurf https://www.reddit.com/r/nosurf/comments/1r0hjaq/

*Caveat: Reddit quotes are from search-result snippets (API blocks full-thread scraping); the niche skews skeptical, so treat enthusiasm as hard-won. Competitor ARR/figures are from secondary teardowns, not audited.*
