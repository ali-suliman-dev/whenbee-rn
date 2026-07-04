# Native presence — Home-screen widget + Live Activity / Dynamic Island

Whenbee's Lock-Screen / Home-screen presence (a re-engagement channel, not part of
the core loop). This page documents **what is scaffolded** and **the exact device
steps you must run** to validate it — that part needs a physical device + Apple
signing and **cannot** be verified in CI or the simulator alone.

> **Invariant:** none of this is on the core guess → timer → learn path. Everything
> here is guarded by `src/lib/isExpoGo.ts` and is a no-op in Expo Go, in tests, and
> on any binary built before the native module is linked. The JS app stays fully
> Expo-Go-testable.

## What ships in the repo (scaffolded, CI-green)

| Piece | Where | State |
|---|---|---|
| Config plugin | `@bacons/apple-targets` in `app.json` `plugins` | installed |
| App Group | `app.json` → `ios.entitlements['com.apple.security.application-groups']` = `group.com.whenbee.app` | declared; mirrored into the target |
| `NSSupportsLiveActivities` | `app.json` → `ios.infoPlist` | set |
| Widget extension target | `targets/widget/` (`expo-target.config.js`) | scaffolded |
| Static Home-screen widget | `targets/widget/NextTaskWidget.swift` | real SwiftUI; reads the App Group snapshot |
| Live Activity / Dynamic Island | `targets/widget/FinishTimeActivity.swift` | real ActivityKit; finish-time countdown |
| Widget bundle | `targets/widget/WhenbeeWidgetBundle.swift` | registers both widgets |
| Shared store reader | `targets/widget/SharedStore.swift` | decodes the JS-written payload |
| RN bridge (guarded) | `src/services/liveActivity.ts` | writes the App Group snapshot, starts/stops the Live Activity, fires `widget_added` / `widget_engaged` |
| Call sites | `useToday.ts` (widget snapshot on focus-task change), `useTimer.ts` (Live Activity on timer start/stop/abandon) | wired |

The static widget and the Dynamic-Island countdown live in **one** widget extension
target: iOS requires Live Activities to ship inside a WidgetKit extension bundle, so
this is the correct architecture rather than two separate targets.

## ⚠️ NOT done in the repo — the native module is the remaining glue

`src/services/liveActivity.ts` probes for a native module named **`WhenbeePresence`**
(via `requireOptionalNativeModule`). That module does **not** exist yet, so today the
bridge resolves to its stub and the calls are inert (which is why CI is green). To make
the widget show live data and the Live Activity actually start, you must provide that
native module on the device build. It needs three trivial Swift methods:

- `writeSnapshot(_:)` / `clearSnapshot()` — write/remove JSON at key
  `whenbee.widgetSnapshot` in `UserDefaults(suiteName: "group.com.whenbee.app")`,
  then call `WidgetCenter.shared.reloadAllTimelines()`.
- `startLiveActivity(_:)` / `updateLiveActivity(_:)` / `endLiveActivity()` — wrap
  `Activity<FinishTimeAttributes>.request / update / end`.

The payload shape and the App Group id/keys are already agreed on both sides — see the
`WidgetSnapshot` / `FinishTimeAttributes` structs in `targets/widget/*.swift` and the
matching interfaces + `APP_GROUP_ID` / `WIDGET_SNAPSHOT_KEY` in `liveActivity.ts`.
Until the module lands, the Swift widgets render their built-in placeholder/sample data.

## Device steps you must run (cannot be done in CI / simulator)

1. **Set your Apple Team id** in `app.json`:
   ```jsonc
   "ios": { "appleTeamId": "XXXXXXXXXX" }   // from Xcode → Signing & Capabilities
   ```
   (`expo-doctor` reminds you of this; iOS builds may fail to sign without it.)

2. **Prebuild** so the target is linked into a fresh Xcode project:
   ```bash
   npx expo prebuild --clean        # ios/ is gitignored (CNG) — never hand-edit it
   ```

3. **Build to a physical device** (Live Activities + Dynamic Island do **not** work in
   the simulator):
   ```bash
   npm run ios --device             # or: eas build --profile development --platform ios
   ```

4. **Enable the Home-screen widget:** long-press the Home Screen → **+** → search
   **Whenbee** → add the "Next task" widget. Confirm it shows the next task + honest
   finish time, and that tapping **Start** deep-links into the timer.

