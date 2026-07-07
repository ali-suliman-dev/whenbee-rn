# Widget guess pairing + "Start now" timer fix — design

**Date:** 2026-07-07
**Status:** Approved (founder, in brainstorming). Awaiting spec review before plan.

Two small, isolated changes shipped together in one worktree, sub-agent driven.
Founder hard constraint: **add-only** — do NOT alter the promotion / chronometer /
ProgressStyle / alarm / snapshot-write logic that already works. Append fields and
views; rewire nothing.

---

## Workstream A — show the guess next to the honest finish

### A1. Home-screen widget W2 (Option C, final)

Today `NextTaskWidgetProvider` renders an unlabeled honest-finish clock and no
guess. Final layout (top→bottom, left column; play button pinned bottom-right):

```
Next up            (eyebrow, inkSoft)
Deep work          (label, ink)
─ spacer ─
HONESTLY           (amber eyebrow, uppercase, 9sp)   ▶ play (amber, bottom-right)
4:35 PM            (mono hero, ink ~23sp)
guessed 3:50       (mono row, inkSoft ~11sp)
```

Copy rules (locked with founder):
- Amber label reads **"Honestly"** — NOT "Honestly done".
- Guess row is the word **"guessed"** + the **clock time** (e.g. `guessed 3:50`),
  one row, NOT a duration ("50m") and NOT "you guessed".

Data flow — add ONE field, `guessClock`, end to end:

1. `src/services/liveActivity.ts` → `WidgetSnapshot` interface: add
   `guessClock: string` (JS-formatted wall-clock of the original-guess finish,
   e.g. "3:50"). JS owns formatting; widget stays presentation-only.
2. Snapshot write-site (wherever `publishWidgetSnapshot` is called — Today focus-task
   path): compute `guessClock` from the task's guess the same way `honestFinishClock`
   is computed from the honest estimate.
3. `NextTaskWidgetProvider.kt` `WidgetSnapshot` data class + `readSnapshot`: parse
   `guessClock` (`json.optString("guessClock", "")`).
4. `res/layout/widget_next_task.xml`: add the amber `Honestly` TextView above the
   hero and the `guessed …` TextView below it. Hero size drops a touch (~23sp) to fit
   the extra rows inside the 156dp tile. Amber = `#EEAE4D`, ink `#F4F1EA`, inkSoft
   `#ADA9B5`, mono for hero + guess.
5. Provider `buildViews`: `setTextViewText` the guess row; hide the guess + Honestly
   label in the empty state (blank snapshot) exactly like the hero is blanked today.

iOS parity (`SharedStore.swift` / `NextTaskWidget.swift`) is out of scope here
(deferred family-wide; needs paid Apple team). Keep the JS `WidgetSnapshot` the single
source of truth so iOS picks the field up later for free.

### A2. Running-timer notification

`PresenceNotifier.post` sets one content-text line. Append the guess:
- Running: `Finish 4:35 · guessed 3:50`
- Overrun: `Over · honest finish was 4:35 · guessed 3:50`

Plumbing: carry a `guessClock` (or guess epoch → format in Kotlin like the finish
clock) through `WhenbeePresenceModule.startTimerNotification` → `saveTimer` →
`PresenceNotifier.post`, and through the JS start-site in `useTimer` that starts the
presence session. **Only the `contentText` string changes.** Do not touch
`setRequestPromotedOngoing`, the channel, `setWhen`/chronometer, `ProgressStyle`, or
the AlarmManager re-posts. The overrun re-post already rebuilds via the same builder,
so it inherits the new line for free.

No-guess fallback: if `guessClock` is blank, render the current line unchanged
(`Finish 4:35`) — never render a dangling "· guessed".

---

## Workstream B — "Start now" must start the timer, not just open the app

### Root cause

`src/services/notificationSetup.ts` `navigateForAction`:

```ts
case ACTION.START:
  router.push('/(tabs)'); // Today → start the planned task   ← STUB
```

The START_BY "Start now" button opens Today and stops there. Compounding it, the
START_BY payload (`timerNotifications.ts` `scheduleStartBy`) carries only
`{ kind:'startBy', startByMs, firstTaskLabel, deadlineMs }` — no `taskId`, guess,
honest estimate, or category — so the handler has nothing to start a timer with.

### Fix (approach: enrich payload at schedule time)

1. `useStartByReminder.ts`: the hook has `plan.timeline`; the first task item carries
   `id` (= taskId) and `startAt/endAt` (→ honest minutes). Join that `id` against the
   task/today store to also read `guessMin` and `category`. Pass
   `{ taskId, guessMin, honestMin, category }` into `scheduleStartBy`.
2. `scheduleStartBy` (`timerNotifications.ts`): widen `opts` + add these to the
   notification `data`. Purely additive to the payload; scheduling logic unchanged.
3. `notificationSetup.ts` `ACTION.START`: replace `router.push('/(tabs)')` with a
   deep-link to the timer modal carrying the params:
   `router.push('/(modals)/timer?taskId=…&label=…&category=…&estimateMin=<honestMin>&guessMin=<guessMin>')`.
   The timer modal already reads exactly these params (`timer.tsx:98-121`) and starts
   the session, landing on the overlay — the same contract Add-Task's
   "Add & start timer" uses.
4. Verify the modal **auto-starts** on this entry (running state + overlay), not a
   pre-start screen. If a signal is needed, reuse the existing `quick='1'` param
   convention rather than inventing a new one. Confirm during implementation.

Self-contained payload → works on a cold boot from the lock screen (the moment this
notification fires), no reliance on a hydrated store at tap time.

---

## Isolation & testing

- **Worktree, sub-agent driven** (founder directive). Branch name to be approved
  before creation (house rule).
- Add-only: the diff must not modify any promotion/chronometer/ProgressStyle/alarm
  line, nor the snapshot arc/update triggers.
- Tests:
  - `createAndroidPresence` / snapshot shape: extend the existing unit test for the
    new `guessClock` field (present + blank-fallback).
  - `notificationResponses` / a new/extended test asserting `ACTION.START` produces
    the timer deep-link with the enriched params (and blank-guess fallback).
  - `stopPresenceSession.test.ts` stays green (untouched path).
  - Kotlin has no unit harness here — verify the widget + notification on a device
    per `docs/NATIVE-PRESENCE.md` (Android, no paid account): plan a day → observe
    the widget shows `Honestly / 4:35 / guessed 3:50`, start a timer → notification
    line shows `· guessed …`, tap "Start now" on the START_BY ping → timer starts and
    the overlay opens.
- `npm run lint` + `npm run typecheck` + affected `npx jest` + full `npm test` before
  the PR. Never merge — open the PR, founder merges.

## Out of scope

iOS widget/notification parity; W5/W6/W7; any change to the free/Pro gate (W2 stays
free); pause/resume UI.
