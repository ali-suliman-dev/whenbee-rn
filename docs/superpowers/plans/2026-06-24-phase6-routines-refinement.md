# Planning Expansion — Phase 6: Routines Refinement

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Checkbox steps.
> **Branch off Phase 5** (`feat/planning-focus`, PR #52). Consumes the routines store/engine/repo, the notifications pattern (`timerNotifications.ts`), `liveActivity.ts` (guarded), `dayTasksStore`/`useDayCapacity` (for day-block materialization), `calibrationStore` (seeding).
> NOTE: the real system date may roll past 2026-06-24 — any date-dependent test MUST pin the clock (`jest.spyOn(Date,'now').mockReturnValue(fixed)`).

**Goal:** Make Routines actionable, not inert. Add **scheduling + real start-by alerts**, an **auto-advancing run** with a chime + live countdown, **calibration-seeded step durations** (zero setup), a **pre-built example** empty state, **behavior-framed copy**, **day-block materialization** (a scheduled routine shows as a collapsible block on its days and counts toward capacity), and the **Plan→Routines tab rename** (Start-By is now per-day via Plan-my-day, so the tab becomes Routines-only).

**Architecture:** Additive migration adds `scheduleDays`/`alertEnabled`/`alertLeadMin` to `routines`. A `routineNotifications` service mirrors `timerNotifications` (lazy native module, permission, schedule/cancel by kv-stored id). The run flow gains auto-advance + a chime + a guarded Live Activity. Materialization is a **derived read** (a hook that, for a selected day, returns scheduled routines as synthetic blocks) consumed by Today + capacity — NOT duplicated task rows. The Plan route drops Start-By and renders Routines directly.

**Tech Stack:** TS strict, expo-notifications (guarded), Zustand, Reanimated, Jest. Spec §9.2, §4.4, D10, §19. Native presence/Live Activity is a guarded no-op until the device build (in-app countdown ships now).

## Global Constraints
- **No guilt.** A missed routine never scolds; recap stays gain-only. Alerts are gentle nudges, never nags. **Honey/sharpness monotonic** (routine learning never regresses a tier).
- **Notifications guarded** by the lazy-module + `isExpoGo` pattern (no-op in Expo Go/tests); permission asked gently on first enable; cancel on unschedule/delete (kv-stored ids). No notification spam.
- **Materialization is a derived read** — never write duplicate task rows; a scheduled routine block is computed for the day, counts toward capacity, and completing it logs a routine run.
- Pro: Routines stays Pro (free = locked teaser). Tokens only (new group → useTheme line). Animation entering-only, reduced-motion → final, no bounce; chime respects the system silent switch + reduced-motion (no chime if reduced-motion? keep audio but no haptic bounce — decide, document). reactCompiler Pressable gotcha. Layer rule. TS strict + noUncheckedIndexedAccess. Conventional Commits; NO AI/co-author attribution. Pre-commit: eslint 0, typecheck, jest green ×2.

---

## Section A — Scheduling + alerts

### Task A1: Routine scheduling fields (migration + model + store)
**Files:** `src/db/migrations.ts` (append 0011), `src/domain/types.ts` (+ db `RoutineRow`), `src/db/Database.ts` + both adapters, `src/db/repositories/routinesRepo.ts`, `src/stores/routinesStore.ts`; tests for the repo + store.
**Interfaces:** `Routine` gains `scheduleDays: number[]` (weekdays 0–6; empty = unscheduled), `alertEnabled: boolean`, `alertLeadMin: number`. Migration 0011: `ALTER TABLE routines ADD COLUMN schedule_days TEXT NOT NULL DEFAULT '' ; ADD COLUMN alert_enabled INTEGER NOT NULL DEFAULT 0 ; ADD COLUMN alert_lead_min INTEGER NOT NULL DEFAULT 0` (store `scheduleDays` as a comma-joined string in the row; map to number[] in the repo). Store draft actions: `setSchedule(days)`, `setAlert(enabled, leadMin)`; persisted via saveDraft.
- [ ] TDD: repo round-trips scheduleDays/alert fields (both adapters); migration applied; store draft carries + saves them. Commit `feat(routines): scheduling + alert fields (migration 0011)`.

### Task A2: `routineNotifications` service + wire to save/delete
**Files:** Create `src/services/routineNotifications.ts` (mirror `timerNotifications.ts`); wire into `routinesStore.saveDraft`/`remove`; test (mock the module).
**Interfaces:** `scheduleRoutineAlerts(routine, startByMinuteOfDay): Promise<void>` — for each `scheduleDays` weekday, schedule a WEEKLY local notification at (startBy − alertLeadMin) with body "Time to start {routine.name} to be done by {doneBy}"; store the ids in kv keyed by routine id. `cancelRoutineAlerts(routineId): Promise<void>` — cancel all. `ensureNotificationPermission` reused. All guarded (no-op Expo Go/tests). On saveDraft: cancel old + reschedule when `alertEnabled && scheduleDays.length`; on remove: cancel.
- [ ] TDD (mock the lazy module): scheduling an alert-enabled routine schedules N notifications (one per scheduleDay); disabling/deleting cancels them; Expo Go path is a no-op. Commit `feat(routines): start-by alerts on scheduled days`.

---

## Section B — Run + build

### Task B1: Auto-advance run + chime + live countdown
**Files:** `src/features/routines/RoutineRunView.tsx` (+ `routinesStore` if needed), `src/services/liveActivity.ts` wiring; test.
**MANDATORY skills:** `react-native-expert`, `creating-reanimated-animations`, `motion-design`, `ui-design:interaction-design`, `clean-code`.
- The running step shows a **live countdown** to its honest estimate (not just elapsed up-count) — when it reaches the honest minutes, a **gentle chime** + the step **auto-advances** to the next (with a brief "next: {label}" beat), or the user can tap Done early / Skip. Keep manual Done/Skip. Auto-advance never punishes overrun (it just rolls on; recap stays gain-only).
- Wire `liveActivity.startFinishTimeActivity()` for the running step (guarded no-op until device build) + `end…` on finish/abandon — so the lock-screen countdown lights up on device.
- Reduced-motion → no animated transitions (instant advance); chime honors the silent switch.
- [ ] TDD: a step reaching its honest minutes auto-advances to the next (fake timers); manual Done still advances; abandon ends the activity. (Pin the clock if date-sensitive.) Commit `feat(routines): auto-advancing run with chime + live countdown`.

### Task B2: Calibration-seeded step durations
**Files:** `src/features/routines/RoutineBuildView.tsx` (+ the step composer); test.
- When a step's category is picked, **pre-seed its guess** from the user's learned number for that category (`statsByCategory[category]?.mEffective` → a sensible starting guess, or `resolveSuggestion` at a base) instead of the flat 15m default; show a quiet "typical: {n}m" caption. The user can still override. Zero-setup edge (the thing that sinks competitors).
- [ ] TDD: picking a category with learned stats seeds the step guess from it; a cold category falls back to the default. Commit `feat(routines): calibration-seeded step durations`.

### Task B3: Example routine empty state + behavior copy
**Files:** `src/features/routines/RoutinesList.tsx` / empty state (+ a seed helper); copy across routines surfaces; test.
**MANDATORY skills:** `conversion-psychology`, `humanizer`, `retention-optimization`.
- Empty state ships a **pre-built example "Morning routine"** (3–4 steps with real seeded durations) the user can **run once** before building their own (don't force setup-first). Framing copy is a **behavior, not a noun**: "A guided sequence that runs on a timer — it tells you what to do now, then moves you on." Reframe the build/run/recap copy accordingly. No-guilt.
- [ ] TDD: empty state renders the example + a "try it" affordance that starts a run (or pre-fills the build) without persisting a junk routine until saved. Commit `feat(routines): example routine empty state + behavior-framed copy`.

---

## Section C — Materialization + tab

### Task C1: Day-block materialization (scheduled routines on the day + capacity)
**Files:** Create `src/features/today/useScheduledRoutines.ts` (+ test); wire into `useDayCapacity` (Phase 3) + the Today list (a collapsible routine block) + the Timeline (an anchor-like block).
- `useScheduledRoutines(selectedDate): { blocks: { routineId; name; honestTotalMin; startByMin: number|null }[] }` — derived: for the selected day's weekday, the routines whose `scheduleDays` include it, each as ONE block with its honest total + start-by (from the routine's doneBy). No DB task rows created.
- Capacity: feed each block's `honestTotalMin` into `useDayCapacity`'s task minutes (so a scheduled routine counts toward "will it fit").
- Today list: render each scheduled routine as a **single collapsible block** ("Morning routine · 50m · start by 8:10") that expands to its steps; tapping "run" starts the routine run. Timeline: the block appears at its start-by like an anchor.
- [ ] TDD: a routine scheduled for the selected weekday yields a block with the right honest total; it adds to capacity; unscheduled day → no block. Commit `feat(today): scheduled-routine day blocks (+ capacity)`.

### Task C2: Plan → Routines tab rename (drop Start-By)
**Files:** `src/app/(tabs)/_layout.tsx` (title Plan→Routines), `src/app/(tabs)/plan.tsx` (render Routines directly; remove the Start-By/BuildView/RunView branch + PlanSegment), `src/features/routines/PlanSegment.tsx` (delete if now unused). Consider renaming the route file `plan.tsx`→`routines.tsx` (update `_layout` Stack.Screen name).
- The tab becomes **Routines-only**. Start-By's manual build/run (`usePlanner`/`BuildView`/`RunView`) is retired from the tab (the per-day Plan-my-day replaced it). Delete the now-orphaned planner build/run UI IF nothing else imports it (grep; KEEP the pure engine `planner.ts` + `planDayAroundAnchors`).
- [ ] TDD: the Routines tab renders the routines library directly (no segment); `_layout` shows "Routines"; grep confirms no dangling Start-By tab refs. Commit `refactor(nav): rename Plan tab → Routines (Start-By now per-day)`.

---

## Section D — Polish + review
### Task D1: copy + a11y + Pro + review
- [ ] All routines strings through conversion-psychology + humanizer + retention-optimization (behavior framing, no guilt, no streak). a11y on the run controls, the day-block, the schedule/alert settings. Pro-gate: Routines + scheduling are Pro (free locked teaser); confirm no leak. Notification copy gentle. Commit `style(routines): copy/a11y/gate polish`.

## Self-Review
**Coverage:** §9.2 (alerts, live countdown, auto-advance, calibration-seeded, example, behavior copy, day blocks) → A2/B1/B2/B3/C1; §4.4 scheduling fields → A1; D10 → all; tab rename (D8/§19) → C2. Out of scope: export (Phase 7), Patterns segments (Phase 8).
**Decisions:** Live Activity is a guarded no-op (in-app countdown ships); materialization is a derived read; example routine isn't persisted until saved.

## Execution
Subagent-driven off `feat/planning-focus`, PR at the end (never merge). Gates: on-device notification + Live Activity + chime verification.
