# Planning Expansion — Device Verification Checklist

> **Founder's manual gate.** All logic, business rules, and Pro-gate enforcement is unit-tested green. This checklist covers the visual and native behaviors that can only be verified on a physical or simulated iOS device.
>
> Run this checklist on a **dev build** (not Expo Go — native modules are required). Items marked **⚠️ MUST VERIFY BEFORE APP STORE SUBMISSION** cross-reference [docs/product/11-APP-STORE-LAUNCH-BLOCKERS.md](./11-APP-STORE-LAUNCH-BLOCKERS.md) and must be checked off before any submission attempt.
>
> Deep-link convention: `xcrun simctl openurl booted "whenbee:///..."`. Screenshot: `xcrun simctl io booted screenshot /tmp/snap.png && open /tmp/snap.png`.

---

## Prep

```bash
# Launch the app fresh (nuke state so you can test first-run paths)
CONTAINER=$(xcrun simctl get_app_container booted com.whenbee.app data)
# remove the SQLite stores
rm -rf "$CONTAINER/Documents/SQLite/"
xcrun simctl launch booted com.whenbee.app
```

For mid-flow deep-links skip the nuke and just open:

```bash
xcrun simctl openurl booted "whenbee:///(tabs)"
```

---

## 1. Today — Day Surface (Phase 2)

Reach: `xcrun simctl openurl booted "whenbee:///(tabs)"`

### 1a. Calendar strip

- [ ] **Today cell highlighted** — the current day cell has a distinct filled treatment (solid `colors.ink` pill or similar); visual separation from adjacent cells is unambiguous.
- [ ] **Selected vs today** — tap a different day; the "selected" indicator moves and differs from the "today" indicator (today stays highlighted, selected is a separate style).
- [ ] **Swipe weeks** — swipe the strip left/right; the week changes; lands without bounce/overshoot (ease-out settle only).
- [ ] **Task dots** — add a task to today; a dot appears on today's cell in the strip. Navigate to tomorrow; no dot yet. Add a task to tomorrow; a dot appears on tomorrow.
- [ ] **Strip alignment** — screenshot and verify the 7 cells are evenly spaced, labels and dots align, no cell clips.

### 1b. Per-day task list

- [ ] **Add to viewed day** — with a future day selected (e.g. Thursday), tap the FAB; add a task; it lands in Thursday's list, not today.
- [ ] **Date chip in add-task** — the add-task sheet header shows the target day ("Adding to Thursday" / "Today" / "No day yet"). Tapping the chip opens a day picker.
- [ ] **Today's list loads on launch** — on a fresh boot, today's tasks appear immediately.

### 1c. Swipe to move

- [ ] **Swipe left → "Tomorrow"** — on a task row, swipe left; an amber "Tomorrow" action appears; confirming it removes the task from the current day and it appears in tomorrow's list.
- [ ] **Long-press → "Pick a day…"** — long-press a task; an action sheet appears with "Move to tomorrow", "Pick a day…", and "Remove"; choosing "Pick a day…" opens a date picker; selecting a date moves the task.

### 1d. Carryover tag

- [ ] **Neutral tag visible** — on a day that has carried-over tasks, each carried row shows a neutral `· from {Mon}` tag in muted ink; tag is NOT red; text does NOT say "overdue".
- [ ] **Non-carried rows have no tag** — tasks added directly on the current day show no carryover tag.

### 1e. Per-day recap (past days)

- [ ] **Past day shows recap card** — navigate to yesterday (or any past day with tasks); a banked recap card appears showing done count, real focus minutes, and vs-guess delta. No streak/score language.
- [ ] **Collapsible task list** — the recap card has a "All tasks · {day}" disclosure; tapping it expands the full list of that day's tasks (done + queued); tapping again collapses.
- [ ] **Empty past day** — navigate to a past day with no tasks; the view shows "Nothing logged that day" (or similar neutral copy) — no recap card, no count badge, no deficit language.

### 1f. "No day yet" shelf

- [ ] **Shelf appears** — add a task with "No day yet" selected in the date chip; a "No day yet · N" entry appears at the bottom of Today.
- [ ] **Shelf expands** — tapping the shelf entry reveals the unscheduled tasks.
- [ ] **Move from shelf** — a shelf task can be moved to a specific day via long-press → "Pick a day…".

### 1g. Day-aware empty states

- [ ] **Future day — neutral empty** — navigate to a future day with no tasks; the copy is inviting (e.g. "{Weekday}'s wide open. Add what future-you should tackle — it carries over free if life happens."); no red, no deficit language.
- [ ] **Today first-run** — on a fresh install, today shows the first-run onboarding empty state variant.

---