5. **Verify the Live Activity / Dynamic Island:** start a task timer in the app, then
   lock the device — confirm the finish-time countdown appears on the Lock Screen and
   in the Dynamic Island (iPhone 14 Pro+), and that it ends when you stop/abandon.

6. **Inspect the App Group payload** while debugging the bridge:
   ```bash
   # In the running app's container (device or sim with a dev build):
   xcrun simctl get_app_container booted com.whenbee.app data
   # then read the shared defaults the bridge writes:
   defaults read group.com.whenbee.app whenbee.widgetSnapshot
   ```

7. **Confirm analytics:** `widget_added` (surface `live_activity`) fires on timer start
   and `widget_engaged` on stop, once the native module is present (they're guarded so
   they stay silent until then).

## Re-sync after changing config

Editing `app.json` (App Group, plugins) or any `targets/widget/expo-target.config.js`
requires a re-run:

```bash
npx expo prebuild --clean
```

---

# Android presence (native — built)

The iOS sections above describe WidgetKit + ActivityKit. **Android presence is a
separate, fully-native implementation** that ships the same two surfaces — a
home-screen widget and a persistent live-timer notification — reusing the entire
JS bridge unchanged. It needs **no paid developer account** (unlike iOS): a personal
debug/release APK on a physical device or emulator shows everything.

## Where it lives

Everything Android-native is in the **`modules/whenbee-presence/android/`** Expo module
(autolinked; its `AndroidManifest.xml` merges the receivers/permissions into the app):

| Piece | File | Role |
|---|---|---|
| Native module | `WhenbeePresenceModule.kt` | Exposes JS Functions: `writeWidgetSnapshot`, `clearWidgetSnapshot`, `startTimerNotification`, `updateTimerNotification`, `stopTimerNotification`; schedules the overrun + progress alarms |
| Notification builder | `PresenceNotifier.kt` | The single shared builder (used by the module **and** the alarm receiver) — channel, promoted ProgressStyle, chronometer |
| Alarm receiver | `TimerAlarmReceiver.kt` | Fires the overrun flip (`ACTION_OVERRUN`) and the periodic progress re-post (`ACTION_PROGRESS`), driven off persisted state so it works after process death |
| Widget provider | `NextTaskWidgetProvider.kt` | `AppWidgetProvider` — reads the snapshot from SharedPreferences, builds the RemoteViews |
| Widget layout / res | `res/layout/widget_next_task.xml`, `res/xml/next_task_widget_info.xml`, `res/drawable/*`, `res/values/strings.xml` | RemoteViews layout + widget metadata |

**JS side (shared with iOS, unchanged):** `src/services/liveActivity.ts` resolves a
`NativePresenceModule`. On Android it resolves via `src/services/presence/androidPresence.android.ts`
→ `createAndroidPresence(...)` (a pure, unit-tested factory) → the native `WhenbeePresence`
module. Call sites (`useToday.ts` widget snapshot, `useTimer.ts` timer start/overrun/stop)
never change per platform.

**Shared data:** one SharedPreferences file `"<packageName>.presence"` with two keys —
`"timer"` (running-timer JSON: taskLabel / finishEpoch / startEpoch / isProRich) and
`"widget"` (the `WidgetSnapshot` JSON). Both alarms and the widget provider read it, so
presence survives process death. `arcFraction` is mirrored in Kotlin from
`src/engine/presence.ts` (same single-source pattern as the Swift copy).

## Home-screen widget

- **Native RemoteViews `AppWidgetProvider`** — works on **API 24+**. We deliberately do
  **not** use `react-native-android-widget`: on Android 16 its headless JS render never
  runs (blank widget) and it NPEs internally on remove. It was removed; do not reintroduce it.
- **RemoteViews only supports a whitelist of views** (FrameLayout, LinearLayout,
  RelativeLayout, GridLayout, TextView, ImageView, ImageButton, Button, ProgressBar,
  Chronometer, ViewFlipper, …). A **bare `<View>`** (e.g. a weighted spacer) is *not*
  supported and makes the launcher show **"Can't load widget"** — use a `FrameLayout`
  spacer instead. Prefer concrete styles over `?android:attr/...` theme refs (they resolve
  against the launcher's theme).
- **Data flow:** JS `publishWidgetSnapshot` → `writeSnapshot` → native
  `writeWidgetSnapshot(json)` stores the `"widget"` key and calls
  `AppWidgetManager.updateAppWidget(...)`. The provider renders label + "Honest finish
  H:MM" (drops the prefix when the snapshot is >6h stale), a Start chip (deep link
  `whenbee://timer?...` via a `PendingIntent`), and a Pro-only fill bar (a horizontal
  `ProgressBar` set to `arcFraction*1000`, since RemoteViews has no layout-weight setter).
