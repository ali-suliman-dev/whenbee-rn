# Start-By Plan — full screen redesign (two-phase: Build → Run)

**Date:** 2026-06-17 · **Status:** design approved, ready for implementation plan
**Mockups (rendered, dark theme, real tokens):**
- `docs/superpowers/mockups/2026-06-17-plan-redesign-options.html` — 4 directions
- `docs/superpowers/mockups/2026-06-17-plan-run-mode-decisions.html` — decision matrix
- `docs/superpowers/mockups/2026-06-17-plan-final-two-phase.html` — **the locked design**

---

## 1. Why

The current Plan screen (`src/app/(tabs)/plan.tsx`) is broken UX:

- You can press **Build my plan** with **zero tasks**.
- Add-task is a clumsy separate modal (`src/app/(modals)/add-task.tsx` route reused).
- Reorder is up/down arrow buttons — no drag.
- **No way to reset / re-plan / restart** (store has `reset`/`clearActive` but nothing on screen calls them).
- Tasks are not **loggable** — you can't run a timer per task, which is the whole point (the planner must feed calibration via the timer-as-log path).

This is a **total redesign**, not a patch. It is grounded in the product docs (`03-FEATURES.md §3`, `05-RETENTION.md`, `05b/05c`, `08`) and external research (Morgen/ClickUp timeboxing drag-onto-axis; ADHD low-friction inline add; 60fps reorderable lists).

## 2. The two-phase model (the core idea)

One screen, two phases, separated by the **Build my plan** commit:

| | **Phase 1 · Build** | **Phase 2 · Run** |
|---|---|---|
| Shape | B-style **card list** | A-style **timeline rail** |
| State | `planStore.draft` | `planStore.active` |
| Goal | compose the plan | run + log the plan |
| Primary CTA | **Build my plan** (bottom) | per-task **▶ / open timer** |
| Reset action | (start fresh / clear) | **Abandon** (red, top-right) |
| Reorder | drag | drag (except the running task) |

`saveActive()` freezes `draft → active` = the Build→Run transition. Once active, the **Build my plan button is gone**; you're running. `clearActive()` = **Abandon** → back to an empty Build (no learning lost).

## 3. Locked decisions

| # | Decision | Chosen | Notes |
|---|---|---|---|
| D1 | Run-card time placement | **① gutter-only** + rich progress rail | time lives on the rail spine; cards stay clean |
| D2 | Reorder scope in Run | **NOW is pinned** (🔒, no handle) | only *upcoming* drag; before any ▶, all cards drag freely in both phases |
| D3 | Top destructive action | **Abandon-only** (red) | no separate "Edit" — Run is inline-editable; `Re-plan` ≠ Edit |
| — | Rail colors | **done = green ✓ + strike**, **now = purple pulsing**, upcoming = hollow ring | green `#33B07C`, purple `#8275F0` |
| — | "now" label | purple pill, white text, `padding 2px 8px` | pulse animation on the circle below it |
| — | Finish-by input | **HH:MM scroll-wheel** + mode chips (leave by · be done by · be at) | reuse Add-Task wheel; narrower |
| — | Build-card duration | **slim scroll-wheel** far-right (5-min steps); **no play button in Build** | running only in Run |
| — | Breather | **Option 2: between-task breather only** (gap), shown as a visible rail node | per-task buffer becomes a silent default; the on-screen control is the *gap* |
| — | Timer start | **manual** (user taps ▶) — never auto-start | doc-mandated: "plan you confirm, then gets out of the way" |
| — | Start-by notification | **off-by-default, opt-in, fast-follow** (G17) | on-screen anchor ships now; the notification is later |
| — | Late / behind | **adaptive "Should I trim?" cut card** via re-project, user approves | the `cutLadder`/`computeCuts` engine; never auto-removes |

## 4. Screen specs

### 4.1 Phase 1 — Build

Top → bottom:

1. **Eyebrow** `● Start-By Plan` + title **Plan backward**.
2. **Finish by** — mode chips (`leave by` / `be done by` (default) / `be at`) + a compact **HH:MM wheel spinner** (two slim columns, center pill = selection, neighbours fade — like Add Task).
3. **Breather between tasks** — chips `Off / +5 / +10 / +20`. This is the *between-task gap* (Option 2), not per-task padding.
4. **Tasks · drag to reorder** — sortable cards:
   `⠿ drag · [range chip · title · category] · slim duration wheel (30/35m/40)` — **no play button**.
5. **＋ add a task…** — inline dashed composer (expands inline: title input + category chips + confirm). **No modal.**
6. Live one-liner: `start by 21:42 · fits by 22:52 ✓` (or amber verdict if over).
7. **Build my plan** — primary indigo button; **disabled until ≥1 task**.