## 2. Capacity + Calendar Overlay (Phase 3) — Device Only

Reach: `xcrun simctl openurl booted "whenbee:///(tabs)"` then navigate to a day with tasks.

> **Requires:** Pro entitlement active on the test account, and at least one calendar event in the device calendar.

### 2a. Calendar permission prompt ⚠️ MUST VERIFY BEFORE APP STORE SUBMISSION

- [ ] **First enable triggers permission** — in Settings → Calendar, toggle "Show calendar events" ON; iOS calendar read-permission sheet appears.
- [ ] **Permission copy is correct** — the iOS alert shows the `NSCalendarsUsageDescription` from `app.json`; it references honest-day / read-only use (not a generic string).
- [ ] **Denied path is graceful** — deny permission; the capacity chip shows task-only load (no crash, no red, calm copy offering to open Settings).
- [ ] **Granted path works** — grant permission; device calendar events appear in the overlay.

### 2b. Capacity chip — collapsed/expanded

- [ ] **Collapsed line** — a quiet single-line chip reads "⚡ Honest day Xh Ym · fits/snug/~Nh heavy" on the day surface.
- [ ] **Tap to expand** — tapping expands in place to a two-segment bar (tasks vs events) + free hours; copy makes sense.
- [ ] **Over verdict — amber only** — add enough tasks to exceed the waking window; the chip says "~Nh heavy — move one?" in amber; no red anywhere; no "behind" / "failed" language.
- [ ] **× dismiss** — the × button dismisses the chip for the session; it does not reappear until the next launch.
- [ ] **"Make my day honest" link** — in the expanded chip, the "Make my day honest" link navigates to the existing Honest-Day modal (buffer-write surface).
- [ ] **Free user — teaser only** — log out of Pro (or use a free test account); the chip slot shows a frosted teaser line leading to the paywall; NO real number or bar is visible; the bar/segments are absent from the layout entirely.

### 2c. Read-only calendar overlay

- [ ] **Timed events appear** — with "Show calendar events" on and permission granted, a "Calendar" section appears beneath the task list showing today's calendar events as greyed rows with clock ranges.
- [ ] **All-day events excluded from math** — create an all-day test event; it should appear in a separate "all day" sub-row but not change the capacity number.
- [ ] **Tap event** — tapping a timed event row opens it in the device Calendar app (or is a graceful no-op if `calshow:` deep-link is unavailable).
- [ ] **Read-only styling** — events look clearly non-interactive / greyed compared to task rows.
- [ ] **Free user** — free user does not see the overlay section at all (the section is absent, not merely greyed).

### 2d. Per-calendar settings

- [ ] **Calendar list** — Settings → Calendar shows a list of all device calendars with checkboxes after permission is granted.
- [ ] **Disabling a calendar** — uncheck a calendar; its events disappear from the overlay and don't count toward capacity.
- [ ] **Master off** — toggle "Show calendar events" OFF; the overlay section disappears and capacity shows task-only load.

---

## 3. Plan-my-day + Timeline (Phase 4)

Reach: `xcrun simctl openurl booted "whenbee:///(tabs)"` then add several tasks.

### 3a. List ⇄ Timeline toggle

- [ ] **Toggle visible** — a List / Timeline toggle is visible on the day surface.
- [ ] **Default is List** — on launch, the view is in List mode.
- [ ] **Toggle cross-fades** — switching between List and Timeline is a clean cross-fade; no slide-up, no bounce, no overshoot.

### 3b. "Plan my day"

- [ ] **Button/chip present in List view** — a "Plan my day" action is present.
- [ ] **Tapping computes + switches** — tapping "Plan my day" computes the backward schedule and switches to Timeline view.
- [ ] **Free user → paywall** — on a free account, tapping "Plan my day" shows a paywall teaser, never the timeline.

### 3c. Timeline

- [ ] **Tasks at clock positions** — tasks appear at their computed start times with the Start-By time visible.
- [ ] **Meeting blocks greyed** — calendar event anchors appear at their real times in a clearly-read-only greyed style, distinct from task rows.
- [ ] **Focus band visible** — the learned focus window is shown as a shaded band behind the timeline rows inside the window.
- [ ] **Done-by picker** — the day-level "done by" time chip is tappable and opens a time picker; changing it re-plans the day.
- [ ] **Overflow — amber only** — when the day overflows, a calm amber line reads "This won't fit before {time} — move one to tomorrow?"; tapping it moves the largest task to tomorrow; no red / no "overdue" copy.

---

## 4. Focus (Phase 5)

Reach: `xcrun simctl openurl booted "whenbee:///(tabs)"` (List view on Today) and `xcrun simctl openurl booted "whenbee:///(tabs)/patterns"`.

