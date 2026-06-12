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
