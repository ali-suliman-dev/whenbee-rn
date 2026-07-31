# Plan pill + TASKS title + Clear-plan — design spec

**Date:** 2026-07-08 · **Status:** approved (visual, from rendered mocks) · **Scope:** Today screen `PlanButton`, section labels, plan sheet reset.

Three decisions, all approved from token-accurate dark-mode HTML mocks. No amber anywhere (amber stays reserved for honey/reward). No code changed yet.

---

## 1 · Section title — "TASKS" (day-neutral) + smaller labels

**Problem.** The `UP NEXT` label implies "next after now" — wrong when the selected day is tomorrow or a past date. The screen header already names the day (`Today` → `Wednesday` + date), so the sub-label is redundant as a day cue and only needs to describe the list.

**Change.**
- `UP NEXT` → **`TASKS`** (day-neutral; true on every day).
- Shrink the Today section labels one step. All four currently use `type.eyebrow` (`fs.xs` = 10px, `letterSpacing: 2`): `TASKS`, `CALENDAR` (`CalendarOverlaySection`), `DONE TODAY` (`DoneSection`), `TODAY'S ROUTINES` (`index.tsx`).
  - Do **not** edit `type.eyebrow` globally (used by onboarding etc.). Add a localized role/token — a smaller eyebrow: `fs.crumb` (9px) with `letterSpacing` reduced (~0.8–1.0; wide tracking inflates perceived size). Apply it to the four Today labels only.
  - Exact value tuned on-device; target is "clearly a step smaller, tighter."

**Also (consistency, low-risk):** `TODAY'S ROUTINES` has the same day-bound wording problem. Not in this change's approved scope — note for a follow-up; do not silently reword it here.

---

## 2 · Plan pill — one component, two states, calendar icon

Reworks `src/features/today/PlanButton.tsx`. Sits far-right on the `TASKS` header row. Chevron `›` (`inkFaint`) on **both** states.

**Icon:** calendar (rounded rect + top bar + two tick marks) — the icon from mock v3 "Pill C".

**State A — no plan (`hasPlan === false`):** `📅 Plan ›`
- Label: `Plan` (single word, no time).
- Treatment: **indigo invite** — `backgroundColor: primaryWash`, icon + label in `primaryBright` (indigo). Reads "tap me, something happens" without being a filled CTA (the + FAB keeps the one filled-indigo slot).
- Action: unchanged — `handlePlanMyDay` (keeps the Pro gate).

**State B — plan active (`hasPlan === true`):** `📅 15:00 ›`
- Content: calendar icon (`primary`) + start-by clock `15:00` + chevron. **No "Start" word.**
- Color discipline: color lives on the **icon only** (the tap/plan signal); the clock number is neutral `ink` (data, not accent). `surfaceRaised` background as today.
- Clock = the day's start-by (`formatClock(startBy, false)`), same value the component already passes.
- Action: unchanged — open `/(modals)/plan`.

**Color rationale (why not amber):** `tokens.ts` reserves amber strictly for honey/ripen/reward. A start-time is neither. Plan clocks have their own token (`primaryBright`, commented "small mono data (plan clocks)"), and the disciplined choice is to color only the interactive icon and leave the datum in ink.

---

## 3 · Clear plan — reset inside the plan sheet

Adds a reset to `src/app/(modals)/plan.tsx`.

**Placement:** top-right of the "Today's plan" title row — a quiet text action `↺ Clear`, in **red** (`danger`), icon red too. iOS-native pattern (secondary action top-right). Never competes with the `Done` CTA; no extra footer row.

**Confirm before wiping** (mildly destructive → confirm; user control/error-prevention):
> **Clear today's plan?**
> Removes your start time, finish, nudge and any hand-sorted order. Your tasks stay in the queue.
> [ Cancel ] [ **Clear plan** ] ← Clear in red

**Scope — plan-only (approved).** The plan is *derived* from queued tasks + config, so "clear" wipes the config, not the tasks:
- `planComputedAt` → cleared (so `hasPlan` → false → pill returns to `Plan`).
- `doneByMin` → null.
- start-by nudge → off.
- manual order (`hasManualOrder`/`orderIndex`) → cleared (back to focus-aware default order).
- **Queued tasks stay** in the day. The `TASKS` list is unchanged; only the plan scaffolding is gone.

After clearing: dismiss the sheet back to Today (no plan → pill shows `Plan`). Exact store actions to wire during planning (`dayTasksStore` for planComputedAt/doneBy/manual order; `settingsStore`/`useStartByToggle` for the nudge).

---

## Invariants respected
- No amber outside honey/reward.
- One filled-indigo CTA per screen (FAB) — the plan pill stays quiet (wash/raised, never filled).
- No guilt/streak language in the Clear copy.
- All values from `tokens.ts`; new smaller-eyebrow value added as a token/role, not inlined.
