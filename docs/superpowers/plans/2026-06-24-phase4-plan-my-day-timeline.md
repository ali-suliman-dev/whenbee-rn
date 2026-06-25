# Planning Expansion — Phase 4: Plan-my-day + Timeline (around meetings)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Checkbox steps.
> **Branch off Phase 3** (`feat/planning-capacity`, PR #48). Consumes the existing `planBackward` engine, `dayTasksStore` (selectedDate, dayTasks, viewMode, day_meta via repo), `useDayCapacity`/calendar service (event anchors), `useLearnedFocusWindow` (focus band), `resolveHonestTasks`, `src/lib/day`, tokens.

**Goal:** On-demand "Plan my day": from the selected day's untimed tasks + an optional "done by" target + the day's fixed calendar meetings, compute a backward schedule that **routes tasks around the meetings**, and show it as a **Timeline** lens (List⇄Timeline toggle). Deep/high-bias tasks prefer the learned focus window. No-guilt overflow ("move one to tomorrow?"); on-demand only (never auto-reshuffles).

**Architecture:** A new pure engine `planDayAroundAnchors` fragments the day into free windows between immovable anchor blocks (calendar events) and fills them backward from the deadline; reuses the existing cut-ladder verdict. A `useDayPlan` hook resolves the day's queued tasks → honest minutes, orders them with a focus-band preference, gathers calendar anchors, and runs the engine. A `DayTimeline` component renders the result (tasks at clock positions, events greyed, focus band shaded). The `dayTasksStore` gains `viewMode` toggle wiring + `setDoneBy`. The old Plan-tab Start-By flow is untouched (the tab is reorganized in Phase 6).

**Tech Stack:** TypeScript (strict), Zustand, Reanimated, Jest. Spec §5.2, §7, §9.1 (Timeline), D6 (anchors). Phase-1/3 modules: `src/engine/planner.ts`, `dayTasksStore`, `tasksRepo` (getDayMeta/setDoneBy), `useDayCapacity`/`src/services/calendar.ts`, `useLearnedFocusWindow`.

## Global Constraints

- **Engine pure.** `planDayAroundAnchors` in `src/engine/`, no Date/IO; caller passes `nowMs`, `deadline`, `dayStartMs`, anchors (epoch ms). Order-preserving over the tasks it's given (the hook does focus-aware ordering before calling).
- **On-demand only.** Plan is computed when the user taps "Plan my day" (or re-plans). NEVER an always-on background reshuffle. Nothing moves unless the user triggers it.
- **No-guilt.** Overflow verdict framed as "move one to tomorrow?" — never red/overdue/failed. The Timeline never scolds; an unfilled window is fine. Focus band is a *suggestion*, never a constraint.
- **Anchors are read-only.** Calendar events are immovable display blocks; the planner never writes to the calendar. All-day events are NOT anchors (excluded). Tasks never overlap an anchor.
- **Tokens only** (new group → useTheme line). **Animation** entering-only, no bounce/translate-in, reduced-motion → final, List⇄Timeline = cross-fade. **reactCompiler Pressable** (visual on inner View). **No `exiting` layout anim** on conditionally-unmounted views (Fabric SIGABRT). **Layer rule.** TS strict + noUncheckedIndexedAccess.
- Conventional Commits; NO AI/co-author attribution (HARD RULE). Before each commit: eslint (0 warnings), typecheck, jest; full suite green at task end.

---

## Section A — Engine

### Task A1: `planDayAroundAnchors` pure scheduler

**Files:** Create `src/engine/planDayAroundAnchors.ts`; extend `PlanTimelineKind` in `src/domain/types.ts` to add `'event'`; export from `src/engine/index.ts`; Test `src/engine/__tests__/planDayAroundAnchors.test.ts`.

**Interfaces:**
- `interface PlanAnchor { id: string; label: string; startMs: number; endMs: number }`
- `interface PlanDayInput { deadline: number; nowMs: number; dayStartMs: number; tasks: PlanTaskInput[]; anchors: readonly PlanAnchor[]; bufferMin?: number; breatherMin?: number }`
- `planDayAroundAnchors(input: PlanDayInput): PlanResult` — `PlanResult` reused; `timeline` items use `kind: 'task' | 'breather' | 'event'` (anchors emitted as `'event'` items at their real positions).
- Extend `PlanTimelineKind = 'task' | 'breather' | 'event'`.

**Algorithm (implement to pass the test table; this is the spec):**
1. **Normalize anchors:** clip each anchor to `[dayStartMs, deadline]`, drop empties, sort by `startMs`, merge overlaps into disjoint immovable blocks.
2. **Free windows:** the complement of the merged anchors within `[dayStartMs, deadline]` — a sorted list of `[winStart, winEnd]` gaps (each ≥ 0 length; drop zero-length).
3. **Effective blocks:** each task → `durationMin + bufferMin` (DEFAULT_BUFFER_MIN reused), in minutes; `breatherMin` gaps between consecutive tasks **within the same window** (a window boundary already separates tasks, so no breather across a window jump).
4. **Backward fill:** place tasks **right-to-left** (reverse task order). `cursor = deadline`. For each task from last→first: find the latest position `s` such that `[s, s+block]` lies fully inside a single free window AND `s + block ≤ cursor`. Start from the window containing/preceding `cursor`; if the block can't fit before that window's start, jump `cursor` to the previous window's `winEnd` and retry. Set `cursor = s` (minus a breather if the next-earlier task shares the window). Record each task's `[startAt, endAt]`.
   - `startBy` = the earliest placed task `startAt`.
5. **Timeline:** merge placed task items + the anchor blocks (as `'event'` items) + breathers (only between two tasks inside one window), sorted by `startAt`.
6. **Verdict:**
   - If all tasks placed AND `startBy ≥ nowMs` → `{ kind: 'fits', startBy }`.
   - If tasks can't all fit the free windows before `deadline`, OR `startBy < nowMs` → run the existing **cut ladder** (drop largest-effective first until the remainder fits the windows AND starts ≥ nowMs) → `cut-one` / `multi-cut`; if even the smallest can't fit → `push-deadline` (feasibleDeadline = the earliest deadline at which the smallest task fits the next free slot after now). Reuse `cutLadder`/helpers from `planner.ts` (export them or replicate minimally — prefer exporting the shared helpers from `planner.ts`).
   - `totalMin` = Σ effective task blocks + intra-window breathers.

**Test table (write these first; each is one `test(...)`):**
- **No anchors** → identical placement to `planBackward` (same startBy/timeline for the task items) — fits case.
- **One anchor mid-day** splits the day: two tasks, an anchor between their natural slots → tasks placed in the windows before/after the anchor; the anchor appears as an `'event'` item between them; no task overlaps `[anchorStart, anchorEnd]`.
- **Task too big for the window before an anchor** → it's pushed to an earlier window (its `endAt ≤ anchorStart`), not overlapping.
- **Tasks exactly fill free windows** → fits, startBy = first window start.
- **Over capacity** (task total > free-window total) → verdict `cut-one`/`multi-cut` (largest dropped), framed via the verdict struct (UI adds the "move" copy).
- **startBy < now** (deadline too soon) → cut ladder fires.
- **All-day-only day** (anchors empty) → behaves like no-anchors.
- **Anchor at the very end** (ends at deadline) → tasks placed before it; startBy correct.
- **Overlapping anchors** merged → treated as one block.
- **Breather inserted between two tasks in one window**, NOT across a window jump.
- **Empty tasks** → empty timeline (just event items), `fits`.

- [ ] Steps: extend `PlanTimelineKind`; write the test table → run (fail) → implement the algorithm → run (pass). eslint + typecheck. Commit `feat(engine): planDayAroundAnchors — backward schedule around fixed meetings`.

### Task A2: Focus-aware task ordering (pure helper)

**Files:** Create `src/engine/focusOrder.ts` (+ test); export from index.
**Interfaces:** `orderForFocus(tasks: readonly T[], opts: { focusWindowStartMin: number | null; focusWindowEndMin: number | null; isDeep: (t: T) => boolean }): T[]` — a STABLE reorder that nudges "deep"/high-bias tasks earlier so the backward pass tends to land them inside the focus window, WITHOUT breaking the user's overall order more than necessary (a stable partition: deep tasks keep their relative order, light tasks keep theirs; only a gentle bias). Keep it minimal + deterministic.
- [ ] TDD: deep tasks surface before light ones while preserving intra-group order; null focus window → identity (no reorder). Commit `feat(engine): focus-aware task ordering helper`.

---

## Section B — Hook + Timeline UI

### Task B1: `setDoneBy` + plan state in the store; `useDayPlan` hook

**Files:** Modify `src/stores/dayTasksStore.ts` (expose `dayMeta`/`setDoneBy(date, min)` + `viewMode`/`setViewMode` already exist from Phase 1); Create `src/features/today/useDayPlan.ts` (+ test).
**Interfaces:**
- Store: ensure `setDoneBy(min: number | null)` writes `day_meta` for selectedDate (repo `setDoneBy` exists) + reload `dayMeta`; expose `dayMeta` (the selected day's `{doneByMin, planComputedAt}`).
- `useDayPlan(nowMs?): { plan: PlanResult | null; status: 'empty'|'ready'; doneByMin: number | null; setDoneBy: (m:number|null)=>void }`
  - Reads selectedDate + queued dayTasks → resolve honest minutes (reuse the resolver) → `orderForFocus` (A2, using `useLearnedFocusWindow`) → gather the day's calendar anchors (timed events via `useDayCapacity`/calendar, all-day excluded) → `dayStartMs` = max(now, the day's waking start) → `deadline` = the day's `doneByMin` (or the waking-window end if unset) as epoch ms on the selected day → `planDayAroundAnchors`.
  - `plan = null` when no queued tasks (status 'empty').
- [ ] TDD with seeded tasks + mocked calendar + focus window: assert the plan places tasks around an anchor, respects done-by, empty → null. Commit `feat(today): useDayPlan (focus-aware plan around meetings)`.

### Task B2: `DayTimeline` component

**Files:** Create `src/features/today/DayTimeline.tsx` (+ test). MANDATORY skills: `react-native-expert`, `ui-design:react-native-design`, `ui-design:visual-design-foundations`, `motion-design`, `conversion-psychology`, `humanizer`, `clean-code`.
**Behavior:**
- Renders the `PlanResult.timeline`: each `'task'` item = a row with its start clock + label + honest duration; each `'event'` item = a greyed, clearly read-only meeting block at its clock position; `'breather'` = a thin gap. The **learned focus window** is a shaded band behind the timeline rows that fall inside it.
- Header: the day-level "done by" control (a small time chip → opens a time picker; setDoneBy). 
- Overflow (verdict `cut-one`/`multi-cut`/`push-deadline`): a calm amber line "This won't fit before {time} — move one to tomorrow?" with a tap that moves the suggested (largest) task to tomorrow via `dayTasksStore.moveToTomorrow`. NEVER red/overdue.
- Reuse the existing rail/timeline visual primitives where sensible (`PlanRail`/`PlanTaskCard`/`RailNode` in `src/features/planner/`) — read them; if they fit, compose; else build lean rows. Tokens only.
- [ ] Render tests: timeline shows task rows + an event block + the focus band; overflow shows "move" copy (no "overdue"). Commit `feat(today): DayTimeline (tasks around meetings + focus band)`.

### Task B3: List⇄Timeline toggle + "Plan my day"

**Files:** Modify `src/app/(tabs)/index.tsx`; small `ListTimelineToggle` if useful.
**Behavior:**
- A toggle at the top of the day body: **List** (default) ⇄ **Timeline**. In List, a quiet "Plan my day" action (button/chip) computes the plan + flips to Timeline (cross-fade). In Timeline, the `<DayTimeline />` renders; a "Back to list" returns. Persist viewMode per session (store `viewMode`); stamp `day_meta.planComputedAt` when planned.
- Only on today/future days (past = recap). Reduced-motion → instant swap.
- [ ] Screen test: tapping "Plan my day" sets viewMode timeline + renders DayTimeline; toggling back shows the list. Commit `feat(today): List/Timeline toggle + Plan-my-day`.

---

## Section C — Polish + review

### Task C1: Copy + motion + a11y + Pro-gate
- [ ] Plan-my-day + Timeline are **Pro** (per §10 — the Timeline/Start-By is a Pro lens): free users tapping "Plan my day" → paywall teaser (trigger `plan_my_day`), never the rendered timeline. Gate it. Run all new strings through conversion-psychology + humanizer (no guilt). Verify cross-fade is no-bounce + reduced-motion final; a11y labels on the toggle, timeline rows (read-only events labeled), done-by chip, overflow move action. Note sim screenshot pending. Commit `style(today): plan-my-day copy/motion/a11y + Pro gate`.

---

## Self-Review
**Spec coverage:** §5.2 planDayAroundAnchors → A1; D6 anchors → A1; §7 done-by + List⇄Timeline + on-demand → B1, B3; §9.1 Timeline + focus band + no-guilt overflow → B2; focus preference (D9) → A2, B1; §10 gating → C1. ✅ Out of scope: focus chip/curve-to-Patterns (Phase 5), routines/export/patterns (6-8).
**Placeholder scan:** A1 carries a precise algorithm + an 11-case test table (tests are the spec for this intricate pure logic); A2 full contract; B/C interface+behavior+test intent. Decisions named (dayStartMs = max(now, waking start); deadline = doneBy or waking-window end).
**Type consistency:** `PlanAnchor`/`PlanDayInput` (A1) consumed by B1; `PlanResult` timeline gains `'event'` kind used by B2; `orderForFocus` (A2) used by B1; `useDayPlan` shape used by B2/B3.

## Execution Handoff
Subagent-driven in a worktree off `feat/planning-capacity`, PR at the end (never merge). Gate remaining: on-device visual verification of the Timeline + focus band.
