# Reclaim — honesty evaluation (should the "banked minutes" framing stay?)

**Date:** 2026-06-20 · **Status:** DECIDED — **option C (remove reclaim)**, recorded 2026-06-20 · **Trigger:** reviewing the persistent-presence widget surfaced reclaim as an ambient metric and prompted the question — is "reclaim" honest, and do we need it? · **Removal plan:** `docs/product/specs/12-remove-reclaim.md`

---

## The question

Whenbee's whole thesis is **honesty about time**: "no, it won't take 15 minutes, it'll take 30." But the app also tells the user they **"reclaimed" minutes** that get **"banked"** (the Reward modal: `+1m reclaimed → 1m banked`; the Today empty state: `14h 20m reclaimed so far`; formerly the hub monument, removed 2026-06-19 in `53aad88`). Is that honest, and is it earning its place?

## What the number actually is

`reclaimDividendMinutes(guess, actual, honest) = |actual − guess| − |actual − honest|`

Example: `reclaimDividendMinutes(15, 32, 30) = |32−15| − |32−30| = 17 − 2 = 15`.

It is **estimation error avoided** — how many fewer minutes *wrong* your plan was because you trusted the honest number instead of your raw guess. It is **not** time saved. The task still took 32 minutes. You did not get 15 minutes back.

## The honesty problem

Labeling that quantity **"reclaimed"** and **"banked"** frames it as **accumulated free time you can spend** — a savings account of minutes. You cannot spend it; it does not exist. The user's own words: *"you're not reclaiming time… things are taking exactly as long. We're not making your time more effective, we're just giving every task the space it actually needs."*

That is exactly right. The mechanic Whenbee delivers is **planning that matches reality** — you stop overcommitting and cascading into lateness. That benefit is real. But "banked reclaimed minutes" **oversells it as recovered time**, which is the optimistic-time fantasy the app exists to kill. It is the one surface where the app contradicts its own thesis. "Banked" is the most overstated word in it.

## Where reclaim currently lives (as of this date)

- **Reward modal** — `ReclaimDeposit.tsx`: the `+Nm reclaimed` chip + lifetime count-up, shown after a log banks ≥1 min. **Rendered.**
- **Today empty state** — `TodayEmptyState.tsx`: `"<X> reclaimed so far"` proof line (when lifetime ≥ 1). **Rendered.**
- **Hub monument** — removed 2026-06-19 (`53aad88`: hub hero card, Today chip, paywall endowment).
- **Persistent-presence widget** — removed 2026-06-20 (this conversation): `reclaimTodayMin` + the "you got ahead of Nm today" evening state.
- **Data layer (intact):** engine `reclaimDividendMinutes`/`formatReclaim`; DB monotonic bank `companion.reclaimedMinutesLifetime` + per-category `reclaimedMinutes`; analytics `reclaim_deposit`/`reclaim_total_view`; hub `loadReclaimSummary` still loads it.

So reclaim is **already being walked back** (hub, then widget). The question is whether to finish the job.

## Options

**A. Keep as-is.** Lowest effort. Cost: the app keeps making a claim ("banked reclaimed time") that contradicts its honesty pitch and that the founder considers misleading.

**B. Reframe the language, keep the metric.** Drop "reclaimed/banked." Reframe as what it honestly is — *planning accuracy / overcommitment avoided* (e.g. "your plans are off by N fewer minutes" or a calibration-progress framing). Keeps a progress signal without the false-time accounting. Cost: needs new honest copy + possibly a new visual; risk of a number nobody understands.

**C. Remove reclaim entirely.** Cut the Reward chip + the Today proof line; retire the engine/DB bank + analytics (or leave the DB columns dormant). Cost: the Reward modal loses its tangible payoff beat — **needs a replacement** so the reward screen doesn't go hollow.

## Decision (recorded 2026-06-20) — **C: remove reclaim**

**Chosen: C.** Remove the reclaim metric from the product.

- **Not A** (keep): a dishonest number in an honesty app is the worst option.
- **Not B** (reframe): the honest reframe of reclaim is "estimation error avoided" — an abstract, cumulative number nobody understands. Reframing a vanity metric into a truthful-but-incomprehensible one is a lateral move, not a fix.
- **C** wins because the honest reward **already exists** and reclaim was diluting it: (1) the **honest-vs-actual reveal** ("you guessed 15, it took 32 — now I know your 2.1×"), and (2) **honey / sharpness** (calibration maturity, monotonic). Reclaim was a synthetic dopamine layer bolted on top. Removing it leaves **no hole** — it gives those two honest beats the room reclaim was stealing. So C needs **no new invented metric**, just the removal + a light Reward-modal motion pass so the screen doesn't feel thin without the count-up beat.

Execution: see `docs/product/specs/12-remove-reclaim.md`.

> The persistent-presence widget already removed its reclaim surface, so it is unaffected by this decision.