If over deadline → amber **triage verdict** inline (never red): "About Nm over. Here's what fits — push the finish, or drop a task." with the deterministic cut choices.

### 4.2 Phase 2 — Run

Top → bottom:

1. **Top bar** — title `Today's plan` + `done by 22:52 · on track ✓`; **Abandon** (red pill, top-right).
2. **Progress rail** (`46px` gutter + cards), one row per task:
   - **Done** — green node + ✓, strike-through title, `logged 18m`, dashed-green connector above.
   - **NOW** (pinned) — purple **pill** label + purple **pulsing** node; raised card with `done ~22:17`, progress bar, **open timer** button. No drag handle (🔒).
   - **Upcoming** — hollow ring node, faint connector, card with `⠿` drag + duration + **▶**.
   - **Breather** (if set) — small node `☕ 5m · back at ~22:22` between task rows (finish-wrapped per §2.3.3).
3. **Footer** — `⟳ Re-plan` + `＋ Add task`.

Inline editing in Run (no mode switch): drag upcoming, stepper/wheel duration, swipe-to-delete, tap the `done by` header to change the anchor.

## 5. Interactions & motion (emil / motion-design)

- **Drag reorder:** press-and-hold to lift (`activateAfterLongPress`), card lifts with shadow + slight scale, others reflow with spring (`tokens.motion.spring`). 60fps on UI thread (Reanimated worklets). Running task is not draggable.
- **Wheels:** flick with momentum + snap to nearest; center pill is selection; haptic tick on snap. Reuse Add-Task wheel physics.
- **Build → Run transition:** cross-fade/slide; cards reflow into the timeline. ≤300ms, `ease-out`. Mask the crossfade with subtle blur if needed.
- **NOW pulse:** 2.2s calm breath on the node ring (`tokens.motion.halo`-ish), purple. Never a blink.
- **Button press:** `scale(0.97)` active, 160ms ease-out. Coin-edge depth on the primary (View-based, no boxShadow on Fabric).
- **Reduced motion:** drop transforms, keep opacity/color; pulse → static.
- All values come from `tokens.motion` / `tokens.scale`.

## 6. Data model & state changes

**`src/domain/types.ts` (contract first):**
- Extend the plan task with run fields: `status: 'upcoming' | 'running' | 'done'`, `completedAt?: number`, `actualMin?: number`, frozen `suggestedHonestMin`.
- Add `breatherMin` to the draft/active plan; add a `kind: 'task' | 'breather'` notion for timeline items (breather rows).

**`src/stores/planStore.ts`:**
- Add `breatherMin` to `PlanDraft` + `ActivePlan` (keep `bufferMin` as silent default).
- Add per-task run state + actions: `startTask(id)`, `completeTask(id, actualMin)`, current-index/`startedAt` on `ActivePlan`.
- `saveActive()` already freezes draft→active (Build→Run). `clearActive()` = Abandon. `reset()` = full wipe.
- `reorderTasks(ids)` must reject moving the running task (D2).

**`src/features/planner/usePlanner.ts`:** expose `breatherMin` setter, run-phase selectors (done/now/next split), `reproject()`, and the cut-card state.

## 7. Engine changes (`src/engine/`, pure, TDD)

- **Exists:** `effectiveBlockMin`, `cutLadder` (the deterministic cut ladder: smallest single cut that just fits → minimal greedy multi-cut → push deadline → safe trims; never silently shrink an honest duration), `planBackward`.
- **Add `breatherBetween`:** insert breather gaps between tasks in the backward pass and the rendered timeline (`cursor = start − breatherMin`). Gaps consume schedule time → push `startBy` earlier and appear as timeline items.
- **Add `reproject(plan, now)`:** recompute remaining (incomplete) tasks vs the same deadline; return a **diff for confirmation** (never auto-apply). If now over → return the `cutLadder` "cut one" choice for approval.
- Constants in `src/engine/constants.ts`, not inline.

## 8. Loggable tasks (the load-bearing wiring)

Running a planned task uses the **existing timer-as-log path** — the planner never forks the write path (docs §3.3: *"logging a planned task still goes through the timer like any other log"*).

- ▶ / open-timer on a Run card →
  `router.push({ pathname: '/(modals)/timer', params: { taskId, label, category, estimateMin: durationMin, guessMin, suggestedHonestMin } })`.
- On **Stop & log**, the normal `applyLog()` runs (EWMA, sharpness, +1 nectar, honey cell-fill, reclaim deposit). The Run view then marks the task `done`, fills its green node, and advances NOW.
- Plan store is a **read-only consumer** of calibration — it never writes logs/stats. Per-task duration edits apply to *this plan only*.