- The widget renders its **empty state immediately on add** (no JS dependency); it
  populates once the app writes a snapshot (Today with a queued task).

## Persistent live-timer notification (the Android "Live Activity")

The genuine analog of an iOS Live Activity / Dynamic Island on Android 16 is a
**promoted "Live Update" notification**. Key facts (all verified against the official
Android 16 docs):

- **Promotion = the status-bar chip near the clock + pinned/prominent lock-screen
  presence.** It requires **all** of: `setRequestPromotedOngoing(true)`, the
  `POST_PROMOTED_NOTIFICATIONS` permission, `setOngoing(true)`, a `contentTitle`, a
  channel importance above MIN, not colorized/group-summary, and a **system style**
  (Standard / BigText / Call / **ProgressStyle** / Metric).
- **HARD CONSTRAINT: promotion forbids custom RemoteViews.** Any `setCustomContentView`
  silently disqualifies the notification (it drops to a normal grouped notification —
  no chip, not pinned). So you **cannot** have a big custom-drawn timer number *and* the
  promoted chip in one notification. We use `ProgressStyle` + the system chronometer, and
  the "big number" lives on the home-screen **widget** instead.
- **Live countdown = the system chronometer** — `setUsesChronometer(true)` +
  `setChronometerCountDown(true)` + `setWhen(finishMs)` (must be a **future** time or the
  system skips updates). The OS ticks it with **no app process** running. On overrun the
  native alarm re-posts with `setChronometerCountDown(false)` so it counts **up**.
- **Seconds in the chip:** the chip shows *either* `setShortCriticalText` (≤7 chars, e.g.
  "5m", minutes only) *or* the live chronometer (MM:SS, with seconds) — **not both**. To
  show seconds in the chip we do **not** set `setShortCriticalText` on the running
  notification, so the chronometer drives the chip.
- **The ProgressStyle bar does NOT auto-advance** — `setProgress(...)` is manual. To make
  it fill toward the finish, the module schedules a **self-rescheduling inexact
  AlarmManager re-post (~45s, `ACTION_PROGRESS`)** that recomputes progress from
  `startEpoch → finishEpoch` and re-posts with `setOnlyAlertOnce(true)` (no re-buzz). It
  stops on `stopTimerNotification`, at overrun, or when finish has passed (set to full).
  The chronometer countdown stays smooth regardless (system-driven).
- **Overrun flip is native, not JS.** A JS `setTimeout` freezes when the app is
  backgrounded/locked — exactly when you're watching the lock screen. So the flip is an
  **exact AlarmManager** (`setExactAndAllowWhileIdle`, `USE_EXACT_ALARM` [+
  `SCHEDULE_EXACT_ALARM` for API 31/32]) at `finishMs` → `TimerAlarmReceiver` (`ACTION_OVERRUN`)
  → re-post as overrun. It fires even if the app is dead. `TimerAlarmReceiver` routes by
  intent action (overrun vs progress) and reads the persisted `"timer"` state.

### Minimum Android version / graceful degradation

