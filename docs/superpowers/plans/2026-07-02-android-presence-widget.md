# Android Presence (Home-screen Widget + Live-timer Notification) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the iOS "presence" feature (Home-screen widget + running-timer Live Activity) on Android — a home-screen widget showing the next task + honest finish, and an ongoing, live-ticking timer notification — reusing the entire existing JS presence layer unchanged.

**Architecture:** The JS bridge (`src/services/liveActivity.ts`) already resolves an injected `NativePresenceModule` and no-ops when none is linked. We add an **Android** implementation of that interface without touching a single call site. The widget is built with `react-native-android-widget` (declare UI in JSX; its Expo config plugin generates all Android glue at prebuild — no hand-written Kotlin/XML for the widget). The Live-Activity analog is a small Kotlin **Expo module** that posts an **ongoing chronometer notification** (the Android system ticks the countdown with zero background work — no foreground service), progressively enhanced to an Android-16 `Notification.ProgressStyle` promoted "Live Update" on API 36. A pure, dependency-injected factory (`createAndroidPresence`) holds the logic so it is fully unit-testable off-device; a `.android.ts` wiring file keeps the Android-only library out of the iOS bundle.

**Tech Stack:** Expo SDK 54, React Native 0.81.5, TypeScript (strict), `react-native-android-widget` (~0.20), Expo Modules (Kotlin), `expo-sqlite/kv-store` (existing `src/lib/kv.ts`), Jest.

## Global Constraints

