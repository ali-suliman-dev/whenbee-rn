# Widget Guess Pairing + "Start Now" Timer Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the original guess next to the honest finish on the W2 home-screen widget and the running-timer notification, and make the "Start now" plan reminder actually start the timer and open the timer overlay.

**Architecture:** Two independent workstreams in one branch. (A) Add a single presentation-ready field to each presence payload — `guessClock` (widget) / `guessFinishEpoch` (notification) — flowing JS → native, rendered by an added view / an appended text fragment. (B) Enrich the START_BY notification payload at schedule time with the first task's data, then route the `START` action to the timer modal deep link instead of Today.

**Tech Stack:** TypeScript, React Native (Expo SDK 54), Kotlin (Expo module, Android RemoteViews + NotificationCompat), Jest.

## Global Constraints

- **ADD-ONLY on the presence surfaces.** Do NOT modify any promotion / chronometer / `ProgressStyle` / AlarmManager / snapshot-arc / update-trigger logic. Only add a field, add a view, or append to a string. (`docs/product/12-WIDGET-STRATEGY.md`; founder rule 2026-07-07.)
- **`PresenceNotifier.post` signature stays unchanged** — it is called by both the module and `TimerAlarmReceiver`. New notification data is read from the persisted timer state (same pattern as `startEpoch`), never added as a `post` parameter.
- **Copy (locked):** widget amber label reads **`Honestly`** (not "Honestly done"); guess row is the word **`guessed`** + the clock time, e.g. `guessed 3:50` (a clock, never a duration, never "you guessed"). Notification: `Finish 4:35 · guessed 3:50` running / `Over · honest finish was 4:35 · guessed 3:50` overrun. Blank guess → render the current text with no dangling "· guessed".
- **Tokens (dark surface, from `src/theme/tokens.ts`):** surface `#1F2130`, ink `#F4F1EA`, inkSoft `#ADA9B5`, amber `#EEAE4D`. Hero + guess use monospace.
- **Core-loop invariant:** every presence read/write is best-effort and must never throw into the guess→timer→learn loop.
- **iOS parity is OUT OF SCOPE** (deferred family-wide; needs a paid Apple team). JS interfaces gain the new fields so iOS picks them up later; do not edit Swift.
- **Commits:** Conventional Commits, NO AI/co-author attribution. Never merge — open a PR; the founder merges.
- **Verify before PR:** `npm run lint`, `npm run typecheck`, `npx jest` (affected), `npm test` (full). Kotlin has no unit harness — device-verify per `docs/NATIVE-PRESENCE.md` (Android, no paid account).

---

## File Structure

**Workstream A — widget:**
- `src/services/liveActivity.ts` — add `guessClock` to `WidgetSnapshot`.
- `src/features/today/useWidgetPublisher.ts` — compute `guessClock`.
- `src/services/presence/__tests__/createAndroidPresence.test.ts` — extend fixture.
- `modules/whenbee-presence/android/.../NextTaskWidgetProvider.kt` — parse + render guess.
- `modules/whenbee-presence/android/src/main/res/layout/widget_next_task.xml` — add views.
- `modules/whenbee-presence/android/src/main/res/values/strings.xml` — add `widget_honestly`.

**Workstream A — notification:**
- `src/services/liveActivity.ts` — add `guessFinishEpoch` to `LiveActivityAttributes`.
- `src/features/timer/useTimer.ts` — pass `guessFinishEpoch`.
- `modules/whenbee-presence/android/.../WhenbeePresenceModule.kt` — read attr, pass to `saveTimer`.
- `modules/whenbee-presence/android/.../PresenceNotifier.kt` — persist + append guess in `post`.

**Workstream B — start-now:**
- `src/services/notificationRoutes.ts` (new) — pure route builder.
- `src/services/__tests__/notificationRoutes.test.ts` (new).
- `src/services/timerNotifications.ts` — widen `scheduleStartBy` payload.
- `src/features/today/useStartByReminder.ts` — join first task, pass data.
- `src/services/notificationSetup.ts` — route `ACTION.START` via the builder.

---

## Task 1: Widget snapshot carries `guessClock` (JS)