### 4a. List one-line insight (Today)

- [ ] **Insight line visible** — when a personal focus window is learned and it's before the window end, a one-line insight ("Sharpest 9–11am — your window for hard tasks" or similar) appears in the List view.
- [ ] **Pro → routes to Patterns** — tapping the insight navigates to the Patterns tab (focus detail).
- [ ] **Free → paywall** — free user sees a teaser; no window times are shown; tapping opens the paywall.
- [ ] **No guilt language** — copy never says "you should" / "you must"; it is a suggestion.

### 4b. Focus curve in Patterns

- [ ] **Curve visible (Pro)** — on the Patterns tab, in the Numbers segment, the focus curve renders (the time-of-day accuracy graph).
- [ ] **Window range + maturity** — the window range (e.g. "9:00–11:00") and maturity meter (e.g. "7 / 15 sessions") are visible below the curve.
- [ ] **Edit window** — tapping "Edit window" opens the focus window editor sheet.
- [ ] **Free — teaser only** — free user sees a locked teaser; no window times, no curve data.

---

## 5. Routines (Phase 6) — Device Only

Reach: `xcrun simctl openurl booted "whenbee:///(tabs)/routines"` (the renamed Plan tab).

> **Requires:** Pro entitlement. Most items require a physical or fully-native simulator build with notification support.

### 5a. Start-by notifications ⚠️ MUST VERIFY BEFORE APP STORE SUBMISSION

- [ ] **Permission prompt on first alert enable** — in a routine's settings, toggle "Alert before start" ON; iOS notification permission sheet appears (if not previously granted).
- [ ] **Notification arrives** — schedule a routine for the current weekday with an alert lead time of 1 minute; wait for the notification to arrive on the lock screen. Copy is calm (no "you must" / "don't forget").
- [ ] **Cancellation works** — toggle the alert OFF; the previously scheduled notification no longer fires (verify in Settings → Notifications → Whenbee that pending notifications are gone, or wait through the trigger time).
- [ ] **No-op in Expo Go** — confirm the guard: in Expo Go the toggle is a no-op (no crash, no native error in console).

### 5b. Live Activity — lock-screen countdown ⚠️ MUST VERIFY BEFORE APP STORE SUBMISSION

- [ ] **Countdown appears** — start a routine run; a Live Activity appears on the lock screen showing the step name and a countdown to its honest estimate.
- [ ] **Auto-advance on screen** — when the honest estimate elapses, the step auto-advances to the next (with a "next: {label}" beat); the Live Activity updates.
- [ ] **Ends on finish** — finishing or abandoning the run dismisses the Live Activity.
- [ ] **Guarded on Expo Go** — in Expo Go, starting a run logs no Live Activity crash; the in-app countdown still works.

### 5c. Chime + haptic on step advance

- [ ] **Gentle chime** — when a step auto-advances (honest minutes elapsed), a gentle audio chime plays.
- [ ] **Silent switch respected** — with the device silent switch on, no chime plays (haptic only, if haptic is present, or silent).
- [ ] **No punish overrun** — if the user runs a step past its honest minutes without tapping Done, the step advances without a negative/red signal.

### 5d. Auto-advance run flow

- [ ] **Manual Done advances** — tapping Done before the honest minutes still advances to the next step.
- [ ] **Skip works** — tapping Skip skips the current step and moves to the next.
- [ ] **Last step finish** — completing the last step ends the run and shows a calm recap.

### 5e. Scheduled-routine day blocks on Today

- [ ] **Block appears** — schedule a routine for today's weekday; navigate to Today; a collapsed block ("Morning routine · 50m · start by 8:10") appears in the task list.
- [ ] **Block expands** — tapping the block expands to show its steps.
- [ ] **Counts toward capacity** — the routine's honest total is included in the capacity chip's task load.
- [ ] **Timeline shows the block** — in Timeline view, the routine block appears at its start-by position.

### 5f. Example routine empty state

- [ ] **Pre-built example shown** — with no routines saved, the Routines tab shows a sample routine (e.g. "Morning wind-up") as an example with a "Try it" or similar affordance.
- [ ] **Try it starts a run** — tapping the affordance starts a run or pre-fills the builder without persisting a junk entry.

---

## 6. Calendar Export (Phase 7) ⚠️ MUST VERIFY BEFORE APP STORE SUBMISSION

Reach: Settings → Calendar → "Add my plan to a Whenbee calendar"

> **Critical safety gate.** Export must NEVER write to the user's primary calendar. Verify every step below on device before App Store submission. Cross-reference [docs/product/11-APP-STORE-LAUNCH-BLOCKERS.md](./11-APP-STORE-LAUNCH-BLOCKERS.md).

