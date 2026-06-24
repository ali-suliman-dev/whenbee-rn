# Planning & Calendar Expansion — Design Doc

> Status: **DESIGN — approved in brainstorming, pending spec review → implementation plan.**
> Date: 2026-06-24 · Author: brainstorm session (founder + Claude) · Supersedes nothing; extends the day model.
> Research backing: 5 live-research passes (competitors, demand, task-movement UX, calendar integration UX, list-vs-timeline + IA/density). Citations live in the session, summarized inline where they drive a decision.

---

## 0. One-paragraph vision

Whenbee stops being a **today-only** calibration tool and becomes a **day planner powered by learned bias** — without losing the zero-friction, no-guilt core. The Today tab absorbs a discreet calendar strip and becomes a single **day surface**: you can plan tomorrow and any future day, tasks live on the day they belong to, finished work banks into that day as a recap, and undone work carries over silently. The differentiated payoff (Pro) is the **Honest Day** capacity read — "your real day is 9h 15m, you have ~7h" — computed from your planned tasks' honest numbers **plus** your read-only device-calendar meetings, and an on-demand **Plan-my-day** that schedules your tasks backward from a "done by" time, routing around those meetings. Tasks can also be **exported to a dedicated device calendar**. The old "Plan" tab is renamed **Routines** and focused to one job; Start-By and Focus dissolve into the day. Patterns is restructured around its archetype hero with three segments. **Everything ships in one version — no fast-follow.**

---

## 1. Product invariants (never violate)

Carried from `CLAUDE.md`, plus feature-specific rules this design introduces:

1. **No guilt, ever.** Amber never becomes red. No streaks, no shame. Specifically here:
   - No "overdue" label, no red, no count badge on carried-over tasks.
   - Capacity that exceeds free hours is stated as a fact + an *offer to move*, never "you're behind."
   - Empty future days render as neutral/inviting, never a deficit.
   - The per-day recap is a recap, never a score/streak.
2. **Honey/sharpness is monotonic.** The header honey ring only ever fills. (This is *why* we reject the capacity-ring-as-hero swap — capacity fluctuates and could read as a dropping verdict.)
3. **Core loop is on-device-only.** Guess → timer → learn makes no network call. Calendar read/write uses on-device `expo-calendar` only. No cloud.
4. **Pricing read from RevenueCat**, never hardcoded.
5. **All tokens.** Every spacing/size/font/color comes from `src/theme/tokens.ts` via `useTheme()`. New tokens get added there.
6. **Engine stays pure.** All new scheduling/capacity math is pure TS in `src/engine/`, no clock/Date access (caller passes `nowMs`/dates).
7. **Scheduling is on-demand, never always-on.** No background auto-shuffle of the user's plan (research: always-on auto-scheduling is the single most-fought behavior — Motion/Reclaim). Nothing moves unless the user pulls the trigger.
8. **Never time-pin by default.** Tasks are an *ordered, untimed* list by default. Clock times are computed only when the user asks ("Plan my day"). Forced time-blocking is the #1 reason this audience abandons planners.

---

## 2. Locked decisions (the spine)

