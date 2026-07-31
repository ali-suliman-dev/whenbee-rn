# Plan-surface redesign — making the day-planner controlled and honest

**Date:** 2026-07-07
**Status:** Design approved from mockups; specs + plans in progress
**Owner:** founder + Claude
**Supersedes nothing** — refines the Timeline / Start-By surface added in `2026-06-24-planning-calendar-expansion-design.md` and the notification wiring in `2026-06-24-notification-system-overhaul.md`.

---

## 1. Problem

On Today, the day planner is exposed as a **List / Timeline segmented control** with a **"Plan my day / Re-plan"** button beside it. This feels *uncontrolled* — like switching to Timeline quietly reaches into the calendar, generates a schedule, and may start sending notifications, with no clear moment where the user asked for any of that.

### Why it actually feels that way (research)

A segmented control has one job across every design system (Apple HIG, Mobbin, Mews, UX StackExchange consensus): **switch between alternate _views of the same content_** (list vs grid) with **zero side effects**, instantly reversible.

But the two segments here are not that:

- **List** = the user's raw tasks (input they own).
- **Timeline** = a **generated plan** that reads the device calendar (`useDayCapacity`) and can schedule a local notification (`useStartByReminder`).

So the control's *signifier* ("harmless view flip") contradicts its *affordance* ("trigger planning + calendar read + reminder"). That mismatch is the "something ran away and started messing with my day" feeling. Adding a second control ("Plan my day") next to the toggle makes it worse: two adjacent controls with overlapping meaning ("which one plans?") violate _visibility of system status_ and _consistency_ (Nielsen #1, #4).

### What the code actually does today

- `src/app/(tabs)/index.tsx:196` calls `useStartByReminder(dayPlan)` **unconditionally at the Today-screen level** — not tied to opening Timeline or tapping Re-plan. It (re)schedules whenever the plan's key values change.
- `useStartByReminder` (`src/features/today/useStartByReminder.ts:29`) is gated by `remindersEnabled && startByEnabled`. Defaults: `remindersEnabled=false` (master, opt-in), `startByEnabled=true`. So **out of the box no notification fires** — the consent gate is real and connected. The bug is not missing consent; it is **missing affordance**: nothing on the plan surface shows the reminder state, and no user action visibly corresponds to "this may now ping me."
- `useDayCapacity` (`src/features/today/useDayCapacity.ts:79`) reads the calendar whenever `isPro && calendar.showEvents` (default `false`, Pro, opt-in) — also at Today-screen level, independent of view mode. Same shape of problem: correct gate, invisible linkage.

### Non-negotiables carried into the fix

- **No guilt/shame** language or mechanics (product invariant).
- **Pricing/Pro** unchanged — Plan-my-day stays Pro-gated.
- **One filled primary CTA per screen** — the `+` FAB owns it; plan controls stay secondary/ghost.
- **Every value from a theme token** (`src/theme/tokens.ts`).
- **Modal/sheet rule:** `headerShown: false`, `SheetGrabber`, formSheet gutters via root `contentStyle` (see CLAUDE.md).

---

## 2. Shared foundation (all three options build on this)

Three directions were mocked and chosen. They differ only in **how the plan is surfaced**; they share the same underlying fix. Build the foundation once.

### 2.1 Start-by reminder becomes plan-owned and independently opt-in

**Decision:** decouple the start-by nudge from the global reminders master so the plan surface fully owns it.

- Change `useStartByReminder` gate from `remindersEnabled && startByEnabled` → **`startByEnabled` alone**.
- Flip `startByEnabled` **default `true` → `false`** in `settingsStore` (both the initial value and the reset block). It becomes a genuine opt-in the user turns on from the plan.
- Leave the master `remindersEnabled` and the other sub-types (`honestReachedEnabled`, guardrail, review, sound, quiet hours) **exactly as they are** — start-by simply stops being nested under the master.
- **Migration safety:** effective start-by today = `remindersEnabled(false) && startByEnabled(true)` = **off for essentially everyone** (master is opt-in and off by default). Flipping `startByEnabled` default to `false` preserves that off state. No user starts getting a new notification from this change.
- Settings keeps a start-by row for discoverability, now toggling the same `startByEnabled` as an **independent** row (not under the master). Copy stays plain, no guilt.

**Why decouple rather than "chip flips the master":** the master also gates `honestReachedEnabled` (default `true`). If the plan chip turned the master on, the honest-finish ping would silently start firing too — the exact silent side effect we're removing. Decoupling keeps the chip's effect scoped to precisely the reminder it names.