**Files:**
- Modify: `src/services/liveActivity.ts` (`WidgetSnapshot` interface, ~line 38)
- Modify: `src/features/today/useWidgetPublisher.ts` (snapshot build, ~line 44)
- Test: `src/services/presence/__tests__/createAndroidPresence.test.ts`

**Interfaces:**
- Produces: `WidgetSnapshot.guessClock: string` — JS-formatted wall-clock of the projected finish at the original guess (e.g. `"3:50"`), `''` when unknown.

- [ ] **Step 1: Extend the snapshot fixture in the test (make it fail typecheck first)**

In `createAndroidPresence.test.ts`, add `guessClock` to the `snapshot` fixture object (near line 5):

```ts
const snapshot: WidgetSnapshot = {
  nextTaskLabel: 'Write the report', category: 'Deep work', honestFinishClock: '7:10',
  guessClock: '6:30',
  startDeepLink: 'whenbee://timer?taskId=1', updatedAtEpoch: 1000, honestFinishEpoch: 1600, isPro: false,
};
```

(Keep whatever other fields the existing fixture already sets; only add `guessClock`.)

- [ ] **Step 2: Run typecheck to see it fail**

Run: `npm run typecheck`
Expected: FAIL — `guessClock` does not exist on `WidgetSnapshot`.

- [ ] **Step 3: Add the field to the interface**

In `src/services/liveActivity.ts`, inside `interface WidgetSnapshot`, after `honestFinishClock`:

```ts
  /** Projected finish at the ORIGINAL guess, JS-formatted wall-clock (e.g. "3:50").
   *  '' when unknown. The widget shows it as a quiet "guessed …" row under the
   *  honest hero — the guess-vs-honest pairing only Whenbee can show. */
  guessClock: string;
```

- [ ] **Step 4: Compute it where the snapshot is built**

In `src/features/today/useWidgetPublisher.ts`, the `snapshot` object (~line 44). `projectedFinish` and `formatClockMeridiem` are already imported. Add the field:

```ts
      const finishAt = projectedFinish(now, honestMin);
      const guessAt = projectedFinish(now, focus.guessMin);
      const snapshot: WidgetSnapshot = {
        nextTaskLabel: focus.label,
        category: categoryName(focus.category),
        honestFinishClock: formatClockMeridiem(finishAt),
        guessClock: formatClockMeridiem(guessAt),
        startDeepLink: `whenbee://timer?taskId=${focus.id}`,
        updatedAtEpoch: Math.round(now / 1000),
        honestFinishEpoch: Math.round(finishAt / 1000),
        isPro,
      };
```

(`focus` is a `DayTask`; it carries `guessMin`. If for any reason `guessMin` is 0/absent, `formatClockMeridiem(projectedFinish(now,0))` = now's clock — acceptable; the widget just shows the same clock. Do not special-case.)

- [ ] **Step 5: Run typecheck + the presence test**

Run: `npm run typecheck && npx jest src/services/presence/__tests__/createAndroidPresence.test.ts`
Expected: PASS (the fixture round-trips `guessClock` through `JSON.stringify`).

- [ ] **Step 6: Commit**

```bash
git add src/services/liveActivity.ts src/features/today/useWidgetPublisher.ts src/services/presence/__tests__/createAndroidPresence.test.ts
git commit -m "feat(widget): carry guessClock in the next-task snapshot"
```

---

## Task 2: Widget renders `Honestly` label + `guessed …` row (Kotlin)

**Files:**
- Modify: `modules/whenbee-presence/android/src/main/res/values/strings.xml`
- Modify: `modules/whenbee-presence/android/src/main/res/layout/widget_next_task.xml`
- Modify: `modules/whenbee-presence/android/src/main/java/expo/modules/whenbeepresence/NextTaskWidgetProvider.kt`

**Interfaces:**
- Consumes: `WidgetSnapshot.guessClock` (Task 1), read from JSON key `"guessClock"`.

No Jest coverage (Kotlin). Verify on device in Task 7.

- [ ] **Step 1: Add the string resource**

In `res/values/strings.xml`, add inside `<resources>`:

```xml
    <string name="widget_honestly">Honestly</string>