- **Expo SDK 54 only.** Use `npx expo install <pkg>`, never `npm install`, for native deps. Read SDK 54 docs at https://docs.expo.dev/versions/v54.0.0/ .
- **Reuse the existing contract.** `WidgetSnapshot`, `LiveActivityAttributes`, and `NativePresenceModule` are already defined in `src/services/liveActivity.ts:36-80`. Do **not** redefine them — import them.
- **The core loop stays on-device-only and never breaks.** Every presence call is best-effort/fire-and-forget; a widget or notification failure must never throw into the guess→timer→learn loop. Mirror the existing `try/catch` guards.
- **No new inline colors/sizes in RN code.** Any React Native styling value comes from `src/theme/tokens.ts` via `useTheme()`. (The JSX widget renders in a separate RemoteViews process where `useTheme` is unavailable — there, define the widget's palette as named constants sourced from the same token hex values, in one `widgetTheme.ts` file, and reference the tokens in a comment.)
- **Arc math is shared, single-source.** Reuse `arcFraction` from `src/engine/presence.ts:12`. Never re-derive it.
- **No paid account needed.** Everything here installs and runs on a personal debug/release build on a physical device. No Google Play account, no FCM.
- **Layer rule (ESLint-enforced):** `src/app/**` and `src/components/**` must not import `src/services/*` or `src/db/*`. Presence code lives in `src/services/*`, `src/widgets/*`, and `modules/*`; UI reaches it only through the existing hooks (`useToday`, `useTimer`) — which already call the bridge, so no UI change is needed.
- **Conventional Commits. No AI/co-author attribution in any commit or PR.**
- **Run `npm run lint && npm run typecheck && npx jest <changed suites>` before every commit; `npm test` before the final device build.**

---

## File Structure

**New files:**
- `src/widgets/widgetTheme.ts` — named color/size constants for the RemoteViews widget (mirrors `tokens.ts` hex; the widget process can't use `useTheme`).
- `src/widgets/widgetSnapshotStore.ts` — read/write/delete the `WidgetSnapshot` JSON in kv so the headless widget task can re-render from last-known state. Object export `widgetSnapshotStore.{save,load,clear}`.
- `src/widgets/NextTaskWidget.tsx` — the JSX widget UI (small + medium) built from `react-native-android-widget` primitives.
- `src/widgets/widgetTaskHandler.ts` — headless task handler: renders `NextTaskWidget` from the stored snapshot; opens the Start deep link on `WIDGET_CLICK`.
- `src/services/presence/createAndroidPresence.ts` — **pure** DI factory returning a `NativePresenceModule`. All logic + all tests live here.
- `src/services/presence/androidPresence.android.ts` — wires real deps (kv store, `requestWidgetUpdate`, native notif module) into the factory; `export loadAndroidPresence()`.
- `src/services/presence/androidPresence.ts` — default/iOS resolution: `loadAndroidPresence()` returns `null` (Metro picks this off Android).
- `modules/whenbee-presence/android/build.gradle` — Kotlin Expo-module gradle.
- `modules/whenbee-presence/android/src/main/java/expo/modules/whenbeepresence/WhenbeePresenceModule.kt` — the ongoing-notification (Live-Activity analog) native module.
- `assets/widget-preview/next-task.png` — widget picker preview image.

**Modified files:**
- `app.json` — add the `react-native-android-widget` plugin + widget config; add Android `POST_NOTIFICATIONS` permission; set `android.versionCode`; add `expo-build-properties` android `compileSdkVersion`/`targetSdkVersion` 36.
- `modules/whenbee-presence/expo-module.config.json` — add the `android` platform + module.
- `src/services/liveActivity.ts` — make `loadNativePresence()` platform-aware (Android → `loadAndroidPresence()`).
- `index.js` (app entry) — register the widget task handler on Android.
- `docs/NATIVE-PRESENCE.md` — add the Android section.

**Test files:**
- `src/widgets/__tests__/widgetSnapshotStore.test.ts`
- `src/services/presence/__tests__/createAndroidPresence.test.ts`
- `src/services/__tests__/liveActivity.androidLoader.test.ts`

---

### Task 1: Install `react-native-android-widget` + config plugin, manifest permission, build props

**Files:**
- Modify: `app.json`
- Modify: `package.json` (via `expo install`)
- Create: `assets/widget-preview/next-task.png` (placeholder PNG; real art later)

**Interfaces:**
- Produces: a registered Android widget named `"NextTask"` (referenced by `requestWidgetUpdate({ widgetName: 'NextTask' })` and the manifest receiver); `POST_NOTIFICATIONS` permission; `compileSdk`/`targetSdk` 36 so the Android-16 `ProgressStyle` API compiles.

- [ ] **Step 1: Install the library (pins an SDK-54-compatible version)**

Run:
```bash
cd /Users/alisuliman/Business/income/Apps/Whenbee
npx expo install react-native-android-widget
```
Expected: `package.json` gains `react-native-android-widget` (~0.20.x).

- [ ] **Step 2: Add a placeholder preview image**

Run:
```bash
mkdir -p assets/widget-preview
cp assets/images/android-icon-foreground.png assets/widget-preview/next-task.png
```
(Any PNG works as a first pass; it's only the widget-picker thumbnail.)

- [ ] **Step 3: Register the plugin + widget in `app.json`**

In `app.json`, inside `expo.plugins`, add (as a new array entry):
```json
[
  "react-native-android-widget",
  {
    "widgets": [
      {
        "name": "NextTask",
        "label": "Whenbee — Next task",
        "description": "Your next task and its honest finish time",
        "minWidth": "110dp",
        "minHeight": "110dp",
        "targetCellWidth": 2,
        "targetCellHeight": 2,
        "resizeMode": "horizontal|vertical",
        "previewImage": "./assets/widget-preview/next-task.png",
        "updatePeriodMillis": 1800000
      }
    ]
  }
]
```
(`updatePeriodMillis` 1800000 = 30 min: the Android floor for background auto-refresh. Live updates come from the app via `requestWidgetUpdate`, not this timer.)

- [ ] **Step 4: Add the Android notification permission + versionCode**

In `app.json` under `expo.android`, add:
```json
"versionCode": 1,
"permissions": ["android.permission.POST_NOTIFICATIONS"]
```
(Keep the existing `package`, `adaptiveIcon`, `predictiveBackGestureEnabled` keys.)

- [ ] **Step 5: Raise Android compile/target SDK to 36 for the ProgressStyle API**

In `app.json`, find the `expo-build-properties` plugin entry and add an `android` block (merge if `ios` already present):
```json
[
  "expo-build-properties",
  {
    "android": {
      "compileSdkVersion": 36,
      "targetSdkVersion": 36,
      "minSdkVersion": 24
    }
  }
]
```

- [ ] **Step 6: Verify prebuild generates the widget glue**

Run:
```bash
npx expo prebuild --clean -p android
grep -R "NextTask" android/app/src/main/AndroidManifest.xml android/app/src/main/res/xml/ 2>/dev/null
```
Expected: a `<receiver ... NextTaskWidget ...>` in the manifest and an `appwidget-provider` XML referencing `NextTask`. (Regenerating `android/` is safe — it's CNG/gitignored.)

- [ ] **Step 7: Commit**

```bash
git add app.json package.json package-lock.json assets/widget-preview/next-task.png
git commit -m "feat(android-presence): register NextTask widget + notification permission"
```

---

### Task 2: `widgetSnapshotStore` — persist the snapshot in kv (TDD)

**Files:**
- Create: `src/widgets/widgetSnapshotStore.ts`
- Test: `src/widgets/__tests__/widgetSnapshotStore.test.ts`

**Interfaces:**
- Consumes: `kv` from `src/lib/kv.ts` (`set(key,value)`, `getString(key): string|null`, `delete(key)`); `WidgetSnapshot`, `WIDGET_SNAPSHOT_KEY` from `src/services/liveActivity.ts`.
- Produces: `widgetSnapshotStore.save(snapshot: WidgetSnapshot): void`, `widgetSnapshotStore.load(): WidgetSnapshot | null`, `widgetSnapshotStore.clear(): void`. (Named `save/load/clear`, NOT `writeSnapshot/clearSnapshot`, to avoid colliding with the bridge's public API names.)

- [ ] **Step 1: Write the failing test**

Create `src/widgets/__tests__/widgetSnapshotStore.test.ts`:
```ts
import { widgetSnapshotStore } from '@/src/widgets/widgetSnapshotStore';
import { WIDGET_SNAPSHOT_KEY, type WidgetSnapshot } from '@/src/services/liveActivity';

const store: Record<string, string> = {};
jest.mock('@/src/lib/kv', () => ({
  kv: {
    set: (k: string, v: string) => { store[k] = v; },
    getString: (k: string) => (k in store ? store[k] : null),
    delete: (k: string) => { delete store[k]; },
  },
}));

const sample: WidgetSnapshot = {
  nextTaskLabel: 'Write the report',
  category: 'Deep work',
  honestFinishClock: '7:10',
  startDeepLink: 'whenbee://timer?taskId=1',
  updatedAtEpoch: 1000,
  honestFinishEpoch: 3700,
  isPro: true,
};

beforeEach(() => { for (const k of Object.keys(store)) delete store[k]; });

test('save then load round-trips the snapshot', () => {
  widgetSnapshotStore.save(sample);
  expect(store[WIDGET_SNAPSHOT_KEY]).toBeDefined();
  expect(widgetSnapshotStore.load()).toEqual(sample);
});

test('load returns null when nothing stored', () => {
  expect(widgetSnapshotStore.load()).toBeNull();
});

test('load returns null on corrupt JSON instead of throwing', () => {
  store[WIDGET_SNAPSHOT_KEY] = '{not json';
  expect(widgetSnapshotStore.load()).toBeNull();
});

test('clear removes the stored snapshot', () => {
  widgetSnapshotStore.save(sample);
  widgetSnapshotStore.clear();
  expect(widgetSnapshotStore.load()).toBeNull();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest src/widgets/__tests__/widgetSnapshotStore.test.ts`
Expected: FAIL — cannot find module `widgetSnapshotStore`.

- [ ] **Step 3: Implement the store**

Create `src/widgets/widgetSnapshotStore.ts`:
```ts
// Persists the Home-screen widget snapshot so the headless widget task can
// re-render from last-known state when the app process isn't running. The bridge
// (androidPresence) writes here on every publish; widgetTaskHandler reads here.
import { kv } from '@/src/lib/kv';
import { WIDGET_SNAPSHOT_KEY, type WidgetSnapshot } from '@/src/services/liveActivity';

export const widgetSnapshotStore = {
  save: (snapshot: WidgetSnapshot): void => {
    kv.set(WIDGET_SNAPSHOT_KEY, JSON.stringify(snapshot));
  },

  load: (): WidgetSnapshot | null => {
    const raw = kv.getString(WIDGET_SNAPSHOT_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as WidgetSnapshot;
    } catch {
      return null; // corrupt payload → quiet empty widget, never throw
    }
  },

  clear: (): void => {
    kv.delete(WIDGET_SNAPSHOT_KEY);
  },
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/widgets/__tests__/widgetSnapshotStore.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/widgets/widgetSnapshotStore.ts src/widgets/__tests__/widgetSnapshotStore.test.ts
git commit -m "feat(android-presence): kv-backed widget snapshot store"
```

---

### Task 3: `widgetTheme` + `NextTaskWidget` JSX UI

**Files:**
- Create: `src/widgets/widgetTheme.ts`
- Create: `src/widgets/NextTaskWidget.tsx`

**Interfaces:**
- Consumes: `arcFraction` from `src/engine/presence.ts`; `WidgetSnapshot` from `src/services/liveActivity.ts`; `FlexWidget`, `TextWidget` from `react-native-android-widget`.
- Produces: `NextTaskWidget({ snapshot, nowSec }: { snapshot: WidgetSnapshot | null; nowSec: number }): JSX.Element`. Used by `widgetTaskHandler` and `createAndroidPresence`'s render call.

- [ ] **Step 1: Create the widget palette (mirrors tokens.ts; RemoteViews can't use useTheme)**

Create `src/widgets/widgetTheme.ts`:
```ts
// The widget renders in a separate RemoteViews process where useTheme() is
// unavailable, so its palette is defined here as constants. Values MUST match
// src/theme/tokens.ts — update both together. (surface=colors.surface,
// ink=colors.ink, muted=colors.inkMuted, accent=colors.honey/accent.)
export const widgetTheme = {
  surface: '#12100E', // tokens colors.surface (dark)
  ink: '#F5F1EA', // tokens colors.ink
  inkMuted: '#A79E90', // tokens colors.inkMuted
  accent: '#E8B23A', // tokens colors.honey
  ringTrack: '#2A2621', // tokens colors.hairline
  radius: 20,
  padding: 14,
  labelSize: 15,
  captionSize: 12,
  wordmarkSize: 11,
} as const;
```
(The exact hex values are copied from `src/theme/tokens.ts` in Step 4's verification — replace the placeholders above with the real `colors.surface`, `colors.ink`, `colors.inkMuted`, `colors.honey`, `colors.hairline` values before committing.)

- [ ] **Step 2: Implement `NextTaskWidget`**

Create `src/widgets/NextTaskWidget.tsx`:
```tsx
// Home-screen widget UI, declared in JSX and rendered to Android RemoteViews by
// react-native-android-widget. Presentation-only: all math/formatting is done in
// JS before the snapshot is written (mirrors the iOS NextTaskWidget.swift split).
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { arcFraction } from '@/src/engine/presence';
import type { WidgetSnapshot } from '@/src/services/liveActivity';
import { widgetTheme as t } from '@/src/widgets/widgetTheme';

const STALE_AFTER_SEC = 6 * 60 * 60; // 6h — matches SharedStore.swift staleness gate

type Props = { snapshot: WidgetSnapshot | null; nowSec: number };

export function NextTaskWidget({ snapshot, nowSec }: Props) {
  const hasTask = snapshot != null && snapshot.nextTaskLabel !== '';
  const isStale = snapshot != null && nowSec - snapshot.updatedAtEpoch > STALE_AFTER_SEC;

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: t.surface,
        borderRadius: t.radius,
        padding: t.padding,
      }}
      clickAction="OPEN_START"
    >
      <TextWidget text="● Whenbee" style={{ fontSize: t.wordmarkSize, color: t.accent }} />

      {hasTask ? (
        <FlexWidget style={{ flexDirection: 'column' }}>
          <TextWidget
            text={snapshot!.nextTaskLabel}
            maxLines={2}
            style={{ fontSize: t.labelSize, color: t.ink }}
          />
          <TextWidget
            text={isStale ? snapshot!.honestFinishClock : `Honest finish ${snapshot!.honestFinishClock}`}
            style={{ fontSize: t.captionSize, color: t.inkMuted, marginTop: 4 }}
          />
          {snapshot!.isPro ? <ProgressBar snapshot={snapshot!} nowSec={nowSec} /> : null}
        </FlexWidget>
      ) : (
        <TextWidget text="No task queued" style={{ fontSize: t.captionSize, color: t.inkMuted }} />
      )}

      <TextWidget
        text="Start"
        clickAction="OPEN_START"
        style={{
          fontSize: t.captionSize,
          color: t.surface,
          backgroundColor: t.accent,
          borderRadius: 999,
          paddingHorizontal: 14,
          paddingVertical: 6,
          textAlign: 'center',
        }}
      />
    </FlexWidget>
  );
}

// RemoteViews can't draw an arc, so the Pro "ring" becomes a horizontal fill bar
// whose width is the SAME arcFraction the iOS ring uses — one shared formula.
function ProgressBar({ snapshot, nowSec }: { snapshot: WidgetSnapshot; nowSec: number }) {
  const frac = arcFraction(snapshot.updatedAtEpoch, snapshot.honestFinishEpoch, nowSec);
  const pct = `${Math.round(frac * 100)}%` as const;
  return (
    <FlexWidget
      style={{ height: 4, width: 'match_parent', backgroundColor: t.ringTrack, borderRadius: 999, marginTop: 8 }}
    >
      <FlexWidget style={{ height: 4, width: pct, backgroundColor: t.accent, borderRadius: 999 }} />
    </FlexWidget>
  );
}
```

- [ ] **Step 3: Typecheck the new files**

Run: `npm run typecheck`
Expected: PASS (no errors in `src/widgets/*`). If `react-native-android-widget` style props reject a value, adjust to the library's `WidgetStyle` types (consult `node_modules/react-native-android-widget/dist` typings).

- [ ] **Step 4: Replace placeholder hex with real token values, then lint**

Run:
```bash
grep -E "surface|ink|inkMuted|honey|hairline" src/theme/tokens.ts | head -40
npx eslint src/widgets/widgetTheme.ts src/widgets/NextTaskWidget.tsx
```
Update `widgetTheme.ts` constants to the exact hex from `tokens.ts`. Expected: eslint clean.

- [ ] **Step 5: Commit**

```bash
git add src/widgets/widgetTheme.ts src/widgets/NextTaskWidget.tsx
git commit -m "feat(android-presence): NextTask widget UI (JSX/RemoteViews)"
```

---

### Task 4: `widgetTaskHandler` — headless render + Start deep link

**Files:**
- Create: `src/widgets/widgetTaskHandler.ts`

**Interfaces:**
- Consumes: `widgetSnapshotStore` (Task 2); `NextTaskWidget` (Task 3); `WidgetTaskHandlerProps`, `renderWidget` semantics from `react-native-android-widget`; `Linking` from `react-native`.
- Produces: `widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void>` — registered in `index.js` (Task 5).

- [ ] **Step 1: Implement the handler**

Create `src/widgets/widgetTaskHandler.ts`:
```ts
// Headless task the OS invokes for widget lifecycle events (add / periodic update /
// resize / click), even when the app is closed. We re-render NextTask from the
// last-known snapshot in kv, and open the Start deep link on tap.
import React from 'react';
import { Linking } from 'react-native';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { NextTaskWidget } from '@/src/widgets/NextTaskWidget';
import { widgetSnapshotStore } from '@/src/widgets/widgetSnapshotStore';

const nowSec = () => Math.round(Date.now() / 1000);

export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  const { widgetAction, renderWidget, clickAction } = props;

  if (widgetAction === 'WIDGET_CLICK' && clickAction === 'OPEN_START') {
    const snapshot = widgetSnapshotStore.load();
    const url = snapshot?.startDeepLink ?? 'whenbee://timer';
    await Linking.openURL(url).catch(() => {});
    return;
  }

  // WIDGET_ADDED | WIDGET_UPDATE | WIDGET_RESIZED → paint from stored state.
  renderWidget(React.createElement(NextTaskWidget, { snapshot: widgetSnapshotStore.load(), nowSec: nowSec() }));
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS. (If `WidgetTaskHandlerProps` names differ in the installed version — e.g. `widgetAction` values — align with `node_modules/react-native-android-widget` typings.)

- [ ] **Step 3: Lint**

Run: `npx eslint src/widgets/widgetTaskHandler.ts`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/widgets/widgetTaskHandler.ts
git commit -m "feat(android-presence): widget task handler (render + start deep link)"
```

---

### Task 5: Register the widget task handler in the app entry

**Files:**
- Modify: `index.js` (repo-root Expo entry; confirm the path with `node -e "console.log(require('./package.json').main)"`)

**Interfaces:**
- Consumes: `registerWidgetTaskHandler` from `react-native-android-widget`; `widgetTaskHandler` (Task 4).
- Produces: side-effect registration on Android only.

- [ ] **Step 1: Locate the entry file**

Run: `node -e "console.log(require('./package.json').main)"`
Expected: prints the entry (e.g. `index.js` or `expo-router/entry`). If it's `expo-router/entry`, create/append to a local `index.js` that first imports the router entry, then registers the handler, and point `package.json` `main` to it — but only if no `index.js` exists. If `index.js` already exists, edit it.

- [ ] **Step 2: Register on Android**

Add to the entry file (after existing imports, before/after the router entry import as appropriate):
```js
import { Platform } from 'react-native';

if (Platform.OS === 'android') {
  // Registered at module load so the OS can invoke it headlessly. Guarded to
  // Android; the library's native side only exists there.
  const { registerWidgetTaskHandler } = require('react-native-android-widget');
  const { widgetTaskHandler } = require('@/src/widgets/widgetTaskHandler');
  registerWidgetTaskHandler(widgetTaskHandler);
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `npm run typecheck && npx eslint index.js`
Expected: clean. (If the entry is `.js` and eslint ignores it, skip the eslint step.)

- [ ] **Step 4: Commit**

```bash
git add index.js package.json
git commit -m "feat(android-presence): register widget task handler on Android"
```

---

### Task 6: Kotlin Expo module — ongoing chronometer notification (Live-Activity analog)

**Files:**
- Create: `modules/whenbee-presence/android/build.gradle`
- Create: `modules/whenbee-presence/android/src/main/java/expo/modules/whenbeepresence/WhenbeePresenceModule.kt`
- Modify: `modules/whenbee-presence/expo-module.config.json`

**Interfaces:**
- Produces a native module named `WhenbeePresence` (same JS name as iOS) exposing, on Android:
  - `Property("isStub") { false }`
  - `Function("startTimerNotification") { attrs: Map<String, Any?> }` — keys: `taskLabel: String`, `finishEpoch: Double` (unix seconds), `isProRich: Boolean`.
  - `Function("updateTimerNotification") { state: Map<String, Any?> }` — key `isOverrun: Boolean`.
  - `Function("stopTimerNotification") { }`
  - Consumed by `androidPresence.android.ts` (Task 7). The JS adapter maps `startLiveActivity→startTimerNotification`, `updateLiveActivity→updateTimerNotification`, `endLiveActivity→stopTimerNotification`.

- [ ] **Step 1: Add the Android platform to the module config**

Edit `modules/whenbee-presence/expo-module.config.json` to:
```json
{
  "platforms": ["apple", "android"],
  "apple": {
    "modules": ["WhenbeePresenceModule"]
  },
  "android": {
    "modules": ["expo.modules.whenbeepresence.WhenbeePresenceModule"]
  }
}
```

- [ ] **Step 2: Create the module gradle**

Create `modules/whenbee-presence/android/build.gradle`:
```gradle
apply plugin: 'com.android.library'
apply plugin: 'kotlin-android'

group = 'expo.modules.whenbeepresence'
version = '0.1.0'

def expoModulesCorePlugin = new File(project(":expo-modules-core").projectDir.absolutePath, "ExpoModulesCorePlugin.gradle")
apply from: expoModulesCorePlugin
applyKotlinExpoModulesCorePlugin()
useCoreDependencies()
useExpoPublishing()

android {
  namespace "expo.modules.whenbeepresence"
  compileSdkVersion rootProject.ext.has("compileSdkVersion") ? rootProject.ext.get("compileSdkVersion") : 36
  defaultConfig {
    minSdkVersion rootProject.ext.has("minSdkVersion") ? rootProject.ext.get("minSdkVersion") : 24
  }
}

dependencies {
  implementation "androidx.core:core-ktx:1.13.1"
}
```

- [ ] **Step 3: Implement the notification module**

Create `modules/whenbee-presence/android/src/main/java/expo/modules/whenbeepresence/WhenbeePresenceModule.kt`:
```kotlin
package expo.modules.whenbeepresence

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Android analog of the iOS Live Activity. An ONGOING notification whose countdown
// is ticked by the system chronometer (no foreground service, no background JS),
// progressively enhanced to an Android-16 promoted "Live Update" via ProgressStyle.
class WhenbeePresenceModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context unavailable" }

  private fun ensureChannel() {
    val mgr = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (mgr.getNotificationChannel(CHANNEL_ID) == null) {
      val channel = NotificationChannel(CHANNEL_ID, "Running timer", NotificationManager.IMPORTANCE_LOW).apply {
        description = "Shows your live timer while a task is running"
        setShowBadge(false)
      }
      mgr.createNotificationChannel(channel)
    }
  }

  private fun postNotification(label: String, finishEpochSec: Double, isOverrun: Boolean, isProRich: Boolean) {
    ensureChannel()
    val finishMs = (finishEpochSec * 1000).toLong()

    val builder = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(context.applicationInfo.icon)
      .setContentTitle(label)
      .setContentText(if (isOverrun) "Over your honest finish" else "Running — honest finish shown")
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setUsesChronometer(true)
      // Count DOWN to the honest finish; once overrun, count UP from it (+MM:SS).
      .setChronometerCountDown(!isOverrun)
      .setWhen(finishMs)
      .setShowWhen(true)

    // Android 16 (API 36) promoted ongoing "Live Update" — the real Live Activity analog
    // (status-bar chip). Reflection-guarded so the module compiles/runs on older devices.
    if (Build.VERSION.SDK_INT >= 36 && isProRich) {
      try {
        val m = NotificationCompat.Builder::class.java.getMethod("requestPromotedOngoing", Boolean::class.javaPrimitiveType)
        m.invoke(builder, true)
      } catch (_: Throwable) { /* not available → plain ongoing notification */ }
    }

    NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, builder.build())
  }

  override fun definition() = ModuleDefinition {
    Name("WhenbeePresence")

    Property("isStub") { false }

    Function("startTimerNotification") { attrs: Map<String, Any?> ->
      val label = attrs["taskLabel"] as? String ?: return@Function
      val finish = (attrs["finishEpoch"] as? Number)?.toDouble() ?: return@Function
      val proRich = attrs["isProRich"] as? Boolean ?: false
      postNotification(label, finish, isOverrun = false, isProRich = proRich)
      lastLabel = label; lastFinish = finish; lastProRich = proRich
    }

    Function("updateTimerNotification") { state: Map<String, Any?> ->
      val overrun = state["isOverrun"] as? Boolean ?: false
      val label = lastLabel ?: return@Function
      val finish = lastFinish ?: return@Function
      postNotification(label, finish, isOverrun = overrun, isProRich = lastProRich)
    }

    Function("stopTimerNotification") {
      NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
      lastLabel = null; lastFinish = null
    }
  }

  // Retained so an overrun update can re-post with the original label/finish.
  private var lastLabel: String? = null
  private var lastFinish: Double? = null
  private var lastProRich: Boolean = false

  companion object {
    private const val CHANNEL_ID = "whenbee.timer"
    private const val NOTIFICATION_ID = 4711
  }
}
```

- [ ] **Step 4: Prebuild + compile the module**

Run:
```bash
npx expo prebuild -p android
cd android && ./gradlew :whenbee-presence:compileReleaseKotlin ; cd ..
```
Expected: BUILD SUCCESSFUL (the module compiles). If autolinking doesn't pick it up, confirm `expo-module.config.json` `android.modules` uses the fully-qualified class name and re-run prebuild.

- [ ] **Step 5: Commit**

```bash
git add modules/whenbee-presence/android modules/whenbee-presence/expo-module.config.json
git commit -m "feat(android-presence): Kotlin ongoing chronometer notification module"
```

---

### Task 7: `createAndroidPresence` pure factory (TDD)

**Files:**
- Create: `src/services/presence/createAndroidPresence.ts`
- Test: `src/services/presence/__tests__/createAndroidPresence.test.ts`

**Interfaces:**
- Consumes: `NativePresenceModule`, `WidgetSnapshot`, `LiveActivityAttributes` from `src/services/liveActivity.ts`.
- Produces:
  ```ts
  export interface AndroidPresenceDeps {
    saveSnapshot: (s: WidgetSnapshot) => void;
    clearSnapshot: () => void;
    renderWidget: () => void; // triggers requestWidgetUpdate with the current snapshot
    notif: {
      startTimerNotification: (attrs: Record<string, unknown>) => void;
      updateTimerNotification: (state: Record<string, unknown>) => void;
      stopTimerNotification: () => void;
    } | null; // null when the native module isn't linked (older binary)
  }
  export function createAndroidPresence(deps: AndroidPresenceDeps): NativePresenceModule
  ```
  Consumed by `androidPresence.android.ts` (Task 8) and `liveActivity.ts`.

- [ ] **Step 1: Write the failing test**

Create `src/services/presence/__tests__/createAndroidPresence.test.ts`:
```ts
import { createAndroidPresence, type AndroidPresenceDeps } from '@/src/services/presence/createAndroidPresence';
import type { WidgetSnapshot, LiveActivityAttributes } from '@/src/services/liveActivity';

const snapshot: WidgetSnapshot = {
  nextTaskLabel: 'Write the report', category: 'Deep work', honestFinishClock: '7:10',
  startDeepLink: 'whenbee://timer?taskId=1', updatedAtEpoch: 1000, honestFinishEpoch: 3700, isPro: true,
};
const attrs: LiveActivityAttributes = { taskLabel: 'Write', finishEpoch: 3700, startEpoch: 1000, isProRich: true };

function makeDeps(overrides: Partial<AndroidPresenceDeps> = {}): jest.Mocked<AndroidPresenceDeps> {
  return {
    saveSnapshot: jest.fn(), clearSnapshot: jest.fn(), renderWidget: jest.fn(),
    notif: { startTimerNotification: jest.fn(), updateTimerNotification: jest.fn(), stopTimerNotification: jest.fn() },
    ...overrides,
  } as jest.Mocked<AndroidPresenceDeps>;
}

test('isStub is false — Android presence is a real surface', () => {
  expect(createAndroidPresence(makeDeps()).isStub).toBe(false);
});

test('writeSnapshot persists then re-renders the widget', () => {
  const deps = makeDeps();
  createAndroidPresence(deps).writeSnapshot(snapshot);
  expect(deps.saveSnapshot).toHaveBeenCalledWith(snapshot);
  expect(deps.renderWidget).toHaveBeenCalledTimes(1);
});

test('clearSnapshot clears store then re-renders the empty widget', () => {
  const deps = makeDeps();
  createAndroidPresence(deps).clearSnapshot();
  expect(deps.clearSnapshot).toHaveBeenCalledTimes(1);
  expect(deps.renderWidget).toHaveBeenCalledTimes(1);
});

test('startLiveActivity forwards attrs to the native notification', () => {
  const deps = makeDeps();
  createAndroidPresence(deps).startLiveActivity(attrs);
  expect(deps.notif!.startTimerNotification).toHaveBeenCalledWith(attrs);
});

test('updateLiveActivity forwards overrun state', () => {
  const deps = makeDeps();
  createAndroidPresence(deps).updateLiveActivity({ isOverrun: true });
  expect(deps.notif!.updateTimerNotification).toHaveBeenCalledWith({ isOverrun: true });
});

test('endLiveActivity stops the notification', () => {
  const deps = makeDeps();
  createAndroidPresence(deps).endLiveActivity();
  expect(deps.notif!.stopTimerNotification).toHaveBeenCalledTimes(1);
});

test('notification calls no-op safely when the native module is absent', () => {
  const deps = makeDeps({ notif: null });
  const p = createAndroidPresence(deps);
  expect(() => { p.startLiveActivity(attrs); p.updateLiveActivity({ isOverrun: true }); p.endLiveActivity(); }).not.toThrow();
});

test('a throwing dep never escapes writeSnapshot', () => {
  const deps = makeDeps({ saveSnapshot: jest.fn(() => { throw new Error('kv down'); }) });
  expect(() => createAndroidPresence(deps).writeSnapshot(snapshot)).not.toThrow();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest src/services/presence/__tests__/createAndroidPresence.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the factory**

Create `src/services/presence/createAndroidPresence.ts`:
```ts
// Pure, dependency-injected Android implementation of NativePresenceModule.
// Widget writes go to the kv store + a widget re-render; the running-timer
// "Live Activity" maps onto the native ongoing-notification module. Every method
// is best-effort — a presence failure must never reach the core loop.
import type { NativePresenceModule, WidgetSnapshot, LiveActivityAttributes } from '@/src/services/liveActivity';

export interface AndroidPresenceDeps {
  saveSnapshot: (snapshot: WidgetSnapshot) => void;
  clearSnapshot: () => void;
  renderWidget: () => void;
  notif: {
    startTimerNotification: (attrs: Record<string, unknown>) => void;
    updateTimerNotification: (state: Record<string, unknown>) => void;
    stopTimerNotification: () => void;
  } | null;
}

const swallow = (fn: () => void): void => {
  try {
    fn();
  } catch {
    // best-effort; presence must never break the guess→timer→learn loop
  }
};

export function createAndroidPresence(deps: AndroidPresenceDeps): NativePresenceModule {
  return {
    isStub: false,
    writeSnapshot: (snapshot: WidgetSnapshot) =>
      swallow(() => {
        deps.saveSnapshot(snapshot);
        deps.renderWidget();
      }),
    clearSnapshot: () =>
      swallow(() => {
        deps.clearSnapshot();
        deps.renderWidget();
      }),
    startLiveActivity: (attributes: LiveActivityAttributes) =>
      swallow(() => deps.notif?.startTimerNotification({ ...attributes })),
    updateLiveActivity: (state: { isOverrun: boolean }) =>
      swallow(() => deps.notif?.updateTimerNotification({ ...state })),
    endLiveActivity: () => swallow(() => deps.notif?.stopTimerNotification()),
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/services/presence/__tests__/createAndroidPresence.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Lint + commit**

```bash
npx eslint src/services/presence/createAndroidPresence.ts src/services/presence/__tests__/createAndroidPresence.test.ts
git add src/services/presence/createAndroidPresence.ts src/services/presence/__tests__/createAndroidPresence.test.ts
git commit -m "feat(android-presence): pure createAndroidPresence factory"
```

---

### Task 8: Wire real deps — `androidPresence.android.ts` + default stub, plug into `liveActivity.ts` (TDD)

**Files:**
- Create: `src/services/presence/androidPresence.android.ts`
- Create: `src/services/presence/androidPresence.ts`
- Modify: `src/services/liveActivity.ts:106-109` (`loadNativePresence`)
- Test: `src/services/__tests__/liveActivity.androidLoader.test.ts`

**Interfaces:**
- Consumes: `createAndroidPresence` (Task 7); `widgetSnapshotStore` (Task 2); `NextTaskWidget` (Task 3); `requestWidgetUpdate` from `react-native-android-widget`; `requireOptionalNativeModule` from `expo-modules-core`.
- Produces: `loadAndroidPresence(): NativePresenceModule | null` (real on Android via `.android.ts`, `null` elsewhere via `.ts`).

- [ ] **Step 1: Create the default (non-Android) resolution**

Create `src/services/presence/androidPresence.ts`:
```ts
// Default resolution for every platform except Android (Metro swaps in the
// `.android.ts` variant on Android). Presence on iOS is the native WhenbeePresence
// module, resolved separately in liveActivity.ts, so here we simply decline.
import type { NativePresenceModule } from '@/src/services/liveActivity';

export function loadAndroidPresence(): NativePresenceModule | null {
  return null;
}
```

- [ ] **Step 2: Create the Android wiring**

Create `src/services/presence/androidPresence.android.ts`:
```ts
// Android wiring: binds the real kv store, widget renderer, and native
// notification module into the pure createAndroidPresence factory. This file is
// only bundled on Android, so the Android-only library import stays out of iOS.
import React from 'react';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { createAndroidPresence } from '@/src/services/presence/createAndroidPresence';
import { widgetSnapshotStore } from '@/src/widgets/widgetSnapshotStore';
import { NextTaskWidget } from '@/src/widgets/NextTaskWidget';
import type { NativePresenceModule } from '@/src/services/liveActivity';

const WIDGET_NAME = 'NextTask';

type NotifModule = {
  startTimerNotification: (attrs: Record<string, unknown>) => void;
  updateTimerNotification: (state: Record<string, unknown>) => void;
  stopTimerNotification: () => void;
};

function renderCurrentWidget(): void {
  const nowSec = Math.round(Date.now() / 1000);
  void requestWidgetUpdate({
    widgetName: WIDGET_NAME,
    renderWidget: () =>
      React.createElement(NextTaskWidget, { snapshot: widgetSnapshotStore.load(), nowSec }),
    widgetNotFound: () => {
      // no widget on the home screen yet — nothing to paint
    },
  });
}

export function loadAndroidPresence(): NativePresenceModule {
  const notif = requireOptionalNativeModule<NotifModule>('WhenbeePresence') ?? null;
  return createAndroidPresence({
    saveSnapshot: widgetSnapshotStore.save,
    clearSnapshot: widgetSnapshotStore.clear,
    renderWidget: renderCurrentWidget,
    notif,
  });
}
```

- [ ] **Step 3: Write the failing loader test**

Create `src/services/__tests__/liveActivity.androidLoader.test.ts`:
```ts
import { resolveNativePresence, type NativePresenceModule } from '@/src/services/liveActivity';

// resolveNativePresence stays pure — this test proves an Android-style loader is
// honored (real module returned when not in Expo Go).
test('resolveNativePresence returns the injected android module outside Expo Go', () => {
  const android: NativePresenceModule = {
    isStub: false, writeSnapshot: jest.fn(), clearSnapshot: jest.fn(),
    startLiveActivity: jest.fn(), updateLiveActivity: jest.fn(), endLiveActivity: jest.fn(),
  };
  const resolved = resolveNativePresence(false, () => android);
  expect(resolved).toBe(android);
  expect(resolved.isStub).toBe(false);
});

test('resolveNativePresence still returns the stub in Expo Go even if a loader would provide one', () => {
  const android: NativePresenceModule = {
    isStub: false, writeSnapshot: jest.fn(), clearSnapshot: jest.fn(),
    startLiveActivity: jest.fn(), updateLiveActivity: jest.fn(), endLiveActivity: jest.fn(),
  };
  const resolved = resolveNativePresence(true, () => android);
  expect(resolved.isStub).toBe(true);
});
```

- [ ] **Step 4: Run it (first test may already pass; it guards the contract). Confirm the suite runs**

Run: `npx jest src/services/__tests__/liveActivity.androidLoader.test.ts`
Expected: PASS (`resolveNativePresence` already exists and is pure). This test locks the behavior the Android loader depends on.

- [ ] **Step 5: Make `loadNativePresence` platform-aware**

In `src/services/liveActivity.ts`, add the import near the top (after line 20):
```ts
import { Platform } from 'react-native';
import { loadAndroidPresence } from '@/src/services/presence/androidPresence';
```
Replace `loadNativePresence` (lines 106-109) with:
```ts
// Probe for the native module the same defensive way timerNotifications does.
// Android resolves a JS-backed adapter (widget + ongoing notification); iOS/other
// resolve the native WhenbeePresence module. A binary built before either was
// linked degrades to a clean no-op stub upstream.
function loadNativePresence(): NativePresenceModule | null {
  if (Platform.OS === 'android') return loadAndroidPresence();
  const native = requireOptionalNativeModule<NativePresenceModule>(NATIVE_MODULE_NAME);
  return native ?? null;
}
```

- [ ] **Step 6: Run the full presence-related suites (nothing regressed)**

Run: `npx jest src/services/__tests__ src/services/presence src/widgets src/engine/__tests__/presence.test.ts`
Expected: PASS across all — existing `liveActivity.test.ts`, `liveActivity.activeFlag.test.ts`, `presence.test.ts`, plus the new suites.

- [ ] **Step 7: Typecheck, lint, commit**

```bash
npm run typecheck
npx eslint src/services/liveActivity.ts src/services/presence/androidPresence.ts src/services/presence/androidPresence.android.ts src/services/__tests__/liveActivity.androidLoader.test.ts
git add src/services/liveActivity.ts src/services/presence/androidPresence.ts src/services/presence/androidPresence.android.ts src/services/__tests__/liveActivity.androidLoader.test.ts
git commit -m "feat(android-presence): platform-aware presence loader (Android adapter)"
```

---

### Task 9: Full-suite gate + build, install, and verify on the Pixel

**Files:** none (verification task)

**Interfaces:** consumes everything above; produces a running APK on the device with a working widget + live notification.

- [ ] **Step 1: Full local gate**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all green, 0 warnings.

- [ ] **Step 2: Prebuild + build the release APK on the Pixel**

Run:
```bash
bash "/Users/alisuliman/Business/income/Apps/Whenbee/.claude/skills/whenbee-device/scripts/build-and-launch-android.sh"
```
(The script runs `expo prebuild -p android` if needed, `assembleRelease`, installs, and launches.) Expected final line: `✓ Whenbee is running on the device with your latest code.`

- [ ] **Step 3: Verify the widget**

On the Pixel: long-press the home screen → **Widgets** → find **Whenbee — Next task** → drag it to the home screen. Expected: it shows the honey dot + wordmark, the next task label, "Honest finish H:MM", a Start chip, and (if Pro) the fill bar. Tapping the widget/Start opens the app at the timer deep link.

- [ ] **Step 4: Verify the live notification**

In the app, start a timer. Expected: an ongoing notification appears (non-swipeable) with the task label and a **live-ticking countdown** to the honest finish; on Android 16 (this Pixel) with Pro, it's promoted to a status-bar **Live Update** chip. Let it pass the honest finish → the chronometer flips to counting up (overrun). Stop the timer → the notification disappears.

- [ ] **Step 5: Capture evidence + note any gaps**

Run: `adb -s 55091FDCH002JF exec-out screencap -p > /tmp/whenbee-widget.png` (home screen with widget) and repeat with the notification shade open. Report both back. If the widget shows the empty state, confirm a task is queued in Today and that `publishWidgetSnapshot` ran (foreground the app once).

- [ ] **Step 6: Commit any fixes discovered during device verification** (per whatever was changed).

---

### Task 10: Document the Android presence in `docs/NATIVE-PRESENCE.md`

**Files:**
- Modify: `docs/NATIVE-PRESENCE.md`

- [ ] **Step 1: Append an Android section**

Add a section covering: the two surfaces (widget via `react-native-android-widget`; live notification via the Kotlin `WhenbeePresence` module), the shared `WidgetSnapshot`/`LiveActivityAttributes` contract reused from iOS, the kv snapshot key, the `arcFraction` single-source, the platform-split loader, and — importantly — that **Android presence needs no paid developer account** and is fully testable on a personal build (contrast with iOS Live Activities, which require a paid Apple team). Note the two platform limits: widget background auto-refresh floor is 30 min (live updates come from `requestWidgetUpdate` while the app is foregrounded / the headless task on lifecycle events), and the promoted `ProgressStyle` "Live Update" chip is API-36-only (older Android shows a plain ongoing chronometer notification).

- [ ] **Step 2: Commit**

```bash
git add docs/NATIVE-PRESENCE.md
git commit -m "docs(android-presence): document the Android widget + live notification"
```

---

## Self-Review

**1. Spec coverage.** iOS presence = (a) Home-screen widget → Tasks 1–5 (register, store, UI, task handler, entry). (b) Live Activity → Task 6 (Kotlin ongoing chronometer notification, ProgressStyle on API 36). (c) JS bridge reuse → Tasks 7–8 (factory + platform loader; zero call-site changes). (d) shared arc math → reused in Task 3. (e) analytics (`widget_added`/`widget_engaged`) → fire automatically once `isStub` is false, no new code. (f) Pro gating → widget fill bar + promoted chip gated on `isPro`/`isProRich`, matching iOS. (g) staleness (6h) → Task 3. (h) docs + device verify → Tasks 9–10. Covered.

**2. Placeholder scan.** `widgetTheme.ts` hex values are the one deliberate "fill in from tokens.ts" — Task 3 Step 4 forces the real values before commit; not a silent TODO. No other placeholders.

**3. Type consistency.** `NativePresenceModule` (isStub, writeSnapshot, clearSnapshot, startLiveActivity, updateLiveActivity, endLiveActivity) is imported from `liveActivity.ts` everywhere, never redefined. Factory method names match the interface exactly. `widgetSnapshotStore.{save,load,clear}` are deliberately distinct from the bridge's `clearWidgetSnapshot`/`writeSnapshot` (no collision). Native functions `startTimerNotification`/`updateTimerNotification`/`stopTimerNotification` are consistent between the Kotlin module (Task 6), the `NotifModule` type (Task 8), and the factory deps (Task 7).

**Open risks flagged for the implementer:**
- `react-native-android-widget` prop/type names (`WidgetStyle`, `widgetAction` enum, `requestWidgetUpdate` signature) can drift by version — verify against the installed `node_modules` typings in Tasks 3–4/8 and adjust.
- kv access inside the headless widget task (Task 4): if `expo-sqlite/kv-store` proves unavailable in the widget process on-device, fall back to the library's own prop persistence (pass the snapshot through `requestWidgetUpdate` and cache last props) — device verification (Task 9 Step 3) is where this surfaces.

---

## Would you see & test the widget on Android? — Yes.

Unlike iOS (where the widget + Live Activity are stripped from the free-team build and need a **paid** Apple Developer account), **every** Android piece here runs on a personal debug/release APK on your Pixel — no Google Play account, no paid membership, no server. You'll add the widget from the launcher's widget picker and watch the ongoing timer notification tick live. The Android-16 promoted "Live Update" status-bar chip (the closest analog to the iOS Dynamic Island / Live Activity) is visible on your Pixel 10 Pro specifically because it's on API 36.
```

---

# ADDENDUM (2026-07-03): Native widget pivot + native overrun fix

Device verification on the Pixel 10 Pro (Android 16 / API 36) found: the live-timer **notification works**, but (1) overrun display is wrong because the JS `setTimeout` flip is frozen while the app is backgrounded, and (2) `react-native-android-widget@0.20.3` renders a **blank** widget on API 36 (its headless JS render task never runs) and crashes internally on remove. Decision: fix overrun **natively**, and replace the JS widget library with a **native RemoteViews `AppWidgetProvider`** housed in the existing `modules/whenbee-presence` Expo module.

**New shared state:** a single SharedPreferences file `"<pkg>.presence"` holds two keys — `"timer"` (the running-timer JSON: taskLabel, finishEpoch, isProRich) and `"widget"` (the WidgetSnapshot JSON). Both the notification's alarm receiver and the widget provider read from it, so presence survives process death.

## Task G1: Native overrun flip (AlarmManager) + persisted notification state

**Files:** `modules/whenbee-presence/android/src/main/java/expo/modules/whenbeepresence/WhenbeePresenceModule.kt` (modify), new `TimerAlarmReceiver.kt`, module `AndroidManifest.xml` (create — declare the receiver + `USE_EXACT_ALARM`).

- On `startTimerNotification`: persist `{taskLabel, finishEpoch, isProRich}` to SharedPreferences key `"timer"`, post the ongoing chronometer notification (as today), AND schedule an exact alarm (`AlarmManager.setExactAndAllowWhileIdle`, `USE_EXACT_ALARM`) at `finishEpoch*1000` with a `PendingIntent` to `TimerAlarmReceiver`.
- `TimerAlarmReceiver.onReceive`: read `"timer"` from SharedPreferences; if present, re-post the SAME notification id with `isOverrun=true` (count-up chronometer). This fires even when the app is backgrounded/killed — the fix for the lock-screen case.
- `stopTimerNotification`: cancel the alarm (same PendingIntent), cancel the notification, clear the `"timer"` key.
- `updateTimerNotification` (JS path) stays as a harmless foreground fast-path; both routes re-post idempotently.
- Extract the notification-building into a shared function usable by both the module and the receiver (put it in a `PresenceNotifier` object or the receiver calls back into a static builder). Keep the chronometer polarity from Task 6.
- Manifest: the module's `AndroidManifest.xml` declares `<receiver android:name=".TimerAlarmReceiver" android:exported="false"/>` and `<uses-permission android:name="android.permission.USE_EXACT_ALARM"/>`.

**Verify:** `./gradlew :whenbee-presence:compileReleaseKotlin` BUILD SUCCESSFUL.

## Task G2: Native RemoteViews widget (provider + layout + snapshot store + update trigger)

**Files (all under `modules/whenbee-presence/android/`):** `WhenbeePresenceModule.kt` (add `writeWidgetSnapshot(json)` + `clearWidgetSnapshot()`), new `NextTaskWidgetProvider.kt` (`AppWidgetProvider`), `src/main/res/layout/widget_next_task.xml`, `src/main/res/xml/next_task_widget_info.xml` (appwidget-provider), `src/main/res/drawable/*` (preview + bar assets), `src/main/res/values/strings.xml` (widget label/description), `AndroidManifest.xml` (declare the widget receiver + `APPWIDGET_UPDATE` intent-filter + provider meta-data), module `build.gradle` (no new deps — RemoteViews is in the framework; androidx.core already present).

- `writeWidgetSnapshot(json)`: store JSON under SharedPreferences key `"widget"`, then `AppWidgetManager.getInstance(ctx).getAppWidgetIds(ComponentName(ctx, NextTaskWidgetProvider))` → `notifyAppWidgetViewDataChanged`/`updateAppWidget` (rebuild RemoteViews). `clearWidgetSnapshot()`: remove the key + update (empty state).
- `NextTaskWidgetProvider.onUpdate`/`onReceive(APPWIDGET_UPDATE)`: read `"widget"` JSON → build `RemoteViews(pkg, R.layout.widget_next_task)`: set task label, "Honest finish H:MM" (drop prefix when `now-updatedAtEpoch > 6h`), toggle the Pro fill bar width by `arcFraction(updatedAtEpoch, honestFinishEpoch, now)` (port the formula into Kotlin with a comment pointing at `src/engine/presence.ts` — same single-source mirror pattern as the Swift copy), empty state "No task queued" when no snapshot. Set the Start view's `setOnClickPendingIntent` to a `PendingIntent.getActivity` with `Intent(ACTION_VIEW, Uri.parse(startDeepLink ?: "whenbee://timer"))`.
- Layout `widget_next_task.xml`: dark surface (`#1F2130`), rounded bg drawable, wordmark row, label (maxLines 2), finish caption, Start chip, and a 2-view fill-bar (track + fill) whose fill weight is set from arcFraction. Colors mirror `src/theme/tokens.ts` (accent `#EEAE4D`, ink `#F4F1EA`, inkSoft `#ADA9B5`, surfaceSunken `#15161F`).
- Manifest: `<receiver android:name=".NextTaskWidgetProvider" android:exported="true"> <intent-filter><action android:name="android.appwidget.action.APPWIDGET_UPDATE"/></intent-filter> <meta-data android:name="android.appwidget.provider" android:resource="@xml/next_task_widget_info"/> </receiver>`. The provider xml sets `minWidth/minHeight 110dp`, `targetCellWidth/Height 2`, `resizeMode`, `previewImage`, `initialLayout=@layout/widget_next_task`, `updatePeriodMillis 1800000`, `widgetCategory home_screen`.

**Verify:** compile; prebuild merges the module manifest so the app manifest gains the `.NextTaskWidgetProvider` receiver.

## Task G3: Rewire JS to the native module; remove react-native-android-widget

**Files:** `src/services/presence/createAndroidPresence.ts` + its test (modify), `src/services/presence/androidPresence.android.ts` (modify), delete `src/widgets/NextTaskWidget.tsx`, `src/widgets/widgetTaskHandler.ts`, `src/widgets/widgetSnapshotStore.ts` (+ its test) and `src/widgets/widgetTheme.ts`, `index.js` (remove the widget registration), `app.json` (remove the `react-native-android-widget` plugin entry), `package.json` (remove the dep via `npm uninstall react-native-android-widget`).

- `AndroidPresenceDeps` becomes `{ notif }` where the native `notif` module now also exposes `writeWidgetSnapshot(json: string)` and `clearWidgetSnapshot()`. Factory: `writeSnapshot(s)` → `notif?.writeWidgetSnapshot(JSON.stringify(s))`; `clearSnapshot()` → `notif?.clearWidgetSnapshot()`; start/update/end unchanged. Keep the `swallow` guards and the `notif===null` no-op tests; drop the `saveSnapshot`/`renderWidget` deps and their tests, add `writeWidgetSnapshot`/`clearWidgetSnapshot` forwarding tests.
- `androidPresence.android.ts`: drop the `react-native-android-widget` import, the `renderCurrentWidget`, and `widgetSnapshotStore`/`NextTaskWidget` imports; build deps solely from `requireOptionalNativeModule('WhenbeePresence')`.
- `index.js`: remove the whole `if (Platform.OS === 'android') { registerWidgetTaskHandler … }` block (revert to just `import 'expo-router/entry'`; keep `package.json` `main` as `index.js` or revert to `expo-router/entry` — either works, simplest is to revert `main` to `expo-router/entry` and delete `index.js`).
- `app.json`: remove the `["react-native-android-widget", {…}]` plugin entry. Keep the Android permissions and build props.

**Verify:** `npm run lint && npm run typecheck && npm test` all green; `grep -r react-native-android-widget src app.json package.json` returns nothing.

## Task G4: Device build + verify on the Pixel

- Clean prebuild + `assembleRelease` from the worktree (clear `~/.tmp/metro-cache` first — the known worktree gotcha), install, launch.
- Widget: on Today with a task queued (fires `publishWidgetSnapshot` → native `writeWidgetSnapshot` → widget repaints), add the widget from the launcher → it shows the task + honest finish + Start (+ Pro bar). Tapping Start opens the timer.
- Overrun: start a timer, lock the phone, let it pass the honest finish → the notification flips to count-up (over-by) via the native alarm, NOT a negative countdown.