| # | Decision | Rationale (research) |
|---|---|---|
| D1 | **Today absorbs the calendar strip**; becomes the one day surface. Default = today. | One task list = no "which today did I add to" confusion. Today-only caps the ceiling; all successful peers plan ahead. Hyperfocus users ignore the strip. |
| D2 | **Task→day model**: add lands on the *viewed* day; date chip to retarget; swipe→move; **silent no-red carryover**; one "No day yet" shelf (not a GTD inbox). No natural-language date parsing in v1. | Default-to-viewed-day + always-show-the-day kills the "wrong day" complaint. Swipe-reschedule loved; drag-drop hated on mobile. Silent carryover is the single most-requested + on-thesis behavior. NLP parsing is the #1 misfire source. |
| D3 | **Per-day banked recap** (past days) + a collapsible "all tasks that day" list under it. | Bounded "Monday, done" reads as accomplishment; an endless completed list reads as backlog. |
| D4 | **Honest Day = per-day capacity** = planned tasks (honest numbers) **+ read-only device-calendar events** vs free hours. Unifies the existing calendar-only Honest Day. Per-calendar toggle + master off; all-day events excluded from the math. | Read-only event overlay is the industry-standard model (Todoist explicitly refuses import-as-task). Capacity is a lie if it ignores meetings. |
| D5 | **Export tasks → device calendar — IN v1.** Writes only to a dedicated app-owned "Whenbee" calendar; explicit "turning this off deletes its events" contract. | Highest-demand calendar feature (Structured: 3.1k upvotes). Dangerous only if it writes to the user's primary calendar — so it never does. |
| D6 | **Calendar events are fixed anchors in the backward planner.** Plan-my-day schedules tasks into the gaps around meetings. | Makes the Start-By number genuinely honest; nobody else combines learned bias + meeting-aware routing. |
| D7 | **List is home; Timeline is an on-demand lens.** Untimed ordered list by default; "Plan my day" computes Start-By times + flips to a Timeline of the same tasks; List⇄Timeline toggle; day-level "done by" target. | Untimed-first avoids the rigidity that makes this audience quit. Plan lives *on the day*, not a separate tab. On-demand beats always-on. |
| D8 | **Tab restructure**: Today / **Routines** (was Plan) / Whenbee / Patterns. Start-By + Focus migrate onto the day. | The which-day axis lives on Today; the only remaining persistent *collection* is saved routines. |
| D9 | **Focus** → shaded band on the day Timeline + one-line insight on the List + Plan-my-day prefers it; the curve/detail moves to Patterns. | A focus insight on its own analytics screen is looked at once; it must live where you plan. A ring/score that can drop is forbidden by the no-guilt invariant. |
| D10 | **Routines refinement**: real alerts + live lock-screen countdown + auto-advance steps + calibration-seeded step durations + pre-built example routine empty state + behavior-framed copy; routines droppable as day blocks; scheduled routines auto-appear on their days and count toward capacity. | Routines today is inert ("Start by 8:10" with no alert) — the reason it felt confusing on-device. Loved routine apps live/die on reliable alerts + zero setup. Whenbee's edge: pre-seed durations from the user's own numbers. |
| D11 | **Today density**: strip + task list are the hero; focus & capacity are **quiet collapsible single-line chips**, dismissible, expand-on-tap; honey ring + settings gear stay in the header (no capacity-ring swap). | NN/g caps disclosure at 2 levels; contextual dismissible chips welcomed, standing cards = clutter. |
| D12 | **Patterns IA**: archetype badge stays the **hero**; a **3-segment control** [Numbers · Insights · Correlations] organizes the rest; Insights = the dismissable feed (delete = permanent, no regenerate). | ~4 buckets is too few for many tabs (unselected tabs hide content). A pinned identity hero + 3 segments orders the junk drawer without burying anything. |
| D13 | **No fast-follow.** Every item above ships in this version. | Founder rule: maximum value in the first iteration. |

---

## 3. Information architecture

### 3.1 Tabs — before / after

| Slot | Before | After |
|---|---|---|
| 1 | **Today** — calibration loop (guess/timer/learn, today-only task list) | **Today** — the **day surface**: strip · per-day task list · capacity & focus chips · List⇄Timeline · Plan-my-day · per-day recap · calendar overlay |
| 2 | **Plan** — segmented: Start-By (today) / Routines / Focus | **Routines** — saved recurring sequences: library · build · run (alerts + live countdown + auto-advance) · schedule |
| 3 | **Whenbee** — companion hub | **Whenbee** — unchanged |
| 4 | **Patterns** — long scroll (archetype, progress, what-changed, numbers, correlations) | **Patterns** — archetype hero + segmented [Numbers · Insights · Correlations]; Focus curve/detail added to Numbers |
| center | FAB (+) | FAB (+) — unchanged |

`src/app/(tabs)/_layout.tsx`: rename the `plan` screen's title to `Routines` (route file may stay `plan.tsx` or be renamed `routines.tsx` — see §16 migration). Start-By + Focus are removed from that tab.

### 3.2 What each surface owns

- **Today** answers *"what's on this day, will it fit, when am I sharp, and (on demand) in what order."*
- **Routines** answers *"the sequences I repeat — run one now, or schedule it to nudge me."*
- **Patterns** answers *"who am I as a time-estimator, my numbers, my insights, my correlations."*

---

## 4. Data model

### 4.1 Tasks graduate from kv list → durable per-day table

**Today (current):** `src/stores/tasksStore.ts` holds `TodayTask[]` in a kv-persisted in-memory list named `today-tasks`. There is **no tasks DB table**, and `clear()` wipes the list at day rollover. Done tasks vanish on rollover. This cannot support per-day buckets, carryover, or history.

