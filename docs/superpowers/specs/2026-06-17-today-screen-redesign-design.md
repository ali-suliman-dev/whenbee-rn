# Today screen redesign — all states (design spec)

> **Status:** Approved in brainstorming (visual companion, 2026-06-17). Ready for an implementation plan.
> **Scope:** Redesign the `Today` tab (`src/app/(tabs)/index.tsx`) across every state — first run, daily-empty, has-tasks, running. The current daily-empty state is a single gray sentence in a black void with Whenbee (the retention engine) absent; this fixes that and unifies the four states under one pattern.
> **Out of scope:** the engine, the Whenbee hub tab, the timer modal internals, the add-task / retro modals. We reuse them.

---

## 1. The problem

`index.tsx` today renders a `HoneycombStrip` (a row of tiny hex pips + "10 logs to Setting ›"), then for `totalCount === 0` a single centered line: *"Nothing tracked yet today — tap + when you start something."* Below that, a vast empty void.

Two concrete misses:

1. **Whenbee is absent from the screen the user lands on most.** The docs ([`05-RETENTION.md`](../../../../Ideas/04-productivity-adhd/whenbee/build-plan-final/05-RETENTION.md) §1.8.2) make passive companion *presence* the #1 retention mechanic. It lives only on the hub today.
2. **The hex-pip strip reads as dead pixels + a chore counter.** The founder rejected it on sight. "10 logs to Setting" frames progress as something owed.

## 2. The approved direction — "C: bee + honey, unified"

One pattern, four states.

**Constant HUD (every state).** Replace the Today `HoneycombStrip` with a single row: **Whenbee at its current tier stage + a slim honey progress bar + tier label**, tappable → `/(tabs)/whenbee`. This puts the living bee on Today *and* kills the dead-pixel strip in one move. The full honeycomb (per-category hexes) stays on the Whenbee hub, unchanged.

- Bee renders `companion.maxTier` stage (monotonic; never regresses). Ambient float + per-stage glow from existing tokens (`tokens.companion.floatLift`, `tokens.companion.glow`, `motion.float`). Reduce-motion: static.
- Honey bar = current category-band progress toward the next tier (the existing `sharpness` / `logsToNextTier` data). Fill animates with `motion.honeyFill`. Track = `surfaceSunken`, fill = `accent` gradient. **Soft language only**, never "N logs owed".
- Tap target: the whole HUD card.

**The body adapts per state** (below). The bee does *not* repeat in the body — it lives in the HUD, which frees the body for content/action.

## 3. The four states