```

- [ ] **Step 2: Add the label + guess views to the layout**

In `res/layout/widget_next_task.xml`, replace the hero row's inner text column so the honest clock is wrapped with an amber `Honestly` label above and a `guessed` row below. Change the hero `LinearLayout` (the horizontal row at the bottom) to hold a vertical column + the play button:

```xml
    <!-- Hero row: honest column (label + clock + guess) fills; flat play button pinned right -->
    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="horizontal"
        android:gravity="bottom">

        <LinearLayout
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:orientation="vertical">

            <TextView
                android:id="@+id/widget_honestly"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="@string/widget_honestly"
                android:textColor="#EEAE4D"
                android:textSize="9sp"
                android:letterSpacing="0.06"
                android:textAllCaps="true"
                android:textStyle="bold" />

            <TextView
                android:id="@+id/widget_hero"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:maxLines="1"
                android:ellipsize="end"
                android:text=""
                android:textColor="#F4F1EA"
                android:fontFamily="monospace"
                android:textSize="23sp"
                android:textStyle="bold" />

            <TextView
                android:id="@+id/widget_guess"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:layout_marginTop="3dp"
                android:maxLines="1"
                android:ellipsize="end"
                android:text=""
                android:textColor="#ADA9B5"
                android:fontFamily="monospace"
                android:textSize="11sp" />
        </LinearLayout>

        <FrameLayout
            android:id="@+id/widget_start"
            android:layout_width="32dp"
            android:layout_height="32dp"
            android:background="@drawable/widget_play_button">

            <ImageView
                android:layout_width="14dp"
                android:layout_height="14dp"
                android:layout_gravity="center"
                android:layout_marginStart="1dp"
                android:src="@drawable/ic_widget_play"
                android:contentDescription="@string/widget_start" />
        </FrameLayout>
    </LinearLayout>
```

(Only the hero row block changes. Leave the eyebrow, label, and the `FrameLayout` weighted spacer above it exactly as they are. All views used — LinearLayout/TextView/FrameLayout/ImageView — are RemoteViews-supported.)

- [ ] **Step 3: Parse `guessClock` + render the label/guess in the provider**

In `NextTaskWidgetProvider.kt`:

Add to the `WidgetSnapshot` data class (near line 126):

```kotlin
    private data class WidgetSnapshot(
      val label: String,
      val honestFinishClock: String,
      val guessClock: String,
      val startDeepLink: String,
      val updatedAtEpoch: Double,
      val honestFinishEpoch: Double?,
      val isPro: Boolean,
    )
```

Parse it in `readSnapshot` (in the `WidgetSnapshot(...)` constructor call):

```kotlin
          honestFinishClock = json.optString("honestFinishClock", ""),
          guessClock = json.optString("guessClock", ""),
```

In `buildViews`, empty state — blank the new views too:

```kotlin
      if (snapshot == null || snapshot.label.isBlank()) {
        views.setTextViewText(R.id.widget_label, context.getString(R.string.widget_empty))
        views.setTextViewText(R.id.widget_hero, "")
        views.setTextViewText(R.id.widget_guess, "")
        views.setViewVisibility(R.id.widget_honestly, android.view.View.GONE)
        views.setViewVisibility(R.id.widget_guess, android.view.View.GONE)
        views.setOnClickPendingIntent(R.id.widget_start, startPendingIntent(context, null))
        return views
      }
```

Populated state — show the label, and the guess only when present:

```kotlin
      views.setTextViewText(R.id.widget_label, snapshot.label)
      views.setViewVisibility(R.id.widget_honestly, android.view.View.VISIBLE)
      views.setTextViewText(R.id.widget_hero, heroClockSpan(snapshot.honestFinishClock))
      if (snapshot.guessClock.isBlank()) {
        views.setViewVisibility(R.id.widget_guess, android.view.View.GONE)
      } else {
        views.setViewVisibility(R.id.widget_guess, android.view.View.VISIBLE)
        views.setTextViewText(R.id.widget_guess, "guessed ${snapshot.guessClock}")
      }
      views.setOnClickPendingIntent(R.id.widget_start, startPendingIntent(context, snapshot.startDeepLink))
      return views
