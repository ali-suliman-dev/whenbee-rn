# Reclaim — honesty evaluation (should the "banked minutes" framing stay?)

**Date:** 2026-06-20 · **Status:** open decision (raised by the founder) · **Trigger:** reviewing the persistent-presence widget surfaced reclaim as an ambient metric and prompted the question — is "reclaim" honest, and do we need it?

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

## Recommendation

**Lean C (remove the "banked minutes" framing), but design the Reward payoff replacement first.** The metric is off-thesis and the founder reads it as misleading; honey/sharpness (calibration maturity) already provides a legitimate, honest progress number. Before tearing out the Reward chip, brainstorm what the post-log payoff beat becomes — candidates: the honey/sharpness tick, the honest-vs-actual delta itself ("you guessed 15, it took 32 — now I know"), or the calibration-confidence narrowing. The honest reveal *is* the reward; reclaim was a synthetic one layered on top.

If full removal is too aggressive for retention, **B is the honest middle** — same underlying signal, truthful language, no "banked time."

Either way, **do not keep A** — a dishonest number in an honesty app is the worst option.

## Scope / next steps (separate from the widget PR)

1. Decide A / B / C (founder).
2. If B or C: `superpowers:brainstorming` on the Reward-modal payoff replacement (honor invariants: no guilt, honey monotonic). Then a spec, then an implementation plan.
3. Implementation touches: `ReclaimDeposit.tsx`, `reward.tsx`, `TodayEmptyState.tsx`, `useReward.ts`, possibly the engine `reclaim.ts` + DB bank + `analytics.ts`. The DB columns can stay dormant (monotonic, additive) even if the UI is removed, to avoid a migration.

> The persistent-presence widget already removed its reclaim surface, so it is unaffected by whichever option is chosen here.
