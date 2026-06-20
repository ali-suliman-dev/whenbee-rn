# 12 — Remove reclaim from the product

**Status:** spec (executes decision **C** from `research/2026-06-20-reclaim-honesty-evaluation.md`) · **Date:** 2026-06-20 · **Skills at build:** `react-native-expert`, `creating-reanimated-animations` + `motion-design` (the Reward re-time), `clean-code`

> Decision: remove the "reclaim / banked minutes" metric from every user-facing surface. The honest reward already exists (the honest-vs-actual reveal + honey/sharpness maturity); reclaim was a synthetic layer on top. **The data layer stays dormant — no migration.**

## Principle: strip the product surface, leave the data dormant

- **Remove:** every place the user sees a reclaim number or a reclaim CTA, plus the reclaim analytics events.
- **Keep (dormant, untouched):** the DB columns (`companion.reclaimed_minutes_lifetime`, `category_stats.reclaimed_minutes`, `task_events.reclaim_dividend_min`), `addReclaim`/`addCategoryReclaim`, migration 0002, the engine `reclaimDividendMinutes` computation, and `applyLog` continuing to write `reclaim_dividend_min`. These are monotonic and harmless; leaving them avoids a migration and keeps the calibration path identical. They simply stop surfacing.

This keeps the change UI-layer + analytics only — low risk, no engine/DB/migration churn.

## What to remove (file by file)

**Reward modal (the post-log payoff beat):**
- `src/features/reward/ReclaimDeposit.tsx` — **delete the component** (the `+Nm reclaimed → banked` chip + lifetime count-up).
- `src/app/(modals)/reward.tsx` — remove the `{r.reclaimDeltaMin >= 1 ? <ReclaimDeposit .../> : …}` block (Zone 3). Remove or relabel the `See my Reclaim` button (`AppButton label="See my Reclaim"` → it points at the hub which no longer shows reclaim; either drop it or relabel to a neutral hub entry like `See your bee`/`Open Whenbee`). The payoff card is now **honey + multiplier + the honest-vs-actual delta** as the single unit.
- `src/features/reward/useReward.ts` — drop `reclaimDeltaMin` / `reclaimFrom` / `reclaimTo` from the view-model (and the count-up bounds math). Leave the rest of the reward outcome intact.

**Today empty state (the proof line):**
- `src/features/today/TodayEmptyState.tsx` — remove the `showReclaim` branch + the `"<X> reclaimed so far"` row and the `formatReclaim` import. (Optional honest swap, NOT required now: a maturity proof line — "Whenbee's learned your timing across N tasks". Leave for a later call; default is just the calm invite.)
- `src/features/today/useToday.ts` — remove `reclaimLifetimeMin` state + its `loadReclaimSummary().then(... setReclaimLifetimeMin ...)` wiring **only if** `loadReclaimSummary` isn't needed for anything else there (it currently also drives companion/lifetime — verify; keep the parts that feed the companion/HUD, drop only the reclaim number). Remove `reclaimLifetimeMin` from the hook's return.
- `src/app/(tabs)/index.tsx` — remove the `reclaimLifetimeMin` prop passed to `TodayEmptyState`.

**Whenbee hub:**
- `src/features/whenbee/useWhenbeeHub.ts` — `loadReclaimSummary` also provides companion presence + honest-log count + drift health, so **keep the call**; just confirm no reclaim *number* is rendered (the hub monument was already removed in `53aad88`). Likely no change beyond verification. The `ReclaimByCategory`/`biggestArea` fields can stay in the store API (dormant) or be trimmed if they're now unused — trim only if cleanly unused.

**Analytics:**
- `src/services/analytics.ts` — remove the `reclaim_deposit` and `reclaim_total_view` event type defs.
- `src/stores/calibrationStore.ts` — remove the `analytics.capture('reclaim_deposit', …)` call (~line 727). Leave the `companionRepo.deposit(...)` DB writes (dormant data).

## Motion pass (don't skip)

`src/app/(modals)/reward.tsx`'s reveal choreography currently sequences number → honey fill → **reclaim deposit** → cap. Removing the reclaim beat leaves a gap. Re-time the stagger so the payoff card (honey + multiplier + honest-vs-actual) lands as a complete unit — invoke `creating-reanimated-animations` + `motion-design`; honor the invariants (no guilt, honey monotonic, entering-only). ~20-min layout/timing pass, but required so the screen doesn't feel hollow.

## Tests to update

- `src/features/reward/__tests__/rewardScreen.test.tsx` — drop the reclaim count-up assertions (the `reclaimDeltaMin`/`reclaimLifetimeMin` cases that assert the "+Nm reclaimed" / "3h 20m" render).
- `src/features/today/__tests__/TodayEmptyState.test.tsx` — drop the `reclaimLifetimeMin` proof-line assertions.
- `src/features/today/__tests__/useToday.test.tsx` — drop the `reclaimLifetimeMin` expectations.
- `src/stores/__tests__/calibrationStore*.test.ts` — **keep** (data layer unchanged; `reclaimDeltaMin`/`reclaimLifetimeMin` in `LogOutcome` stay — they're dormant, still computed). Only remove an assertion if it checks the `reclaim_deposit` analytics call.
- Engine `src/engine/__tests__/reclaim.test.ts` — **keep** (engine stays).

## Out of scope / explicitly not touched

- No DB migration. No engine deletion. `applyLog` keeps writing `reclaim_dividend_min`. The bank keeps accumulating silently — if reclaim is ever wanted again, the data is intact.
- `LogOutcome.reclaimDeltaMin`/`reclaimLifetimeMin` stay in the store contract (dormant) to avoid rippling through the log path.

## Execution

Small, UI-layer, CI-verifiable (no device needed). One branch, a few commits (Reward modal → Today empty state → analytics → motion re-time → tests), lint + typecheck + jest green. **Separate from PR #19** (the widget) — its own change when you're ready to run it.

## Open question

- The `See my Reclaim` button in the Reward modal: drop it entirely, or relabel to a neutral "open the hub" action? (Leaning relabel — the hub is still a worthwhile destination; the *word* "Reclaim" is the problem.)