### 2.2 `PlanReminderChip` — the in-context reminder control (shared component)

New component: `src/features/today/PlanReminderChip.tsx`.

- **Reads** `startByEnabled` from `settingsStore`; **reflects** live state.
- **On** → amber (`accentSoft` bg, `amberText`/`accent`), bell-filled icon, copy: **"Nudge me at {clock}"** (clock = plan `startBy` in the user's meridiem format via `formatClockMeridiem`). Trailing inline switch or "· tap to turn off" affordance.
- **Off** → quiet (`surfaceSunken` bg, `inkSoft`), bell-outline icon, copy: **"Remind me to start"**.
- **Tap** toggles `startByEnabled`. Turning **on** first calls `ensureNotificationPermission()` (reuse the exact path in `useReminderSetting`/`timerNotifications.ts:80`); if denied, revert to off and surface the standard "enable in Settings" affordance. Haptic on toggle.
- All spacing/size/color from tokens; respects reduced-motion (switch settles, no bounce — animation HARD RULE).
- A11y: `role="switch"`, `accessibilityState={{ checked }}`, label reflects on/off + clock.

This chip is the single reminder affordance reused by all three options — only its **placement** differs.

### 2.3 Calendar read stays gated; provenance stays visible

- Keep `useDayCapacity`'s `showEvents` gate as-is (opt-in, off, Pro). It powers the List-view calendar overlay and CapacityChip too, so it is **not** purely a planning behavior and must not be ripped out.
- The plan surface already renders calendar-sourced rows with a calendar icon + italic label (`DayTimeline` event rows). Keep that provenance so a planned timeline visibly distinguishes "your task" from "your calendar event." No new calendar consent surface in the shared foundation (Option 3 adds one; see §5).

### 2.4 Acceptance criteria (shared)

- With `startByEnabled=false` (default), **no** `scheduleNotificationAsync` call fires for start-by; `cancelStartBy` keeps any stale one cleared. (Unit: extend `useStartByReminder` test.)
- Toggling the chip on schedules exactly one start-by at `plan.startBy`; toggling off cancels it. Verified from the store/service, not the screen.
- Turning the master `remindersEnabled` on/off no longer affects start-by. Honest-finish etc. unchanged.
- No raw hex/number literals in any new component (lint clean, `--max-warnings=0`).

---

## 3. The three directions (summary)

| Dir | Model | Plan lives in | Re-entry / "check on it" | Build target |
|---|---|---|---|---|
| **2** (pinned default) | Keep List/Timeline toggle, but Timeline **owns its action** | An empty-state inside the Timeline tab that holds the button; chip in Timeline header | Timeline tab (unchanged nav) | **main → `feat/timeline-owns-action`** |
| **1** | Plan is a **sheet** you pull up | A formSheet modal summoned from Today | Pinned **plan strip** on Today reopens the sheet | worktree `feat/plan-sheet` |
| **3** | Plan is **its own screen** you visit | A full route `(modals)/plan.tsx`, first-run setup sheet | Today's entry becomes a **live plan card** → reopens the screen | worktree `feat/plan-screen` |

Option 2 ships as the safe default; 1 and 3 are parallel explorations to compare, each ending as its own PR the founder reviews and merges. **Nothing auto-merges.**

---

## 4. Option 2 — Keep the toggle, Timeline owns its action  *(build on main → `feat/timeline-owns-action`)*

### 4.1 Design

Keep the List / Timeline segmented control — it stays useful and the founder likes the inline access. Fix the **honesty**:

1. **Move the plan action out of the toggle row and into the Timeline view.** Before a plan exists, the Timeline tab renders an **empty state** that holds the button ("Plan my day"). The action now visibly belongs to the view it produces — no more two-adjacent-controls ambiguity.
2. **Timeline empty state:** calendar glyph, title "No plan for today yet", one line "Build a timeline around your calendar and get a start-by time.", primary-ish (secondary, ghost — not the screen's filled primary) "Plan my day" button. Tapping it runs `handlePlanMyDay` (Pro-gated as today).
3. **Timeline planned state:** existing `DayTimeline` header (`Start by X` + Done-by chip) **plus** the shared `PlanReminderChip` directly under the header, before the timeline rows. Re-plan remains available (small header affordance, not floating beside the toggle).
4. **Remove `PlanMyDayButton` from the toggle row.** The toggle row becomes just the segmented control (or the control moves inline with the header). List view no longer shows a plan button — Timeline is where planning happens.

### 4.2 Files touched

- `src/app/(tabs)/index.tsx` — remove `PlanMyDayButton` from the toggle row (lines ~543–564); toggle row is now just `ViewToggle` (or full-width). Keep `handlePlanMyDay` but call it from the Timeline empty state.
- `src/features/today/DayTimeline.tsx` — change the `status === 'empty'` branch (currently `return null`, line ~441) to render the new **`TimelineEmptyState`** with the "Plan my day" button; add `PlanReminderChip` under the header in the planned branch.
- New: `src/features/today/TimelineEmptyState.tsx`.
- New: `src/features/today/PlanReminderChip.tsx` (shared foundation §2.2).
- `src/features/today/useStartByReminder.ts` + `src/stores/settingsStore.ts` (shared foundation §2.1).
- `src/app/settings.tsx` — move the start-by row out from under the master (§2.1).

### 4.3 Acceptance criteria (Option 2)

- Timeline tab with no queued tasks / no plan shows the empty state + button (not a blank/`null`).
- Tapping "Plan my day" in the empty state plans and the same view fills in — no view jump.
- The reminder chip appears in the planned Timeline header and reflects/controls `startByEnabled`.
- List view shows no plan button; the segmented toggle no longer sits beside a competing action.
- Free user tapping the Timeline pill or the empty-state button still hits the paywall (`trigger: 'plan_my_day'`).
- Shared §2.4 all hold.

---

## 5. Option 1 — Plan is a sheet you pull up  *(worktree `feat/plan-sheet`)*

### 5.1 Design

Remove the List / Timeline segmented control entirely. Today is just the list. One secondary button, **"Plan my day"**, makes a plan that **slides up as a formSheet** containing the whole plan — start-by header, timeline rows, and the `PlanReminderChip` — with a "Done" affordance. Dismissing returns to Today.

- **Re-entry ("where I check on it"):** once a plan exists for the day, Today shows a compact **`PlanStrip`** near the top ("Start by 12:35 · 🔔 nudge on · done by 13:00", chevron). Tapping it reopens the sheet, which now reflects live state ("Start in 37 min"). The strip is the persistent, glanceable status; the sheet is the detail.
- The plan is obviously a thing the user summoned, fully contained, never behind a silent toggle.

### 5.2 Files touched

- New route: `src/app/(modals)/plan.tsx` — a formSheet (`headerShown: false`, `SheetGrabber`, root `contentStyle` gutters, `minHeight` anchor per the formSheet rules). Renders the plan (reuses `DayTimeline`'s row rendering, or a shared `PlanBody`) + `PlanReminderChip` + Done. Must be listed in `(modals)/_layout.tsx` with `headerShown:false` and given an `unstable_settings` anchor `'(tabs)'` (modal-anchor-required memory).
- New: `src/features/today/PlanStrip.tsx` — the pinned status strip on Today.
- `src/app/(tabs)/index.tsx` — remove `ViewToggle` + the timeline branch; Today is list-only. Add `PlanStrip` (shown when `dayMeta.planComputedAt != null` / a plan exists for today). `handlePlanMyDay` now `router.push('/(modals)/plan')` after `markPlanned` + export, instead of `setViewMode('timeline')`.
- Possibly extract a shared `PlanBody` from `DayTimeline` so the sheet and any future surface share one renderer.
- Shared foundation files (§2.1, §2.2).
- Retire/keep `viewMode` in `dayTasksStore` — Option 1 stops using it on Today; leave the store field (other code/tests may read it) but stop driving it from Today.

### 5.3 Acceptance criteria (Option 1)

- Today shows no segmented control; a single "Plan my day" action.
- Tapping it opens the plan sheet (formSheet, grabber, dark, no white header).
- After planning, a `PlanStrip` appears on Today and reopens the sheet on tap.
- Reminder chip inside the sheet reflects/controls `startByEnabled`.
- Sheet obeys all formSheet HARD RULES (gutters, anchor, no `flex:1` collapse).
- Shared §2.4 all hold.

---

## 6. Option 3 — Plan is its own screen you visit  *(worktree `feat/plan-screen`)*

### 6.1 Design

Remove the segmented control. "Plan my day" opens a **dedicated full screen** (`(modals)/plan.tsx` as a `fullScreenModal` or a pushed card route). **First run only**, before the plan renders, a **setup step** names both potentially-silent behaviors and lets the user opt in:

- **"Read today's calendar"** → toggles `calendar.showEvents` (Pro).
- **"Nudge me when to start"** → toggles `startByEnabled`.
- Both **off by default**; "Continue" proceeds. Persisted via a kv flag `plan.setupSeen` so it shows once. Reuses the paywall `ValueStack` row styling for visual consistency.

After setup (and every subsequent time), the plan screen shows the timeline + header + `PlanReminderChip`, with a back/"Looks good" affordance.

- **Re-entry ("where I check on it"):** back on Today, the "Plan my day" button **becomes a live plan card** ("Today's plan · start in 37 min · 🔔 nudge on · tap to view"). It doubles as at-a-glance status without opening anything; tapping returns to the plan screen. Loop is Today ⇄ Plan screen. Today never mutates behind the user's back.

This is the heaviest but most trust-forward and (hypothesis) most retention-sticky: planning is a deliberate act with its own place, which is what planning rituals lean on (retention-optimization: a distinct, repeatable ritual beat — no guilt, no streak).

### 6.2 Files touched

- New route: `src/app/(modals)/plan.tsx` — full-screen plan view (`headerShown:false`, listed in `_layout.tsx`, anchor `'(tabs)'`). Renders own title (`type.subtitle` + `ink`) per the modal rule. Holds the first-run setup step + the plan body + `PlanReminderChip`.
- New: `src/features/today/PlanSetupStep.tsx` — the two-toggle consent step (calendar + reminders), both off by default; uses ValueStack-style rows.
- New: `src/features/today/PlanEntryCard.tsx` — the Today entry that is a plain "Plan my day" CTA before planning and a live status card after.
- `src/app/(tabs)/index.tsx` — remove `ViewToggle` + timeline branch; render `PlanEntryCard`; `handlePlanMyDay` → `router.push('/(modals)/plan')`.
- kv flag `plan.setupSeen` via `src/lib/kv.ts`.
- Shared foundation files (§2.1, §2.2).

### 6.3 Acceptance criteria (Option 3)

- First-ever "Plan my day" opens the setup step with both toggles **off**; "Continue" proceeds; the step never shows again (`plan.setupSeen`).
- Enabling "Read today's calendar" flips `calendar.showEvents` and requests calendar permission at that moment; enabling "Nudge me to start" flips `startByEnabled` and requests notification permission at that moment.
- After planning, Today's entry is a live plan card showing status; tapping it reopens the plan screen.
- Plan screen obeys modal HARD RULES (no white header, own title, anchor).
- Shared §2.4 all hold.

---

## 7. Cross-cutting test plan

- **Unit (engine/store/service):** `useStartByReminder` gate change (fires only on `startByEnabled`); `settingsStore` new defaults + start-by decoupling; `PlanReminderChip` toggle path (mock `ensureNotificationPermission`).
- **Interaction/snapshot (per option):** empty→planned transition (Opt 2); sheet open + PlanStrip reopen (Opt 1); setup-once + entry-card status (Opt 3).
- **Manual on sim:** deep-link to Today, add a task, plan, verify no notification unless the chip is turned on; verify reminder actually schedules via the reward-screen / notification dump path (device) — never claim it works without observing it.
- **Lint + typecheck + full jest** before every commit (CI parity).
- **Reduced-motion:** chip/switch settle without bounce; entrances fade (animation HARD RULE).

## 8. Rollout / worktree plan

1. Build shared foundation + Option 2 on `feat/timeline-owns-action` off `main`; open PR.
2. After founder approves specs, create worktrees (founder consent required per branch gate):
   - `feat/plan-sheet` (Option 1) — subagent-driven, isolated worktree.
   - `feat/plan-screen` (Option 3) — subagent-driven, isolated worktree.
   Each cherry-picks / re-implements the shared foundation (or branches off the foundation commit) so all three are comparable.
3. Three PRs; founder reviews rendered screenshots + device verification; **founder merges**. Claude never merges.

## 9. Open decisions (resolve during planning)

- Should the shared foundation land as its own commit/branch that 1 & 3 branch from, to avoid three divergent copies? (Recommended: yes — foundation first, then three UI branches off it.)
- Option 1/3: extract a shared `PlanBody` renderer from `DayTimeline`, or duplicate? (Recommended: extract, so the sheet/screen/timeline share one source of truth.)
- Keep `dayTasksStore.viewMode` for Options 1/3 or remove? (Recommended: keep the field, stop driving it from Today, to avoid churn in tests that read it.)