### 3.1 First run (no history yet)
Detector: user has never logged (`companion.lifetimeDataPoints === 0`, equivalently no completed logs). HUD bee is stage 1 (plain, no glow), honey near-empty, tier "Raw". No Reclaim line (it's 0).

Body (centered):
- Lead: **Time your first task**
- Sub: **That's all it takes for Whenbee to start learning your real numbers, the ones you can plan around.**
- Primary CTA: **Start now** → add-task / timer flow.
- Secondary chip: **Already finished something? Log it** → retro modal.

Goal: reach `first_log` fast (the Day-0 make-or-break, docs §1.6.1). No mystery about what the button does.

### 3.2 Daily empty (returning user, nothing logged today)
Detector: `totalCount === 0` for today **and** `lifetimeDataPoints > 0`. HUD bee at its real tier with glow; honey at real %.

Body (centered):
- Eyebrow: **Nothing on yet**
- Lead: **What's on today?**
- Sub: **Add a task and I'll show its honest finish, plus whether the day actually fits.**
- Primary CTA: **+ Plan a task** → add-task flow.
- Reclaim line (when `reclaimedMinutesLifetime ≥ 1`): a small amber honey glyph + **14h 20m reclaimed so far** (`formatReclaim` of lifetime). Quiet proof the empty day still sits on something earned.
- Secondary chip: **Or log something you finished** → retro modal.

No-guilt: "Nothing on yet" / "What's on today?" frames empty as neutral, never a gap or miss. No streak, no counter, amber-never-red.

### 3.3 Has tasks
HUD shrinks (smaller bee) but stays. Body = the existing flow, restyled to match:
- `FocusCard` — honest-number hero + "you guessed X · done ~time" + Start coin (existing component; keep).
- **Up next** section → `TaskRow` list (existing).
- **Done today** section → `TaskRow` done variant (existing).
- `ReclaimTodayLine` — "+22m reclaimed today" (existing, when > 0).
- Retro log chip stays as the natural last item.

### 3.4 Running
The focus slot becomes a **live inline ring** in the *same footprint* (nothing jumps), driven by `RunningFocusCard` (existing):
- Eyebrow with a live amber dot: "Now running · {category}".
- Task title, honest finish ("honest 48m · done ~4:11pm"), guess→plan bar with the live elapsed tick.
- Elapsed count-up ring.
- One action: **Stop & log**.
- **Tapping the card reopens the full timer modal** (confirmed). The inline card and the modal coexist — Today mirrors the live session; the modal is the full-screen surface. This matches the existing `isTimerRunning` branch.

## 4. Components

- **New `TodayHud`** (`src/features/today/TodayHud.tsx`) — bee (reuse `BeeMascot`) + tier label + honey bar; `onPress` → hub. Replaces the `HoneycombStrip` usage *on Today only*. Props: current tier, sharpness/band progress, drift-health tint (reuse `driftSettled`/`driftCurious`).
- **New `TodayEmptyState`** (`src/features/today/TodayEmptyState.tsx`) — takes a `variant: 'first-run' | 'daily'` and renders the right lead/sub/CTA/Reclaim/chip. Keeps `index.tsx` thin (routes stay thin per architecture rule).
- **Reuse unchanged:** `BeeMascot`, `FocusCard`, `RunningFocusCard`, `TaskRow`, `ReclaimTodayLine`, `DailyRitualLine`.
- **`index.tsx`** orchestrates: `TodayHud` always; then branch `isTimerRunning` → `RunningFocusCard`; else `focus` → `FocusCard` + lists; else `TodayEmptyState` (variant by `lifetimeDataPoints`).

## 5. Data dependencies

**All of this is already built and wired — this redesign only *reads* it, nothing new in the engine/data/store layer.**

- `companion.maxTier`, `companion.lifetimeDataPoints` — for bee stage + first-run vs daily detection. Live in `src/domain/types.ts`, both DB impls, and `calibrationStore`'s `ReclaimSummary` (`lifetimeNectar: lifetimeDataPoints`, `calibrationStore.ts:776`) + `CompanionPresence`. Surface to `useToday` if not already (add a selector read; no new state).
- `companion.reclaimedMinutesLifetime` + `formatReclaim()` — for the daily-empty Reclaim line. Engine `src/engine/reclaim.ts`; store exposes it as `ReclaimSummary.lifetimeMin` (`calibrationStore.ts:783`), deposited on every counted log (460–476). The Today line reads the same source the Whenbee hub uses. Line shows when `lifetimeMin ≥ 1` (naturally 0 on first-run → hidden).
- Per-category honey/tier already in `statsByCategory` (used today).

## 6. Theming & motion (token-sourced, no inline values)

- Colors: `surface`, `surfaceSunken`, `accent`/`accentEdge` (honey fill), `primary` (CTA), `ink`/`inkSoft`, drift tints. Brand bee colors from `tokens.brand.bee`.
- Bee size on the HUD: add a token if none fits (e.g. `tokens.companion.hudSize` or reuse a `size` entry) — **do not inline**.
- Motion: `motion.float` (bee), `motion.honeyFill` (bar), `motion.spring` (press), `companion.floatLift`/`glow` (per-stage). All collapse under `useReducedMotion()`.
- Invariants honored: amber-never-red; honey/bee monotonic; no streak/guilt copy; core loop stays on-device.

## 7. Copy deck (final, humanizer-clean — no em dashes, no AI tells)

| Surface | String |
|---|---|
| First-run lead | Time your first task |
| First-run sub | That's all it takes for Whenbee to start learning your real numbers, the ones you can plan around. |
| First-run CTA | Start now |
| First-run secondary | Already finished something? Log it |
| Daily-empty eyebrow | Nothing on yet |
| Daily-empty lead | What's on today? |
| Daily-empty sub | Add a task and I'll show its honest finish, plus whether the day actually fits. |
| Daily-empty CTA | + Plan a task |
| Daily-empty Reclaim | {formatReclaim} reclaimed so far |
| Daily-empty secondary | Or log something you finished |
| Running eyebrow | Now running · {category} |
| Running action | Stop & log |

## 8. Testing

- `index.tsx` renders the right body for each of the four states (extend `src/features/today/__tests__/todayScreen.test.tsx`).
- First-run vs daily-empty branch on `lifetimeDataPoints`.
- Reclaim line hidden when `lifetimeMin < 1` (e.g. first-run); shown otherwise.
- HUD `onPress` routes to the hub.
- Reduce-motion path renders without animation.
- Copy assertions: no em dash, no banned strings (`streak`, `missed`, `don't lose`, red), per the copy deck.

## 9. Non-goals / deferred
- No change to the honeycomb on the Whenbee hub.
- No new Reclaim/Discoveries surfaces beyond the one daily-empty lifetime line.
- No companion personalization entry here.