```

- [ ] **Step 4: Commit**

```bash
git add modules/whenbee-presence/android/src/main/res/values/strings.xml modules/whenbee-presence/android/src/main/res/layout/widget_next_task.xml modules/whenbee-presence/android/src/main/java/expo/modules/whenbeepresence/NextTaskWidgetProvider.kt
git commit -m "feat(widget): render Honestly label + guessed clock on the next-task widget"
```

---

## Task 3: Notification carries `guessFinishEpoch` (JS)

**Files:**
- Modify: `src/services/liveActivity.ts` (`LiveActivityAttributes`, ~line 58)
- Modify: `src/features/timer/useTimer.ts` (~line 245)
- Test: `src/services/presence/__tests__/createAndroidPresence.test.ts`

**Interfaces:**
- Produces: `LiveActivityAttributes.guessFinishEpoch: number` — Unix seconds of the projected finish at the original guess. Forwarded verbatim by `createAndroidPresence.startLiveActivity` (it already spreads `{...attributes}`), so no change is needed in that adapter.

- [ ] **Step 1: Extend the attrs fixture in the test**

In `createAndroidPresence.test.ts`, add `guessFinishEpoch` to the `attrs` fixture used by the `startLiveActivity` tests:

```ts
const attrs: LiveActivityAttributes = {
  taskLabel: 'Write the report', finishEpoch: 1700, startEpoch: 1000, isProRich: false,
  guessFinishEpoch: 1500,
};
```

(Match the existing fixture's other fields; add only `guessFinishEpoch`. The existing assertion `toHaveBeenCalledWith('...', { ...attrs })` — if it spreads attrs — stays correct.)

- [ ] **Step 2: Run typecheck to see it fail**

Run: `npm run typecheck`
Expected: FAIL — `guessFinishEpoch` not on `LiveActivityAttributes`.

- [ ] **Step 3: Add the field to the interface**

In `src/services/liveActivity.ts`, inside `interface LiveActivityAttributes`, after `startEpoch`:

```ts
  /** Unix seconds of the projected finish at the ORIGINAL guess. The Android
   *  notification appends "· guessed <clock>"; 0 = unknown → no guess suffix. */
  guessFinishEpoch: number;
```

- [ ] **Step 4: Pass it from the timer start**

In `src/features/timer/useTimer.ts`, the `startFinishTimeActivity({ ... })` call (~line 245). `projectedFinish` is already imported and `guessMin` is in scope:

```ts
    startFinishTimeActivity({
      taskLabel: label,
      finishEpoch: Math.round(projectedFinish(startedAt, suggestedHonestMin) / 1000),
      startEpoch: Math.round(startedAt / 1000),
      guessFinishEpoch: Math.round(projectedFinish(startedAt, guessMin) / 1000),
      isProRich: useEntitlement.getState().isPro,
    });
```

- [ ] **Step 5: Run typecheck + the presence test**

Run: `npm run typecheck && npx jest src/services/presence/__tests__/createAndroidPresence.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/services/liveActivity.ts src/features/timer/useTimer.ts src/services/presence/__tests__/createAndroidPresence.test.ts
git commit -m "feat(presence): carry guessFinishEpoch into the timer live activity"
```

---

## Task 4: Notification appends `· guessed <clock>` (Kotlin)

**Files:**
- Modify: `modules/whenbee-presence/android/.../WhenbeePresenceModule.kt` (`startTimerNotification`)
- Modify: `modules/whenbee-presence/android/.../PresenceNotifier.kt` (`saveTimer`, `TimerState`, `readTimer`, `post`)

**Interfaces:**
- Consumes: `attrs["guessFinishEpoch"]` (Task 3). Persisted via `saveTimer`, read by `post` from `TimerState` — `post`'s parameter list does NOT change.

- [ ] **Step 1: Read the attr in the module and pass it to `saveTimer`**

In `WhenbeePresenceModule.kt`, `Function("startTimerNotification")`, after `proRich` is read:

```kotlin
      val proRich = attrs["isProRich"] as? Boolean ?: false
      val guessFinish = (attrs["guessFinishEpoch"] as? Number)?.toDouble() ?: 0.0

      PresenceNotifier.saveTimer(context, label, start, finish, proRich, guessFinish)