### 6a. Enable flow + write permission

- [ ] **Toggle is Pro-only** — on a free account, tapping the toggle shows a paywall; the export calendar is never created.
- [ ] **Permission requested** — on a Pro account, enabling the toggle triggers an iOS calendar write-permission alert.
- [ ] **Contract copy visible** — the enable flow shows clear copy: "Whenbee creates its own calendar — turning this off removes those events." before or immediately after enabling.
- [ ] **"Whenbee" calendar created** — after enabling + granting permission, open the iOS Calendar app; a calendar named "Whenbee" appears in the sidebar. It is NOT the user's iCloud/default calendar.

### 6b. Events written to the Whenbee calendar

- [ ] **Plan a day + run Plan-my-day** — add several tasks, tap "Plan my day" in Timeline mode; after the plan computes, the tasks appear as events in the "Whenbee" calendar in the iOS Calendar app with correct times.
- [ ] **Events NOT in primary calendar** — verify the tasks do NOT appear in iCloud, "Home", or any other user-owned calendar.
- [ ] **Event details** — each event shows the task label and the computed start/end time.

### 6c. Edit and delete sync

- [ ] **Task edit updates event** — rename a task or move it to a different time (re-plan); the corresponding event in the Whenbee calendar updates to match.
- [ ] **Task delete removes event** — delete a task that has a linked calendar event; the event is removed from the Whenbee calendar in the iOS Calendar app.

### 6d. Disable removes events

- [ ] **Disable → confirm dialog** — toggling the export OFF shows a confirmation dialog warning that events will be removed.
- [ ] **Events deleted** — after confirming disable, open the iOS Calendar app; all previously exported events are gone from the Whenbee calendar.
- [ ] **No events in other calendars** — verify no stray events were left in any other calendar.
- [ ] **Optional: Whenbee calendar removed** — if the implementation removes the calendar on disable, verify the "Whenbee" entry disappears from the iOS Calendar sidebar.

---

## 7. Patterns IA (Phase 8)

Reach: `xcrun simctl openurl booted "whenbee:///(tabs)/patterns"`

### 7a. 3-segment control + gliding pill

- [ ] **Control visible** — three segments [Numbers · Insights · Correlations] appear below the pinned archetype hero.
- [ ] **Gliding pill physics** — tapping a segment animates a pill indicator sliding to the new selection (ease-out settle, no bounce/overshoot).
- [ ] **Default selection** — the default selected segment is "Numbers".
- [ ] **Segment switches content** — tapping each segment replaces the content area with the correct blocks (Numbers: chart + map + focus; Insights: dismissable feed; Correlations: Pro locked or unlocked).

### 7b. Archetype hero pinned

- [ ] **Hero always visible** — the archetype badge/card is pinned at the top, visible regardless of which segment is selected.
- [ ] **Review ritual pinned** — the Review ritual section appears directly below the hero, always visible.

### 7c. Dismiss an insight (stays gone)

- [ ] **Dismiss action** — in the Insights segment, each card has a dismiss (×) button.
- [ ] **Card disappears on dismiss** — tapping × removes the card immediately.
- [ ] **Stays gone after restart** — force-quit and relaunch the app; the dismissed insight does NOT reappear (durable kv-backed dismissal, not session-only).
- [ ] **Other insights unaffected** — dismissing one card leaves the others visible.

### 7d. "You're all caught up." empty state

- [ ] **Empty Insights tab** — dismiss all visible insight cards; the Insights segment shows a calm "No new insights" (or equivalent, no guilt/streak language) line.

### 7e. Correlations Pro gate

- [ ] **Pro → content visible** — on a Pro account, the Correlations segment shows the steals-your-time, accuracy, and context correlations.
- [ ] **Free → teaser only** — on a free account, the Correlations segment shows a single locked teaser card; no correlation data or positions are rendered.

---

## Final Notes

- All unit tests, engine logic, Pro-gate enforcement, and store behavior are covered by the Jest suite (green ×2 at each phase merge).
- This checklist covers only the **visual and native gates** that cannot be validated in tests.
- Items in sections 2a, 5a, 5b, and all of section 6 are explicitly noted in [docs/product/11-APP-STORE-LAUNCH-BLOCKERS.md](./11-APP-STORE-LAUNCH-BLOCKERS.md) — **do not submit to the App Store until every one of these is checked off.**
- For notification and calendar permissions: verify that `app.json` supplies accurate, specific `NSCalendarsUsageDescription` and `NSUserNotificationsUsageDescription` strings (not generic copy) — the App Store reviewer will check these against the in-app permission alert.