| Android | What the user gets |
|---|---|
| **16+ (API 36, e.g. Pixel 10)** | Full: promoted chip near the clock, pinned lock screen, ProgressStyle bar advancing toward finish, live MM:SS chronometer, native overrun flip |
| **7–15 (API 24–35)** | Graceful fallback: a plain **ongoing chronometer notification** (live countdown still ticks) — **no chip, not pinned** (the promoted "Live Update" API simply doesn't exist before Android 16). Promotion setters no-op; ProgressStyle is skipped |
| **< 7 (< API 24)** | Below the app's `minSdkVersion` (24) — N/A |

- The promoted APIs (`setRequestPromotedOngoing`, `NotificationCompat.ProgressStyle`,
  `setShortCriticalText`) require **androidx.core 1.17.0**, which we pin (bumped app-wide;
  gradle resolves highest, no `strictly`/`force` conflicts). `setChronometerCountDown`
  itself is API 24+, so the countdown works across the whole supported range.

## Build & verify on a device

- Use the `whenbee-device` skill (`build-and-launch-android.sh`): prebuild → Release
  `assembleRelease` (bundled JS, no Metro) → `adb install` → launch. No Google Play
  account needed.
- **Worktree gotcha:** if the JS bundle step (`createBundleReleaseJsAndAssets`) fails with
  `Unable to resolve module …`, the worktree `node_modules` is missing hoisted deps or the
  global Metro cache is stale → `npm ci` in the worktree **and** `rm -rf ~/.tmp/metro-cache`,
  then rebuild.
- **Manual checks:** widget → long-press home → Widgets → *Whenbee — Next task* → drop it
  out (loads immediately; populates once Today has a queued task). Notification → start a
  timer → chip near the clock ticking MM:SS + pinned lock screen + a bar advancing toward
  the finish; lock the phone, pass the honest finish → flips to "over" counting up.
- **Native/config changes** (module Kotlin, `AndroidManifest.xml`, `res/*`, `app.json`
  plugins/permissions) require `npx expo prebuild --clean -p android` before rebuilding.

---

# Android widget family (built)

Beyond the single "next task" widget, Android now ships a small **family** of native RemoteViews widgets, all in the `modules/whenbee-presence` module, fed by a generalized keyed store. Approved lineup + reasoning: `docs/product/12-WIDGET-STRATEGY.md`.

## Keyed write path
`WhenbeePresenceModule.writeWidgetData(key, json)` / `clearWidgetData(key)` store JSON under SharedPreferences `"<pkg>.presence"` key `"widget.<key>"` (via `WidgetDataStore`), then refresh the matching provider (`when(key)`). Keys: `nextTask`, `capacity`, `bias`. JS side: `publishWidgetData(key, payload)` / `clearWidgetData(key)` in `src/services/presence/widgetData.ts`; per-widget publisher hooks under `src/features/today/` mounted in `src/app/(tabs)/index.tsx`. (`writeSnapshot`/`clearSnapshot` remain as back-compat aliases → `writeWidgetData('nextTask', …)`.)

| Widget | Free/Pro | Provider | Payload (key) | Publisher | Update triggers |
|---|---|---|---|---|---|
| **Honest Finish** ("Next task") | FREE | `NextTaskWidgetProvider` | `WidgetSnapshot` (`nextTask`) | `useWidgetPublisher` | focus task, honestMin, timer start/stop, isPro, focus-category mEffective |
| **Does Today Fit?** | PRO | `DoesTodayFitWidgetProvider` | `CapacityWidgetData` (`capacity`) | `useCapacityWidgetPublisher` (reuses `useDayCapacity`/`honestDayLoad`) | task add/remove/complete, day select, dayEnd, calendar, isPro |
| **Your Bias** | PRO | `YourBiasWidgetProvider` | `BiasWidgetData` (`bias`) | `useBiasWidgetPublisher` (`pickTopBias`) | calibration stats change, isPro |

**Pro gating (both Pro widgets):** gated at the SOURCE — a free user's published payload is exactly `{ isPro:false }` (no numbers, no category), and the native provider's locked branch renders a quiet "…— Pro" state with NO value and NO bar/marker (gates value AND position, per the pro-gate-leak rule). Deep links: Honest Finish/Does-Today-Fit → `whenbee://today`, Your Bias → `whenbee://patterns`, locked → `whenbee://paywall`. No red anywhere (no-guilt): capacity "over" uses ink/accent.

**Live-updating:** the Honest Finish widget now republishes on all the triggers above (was previously only `[focus, honestMin]` — which is why it looked frozen). Android's 30-min background floor still applies when the app isn't open; live freshness comes from in-app republishes.

## Remaining widgets — NOT built yet (future)
Per `docs/product/12-WIDGET-STRATEGY.md` (approved lineup), still to build:
- **W1 Live Focus** — SHIPPED on Android already (the promoted live-timer notification / "Live Update"); iOS = existing `FinishTimeActivity`.
- **W5 One-Tap Guess** (Tier 2, free) — a small quick-add widget (AppIntent → new-guess sheet). Not built.
- **W6 Accuracy Trend** (Tier 3, Pro) — guess-vs-actual sparkline, "getting sharper". Not built.
- **W7 Honest Week** (Tier 3, Pro) — week strip planned-honest vs actual; leans on the Pro Honest Review. Not built.
- **iOS parity for the whole family** — WidgetKit versions of Honest Finish / Does-Today-Fit / Your-Bias in `targets/widget/` (SwiftUI). Deferred: needs a **paid Apple team** to device-test. The iOS `WidgetSnapshot`/`SharedStore.swift` must stay in sync if the shared payloads change.
