# Planning Expansion — Phase 7: Export Tasks → Device Calendar

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Checkbox steps.
> **Branch off Phase 6** (`feat/planning-routines`, PR #53). Consumes `src/services/calendar.ts` (read + the existing `writeAdjustments` write), `settingsStore.calendar` (Phase 3), `useDayPlan`/`planDayAroundAnchors` (the timed plan), `dayTasksStore`/`tasksRepo` (tasks carry `calendarEventId` from Phase 1), `useEntitlement`.
> NOTE: pin `Date.now` in any date-dependent test (real date may be past 2026-06-24).

**Goal:** Let Pro users push their planned day to the device calendar — writing ONLY to a dedicated app-owned "Whenbee" calendar, never the user's primary, with an explicit "turning this off removes those events" contract. Highest-demand calendar feature; safe because it owns its calendar.

**Architecture:** The calendar service gains app-owned-calendar write ops (create the Whenbee calendar; create/update/delete events IN IT ONLY; delete-all). An export service syncs a day's TIMED plan (tasks with a computed start from Plan-my-day) into the Whenbee calendar, linking each task via `tasks.calendarEventId`; it updates on edit/move, deletes on task-delete, and deletes everything on disable. A settings toggle + the contract gate it. All guarded by `isExpoGo` (no-op in Expo Go/tests); Pro-only.

**Tech Stack:** TS strict, expo-calendar (guarded), Zustand, Jest. Spec §8.2, D5, §4.5. Native calendar writes are unverifiable in jest (stub) — on-device verification is the founder's gate.

## Global Constraints
- **WRITE SAFETY (do not weaken).** The export NEVER writes to or deletes from any calendar except the app-owned "Whenbee" calendar (identified by `settings.calendar.whenbeeCalendarId`). No event is touched unless it carries a `tasks.calendarEventId` we created. Disabling export deletes ONLY the Whenbee calendar's events (and offers to remove the calendar). Mirror the strict trust-model header comment in `calendar.ts`.
- **Explicit contract.** The enable flow + the settings row state plainly: "Whenbee creates its own calendar. Turning this off removes those events." No silent writes to primary.
- **Guarded** by `isExpoGo` + the lazy native module — no-op in Expo Go/tests/CI. **Horizon cap** (export at most the next N days, e.g. 14) — `log` what's capped (no silent unbounded writes).
- **Pro-only.** Free users can't enable export. Tokens only. TS strict + noUncheckedIndexedAccess. Layer rule. Conventional Commits; NO AI/co-author attribution. Pre-commit: eslint 0, typecheck, jest green ×2.

---

## Section A — Service + settings

### Task A1: Settings — export fields
**Files:** `src/stores/settingsStore.ts` (extend the `calendar` slice from Phase 3) + test.
**Interfaces:** `settings.calendar` gains `exportEnabled: boolean` (default false) + `whenbeeCalendarId: string | null` (default null) + actions `setExportEnabled(b)`, `setWhenbeeCalendarId(id|null)`. Persist-migration backfills.
- [ ] TDD: defaults + actions persist. Commit `feat(settings): calendar export fields`.

### Task A2: Calendar service — app-owned write ops
**Files:** `src/services/calendar.ts` (extend `CalendarModule`) + test (stub path).
**Interfaces (added to `CalendarModule`, all guarded):**
- `ensureWhenbeeCalendar(existingId: string | null): Promise<string>` — returns a valid Whenbee-calendar id; creates the calendar ("Whenbee", app-owned source) if `existingId` is null or no longer exists. (Stub returns a fake id.)
- `createWhenbeeEvent(calendarId: string, e: { title: string; startMs: number; endMs: number }): Promise<string>` — create an event in that calendar; returns its native id.
- `updateWhenbeeEvent(eventId: string, e: { startMs: number; endMs: number; title?: string }): Promise<void>`
- `deleteWhenbeeEvent(eventId: string): Promise<void>`
- `deleteAllWhenbeeEvents(calendarId: string): Promise<number>` — delete every event in the Whenbee calendar (for disable); returns count.
- `deleteWhenbeeCalendar(calendarId: string): Promise<void>` — remove the app-owned calendar entirely (optional, used on full disable).
Native impl uses `Calendar.createCalendarAsync` (app-owned source — pick the default modifiable source; handle iOS source selection), `createEventAsync`, `updateEventAsync`, `deleteEventAsync`, `getEventsAsync` (to enumerate for delete-all). **NEVER operate on a calendarId that isn't the Whenbee one.** Keep `requestReadAccess` + the new writes behind a `requestWriteAccess()` (calendar write permission). Stub: no-ops returning fake ids/0. Update the trust-model header comment to document the app-owned write path.
- [ ] TDD (stub path via `resolveCalendarModule(true, …)`): ensure/create/update/delete/delete-all are callable + return the stub shapes; the existing read methods + `writeAdjustments` unchanged. Commit `feat(calendar): app-owned Whenbee-calendar write ops`.

### Task A3: Export sync service
**Files:** Create `src/services/calendarExport.ts` (+ test).
**Interfaces:**
- `syncDayPlanToCalendar(input: { date: string; plannedTasks: { id: string; label: string; startMs: number; endMs: number; calendarEventId: string | null }[]; calendarId: string }): Promise<{ created: number; updated: number; deleted: number; links: { taskId: string; eventId: string }[] }>` — for each planned (timed) task: create (if no `calendarEventId`) or update its Whenbee event; the caller persists the returned `links` (taskId→eventId) onto the tasks (via `tasksRepo.update(id,{calendarEventId})`). Tasks that previously had an event but are no longer in `plannedTasks` for that day → delete their event (the caller passes the prior linked set, or this service reconciles against the calendar's events for the date — keep it simple: caller passes prior links to delete).
- `disableExport(calendarId: string): Promise<number>` — `deleteAllWhenbeeEvents` + return count (the caller clears all `tasks.calendarEventId` + the settings id).
- All guarded; horizon enforced by the CALLER (passes only ≤ N days of plans).
- [ ] TDD (mock the calendar module): syncing 2 timed tasks creates 2 events + returns links; re-syncing with one changed updates it; a removed task's event is deleted; disable deletes all. Commit `feat(calendar): day-plan export sync service`.

---

## Section B — Wire + settings UI

### Task B1: Export settings toggle + contract
**Files:** `src/features/settings/CalendarSettingsSection.tsx` (extend Phase 3's section) + test.
**MANDATORY skills:** `react-native-expert`, `conversion-psychology`, `humanizer`, `ui-design:interaction-design`.
- A Pro-only "Add my plan to a Whenbee calendar" toggle bound to `settings.calendar.exportEnabled`. On enable: request write access; `ensureWhenbeeCalendar` → store the id; show the contract copy ("Whenbee creates its own calendar — turning this off removes those events"). On disable: confirm, then `disableExport` (delete all + clear ids/links). Free users: the row routes to paywall (trigger `calendar_export`).
- [ ] TDD: toggling on requests write access + ensures the calendar + stores the id; toggling off calls disableExport; free → paywall. (Mock the calendar module + entitlement.) Commit `feat(settings): calendar export toggle + delete contract`.

### Task B2: Wire export to the planned day + task lifecycle
**Files:** Wire into `useDayPlan`/the Timeline (when export is on and a day is planned, sync it) + `dayTasksStore` (on task move/delete, update/delete the linked event).
- When export is enabled AND a day has a computed Timeline plan (Plan-my-day ran), call `syncDayPlanToCalendar` for that day (and persist the returned links). Re-sync when the plan changes. Respect the horizon cap (only sync the selected day + up to N days that have been planned — keep v1 to the SELECTED day's plan on Plan-my-day, plus a "sync" on Timeline; document the scope).
- `dayTasksStore`: when a linked task is deleted → `deleteWhenbeeEvent(calendarEventId)` + clear it; when moved/edited and export on → the next plan sync reconciles (or update directly). Keep it guarded + Pro.
- [ ] TDD: with export on, running Plan-my-day on a day syncs its timed tasks to the calendar (mock); deleting a linked task deletes its event. Commit `feat(today): export the planned day to the Whenbee calendar`.

---

## Section C — Pro/copy/a11y + review
### Task C1: gating + copy + a11y + safety audit
- [ ] Pro-gate: free can't enable export (paywall). Copy through conversion-psychology + humanizer (the contract must be unmistakable + calm). a11y on the toggle + confirm dialog. **Safety audit:** grep the export/calendar code — confirm NO write/delete touches any calendar id other than `whenbeeCalendarId`; confirm disable deletes only Whenbee events; confirm the guard (`isExpoGo`) wraps every write. Add a regression test asserting the export service never calls a write op with a non-Whenbee calendar id. Commit `style(calendar): export copy/a11y + write-safety audit`.

## Self-Review
**Coverage:** §8.2 export (app-owned calendar, link, update/delete, disable-deletes-all, contract) → A2/A3/B1/B2; §4.5 settings → A1; D5 → all; §10 Pro → B1/C1. Out of scope: Patterns segments (Phase 8), final polish (Phase 9).
**Decisions:** v1 export scope = the SELECTED day's plan on Plan-my-day (+ a manual sync), horizon-capped; full multi-day auto-sync can extend later. Native writes verified on-device (jest uses the stub).

## Execution
Subagent-driven off `feat/planning-routines`, PR at the end (never merge). **Gate: on-device calendar write/permission verification is mandatory before this ships** — the founder must confirm events land in the Whenbee calendar (not primary) and that disabling removes them.