```

(Only the `saveTimer` call gains the trailing arg. Leave the `PresenceNotifier.post(...)` calls, the `lastLabel/...` cache, and the alarm scheduling untouched.)

- [ ] **Step 2: Persist + read `guessFinishEpoch` in the notifier**

In `PresenceNotifier.kt`:

`saveTimer` — add a defaulted trailing param and persist it:

```kotlin
  fun saveTimer(
    context: Context,
    label: String,
    startEpochSec: Double,
    finishEpochSec: Double,
    isProRich: Boolean,
    guessFinishEpochSec: Double = 0.0,
  ) {
    val json = JSONObject()
      .put("taskLabel", label)
      .put("startEpoch", startEpochSec)
      .put("finishEpoch", finishEpochSec)
      .put("isProRich", isProRich)
      .put("guessFinishEpoch", guessFinishEpochSec)
    prefs(context).edit().putString(KEY_TIMER, json.toString()).apply()
  }
```

`TimerState` — add the field:

```kotlin
  data class TimerState(
    val label: String,
    val startEpochSec: Double,
    val finishEpochSec: Double,
    val isProRich: Boolean,
    val guessFinishEpochSec: Double,
  )
```

`readTimer` — parse it (older payloads default to 0 → no guess suffix):

```kotlin
      TimerState(
        label = json.getString("taskLabel"),
        startEpochSec = if (json.has("startEpoch")) json.getDouble("startEpoch") else Double.NaN,
        finishEpochSec = json.getDouble("finishEpoch"),
        isProRich = json.optBoolean("isProRich", false),
        guessFinishEpochSec = json.optDouble("guessFinishEpoch", 0.0),
      )
```

- [ ] **Step 3: Append the guess to the content text in `post`**

In `PresenceNotifier.post`, after the existing `val clock = ...` line, add the guess clock and fold it into `setContentText`. Do NOT change any other builder call:

```kotlin
    val clock = DateFormat.getTimeFormat(context).format(Date(finishMs))
    val guessSec = readTimer(context)?.guessFinishEpochSec ?: 0.0
    val guessSuffix = if (guessSec > 0.0)
      " · guessed " + DateFormat.getTimeFormat(context).format(Date((guessSec * 1000).toLong()))
    else ""

    val builder = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(context.applicationInfo.icon)
      .setContentTitle(label)
      .setContentText((if (isOverrun) "Over · honest finish was $clock" else "Finish $clock") + guessSuffix)
      // ...everything below stays byte-for-byte the same...
```

(The overrun wording changes from `"Over · finish was $clock"` to `"Over · honest finish was $clock"` per the locked copy. The overrun re-post in `TimerAlarmReceiver` calls the same `post` → inherits both the new wording and the guess suffix with no change there.)

- [ ] **Step 4: Commit**

```bash
git add modules/whenbee-presence/android/src/main/java/expo/modules/whenbeepresence/WhenbeePresenceModule.kt modules/whenbee-presence/android/src/main/java/expo/modules/whenbeepresence/PresenceNotifier.kt
git commit -m "feat(presence): append guessed finish to the timer notification text"
```

---

## Task 5: Pure `buildStartByTimerRoute` helper (JS, TDD)

**Files:**
- Create: `src/services/notificationRoutes.ts`
- Create: `src/services/__tests__/notificationRoutes.test.ts`

**Interfaces:**
- Produces: `buildStartByTimerRoute(data: Record<string, unknown>): string | null` — returns the timer-modal deep link (path `/(modals)/timer` with `taskId?`, `label`, `category`, `estimateMin`, `guessMin`) when the START_BY payload has enough to start a timer, else `null`.

- [ ] **Step 1: Write the failing test**

Create `src/services/__tests__/notificationRoutes.test.ts`:

```ts
import { buildStartByTimerRoute } from '@/src/services/notificationRoutes';

