# Plan-sheet refinement — Phase 1 (feat/plan-sheet)

> Subagent-driven. Steps use `- [ ]`. Global constraints below bind every task.

**Goal:** Refine Option 1's plan surface per founder review — a minimal plan button entry, a de-crowded drawer (padded header, start-by/finish-by justified line, neutral bottom controls + CTA Done), and drag-to-reorder of the plan's tasks with the existing live non-blocking overflow warning.

**Architecture:** The entry becomes a compact `PlanButton` on the UP NEXT title row (opens the existing `(modals)/plan` sheet). The sheet route (`plan.tsx`) takes ownership of the header line + bottom controls; `DayTimeline` renders rows only (new `hideHeader` prop) and becomes a reorderable list. Manual order persists via `Task.orderIndex` (field/column already exist) through a new `dayTasksStore.reorderTasks(ids)` action; `useDayPlan` skips the `orderForFocus` deep-first reshuffle when the day has a manual order. No planner-engine change (it already preserves input order).

**Tech stack:** RN/Expo SDK 54, Zustand, `react-native-reorderable-list` ^0.18 (installed, unused), Reanimated 4, gesture-handler 2.28, theme tokens, Jest.

## Global Constraints
- Every color/size/spacing/font from `useTheme()` tokens — no raw literals.
- reactCompiler gotcha: Pressable bare wrapper, visual on inner Animated.View, reanimated via `.get()/.set()`.
- Animation HARD RULE: no bounce/overshoot/slide-in on content; fades/settles only.
- Modal HARD RULE: `headerShown:false`, SheetGrabber, gutters via root `contentStyle`, `minHeight: winH*0.95 - insets.bottom` anchor — all already in `plan.tsx`; keep them.
- No guilt/shame copy. One filled primary CTA per surface (the drawer's is **Done**).
- `npm run lint` clean at --max-warnings=0; typecheck clean; run affected suite + `npm test` before each commit.
- Conventional Commits, NO AI/co-author attribution. Stage only each task's files (never `git add -A`).
- Work in the worktree `/Users/alisuliman/Business/income/Apps/Whenbee/.worktrees/plan-sheet`; confirm `git branch --show-current` == `feat/plan-sheet` before every commit.

---

### Task 1 — Entry: `PlanButton` on the UP NEXT row

**Files:** create `src/features/today/PlanButton.tsx` + test; modify `src/app/(tabs)/index.tsx` (~437–467).

- Replace the `PlanStrip`(planned)/`PlanMyDayButton`(unplanned) entry (`index.tsx:437–451`) with a compact `PlanButton` rendered **far-right on the UP NEXT title row** (`index.tsx:467`, the `<Text style={sectionLabel}>UP NEXT</Text>` — wrap it in a space-between row with the button).
- `PlanButton({ hasPlan, startByClock, onPress })`: dark pill (`t.colors.surfaceRaised` / same as `PlanStrip`'s bg), indigo map icon (`Ionicons "map-outline"`, `t.colors.primary`), mono text, chevron. Planned → `plan {startByClock}` (e.g. "plan 15:00", 24-h, so strip meridiem — use the clock without am/pm, mono, `t.colors.ink`); unplanned → `plan my day`. Bare Pressable + inner Animated.View press-scale (mirror `PlanMyDayButton`). Pro-gating stays in `handlePlanMyDay`.
- Keep `handlePlanMyDay` (`index.tsx:144`) as the onPress for unplanned; for planned, onPress `router.push('/(modals)/plan')` (no re-plan side effects — mirror the current `PlanStrip` onPress).
- Remove `PlanStrip` import/usage from `index.tsx` (leave `PlanStrip.tsx` file for now; the final-review will decide deletion). Keep `PlanMyDayButton` import only if still referenced.
- The button shows whenever `totalCount > 0` and `upNext.length > 0`. If there are queued tasks but no UP NEXT section (edge: all done), the plan still opens from the reward/other paths — do NOT invent a second entry in this task; note it as a follow-up if the reviewer flags it.

- [ ] Write a failing test (`PlanButton.test.tsx`): planned renders `plan 15:00` + fires onPress; unplanned renders `plan my day`.
- [ ] Run → fail. Implement component (tokens only). Run → pass.
- [ ] Update `todayScreen.test.tsx` assertions that referenced `PlanStrip`/the old button to the new `PlanButton` on the UP NEXT row (real behavior, not weakened). Run `npm test`.
- [ ] Lint + typecheck. Commit `feat(plan): compact plan button on the list-title row`.

---

### Task 2 — Drawer header: padded, start-by/finish-by justified, same size

**Files:** modify `src/app/(modals)/plan.tsx` (title block ~45–53); `src/features/today/DayTimeline.tsx` (add `hideHeader`, ~503–513).

- Add `hideHeader?: boolean` to `DayTimeline`; when true, skip rendering its header `<View style={headerStyle}>…</View>` (`DayTimeline.tsx:503–513`) — rows only. The sheet passes `hideHeader`.
- In `plan.tsx`, below the "Today's plan" title (`heading`, line 45), add a header line: a space-between row — left `Start by {clock}` (`t.colors.accent`/amber, `type.body` mono, `t.fontFamily.mono`), right `finish by {clock}` (`t.colors.inkSoft`, **same fontSize** as start-by, mono). Both clocks from the plan (`plan.startBy` for start; the plan's last `endAt` / `doneByMin` for finish). Add top padding to the title block so the title clears the grabber (bump the existing top padding by one space step).
- `plan.tsx` already calls `useDayPlan()` (line 30) — reuse it for the clocks (and `doneByMin` for finish-by).

- [ ] Failing test: `DayTimeline` with `hideHeader` renders no start-by header (`queryByText(/Start by/)` null) but still renders rows; `plan.test.tsx` renders the justified "Start by"/"finish by" line at equal font size.
- [ ] Run → fail. Implement. Run → pass. `npm test`.
- [ ] Lint + typecheck. Commit `feat(plan): padded drawer header with justified start-by / finish-by`.

---

### Task 3 — Bottom controls (style A): neutral Done-by + Nudge, Done as CTA

**Files:** modify `src/app/(modals)/plan.tsx` (footer ~56–59); reuse `DoneByChip` + `useStartByToggle`; may add a small neutral control or props.

- Footer layout: a divider (`t.colors.hairline`, 1px top border) above a controls row, then the Done button.
- Controls row (two equal-flex neutral pills, `t.colors.surfaceRaised` bg):
  - **Done-by** pill — reuse `DoneByChip`'s time-picker behavior (it calls `setDoneBy` from `useDayPlan`), restyled neutral (label `Done by {clock} ›`, `t.colors.inkSoft`/quiet). If `DoneByChip` can't be restyled cleanly via a prop, render an equivalent neutral pill in `plan.tsx` that opens the same ActionSheet picker and calls `setDoneBy`.
  - **Nudge** pill — neutral bg; uses `useStartByToggle` (the shared hook). Bell + "Nudge" + inline toggle (toggle track amber-on/`t.colors.hairline`-off). Replaces the standalone `PlanReminderChip` in the footer for this sheet. (Do NOT restyle the shared `PlanReminderChip` component — render the neutral control inline in `plan.tsx` using `useStartByToggle`, so other options' chip is untouched.)
- **Done** button → filled indigo **CTA**: `<AppButton label="Done" variant="primary" fullWidth onPress={router.back}>` (change from `variant="ghost"`). This is the drawer's one primary.
- Move the start-by-reminder scheduling nothing changes (the toggle still drives `startByEnabled`).

- [ ] Failing test (`plan.test.tsx`): footer shows a neutral Done-by control + a Nudge toggle + a primary Done; toggling Nudge calls the start-by toggle; Done-by opens the picker / calls setDoneBy.
- [ ] Run → fail. Implement (tokens only, reactCompiler-safe). Run → pass. `npm test`.
- [ ] Lint + typecheck. Commit `feat(plan): neutral bottom controls, Done as the CTA`.

---

### Task 4 — Drag-to-reorder the plan's tasks

**Files:** `src/stores/dayTasksStore.ts` (+ its repo) — new `reorderTasks(ids: string[])`; `src/features/today/useDayPlan.ts` (~111–127) — skip `orderForFocus` when a manual order exists; `src/features/today/DayTimeline.tsx` — reorderable task list; tests.

- **Store:** add `reorderTasks(ids: string[])` to `dayTasksStore` modeled on `promoteToFocus` (`dayTasksStore.ts:356–362`): assign ascending `orderIndex` to `ids` in the given order via `repo.update(id, { orderIndex })`, then refresh `dayTasks`. Add a per-day flag that a manual order exists (persist via `dayMeta` or a kv keyed by day) so `useDayPlan` knows to honor it. Unit-test the action (memory db).
- **useDayPlan:** when the selected day has a manual order, sort `resolvedTasks` by `orderIndex` (via `byOrder`) and **skip** the `orderForFocus` deep-first reshuffle (`useDayPlan.ts:111–117`); otherwise keep current behavior. Unit-test both paths.
- **DayTimeline reorderable list:** replace the `ScrollView` + `plan.timeline.map` (`DayTimeline.tsx:524–551`) with `react-native-reorderable-list`. Only `kind:'task'` items are draggable; `event`/`breather` items are fixed (non-draggable) anchors — restrict drag to the task subsequence (e.g. render events/breathers as non-reorderable separators, or reorder only the task ids and re-derive). Use **long-press to activate** the drag (the sheet is a gesture-enabled formSheet — avoid hijacking drag-down-to-dismiss and the inner scroll). On drop, compute the new task-id order and call `reorderTasks`. Show a grip affordance (`⋮⋮`, `t.colors.inkFaint`) on task rows.
- **Reactive warning:** the existing `<OverflowBanner>` (`DayTimeline.tsx:515–521`) already renders `plan.verdict` live and updates on recompute — keep it; it is the non-blocking, auto-clearing advisory. No new blocking flow. (Phase 2 will extend its suggestions to calendar-aware "move after X".)

- [ ] Failing tests: `reorderTasks` writes ascending orderIndex + sets the manual-order flag; `useDayPlan` honors manual order (skips deep-first) when the flag is set. (Reorder gesture itself is validated on-device — note it; unit-test the store + hook seam.)
- [ ] Run → fail. Implement store + hook. Run → pass.
- [ ] Implement the reorderable `DayTimeline` list (task-only drag, long-press). Verify the sheet still dismisses and scrolls. `npm test`.
- [ ] Lint + typecheck. Commit `feat(plan): drag-to-reorder plan tasks (manual order feeds the planner)`.

---

## Phase 2 (later, separate)
Calendar-aware smart move suggestions in the overflow advisory: when a task won't fit before a calendar event but the finish-by deadline still has room, offer "move after {event}" (or after the task following the event) instead of only "tomorrow". New engine logic in the planner/verdict + wording in `OverflowBanner`. Not in Phase 1.

## Self-review
- Covers: entry button (T1), header fix (T2), controls A + CTA Done (T3), drag-reorder + reactive warning (T4). Phase 2 explicitly deferred.
- Reactive warning reuses the existing live `OverflowBanner` — matches the founder's useEffect/non-blocking model.
- No planner-engine change in Phase 1 (order fed upstream); `PlanReminderChip` shared component left untouched (neutral nudge rendered inline).