**New:** a real SQLite table behind a repository, mirrored in `createMemoryDatabase` for tests/Expo Go (per the two-Database pattern in `src/db/client.ts`).

```
table tasks
  id            TEXT PRIMARY KEY
  label         TEXT NOT NULL
  category      TEXT NOT NULL           -- existing Category id
  guessMin      INTEGER NOT NULL
  plannedDate   TEXT NULL               -- local 'YYYY-MM-DD'; NULL = "No day yet" shelf
  status        TEXT NOT NULL           -- 'queued' | 'done'
  orderIndex    INTEGER NOT NULL        -- manual order within a (plannedDate) bucket
  doneByMin     INTEGER NULL            -- optional per-task hard deadline (minute-of-day 0–1439)
  createdAt     INTEGER NOT NULL        -- epoch ms
  completedAt   INTEGER NULL            -- epoch ms when marked done
  actualMin     INTEGER NULL            -- real minutes when known
  fromRoutineId TEXT NULL               -- set when this block is a routine instance (see §9.2)
  calendarEventId TEXT NULL             -- set when exported to device calendar (see §8.2)
```

```
table day_meta            -- day-level planning attributes
  date          TEXT PRIMARY KEY        -- local 'YYYY-MM-DD'
  doneByMin     INTEGER NULL            -- the day's "I want to be done by" target (minute-of-day)
  planComputedAt INTEGER NULL           -- last time Plan-my-day ran for this day (drives Timeline freshness)
```

Repository: `src/db/repositories/tasksRepo.ts` — `listByDate(date)`, `listCarryover(today)`, `listShelf()`, `add(task)`, `update(id, patch)`, `move(id, toDate)`, `complete(id, {completedAt, actualMin})`, `remove(id)`, `reorder(date, orderedIds)`. Day-level: `getDayMeta(date)`, `setDoneBy(date, min)`.

`tasksStore` is rewritten to be an async-backed facade over `tasksRepo` (keeping the layer rule: UI → store → repo). It exposes the **selected date** and derived selectors (§4.3). Domain types move to `src/domain/types.ts` (replace `TodayTask` semantics; keep `status: 'queued'|'done'`).

> Layer rule reminder: `src/app/**` and `src/components/**` must not import repos directly — they go through `tasksStore`.

### 4.2 Day membership & carryover rules (no mutation, no guilt)

A task's *home* is its `plannedDate`. Visibility per selected day is derived, never by silently rewriting dates:

- **Selected day = today (`T`):**
  - Show `queued` tasks where `plannedDate <= T` **or** `plannedDate IS NULL? no` (shelf stays in the shelf).
  - A queued task with `plannedDate < T` is a **carryover**: render normally with a quiet `· from {Mon}` tag. No red, no "overdue," no badge, no count.
  - Show `done` tasks whose `completedAt` local day == `T` (today's recap-in-progress / DONE TODAY section).
- **Selected day = future (`F`):** show `queued` tasks where `plannedDate == F`. (Carryover only ever flows *toward today*, never piles onto a future day.)
- **Selected day = past (`P`):** show the **recap** (done tasks where `completedAt` local day == `P`) + any tasks whose `plannedDate == P` that were never completed (shown plainly, no scolding). Past days are read-mostly.

**Done bucketing:** a done task belongs to the local day of its `completedAt`, regardless of `plannedDate`. (Finish a carried-over task today → it banks into *today's* recap.)

**Rollover:** there is no destructive `clear()`. "Rollover" is purely the date advancing; carryover is the `plannedDate <= T` rule above. A small housekeeping pass may *optionally* re-home very old undone tasks to the shelf after N days to avoid an ever-growing today list — **off by default**, decided in plan phase; if added it must be silent and reversible.

### 4.3 Selected-date state

`tasksStore` (or a thin `dayStore`) holds `selectedDate: 'YYYY-MM-DD'` (default = today, reset to today on app foreground after a day boundary). The strip writes it; Today body reads it. `viewMode: 'list' | 'timeline'` per day (defaults to `list`; only `timeline` after Plan-my-day ran and the user is on that day).

### 4.4 Routines — scheduling fields added

Existing `Routine` (`src/domain/types.ts:319–363`) already has `doneByMinuteOfDay`, `transitionFactor`, `runCount`. Add:

```
Routine += {
  scheduleDays: number[]      // weekdays 0–6 this routine is scheduled (empty = unscheduled)
  alertEnabled: boolean       // fire a start-by notification on scheduled days
  alertLeadMin: number        // minutes before start-by to alert (default 0)
}
```

A scheduled routine **materializes as a task block** on each matching day (a single collapsible block, `fromRoutineId` set on the synthesized task row) so it counts toward that day's capacity and appears on the Timeline. (Materialization is a derived read, not duplicated rows — see §9.2.)

### 4.5 Settings (calendar)

`settingsStore` adds:
```
calendar: {
  showEvents: boolean            // master overlay on/off (default: prompt on first use)
  enabledCalendarIds: string[]   // per-calendar visibility (device calendar ids)
  exportEnabled: boolean         // tasks → Whenbee calendar (default false)
  whenbeeCalendarId: string|null // the app-owned calendar id once created
}
```

---

## 5. Engine additions (pure, `src/engine/`)

All take resolved inputs (no Date/clock). Exported via `src/engine/index.ts`. Tuning in `src/engine/constants.ts`.

### 5.1 `honestDayLoad(input): DayLoadResult`
Inputs: resolved per-task honest minutes for the day's queued tasks; timed calendar events (start/end minutes, all-day excluded); the waking window (default 08:00–22:00, tunable / from settings).
Output:
```
DayLoadResult {
  taskMin: number          // Σ honest minutes of queued tasks
  eventMin: number         // Σ minutes of timed events in the waking window
  committedMin: number     // taskMin + eventMin
  freeMin: number          // wakingWindowMin − eventMin
  verdict: 'comfortable' | 'snug' | 'over'   // amber-only; 'over' is NOT red
  overBy: number           // max(0, committedMin − wakingWindowMin)
}
```
Thresholds tunable (`comfortable < 0.8·free`, `snug ≤ free`, `over > free`). `over` drives the calm "~2h heavy — move one?" copy, never a failure state.

### 5.2 `planDayAroundAnchors(input): PlanResult`
Extends the existing backward `planBackward` (`src/engine/`, types `PlanTaskInput`/`PlanResult`/`PlanVerdict` already defined `src/domain/types.ts:144–208`) to accept **fixed anchor blocks** (calendar events as immovable `{startAt, endAt}`).
Algorithm: fragment the day (from `doneByMin` working backward) into free windows split by anchors; place tasks (in order) into windows, jumping over anchors; a task that cannot fit before an anchor is pushed to the prior window. Output reuses `PlanResult.timeline` with `kind: 'task' | 'breather' | 'event'` (extend `PlanTimelineKind`). Verdict ladder unchanged (`fits` / `cut-one` / `multi-cut` / `push-deadline`) but framed no-guilt: "cut-one" → "move one to tomorrow?".
**Focus preference:** when ordering is ambiguous, prefer placing high-bias / deep-work tasks inside the learned focus band (soft tiebreak, never a hard constraint).

### 5.3 Reuse
- `resolveHonestTasks.ts` (`src/features/planner/`) already resolves tasks → honest minutes; the spec §8 note about extracting a shared resolver is now in-scope — extract to `src/engine` or a shared hook used by capacity + Plan-my-day + focus fit.
- Focus engines (`focusWindowLearn.ts`, `focusWindow.ts`) are unchanged in math; only their *surfaces* move (§9).

---

## 6. Calendar strip (component)

- One horizontal **7-day row**, today highlighted (indigo per `colors.primary`), `sel` = solid ink pill, dots = days with tasks (single amber dot; do not stack multiple). All-day events do **not** add dots.
- **Swipe** left/right moves week-to-week; bidirectionally infinite, **range cap ~1 year** each direction (prevents date drift; recycler pattern). Tapping a day sets `selectedDate`.
- Lives directly under `ScreenHeader` on Today. Discreet: one row, one accent, optional single dot. Never a second calendar surface (no month grid in the header).
- States per day cell: default / today / selected / muted(out-of-week-context). Today-vs-selected must be visually distinct (the most common confusion).
- Package: evaluate `react-native-calendar-strip` vs a hand-rolled recycler in the plan phase (compat with Expo SDK 54 / RN 0.81 / Reanimated is the gate — verify before adding any dep; prefer hand-rolled if the dep is unmaintained on SDK 54).

---

## 7. Add-task flow

Modal `(modals)/add-task.tsx` (exists). Changes:
- **Default day = `selectedDate`.** The sheet **always shows the target day** ("Adding to Thursday" / "Today") — never silent.
- **One add field + an optional date chip.** Big default action commits to the shown day. A small date chip opens a compact date picker to retarget (or "No day yet" → shelf). **No natural-language parsing in v1.**
- From Today's empty/normal state, "+ Add a task" → adds to `selectedDate` and (for today) the task is immediately startable (one-tap-start preserved — the sacred case).
- "No day yet" shelf: a quiet list reachable from Today (a small "Someday / No day yet" entry), not a GTD inbox demanding processing.

---

## 8. Calendar integration

### 8.1 Read-only overlay (feeds capacity + Timeline + anchors)
- Uses `expo-calendar` (already a dependency; `NSCalendarsUsageDescription` already in `app.json` — keep). On first use, prompt; if denied, capacity simply omits events and a calm one-liner offers to enable in Settings.
- Events render **read-only**, greyed, tappable → open in Apple Calendar. Never editable, **never imported as tasks**.
- All-day events: separate quiet row, **excluded from capacity math** and from anchor routing.
- Controls (Settings): master `showEvents` toggle + per-calendar `enabledCalendarIds`. Both required (research: uncontrolled overlay = clutter complaints).
- Reuse/refactor `src/features/calendar/` (`useHonestDay`, `buildHonestDay`, `HonestDayPreview`): the existing calendar-buffer logic becomes the **events input** to `honestDayLoad`, not a separate feature/modal. The standalone `(modals)/honest-day.tsx` is repurposed or removed in favor of the inline capacity chip (decide in plan phase; keep the `ProGate` pattern).

### 8.2 Export tasks → device calendar (Pro, v1)
- Writes **only** to a dedicated app-owned calendar named "Whenbee," id stored in `settings.calendar.whenbeeCalendarId`. **Never** the user's primary.
- Only timed tasks (after Plan-my-day) export, as events at their computed start/honest-duration; `tasks.calendarEventId` links them for update/delete.
- **Explicit contract** in the enable flow and Settings: *"Whenbee creates its own calendar. Turning this off removes those events."* Mirrors Todoist's safe model; avoids the data-loss class of bugs (writing to primary, delete loops).
- Edge cases: task edited/moved → update the linked event; task deleted → delete the event; export disabled → delete the Whenbee calendar's events (with the stated warning). Recurring/routine blocks export per-occurrence for the visible horizon only (cap, e.g. 14 days) to avoid unbounded writes.

---

## 9. Screen specs

### 9.1 Today (the day surface)

**Header (`ScreenHeader`, unchanged structure):** eyebrow greeting · "Today" (or the day's name when a non-today day is selected, e.g. "Thursday") · date subtitle · right cluster = **settings gear (top-right, HIG)** + **honey ring** (companion presence + tap → Whenbee hub). **No ring swap.**

**Strip:** §6, directly under the header.

**Intelligence chips (the density rule, D11):** two quiet **single-line collapsible chips** between strip and the task hero, each on `surfaceSunken`, dismissible (×), expand-on-tap:
- **Capacity chip** — collapsed: `⚡ Honest day 4h 20m · fits`. Expanded (in place): a thin two-segment bar (tasks vs meetings) + legend + free hours. `over` → amber chip + "~2h heavy — move one?" (calm; tapping offers to move a task to another day). Pro-gated: free users see a frosted teaser line ("See if {day} will fit") → paywall; never a fake number.
- **Focus chip** — collapsed: `◑ Sharpest 9–11am · deep work`. Only shows when a personal focus window is learned and the window hasn't passed. Free = teaser ("Your focus window is ready"). Pro = the times. (Replaces today's `TodayFocusHook` row.)
- Both: expand = 2-level max disclosure; dismiss = gone for the session, no nag.

**Body — List mode (default):**
- `Next` hero = the focus task (oldest queued for the selected day) — existing `FocusCard` / `RunningFocusCard` with the single indigo Start CTA. (Hyperfocus users see exactly this, unchanged.)
- `Up next` = remaining queued rows (`TaskRow`): tap → start; **swipe → reveal "Tomorrow / pick a day" (move) + delete**; long-press → sheet. Carryover rows show `· from {day}`.
- `Done today` (today) / per-day recap (past) — see below.
- "+ Add a task" (to `selectedDate`).
- `RetroLogChip` retained.

**Body — Timeline mode (after "Plan my day"):**
- A **List⇄Timeline toggle** at the top of the body. "Plan my day" computes `planDayAroundAnchors` from the day's `doneByMin` + queued tasks + calendar anchors and flips to Timeline.
- Timeline shows tasks at computed clock positions, **calendar events as fixed anchor blocks** (greyed), and the **learned focus window as a shaded band**. Each task: start time + honest duration. No-guilt overflow → "move one to tomorrow?" (never red).
- The day-level **"done by" target** is set here (an optional control); absent → Plan-my-day orders without a hard end (uses now/`wakingWindow`).
- Editing in Timeline (reorder, move a task off the day) re-runs the pass on demand; never auto-shuffles in the background.

**Past day (recap):** the **banked recap card** (hero summary: N of N done · real focus time · vs your guess · honey gained) + a **collapsible "All tasks · {day}"** list beneath (the toggle pattern). Empty future day: neutral invite ("Saturday's wide open — add what future-you should tackle. It carries over free.") + capacity teaser (Pro).

**States enumerated:** first-run (no tasks ever) · today with tasks · today empty · future day empty · future day planned (list) · future day planned (timeline) · past day with recap · past day empty · calendar denied · over-capacity. Each must honor no-guilt + token-only styling.

### 9.2 Routines tab (renamed from Plan, focused)

**Purpose:** the library of saved recurring sequences + running/scheduling them. (Start-By and Focus are gone from here — they live on the day.)

**List view:** routine cards (name · step count · honest total · basis label · scheduled days). Empty state ships a **pre-built example morning routine** with real step durations the user can run once before building their own. Copy frames the behavior, not the noun: *"A guided sequence that runs on a timer — it tells you what to do now, then moves you on."*

**Build:** add ordered steps (label + category + guess). **Pre-seed each step's duration from the user's own calibrated numbers** for that category (zero-setup edge). Optional "Be done by" time. Optional schedule (weekdays + alert toggle + lead minutes).

**Run (the fix for "inert / lost"):**
- Sequential **auto-advance**: "do this {honest}m → next," with a gentle chime per step.
- **Live lock-screen countdown** via the existing Live Activity infra (`services/liveActivity.ts`); reliable **start-by notification** on scheduled days (`expo-notifications`, scheduled like timer/review alerts). Alerts are the product for routines — they must be rock-solid.
- Learns per-step durations + chain-level `transitionFactor` (existing `src/engine/routine.ts`), so the honest total + start-by tighten over runs.
- No-guilt recap on finish (existing copy).

**On the day:** a scheduled routine **materializes as a single collapsible block** on its days (`fromRoutineId`), counts toward capacity, and appears on the Timeline anchored by its start-by. Materialization is a *derived read* (don't duplicate task rows); completing the block logs a routine run.

**Pro:** Routines is Pro (as today). Free sees the locked teaser (`RoutinesLocked`).

### 9.3 Patterns (archetype hero + 3 segments)

- **Archetype hero** stays the prominent identity header (current treatment) — pinned, always visible above the segments. Tappable to its evidence; never a guilt score, never horoscope-generic (earned from real calibration).
- **Segmented control** [Numbers · Insights · Correlations]:
  - **Numbers** (free): accuracy trend sparkline (`ProgressChart`) + per-category `HonestMap`. **+ the Focus-window curve/detail** (migrated from the old Plan tab — `FocusCurve` + window range + maturity meter).
  - **Insights** (free): the **dismissable feed** — Drift Note, Biggest Surprise, Plan Experiment. **Delete = permanent (no regenerate)** — persist dismissals (today they're session-only `useState` in `PatternCard`; make them durable). Pull-based, no push, no urgency.
  - **Correlations** (Pro): Steals-Your-Time (+ weekly), Accuracy correlations, Context correlations. Non-Pro sees one frosted teaser, never a fake number.
- Review Ritual card placement: keep accessible (top of Numbers or pinned near the hero — decide in plan phase); it's the one amber moment.

---

## 10. Pro gating map

| Surface | Free | Pro |
|---|---|---|
| Calendar strip + per-day tasks + carryover + move + shelf | ✅ full | ✅ |
| Plan tomorrow / future days (list) | ✅ | ✅ |
| **Honest Day capacity read** | teaser line → paywall | ✅ number + breakdown |
| **Calendar event overlay** (read) | ❌ (part of capacity/Pro) | ✅ |
| **Plan-my-day / Timeline (Start-By)** | ❌ teaser | ✅ |
| **Export tasks → calendar** | ❌ | ✅ |
| **Focus window** (band/insight/curve) | teaser | ✅ |
| **Routines** | locked teaser | ✅ |
| Patterns Numbers / Insights | ✅ | ✅ |
| Patterns Correlations | teaser | ✅ |

Gating must hide the *position* of a value too, not just the number (per the pro-gate-leak rule): teasers show shape, never the user's real data. Audit the free path + regression-test it.

---

## 11. Notifications & Live Activity

- **Routine start-by alert**: local notification scheduled on `scheduleDays` at `doneBy − alertLeadMin`. Reuse the pattern in `services/timerNotifications.ts` / `reviewNotifications.ts`. Reschedule on edit; cancel on unschedule/delete.
- **Routine live countdown**: Live Activity for the active run (per `liveActivity.ts`; guarded no-op until the native module lands — but the JS scheduling + in-app countdown ship now).
- No new nagging surfaces elsewhere. No capacity/planning push notifications (would be guilt-adjacent).

---

## 12. Copy (no-guilt, humanized)

Run all user-facing strings through `conversion-psychology` + `humanizer` in the plan phase. Anchor phrases:
- Carryover tag: `· from Mon` (neutral). Never "overdue."
- Over capacity: *"Your honest day is 9h 15m — about 2h heavy. Move one to tomorrow?"* Verb = **move**, never "behind."
- Empty future: *"Thursday's wide open. Add what future-you should tackle — it carries over free if life happens."*
- Routine framing: *"A guided sequence that runs on a timer."*
- Move action: *"Move to tomorrow" / "Pick a day."*
- Export contract: *"Whenbee creates its own calendar. Turning this off removes those events."*

---

## 13. Motion (per motion-design / emil-design-eng / creating-reanimated-animations)

- **Strip swipe**: horizontal, follows finger, settles ease-out (`tokens.motion.easing.out`), ~`motion.base`. No bounce.
- **Chip expand/collapse**: height/opacity, ease-out ~`motion.fast`–`base`; reduced-motion → instant final state. Per the animation HARD RULE: no slide-up-and-bounce, fade/scale-settle only.
- **List ⇄ Timeline**: cross-fade (opacity), optional subtle scale-settle; no translate-in. Reduced-motion → instant.
- **Move task**: row slides toward the chosen direction then out (entering-only elsewhere; no `exiting` layout animation on conditionally-unmounted views — Fabric SIGABRT, per project gotcha).
- Honor: no animating buttons in/out; durations < ~300ms for UI; SVG draws via real path length.

---

## 14. Edge cases (must all be handled)

1. **Timezone / midnight rollover**: bucket by *local* day deterministically; recompute `selectedDate`/today on foreground.
2. **DST**: minute-of-day math must not assume 1440-min days on transition dates (clamp/guard in planner + capacity).
3. **Calendar denied / restricted**: capacity omits events, calm enable-in-Settings line; Timeline shows no anchors.
4. **Empty calendar day**: capacity = tasks only; no error.
5. **All-day events**: separate row, excluded from math + anchors.
6. **Over-capacity**: amber, "move one?" — never red/fail.
7. **Past-day Plan-my-day**: allowed but framed as "for reference"; no alerts fire for past.
8. **Plan stale**: if tasks/events change after Plan-my-day, Timeline shows a quiet "re-plan" affordance; never silently reshuffles.
9. **Carryover pileup**: optional silent re-home to shelf after N days (off by default).
10. **Routine alert reliability**: verify scheduled notifications survive reschedule/app-kill; test on device.
11. **Export delete-loop / orphan events**: linked via `calendarEventId`; disabling export deletes only Whenbee-calendar events; never touches other calendars.
12. **Free user reaching a Pro route**: `ProGate` → paywall (existing pattern), never a writeable Pro screen.
13. **Shelf vs day**: an unscheduled task never appears on today automatically; it lives in the shelf until given a day.

---

## 15. Testing strategy

- **Engine (TDD, exhaustive):** `honestDayLoad` (verdicts, all-day exclusion, free-hours math, DST), `planDayAroundAnchors` (anchor routing, overflow → no-guilt verdict, focus-band tiebreak, empty/edge inputs). Pure → cheap to test exhaustively.
- **Repo/store:** `tasksRepo` (per-day queries, carryover rule, done-bucketing, move, reorder, shelf) on both memory + sqlite DBs; migration from kv `today-tasks` (§16).
- **Calendar:** event overlay filtering (all-day excluded, per-calendar toggle), export create/update/delete + disable-clears-events (mock `expo-calendar`).
- **Routines:** schedule materialization, notification scheduling/cancel, auto-advance, calibration-seeded durations.
- **UI:** Today states (interaction/snapshot), Patterns segments, swipe-to-move, no-guilt copy assertions.
- **Regression:** Pro-gate leak audit on every gated surface (number AND position hidden).

---

## 16. Migration

- **tasksStore kv → DB:** one-time migration reads the existing `today-tasks` kv list and inserts rows into `tasks` with `plannedDate = today`, preserving status/completedAt/actualMin. Keep a versioned migration; do not drop pre-update queues.
- **Plan tab → Routines:** rename route/title; remove Start-By + Focus segments from the tab (their logic moves to the day / Patterns). Preserve `usePlanner`/`useFocusWindow` engines; re-point their consumers.
- **Honest Day modal:** fold its calendar-buffer logic into the capacity input; repurpose or remove `(modals)/honest-day.tsx` (keep `ProGate`).
- **Patterns dismissals:** make insight dismissals durable (settings/kv), replacing session-only `useState`.
- Regenerate native projects only if a new native dep is added (`expo prebuild --clean`); `ios/`/`android/` are gitignored.

---

## 17. Analytics

Extend existing PostHog events (privacy-safe, no task content): `day_selected` (offset from today), `task_added` (target=today|future|shelf), `task_moved`, `capacity_viewed` (verdict), `plan_my_day_run` (verdict), `timeline_opened`, `focus_chip_tapped`, `routine_scheduled`, `routine_alert_fired`, `routine_run_completed`, `calendar_overlay_enabled`, `export_enabled`, `patterns_segment` (which). No content, just shape.

---

## 18. Explicitly out of scope (this version)

- Natural-language date parsing on add ("tomorrow"). (Deferred — #1 misfire source; date chip instead.)
- Always-on auto-scheduling / continuous re-shuffle. (Banned by invariant 7.)
- Importing calendar events *as editable tasks*. (No leading app does it; overlay only.)
- Multi-day / weekly grid view in the header. (One 7-day strip only.)
- Cross-device calendar sync beyond the on-device `expo-calendar` bridge.

(These are *scoped out*, not *fast-followed* — they are decisions, not deferrals of in-demand value. Everything users demanded — export, capacity, planning — is in this version.)

---

## 19. Phased implementation breakdown (input to writing-plans)

The work decomposes into ordered phases; each becomes a plan section with its own tests. Order chosen so value lands and each phase is independently verifiable:

1. **Data foundation** — `tasks` table + `tasksRepo` (+ memory DB parity) + kv migration + `selectedDate`/day-membership selectors. (No UI yet; fully unit-tested.)
2. **Today day surface — List** — calendar strip, per-day list, add-to-day + date chip, swipe-to-move, silent carryover, shelf, per-day recap + collapsible list. (The spine users feel first.)
3. **Capacity (Honest Day) + calendar overlay** — `honestDayLoad`, calendar read overlay + settings controls, capacity chip (collapsed/expanded, Pro gate), unify the old Honest Day.
4. **Plan-my-day + Timeline** — `planDayAroundAnchors`, List⇄Timeline toggle, day-level done-by, event anchors, focus-band preference.
5. **Focus migration** — focus chip on List, shaded band on Timeline, curve/detail into Patterns Numbers.
6. **Routines refinement** — alerts + live countdown + auto-advance + calibration-seeded steps + example empty state + behavior copy + day-block materialization + scheduling; rename Plan→Routines tab.
7. **Export tasks → device calendar** — Whenbee-owned calendar, link/update/delete, enable/disable contract.
8. **Patterns IA** — archetype hero + 3 segments, durable insight dismissals.
9. **Copy + motion + a11y polish + Pro-gate leak audit + device verification.**

Each phase: TDD the logic layer first, lint + typecheck + test before commit, screenshot-verify UI on the simulator, never merge (founder merges).

---

## 20. Success criteria

- A user can plan tomorrow and any future day; tasks live on their day; undone work carries over with zero guilt; finished work banks into a per-day recap.
- Pro users get an honest capacity read combining tasks + meetings, an on-demand meeting-aware Timeline, calendar export, a focus band, and reliable routines with alerts.
- The hyperfocus user's today is visually unchanged (strip ignorable; chips quiet/dismissible).
- Zero new guilt mechanics; honey ring stays monotonic; core loop stays on-device.
- Everything ships in one version.