## 9. Adaptive trim / re-project flow (your "Should I trim?" idea = the docs' cut ladder)

Trigger: user taps **Re-plan** / "I'm behind", OR a running task passes its honest end (live timer detects).
→ `reproject()`:
- Still fits → show diff + confirm: *"Everything shifts ~12 min later — still done by 22:52 ✓. Update plan?"*
- Now over → surface the **cut card**: the smallest task whose honest minutes ≥ the overflow (tightest fit), else minimal greedy multi-cut, else push-deadline. Framed as **triage, amber, never red**. **User always approves; never auto-removed.**

## 10. Component / file map

**Changed:**
- `src/app/(tabs)/plan.tsx` — thin route, renders Build or Run by `active` presence.
- `src/features/planner/usePlanner.ts` — phase selectors, breather, reproject, cut state.
- `src/stores/planStore.ts` — breather, run state, reorder guard.
- `src/engine/planner.ts` + `constants.ts` — breather gaps, reproject.
- `src/domain/types.ts` — run fields, breather, timeline-item kind.

**New (in `src/features/planner/`):**
- `BuildView.tsx` — Phase 1 container.
- `RunView.tsx` — Phase 2 container (the rail).
- `PlanTaskCard.tsx` — shared card (Build = wheel/no-play; Run = duration + ▶).
- `PlanRail.tsx` + `RailNode.tsx` — the progress spine (done/now/next/breather states).
- `DurationWheel.tsx` / `FinishTimeWheel.tsx` — wraps the reused Add-Task wheel (`src/features/shared/TimeField.tsx`).
- `BreatherChips.tsx` — repurposed from `BufferChips.tsx`.
- `AbandonButton.tsx` + confirm sheet.
- `CutCard.tsx` — the amber triage verdict / trim approval.
- `useDraggablePlanList` hook (or library wrapper, §11).

## 11. Libraries

- **Drag-to-reorder:** Reanimated `~4.1` + Gesture Handler `~2.28` are installed; **no** draggable-list lib. Decision: install **`react-native-reorderable-list`** (Reanimated-native, Expo-friendly, 60fps, long-press activation) — cleaner than hand-rolling. Verify Expo SDK 54 / RN 0.81 / Fabric compat via `npx expo install` + `expo-doctor` (18/18) before committing to it; fall back to a hand-rolled Pan + shared-values list if incompatible.
- **Wheel:** reuse the existing Add-Task picker (`src/features/shared/TimeField.tsx`); extract a generic `Wheel` if needed. No new native picker dependency (keeps it on-theme + light; avoids `@react-native-community/datetimepicker`).
- **Timer:** existing `/(modals)/timer` + `useTimer` — unchanged.

## 12. Invariants honored

- **No guilt, amber-never-red** — over-state is amber triage; **red used ONLY for Abandon** (a destructive action, not a verdict).
- **Honey/sharpness monotonic** — untouched; logging flows through the normal path.
- **Core loop on-device only** — no network in the plan; planner is pure; engine read-only.
- **No streaks**, one-thing-at-a-time (the NOW card), pricing from RevenueCat (n/a here).
- **Every value from `tokens.ts`** — add tokens (e.g. rail geometry) rather than inlining; new token group ⇒ matching `useTheme` line.

## 13. Scope

**MVP-of-feature (this redesign):** two-phase Build/Run, drag reorder, inline add, finish-by wheel, breather (between-task gap, visible), loggable rows via timer-as-log, Abandon + Re-plan, deterministic cut card, the progress rail.

**Fast-follow (build later, off the core loop):**
- Start-by **notification** (G17, off by default).
- **Brain Breather** R1–R3 (adaptive rest at fade point on the live timer) — distinct from the plan's between-task gap.
- Fixed-block routing + multi-cut richness (P6), NL task entry (P7), variability band (P9).
- Per docs, the Start-By Plan + buffer/breather are **Pro / fast-follow**; calibration stays free.

## 14. Testing (TDD where it's logic)

- **Engine (required, test-first):** breather gap insertion, `reproject` diff, cut-ladder ordering, `startBy` with breathers, edge cases (0 tasks, breather Off, exactly fits, big overflow).
- **Store (required):** saveActive/clearActive/reset, reorder-guard rejects running task, start/complete task transitions.
- **UI (welcome, not required):** Build disables CTA at 0 tasks; ▶ routes to timer with correct params; Abandon clears; reduced-motion path.

## 15. Out of scope / open questions

- Exact `react-native-reorderable-list` vs hand-roll — decided at implementation after `expo-doctor`.
- Whether breather rows are themselves runnable (a "breather timer") — **no** for now; that's the fast-follow Brain Breather.
- Multiple saved plans / history — no (single active plan, per docs).