test('builds a timer deep link from an enriched startBy payload', () => {
  const route = buildStartByTimerRoute({
    kind: 'startBy',
    taskId: 't1',
    firstTaskLabel: 'Deep work',
    category: 'deep_work',
    guessMin: 30,
    honestMin: 45,
  });
  expect(route).toBe(
    '/(modals)/timer?taskId=t1&label=Deep%20work&category=deep_work&estimateMin=45&guessMin=30',
  );
});

test('omits taskId when the payload has none', () => {
  const route = buildStartByTimerRoute({
    kind: 'startBy', firstTaskLabel: 'Deep work', category: 'deep_work', guessMin: 30, honestMin: 45,
  });
  expect(route).toBe('/(modals)/timer?label=Deep%20work&category=deep_work&estimateMin=45&guessMin=30');
});

test('returns null when the honest estimate is missing (cannot start a timer)', () => {
  const route = buildStartByTimerRoute({ kind: 'startBy', firstTaskLabel: 'Deep work' });
  expect(route).toBeNull();
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx jest src/services/__tests__/notificationRoutes.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the builder**

Create `src/services/notificationRoutes.ts`:

```ts
// Pure route builder for notification actions. No expo-router / expo-notifications
// import so it is trivially unit-testable; notificationSetup consumes it.

/**
 * Build the timer-modal deep link that STARTS the first planned task from a
 * START_BY reminder. Returns null when the payload lacks the honest estimate
 * needed to run a timer — the caller then falls back to opening Today.
 */
export function buildStartByTimerRoute(data: Record<string, unknown>): string | null {
  const honestMin = Number(data.honestMin);
  if (!Number.isFinite(honestMin) || honestMin <= 0) return null;

  const label = typeof data.firstTaskLabel === 'string' ? data.firstTaskLabel : 'Focus session';
  const category = typeof data.category === 'string' ? data.category : 'getting_ready';
  const guessMin = Number.isFinite(Number(data.guessMin)) ? Number(data.guessMin) : honestMin;
  const taskId = typeof data.taskId === 'string' && data.taskId.length > 0 ? data.taskId : null;

  const params = new URLSearchParams();
  if (taskId) params.set('taskId', taskId);
  params.set('label', label);
  params.set('category', category);
  params.set('estimateMin', String(Math.round(honestMin)));
  params.set('guessMin', String(Math.round(guessMin)));
  return `/(modals)/timer?${params.toString()}`;
}
```

(Note: `URLSearchParams` encodes a space as `+`. The test expects `%20`. Use manual encoding to match the deep-link contract used elsewhere — replace the `URLSearchParams` block with explicit `encodeURIComponent` joins:)

```ts
  const parts: string[] = [];
  if (taskId) parts.push(`taskId=${encodeURIComponent(taskId)}`);
  parts.push(`label=${encodeURIComponent(label)}`);
  parts.push(`category=${encodeURIComponent(category)}`);
  parts.push(`estimateMin=${Math.round(honestMin)}`);
  parts.push(`guessMin=${Math.round(guessMin)}`);
  return `/(modals)/timer?${parts.join('&')}`;
```

Use the second (encodeURIComponent) form; drop the `URLSearchParams` version. It yields `Deep%20work`.

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx jest src/services/__tests__/notificationRoutes.test.ts`
Expected: PASS (all three cases).

- [ ] **Step 5: Commit**

```bash
git add src/services/notificationRoutes.ts src/services/__tests__/notificationRoutes.test.ts
git commit -m "feat(notifications): add pure startBy timer route builder"
```

---

## Task 6: Enrich START_BY payload + route the START action

**Files:**
- Modify: `src/services/timerNotifications.ts` (`scheduleStartBy`, ~line 170-200)
- Modify: `src/features/today/useStartByReminder.ts`
- Modify: `src/services/notificationSetup.ts` (`navigateForAction`, `ACTION.START`)

**Interfaces:**
- Consumes: `buildStartByTimerRoute` (Task 5).
- Produces: START_BY notification `data` now includes `taskId?`, `category`, `guessMin`, `honestMin`.

- [ ] **Step 1: Widen `scheduleStartBy` to accept + persist the task data**

In `src/services/timerNotifications.ts`, `scheduleStartBy`'s `opts` and its `data` payload:

```ts
export function scheduleStartBy(opts: {
  startByMs: number;
  firstTaskLabel: string;
  deadlineMs: number;
  taskId?: string | null;
  category?: string;
  guessMin?: number;
  honestMin?: number;
}): Promise<void> {
```

And in `notifContent.data`:

```ts
        data: {
          kind: 'startBy',
          startByMs: opts.startByMs,
          firstTaskLabel: opts.firstTaskLabel,
          deadlineMs: opts.deadlineMs,
          taskId: opts.taskId ?? null,
          category: opts.category ?? null,
          guessMin: opts.guessMin ?? null,
          honestMin: opts.honestMin ?? null,
        },
```

(Additive only. The `SNOOZE_5` handler in `notificationResponses.ts` re-schedules with `firstTaskLabel`/`deadlineMs` only — it still works; the new fields are simply absent from its reschedule, which is fine since a snooze doesn't start a timer.)

- [ ] **Step 2: Join the first task in the reminder hook and pass the data**

In `src/features/today/useStartByReminder.ts`, read the day tasks store to resolve the first task's `guessMin`/`category`, and derive `honestMin` from the timeline duration. Replace the hook body:

```ts
import { useEffect } from 'react';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useDayTasksStore } from '@/src/stores/dayTasksStore';
import { scheduleStartBy, cancelStartBy } from '@/src/services/timerNotifications';
import type { PlanResult } from '@/src/domain/types';

export function useStartByReminder(plan: PlanResult | null): void {
  const remindersEnabled = useSettingsStore((s) => s.remindersEnabled);
  const startByEnabled = useSettingsStore((s) => s.startByEnabled);
  const dayTasks = useDayTasksStore((s) => s.dayTasks);

  const enabled = remindersEnabled && startByEnabled;
  const startByMs = plan?.startBy ?? null;
  const firstTask = plan?.timeline.find((i) => i.kind === 'task') ?? null;
  const firstTaskLabel = firstTask?.label ?? null;
  const deadlineMs = plan ? plan.timeline.reduce((max, i) => Math.max(max, i.endAt), 0) : null;

  // Honest estimate the plan used for this block = its duration in minutes.
  const honestMin = firstTask ? Math.round((firstTask.endAt - firstTask.startAt) / 60000) : null;
  // Join the timeline item's id back to the source task for guess + category.
  const sourceTask = firstTask ? dayTasks.find((t) => t.id === firstTask.id) ?? null : null;
  const taskId = firstTask?.id ?? null;
  const guessMin = sourceTask?.guessMin ?? null;
  const category = sourceTask?.category ?? null;

  useEffect(() => {
    if (!enabled || startByMs === null || firstTaskLabel === null || deadlineMs === null) {
      void cancelStartBy();
      return;
    }
    void scheduleStartBy({
      startByMs,
      firstTaskLabel,
      deadlineMs,
      taskId,
      category: category ?? undefined,
      guessMin: guessMin ?? undefined,
      honestMin: honestMin ?? undefined,
    });
    // Keyed on primitives so it only re-schedules when a value actually moves.
  }, [enabled, startByMs, firstTaskLabel, deadlineMs, taskId, category, guessMin, honestMin]);
}
```

(Verify `useDayTasksStore`'s `dayTasks` items expose `id`, `guessMin`, `category` — they are the same `DayTask` shape `useToday`/`useWidgetPublisher` read. If the store selector name differs, match the existing usage in `useToday.ts:64`.)

- [ ] **Step 3: Route the START action to the timer**

In `src/services/notificationSetup.ts`, import the builder and use it for `ACTION.START`:

```ts
import { buildStartByTimerRoute } from '@/src/services/notificationRoutes';
```

```ts
    case ACTION.START: {
      // Start the planned task's timer and land on the overlay. Falls back to
      // Today only if the reminder payload lacks the data to start a timer.
      const route = buildStartByTimerRoute(_data);
      router.push(route ?? '/(tabs)');
      return;
    }
```

(Rename the `_data` param to `data` in `navigateForAction`'s signature since it is now used: `function navigateForAction(actionIdentifier: string, data: Record<string, unknown>): void` and update the `ACTION.WRAP`/others which ignore it — they simply don't reference `data`.)

- [ ] **Step 4: Run affected tests + typecheck + lint**

Run: `npm run typecheck && npx jest src/services/__tests__/notificationSetup.test.ts src/services/__tests__/notificationResponses.test.ts src/services/__tests__/notificationRoutes.test.ts && npx eslint src/services/timerNotifications.ts src/services/notificationSetup.ts src/services/notificationRoutes.ts src/features/today/useStartByReminder.ts`
Expected: PASS, 0 lint errors.

- [ ] **Step 5: Commit**

```bash
git add src/services/timerNotifications.ts src/features/today/useStartByReminder.ts src/services/notificationSetup.ts
git commit -m "fix(notifications): Start now actually starts the planned task's timer"
```

---

## Task 7: Full verification + device check + PR

**Files:** none (verification).

- [ ] **Step 1: Full gate**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all pass, 0 warnings. Fix any failure at its root cause before proceeding.

- [ ] **Step 2: Device verification (Android, per `docs/NATIVE-PRESENCE.md`)**

Build + install WITHOUT a prebuild (data-safe — see the versionCode landmine note in CLAUDE.md). Then:
- Plan a day with a queued task → add/observe the "Honest Finish" widget → it shows `Next up` / label / amber `Honestly` / honest clock / `guessed <clock>`.
- Start a timer → the running notification body reads `Finish <clock> · guessed <clock>`; let it pass finish → `Over · honest finish was <clock> · guessed <clock>`, chip still promoted (`adb shell dumpsys notification` → `PROMOTED_ONGOING`, `importance=3`).
- Trigger the START_BY reminder (or cold-deep-link the START action) → tapping **Start now** starts the timer and opens the timer overlay (not just Today).

Note in the PR any test event you logged into the founder's calibration and how to clear it.

- [ ] **Step 3: Open the PR (never merge)**

```bash
git push -u origin feat/widget-guess-and-startby-fix
gh pr create --title "feat: guess-vs-honest on widget + notification, and fix Start-now timer" --body "$(cat <<'EOF'
## What
- W2 widget now shows the amber **Honestly** label + honest finish clock + a quiet **guessed <clock>** row (the guess-vs-honest pairing was missing).
- Running-timer notification body appends **· guessed <clock>** (running + overrun).
- **Start now** plan reminder now actually starts the planned task's timer and opens the timer overlay, instead of just opening the app.

## How
- Add-only on the presence surfaces: new `guessClock` (widget snapshot) / `guessFinishEpoch` (live activity) fields; guess persisted in the notifier's timer state and read in `post` (signature unchanged — alarm re-post inherits it). No promotion/chronometer/ProgressStyle/alarm logic touched.
- START_BY payload enriched at schedule time (taskId/guess/honest/category); `ACTION.START` routes via a pure `buildStartByTimerRoute` helper to the timer modal deep link.

## Verification
- `npm run lint && npm run typecheck && npm test` green.
- Device-verified per docs/NATIVE-PRESENCE.md (widget, notification running+overrun, Start-now).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

STOP after opening the PR. Do not merge.

---

## Self-Review

- **Spec coverage:** A1 widget → Tasks 1–2. A2 notification → Tasks 3–4. B start-now → Tasks 5–6. Isolation/testing/PR → Task 7. All spec sections covered.
- **Placeholder scan:** none — every code step shows real code and exact commands.
- **Type consistency:** `guessClock: string` (Task 1) parsed as `guessClock` in Kotlin (Task 2). `guessFinishEpoch: number` (Task 3) read as `attrs["guessFinishEpoch"]` → `saveTimer(..., guessFinishEpochSec)` → `TimerState.guessFinishEpochSec` (Task 4). `buildStartByTimerRoute` (Task 5) consumed in Task 6 with matching `honestMin`/`guessMin`/`category`/`taskId`/`firstTaskLabel` keys set by `scheduleStartBy`.
- **Add-only check:** `post` parameter list unchanged; only its internal `setContentText` string and the persisted-state read change. No promotion/chronometer/ProgressStyle/alarm line is edited.
