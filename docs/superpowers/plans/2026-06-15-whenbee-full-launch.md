# Whenbee Full-Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take the tested Whenbee MVP to the complete launch version by closing the do-not-cut gaps (native presence, full companion) and adding the chosen fast-follows (earned-readiness paywall, "what steals your time" Pro correlations, discoveries gallery, share-with-coach).

**Architecture:** Six independent subsystems, each shippable on its own. The pure engine (`src/engine`, no React/RN/clock) gains additive modules; the db (`src/db`, two adapters behind one `Database` port) gains additive migrations + read methods; stores (`src/stores`, Zustand) are the only db-touching layer; features/UI route through stores/hooks. Native presence is a new local Expo module compiled into the main app. No product invariant is violated: no guilt (amber-never-red), honey/companion monotonic, core loop stays on-device, pricing read from RevenueCat.

**Tech Stack:** Expo SDK 54 · React Native 0.81.5 · React 19.1 · TypeScript (strict, `noUncheckedIndexedAccess`) · expo-router 6 · Reanimated 4 · expo-sqlite (raw SQL + manual migrations) · Zustand · react-native-purchases (RevenueCat) · expo-sharing · react-native-view-shot · `@bacons/apple-targets` (widget) + a new local Expo module (ActivityKit/App Group) · PostHog · Sentry.

---

## Scope (locked with the founder, 2026-06-15)

**IN this plan:**
1. **Part 1 — Native Presence (`WhenbeePresence`)** — make the Home-screen widget + Live Activity actually work on device (do-not-cut; currently inert stub).
2. **Part 2 — Whenbee companion** — 6-stage capability-bearing avatar + Keeper prestige + 3-layer fuel (do-not-cut; currently tier-only).
3. **Part 3 — Earned-readiness paywall layer** (D12–D17; messaging only, no entitlement/price change).
4. **Part 4 — "What steals your time"** (S12 Pro reason correlations + B15 reason-aware note; capture already ships).
5. **Part 5 — Discoveries gallery** (bank aha cards; the card already ships).
6. **Part 6 — Share with coach/partner** (on-device image share; currently an unfulfilled paywall promise).

**OUT (explicitly deferred):** feedback board (Supabase), partner layer ("Whenbee for Two"), LLM coach, Android/Watch/cloud sync, brain breathers, PDF export, and **all launch operations** (RevenueCat/App-Store-Connect product config, screenshots, TestFlight, submission). This plan is **code-complete only** — it stops at a feature-complete, tested build. Store/product configuration and submission are handled separately by the founder.

> **One configuration dependency, not built here:** Part 3's $49 founder reserve and the existing paywall read prices from a RevenueCat offering. The founder must configure the founder package in RevenueCat; the code degrades gracefully (the card hides) when the package is absent.

---

## Execution order & shared-file coordination (READ BEFORE STARTING)

Build the parts **in numeric order (1 → 6).** Several parts edit the same shared files additively. Resolve these deterministically:

### Migration numbering (CRITICAL — migrations are positional, run by `PRAGMA user_version`)
The repo currently has migrations `0001` and `0002` (`MIGRATIONS[0]`, `MIGRATIONS[1]`). Two parts add a migration. Assign canonically by build order:

| Migration | Index | Owner | Contents |
|---|---|---|---|
| `0003` | `MIGRATIONS[2]` | **Part 2** | companion fuel columns (`lifetime_data_points`, `max_tier`, `keeper`, `seed`, `drift_health`) |
| `0004` | `MIGRATIONS[3]` | **Part 5** | `discoveries` table + indexes + `companion.discovery_count` column |

**Part 5's section was authored as "0003 / `MIGRATIONS[2]`". When you execute Part 5 after Part 2, rename it to `0004` / `MIGRATIONS[3]`** in both `src/db/migrations.ts` and `src/db/__tests__/migrations.test.ts`. Never edit or reorder `0001`/`0002`/`0003` — append only.

### `Companion` / `CompanionRow` interfaces (Parts 2 + 5 both extend)
Both extensions are additive. The **final** shape after both parts is the union — do not let Part 5 replace Part 2's fields. Final `Companion` (`src/domain/types.ts`):

```ts
export interface Companion {
  reclaimedMinutesLifetime: number; // existing
  lifetimeDataPoints: number;       // Part 2
  maxTier: number;                  // Part 2
  keeper: boolean;                  // Part 2
  seed: number;                     // Part 2
  driftHealth?: 'settled' | 'curious'; // Part 2
  discoveryCount: number;           // Part 5
}
```

Final `CompanionRow` (`src/db/types.ts`) mirrors it (with `driftHealth: 'settled' | 'curious'` non-optional). The memory adapter's `companion` literal and the sqlite `getCompanion()` SELECT must list **all** columns from both parts. When executing Part 5, merge `discovery_count` into Part 2's already-extended `getCompanion`/`CompanionDbRow`/companion literal rather than overwriting them.

### Other shared files (all additive — append, never replace)
- `src/domain/types.ts` — Parts 2,3,4,5 add types. Keep all.
- `src/engine/index.ts` — Parts 2,3,4,5 add barrel exports. Keep all.
- `src/engine/constants.ts` — Parts 3,4 add constant blocks. Keep all.
- `src/stores/calibrationStore.ts` — Parts 2,3,4,5 add to `applyLog` side-effects, add loaders, and extend `ReclaimSummary`. Apply each in its own region; re-run the full `npx jest src/stores` after each part to catch shape drift.
- `src/features/category-detail/HonestCard.tsx` & `src/features/shared/HonestSuggestionCard.tsx` — Part 3 adds `confidence`/`range`; Part 4 adds `reasonNote`. Both are additive props.
- `src/features/whenbee/useWhenbeeHub.ts` & `WhenbeeHub.tsx` — Part 2 adds companion read fields; Part 5 adds discoveries. Additive.

### Gate after every part (CI parity)
```bash
npm run lint && npm run typecheck && npm test
```
All three green before moving to the next part. `npm run lint` is `eslint . --max-warnings=0` (0 warnings or it fails). Commits use Conventional Commits via the `/init-cmt` skill — **never** add AI/co-author attribution (project HARD RULE).

---

<!-- ============================================================ -->
<!-- PART 1 -->
<!-- ============================================================ -->

## Part 1 — Native Presence (`WhenbeePresence`) module

### Context (read these first)

- `src/services/liveActivity.ts` is the **complete, frozen** JS bridge. It probes `requireOptionalNativeModule<NativePresenceModule>('WhenbeePresence')` (`liveActivity.ts:29`, `:96`) and falls back to a no-op `stub` when the module is absent (`liveActivity.ts:71-78`, `:85-98`). The contract this part must satisfy, verbatim:
  - `isStub: boolean` — must be `false` on device (`liveActivity.ts:63`).
  - `writeSnapshot(WidgetSnapshot)` / `clearSnapshot()` (`liveActivity.ts:64-65`).
  - `startLiveActivity(LiveActivityAttributes)` / `updateLiveActivity({ isOverrun })` / `endLiveActivity()` (`liveActivity.ts:66-68`).
  - `WidgetSnapshot` fields: `nextTaskLabel, category, honestFinishClock, startDeepLink, updatedAtEpoch:number` (`liveActivity.ts:36-47`).
  - `LiveActivityAttributes` fields: `taskLabel, finishEpoch:number` (`liveActivity.ts:50-55`).
  - `APP_GROUP_ID = 'group.com.whenbee.app'` (`liveActivity.ts:23`), `WIDGET_SNAPSHOT_KEY = 'whenbee.widgetSnapshot'` (`liveActivity.ts:26`).
- The Swift side already decodes exactly this: `SharedStore.swift:13` (`kAppGroupId`), `:16` (`kSnapshotKey`), the `WidgetSnapshot: Codable` struct (`SharedStore.swift:20-42`, note `updatedAtEpoch: Double`), and `FinishTimeAttributes: ActivityAttributes` with `ContentState { isOverrun: Bool }` + `taskLabel` + `finishEpoch: Double` (`FinishTimeActivity.swift:20-36`).
- The widget extension (a **separate binary**) is configured by `targets/widget/expo-target.config.js` (`type: 'widget'`, frameworks `SwiftUI/WidgetKit/ActivityKit`, deploymentTarget `16.2`, App Group mirrored from `app.json`).
- `@bacons/apple-targets` in this repo supports **only** `type: 'widget'`. It **cannot** host the JS bridge module — that runs in the **main app process**, so `WhenbeePresence` must be a **local Expo module** under `modules/`, autolinked by `expo-module.config.json`, not a bacons target.
- Existing tests: `src/services/__tests__/liveActivity.test.ts` asserts stub behavior via the **pure** `resolveNativePresence(expoGo, loadNative)` seam — it never touches native. **Do not change `liveActivity.ts` or this test.** This part only adds the native side that `loadNativePresence()` discovers at runtime.

**Hard constraints (never violate):**
- The core guess → timer → learn loop must keep working if the module is missing — the stub fallback already guarantees this; do not add any unguarded call.
- App Group id `group.com.whenbee.app` must match **exactly** across `app.json`, the bacons target, and the new module's entitlement — a mismatch silently breaks the shared store.
- `npm test`, `npm run lint`, `npm run typecheck` stay green at every commit. `ios/`/`android/` are CNG/gitignored — regenerate with `npx expo prebuild --clean`, never hand-edit.

### Files

| Action | Path | Purpose |
|---|---|---|
| create | `modules/whenbee-presence/expo-module.config.json` | Autolinking manifest naming the iOS module class. |
| create | `modules/whenbee-presence/ios/WhenbeePresenceModule.swift` | The Expo Module — App-Group write/clear + ActivityKit start/update/end. |
| create | `modules/whenbee-presence/ios/FinishTimeAttributes.swift` | Copy of the `ActivityAttributes` struct, compiled into the **main app** target. |
| create | `modules/whenbee-presence/index.ts` | Empty marker so expo-modules treats the dir as a module. |
| modify | `app.json` | Add `"ios.appleTeamId"` (signing) — App Group + `NSSupportsLiveActivities` already present. |
| verify | `docs/NATIVE-PRESENCE.md` | Flip the "NOT done" section to "linked"; record device-verification results. |

> A local Expo module placed in `modules/` is discovered automatically by Expo autolinking during `expo prebuild`. The `expo-module.config.json` `apple.modules` array registers the Swift class.

### Task 1.1 — Scaffold the local module + autolinking manifest

**Files:** `modules/whenbee-presence/expo-module.config.json`, `modules/whenbee-presence/index.ts`

- [ ] **Step 1: Create the autolinking manifest.** Write `modules/whenbee-presence/expo-module.config.json`:
  ```json
  {
    "platforms": ["apple"],
    "apple": {
      "modules": ["WhenbeePresenceModule"]
    }
  }
  ```
  (The class name here must equal the Swift class name in Task 1.3.)

- [ ] **Step 2: Add the JS marker file** (empty of API on purpose — the bridge is the single entry point):
  ```ts
  // modules/whenbee-presence/index.ts
  // The native module "WhenbeePresence" is consumed via
  // requireOptionalNativeModule in src/services/liveActivity.ts (the guarded
  // bridge). No JS API is exported here on purpose.
  export {};
  ```

- [ ] **Step 3: Confirm tests/lint/types still pass (no native build yet).**
  ```bash
  npm test -- liveActivity && npm run typecheck && npx eslint modules/whenbee-presence/index.ts
  ```
  Expected: jest prints `Tests: 3 passed` for `resolveNativePresence`; `tsc` exits 0; eslint prints nothing (exit 0).

- [ ] **Step 4: Commit.**
  ```bash
  git add modules/whenbee-presence/expo-module.config.json modules/whenbee-presence/index.ts
  git commit -m "feat(presence): scaffold WhenbeePresence local expo module manifest"
  ```

### Task 1.2 — Add the ActivityKit attributes struct to the main-app target

**Files:** `modules/whenbee-presence/ios/FinishTimeAttributes.swift`

ActivityKit requests are made from the **main app**, but `FinishTimeAttributes` currently only exists in the **widget** target (`targets/widget/FinishTimeActivity.swift:20-36`). The type must be identical and present in both targets or `Activity<FinishTimeAttributes>.request` won't type-check in the module.

- [ ] **Step 1: Create `modules/whenbee-presence/ios/FinishTimeAttributes.swift`:**
  ```swift
  // FinishTimeAttributes.swift
  // Main-app copy of the Live Activity attributes. MUST stay identical to the
  // copy in targets/widget/FinishTimeActivity.swift — ActivityKit matches an
  // Activity by its ActivityAttributes type, and the request is issued from the
  // app target while the UI is rendered in the widget target.
  import ActivityKit
  import Foundation

  struct FinishTimeAttributes: ActivityAttributes {
      public struct ContentState: Codable, Hashable {
          var isOverrun: Bool
      }
      var taskLabel: String
      var finishEpoch: Double
      var finishDate: Date { Date(timeIntervalSince1970: finishEpoch) }
  }
  ```

- [ ] **Step 2: Add a guard comment in the widget copy.** Edit `targets/widget/FinishTimeActivity.swift` (line ~18-19 region):
  ```swift
  /// Shared attributes for the running-timer Live Activity.
  /// MUST stay in sync with the `attributes` JS writes in liveActivity.ts AND
  /// with modules/whenbee-presence/ios/FinishTimeAttributes.swift (main-app copy).
  struct FinishTimeAttributes: ActivityAttributes {
  ```

- [ ] **Step 3: Commit.**
  ```bash
  git add modules/whenbee-presence/ios/FinishTimeAttributes.swift targets/widget/FinishTimeActivity.swift
  git commit -m "feat(presence): add main-app FinishTimeAttributes for ActivityKit"
  ```

### Task 1.3 — Write the Swift Expo Module (App-Group write/clear + ActivityKit)

**Files:** `modules/whenbee-presence/ios/WhenbeePresenceModule.swift`

Uses the SDK 54 Expo Modules API (`Module`, `Function`, `Property`, `Record`, `@Field`) confirmed from the Expo docs (`docs/pages/modules/module-api.mdx`, `existing-library.mdx`).

- [ ] **Step 1: Create `modules/whenbee-presence/ios/WhenbeePresenceModule.swift`:**
  ```swift
  // WhenbeePresenceModule.swift
  // The native counterpart of src/services/liveActivity.ts. Runs in the MAIN APP
  // process. Two jobs: (1) write/clear the next-task snapshot in the App Group
  // UserDefaults the widget reads, then poke WidgetCenter; (2) start/update/end the
  // finish-time Live Activity (ActivityKit). Module name MUST equal
  // NATIVE_MODULE_NAME in liveActivity.ts; class name MUST equal expo-module.config.json.
  import ExpoModulesCore
  import WidgetKit
  #if canImport(ActivityKit)
  import ActivityKit
  #endif

  private let kAppGroupId = "group.com.whenbee.app"
  private let kSnapshotKey = "whenbee.widgetSnapshot"

  struct WidgetSnapshotRecord: Record {
      @Field var nextTaskLabel: String = ""
      @Field var category: String = ""
      @Field var honestFinishClock: String = ""
      @Field var startDeepLink: String = ""
      @Field var updatedAtEpoch: Double = 0
  }
  struct LiveActivityAttributesRecord: Record {
      @Field var taskLabel: String = ""
      @Field var finishEpoch: Double = 0
  }
  struct LiveActivityUpdateRecord: Record {
      @Field var isOverrun: Bool = false
  }

  public class WhenbeePresenceModule: Module {
      public func definition() -> ModuleDefinition {
          Name("WhenbeePresence")
          Property("isStub") { false }

          Function("writeSnapshot") { (snapshot: WidgetSnapshotRecord) in
              guard let defaults = UserDefaults(suiteName: kAppGroupId) else { return }
              let payload: [String: Any] = [
                  "nextTaskLabel": snapshot.nextTaskLabel,
                  "category": snapshot.category,
                  "honestFinishClock": snapshot.honestFinishClock,
                  "startDeepLink": snapshot.startDeepLink,
                  "updatedAtEpoch": snapshot.updatedAtEpoch,
              ]
              guard
                  let data = try? JSONSerialization.data(withJSONObject: payload),
                  let json = String(data: data, encoding: .utf8)
              else { return }
              defaults.set(json, forKey: kSnapshotKey)
              WidgetCenter.shared.reloadAllTimelines()
          }
          Function("clearSnapshot") {
              guard let defaults = UserDefaults(suiteName: kAppGroupId) else { return }
              defaults.removeObject(forKey: kSnapshotKey)
              WidgetCenter.shared.reloadAllTimelines()
          }
          Function("startLiveActivity") { (attributes: LiveActivityAttributesRecord) in
              if #available(iOS 16.2, *) { self.startActivity(attributes) }
          }
          Function("updateLiveActivity") { (state: LiveActivityUpdateRecord) in
              if #available(iOS 16.2, *) { self.updateActivity(isOverrun: state.isOverrun) }
          }
          Function("endLiveActivity") {
              if #available(iOS 16.2, *) { self.endActivity() }
          }
      }

      #if canImport(ActivityKit)
      @available(iOS 16.2, *)
      private func startActivity(_ attributes: LiveActivityAttributesRecord) {
          for activity in Activity<FinishTimeAttributes>.activities {
              Task { await activity.end(nil, dismissalPolicy: .immediate) }
          }
          guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
          let attrs = FinishTimeAttributes(taskLabel: attributes.taskLabel, finishEpoch: attributes.finishEpoch)
          let initialState = FinishTimeAttributes.ContentState(isOverrun: false)
          let content = ActivityContent(state: initialState, staleDate: Date(timeIntervalSince1970: attributes.finishEpoch))
          _ = try? Activity.request(attributes: attrs, content: content, pushType: nil)
      }
      @available(iOS 16.2, *)
      private func updateActivity(isOverrun: Bool) {
          let newState = FinishTimeAttributes.ContentState(isOverrun: isOverrun)
          let content = ActivityContent(state: newState, staleDate: nil)
          for activity in Activity<FinishTimeAttributes>.activities { Task { await activity.update(content) } }
      }
      @available(iOS 16.2, *)
      private func endActivity() {
          let finalState = FinishTimeAttributes.ContentState(isOverrun: false)
          let content = ActivityContent(state: finalState, staleDate: nil)
          for activity in Activity<FinishTimeAttributes>.activities { Task { await activity.end(content, dismissalPolicy: .immediate) } }
      }
      #endif
  }
  ```
  Correctness notes: `Property("isStub") { false }` satisfies `liveActivity.ts:138`/`:158` (analytics only fire when `!isStub`). `Record`+`@Field` is the SDK 54 way to receive a typed JS object. `updatedAtEpoch`/`finishEpoch` are `Double` to match the Swift decoders. `#available(iOS 16.2, *)` matches the widget's `deploymentTarget: '16.2'`. All ActivityKit failures swallowed (`try?`).

- [ ] **Step 2: Static cross-check (no Swift build in CI).**
  ```bash
  grep -n 'Name("WhenbeePresence")' modules/whenbee-presence/ios/WhenbeePresenceModule.swift
  grep -n 'WhenbeePresenceModule' modules/whenbee-presence/expo-module.config.json
  grep -n "NATIVE_MODULE_NAME = 'WhenbeePresence'" src/services/liveActivity.ts
  npm test -- liveActivity && npm run typecheck
  ```
  Expected: all three greps return a matching line; jest `3 passed`; `tsc` exit 0.

- [ ] **Step 3: Commit.**
  ```bash
  git add modules/whenbee-presence/ios/WhenbeePresenceModule.swift
  git commit -m "feat(presence): implement WhenbeePresence native module (app group + ActivityKit)"
  ```

### Task 1.4 — Wire signing + prebuild so the module and widget link

**Files:** `app.json`

- [ ] **Step 1: Add `appleTeamId` to `app.json` `ios`** (replace `XXXXXXXXXX` with the real Team id):
  ```jsonc
  "ios": {
    "bundleIdentifier": "com.whenbee.app",
    "appleTeamId": "XXXXXXXXXX",
    "supportsTablet": true,
    "infoPlist": { "NSSupportsLiveActivities": true },
    "entitlements": {
      "com.apple.security.application-groups": ["group.com.whenbee.app"]
    }
  }
  ```

- [ ] **Step 2: Confirm the group id is identical across config.**
  ```bash
  grep -n 'group.com.whenbee.app' app.json targets/widget/expo-target.config.js
  ```
  Expected: the group id appears in `app.json` (entitlements) and `targets/widget/expo-target.config.js` — identical string.

- [ ] **Step 3: Regenerate native projects (never hand-edit `ios/`).**
  ```bash
  npx expo prebuild --clean
  grep -rn "WhenbeePresence" ios/ | head
  ```
  Expected: prebuild finishes; the grep returns at least one hit (generated `ExpoModulesProvider.swift` / Pods) — proves autolinking found the module.

- [ ] **Step 4: Doctor + full gate.**
  ```bash
  npx expo-doctor && npm run lint && npm run typecheck && npm test
  ```
  Expected: `expo-doctor` `18/18`; lint `0 warnings`; `tsc` exit 0; jest green (stub assertions still pass).

- [ ] **Step 5: Commit** (do not commit `ios/` — gitignored/CNG).
  ```bash
  git add app.json
  git commit -m "chore(ios): set appleTeamId so app group + live activity sign"
  ```

### Task 1.5 — Build to device and verify the surfaces are live

**Files:** none (device verification) — record results in `docs/NATIVE-PRESENCE.md` at the end. Live Activities + Dynamic Island do **not** run in the simulator; needs a physical iPhone (Dynamic Island: iPhone 14 Pro+).

- [ ] **Step 1: Build and install on device.** `npm run ios -- --device` → builds, launches, Metro connects. (If signing fails, re-check `appleTeamId` and that the App Group exists in the Apple Developer portal for both app + widget bundle ids.)
- [ ] **Step 2: Confirm the module resolved (not the stub).** In the JS debugger: `require('expo-modules-core').requireOptionalNativeModule('WhenbeePresence')?.isStub` → `false`. (If stub: recheck `expo-module.config.json` `apple.modules` == Swift class name, re-run `npx expo prebuild --clean`.)
- [ ] **Step 3: Verify the Home-screen widget shows real data.** Trigger a focus-task change (the `useToday.ts` call site already calls `publishWidgetSnapshot`). Add the **Whenbee → Next task** widget. Confirm live label + "Honest finish H:MM" (not the placeholder). Tapping Start deep-links into `whenbee://timer?...`.
- [ ] **Step 4: Verify the Live Activity / Dynamic Island ring.** Start a task timer (`useTimer.ts` calls `startFinishTimeActivity`). Lock the device. Confirm the countdown appears on Lock Screen + Dynamic Island (compact + expanded), counting toward the honest finish.
- [ ] **Step 5: Verify the overrun flip stays no-guilt.** Let the timer pass the honest finish. Confirm `updateFinishTimeActivity({ isOverrun: true })` flips copy to "Running over — that's data" / "over" — **nothing turns red, no shame copy.** Stop → activity ends.
- [ ] **Step 6: Confirm analytics fire only now.** `widget_added` (surface `live_activity`) on start, `widget_engaged` on stop, in the analytics sink.
- [ ] **Step 7: Re-run the gate + update the doc.** `npm run lint && npm run typecheck && npm test` (all green). Edit `docs/NATIVE-PRESENCE.md`: flip "NOT done" → module ships at `modules/whenbee-presence/`; check off the device-verification results.
- [ ] **Step 8: Commit.**
  ```bash
  git add docs/NATIVE-PRESENCE.md
  git commit -m "docs(presence): mark WhenbeePresence native module linked and device-verified"
  ```

---

<!-- ============================================================ -->
<!-- PART 2 -->
<!-- ============================================================ -->

## Part 2 — Whenbee companion (6-stage + 3-layer fuel + Keeper)

Extends the tier-driven avatar into the locked spec: a **6-stage capability-bearing companion** (stages 1 Raw → 5 Honest, 1:1 with honey tiers, + stage 6 **Keeper** prestige) driven by the **3-layer fuel model**: Layer 1 Effort floor (lifetime nectar, never decrements), Layer 2 Mastery body (monotonic max tier, caps at Honest), Layer 3 Drift-health (oscillates positive-only, never sad/guilt). Each tier unlocks a real CAPABILITY label. Procedural-unique seed + optional one-word rename (default "Whenbee"), no setup wall. **Renames + additive state only** — no engine math touched (`05b-HONEY-SYSTEM.md` "does NOT touch"). Invariants: only climbs, no decay, no streaks, amber-never-red, no guilt; Layer 2/stage monotonic via `Math.max`; Layer 3 positive-only; Keeper set-once.

### Files map

**Create:** `src/engine/companion.ts`, `src/engine/__tests__/companion.test.ts`, `src/db/repositories/__tests__/companionRepo.test.ts`, `src/features/whenbee/__tests__/companionStage.test.tsx`
**Modify:** `src/domain/types.ts`, `src/db/types.ts`, `src/db/migrations.ts`, `src/db/__tests__/migrations.test.ts`, `src/db/Database.ts`, `src/db/memoryDatabase.ts`, `src/db/sqliteDatabase.ts`, `src/db/repositories/companionRepo.ts`, `src/stores/calibrationStore.ts`, `src/features/whenbee/useWhenbeeHub.ts`, `src/features/whenbee/WhenbeeAvatar.tsx`, `src/features/whenbee/TierTrailHub.tsx`, `src/components/BeeMascot.tsx`, `src/theme/tokens.ts`

### Step group A — Engine: pure `companion.ts` (TDD)

**Files:** `src/engine/companion.ts`, `src/engine/__tests__/companion.test.ts`, `src/engine/index.ts`

- [ ] **Step A1 — Write the failing engine test.** Create `src/engine/__tests__/companion.test.ts`:

```ts
import {
  companionStageFor,
  capabilityFor,
  keeperReached,
  driftHealthFromRecent,
  COMPANION_KEEPER_QUOTA,
  type CompanionStage,
} from '../companion';
import { TIERS } from '../constants';

describe('companionStageFor — stages 1–5 map 1:1 to maxTier, +6 for Keeper', () => {
  it('maps maxTier 0..4 to stages 1..5 (Raw→Honest)', () => {
    expect(companionStageFor({ maxTier: 0, keeper: false })).toBe(1);
    expect(companionStageFor({ maxTier: 1, keeper: false })).toBe(2);
    expect(companionStageFor({ maxTier: 2, keeper: false })).toBe(3);
    expect(companionStageFor({ maxTier: 3, keeper: false })).toBe(4);
    expect(companionStageFor({ maxTier: 4, keeper: false })).toBe(5);
  });
  it('returns stage 6 (Keeper) once keeper is set', () => {
    expect(companionStageFor({ maxTier: 4, keeper: true })).toBe(6);
    expect(companionStageFor({ maxTier: 2, keeper: true })).toBe(6);
  });
  it('clamps an out-of-range maxTier into 1..5', () => {
    expect(companionStageFor({ maxTier: -3, keeper: false })).toBe(1);
    expect(companionStageFor({ maxTier: 99, keeper: false })).toBe(5);
  });
});

describe('capabilityFor — each stage unlocks a real capability', () => {
  it('returns a stable id + the tier-aligned label for stages 1..5', () => {
    expect(capabilityFor(1).id).toBe('running-finish-time');
    expect(capabilityFor(2).id).toBe('today-done-time');
    expect(capabilityFor(3).id).toBe('start-by-anchor');
    expect(capabilityFor(4).id).toBe('honest-day-forecast');
    expect(capabilityFor(5).id).toBe('drift-recalibration');
  });
  it('Keeper (stage 6) gates nothing new', () => {
    expect(capabilityFor(6).id).toBe('keeper-standing');
    expect(capabilityFor(6).gatesNewFeature).toBe(false);
  });
  it('stage 1..5 labels align with the honey tier name', () => {
    for (let s = 1 as CompanionStage; s <= 5; s = (s + 1) as CompanionStage) {
      expect(capabilityFor(s).label.length).toBeGreaterThan(0);
      expect(capabilityFor(s).tier).toBe(TIERS[s - 1]);
    }
  });
});

describe('keeperReached — set-once prestige when the comb is (near-)fully capped', () => {
  it('false until capped-cell count reaches the quota', () => {
    expect(keeperReached({ cappedCellCount: 0, trackedCount: 3 })).toBe(false);
    expect(keeperReached({ cappedCellCount: 2, trackedCount: 3 })).toBe(false);
  });
  it('true once capped count meets quota (all tracked cells capped)', () => {
    expect(keeperReached({ cappedCellCount: 3, trackedCount: 3 })).toBe(true);
  });
  it('uses COMPANION_KEEPER_QUOTA as the floor for sparse combs', () => {
    expect(keeperReached({ cappedCellCount: 1, trackedCount: 1 })).toBe(false);
    expect(COMPANION_KEEPER_QUOTA).toBeGreaterThanOrEqual(3);
  });
});

describe('driftHealthFromRecent — Layer 3, POSITIVE-ONLY, oscillates, never guilt', () => {
  it('settled when recent ratios sit near 1', () => {
    expect(driftHealthFromRecent([1, 1.05, 0.97, 1.02])).toBe('settled');
  });
  it('curious — not sad — when recent ratios drift away', () => {
    expect(driftHealthFromRecent([1, 2.5, 3, 2.8])).toBe('curious');
  });
  it('empty window is settled; only ever returns settled|curious', () => {
    expect(driftHealthFromRecent([])).toBe('settled');
    expect(['settled', 'curious']).toContain(driftHealthFromRecent([5, 6, 0.2]));
  });
});
```

Run — expect **FAIL** (`Cannot find module '../companion'`):
```bash
npx jest src/engine/__tests__/companion.test.ts
```

- [ ] **Step A2 — Implement `src/engine/companion.ts` (pure TS, no React/RN/clock).**

```ts
import { TIERS } from './constants';
import type { Tier } from '../domain/types';

export type CompanionStage = 1 | 2 | 3 | 4 | 5 | 6;
export type DriftHealth = 'settled' | 'curious';

export interface CompanionCapability {
  id:
    | 'running-finish-time'
    | 'today-done-time'
    | 'start-by-anchor'
    | 'honest-day-forecast'
    | 'drift-recalibration'
    | 'keeper-standing';
  tier: Tier | null;
  label: string;
  gatesNewFeature: boolean;
}

export const COMPANION_KEEPER_QUOTA = 3;

export function companionStageFor(input: { maxTier: number; keeper: boolean }): CompanionStage {
  if (input.keeper) return 6;
  const clamped = Math.max(0, Math.min(4, Math.trunc(input.maxTier)));
  return (clamped + 1) as CompanionStage;
}

const CAPABILITIES: Record<CompanionStage, CompanionCapability> = {
  1: { id: 'running-finish-time', tier: 'Raw', label: 'Live finish-time on your timer', gatesNewFeature: true },
  2: { id: 'today-done-time', tier: 'Setting', label: 'Done-time on Today and Add-Task', gatesNewFeature: true },
  3: { id: 'start-by-anchor', tier: 'Ripening', label: 'Reverse start-by anchor', gatesNewFeature: true },
  4: { id: 'honest-day-forecast', tier: 'Thickening', label: 'Honest-Day forecast on the widget', gatesNewFeature: true },
  5: { id: 'drift-recalibration', tier: 'Honest', label: 'Drift re-check when life shifts', gatesNewFeature: true },
  6: { id: 'keeper-standing', tier: null, label: 'Keeper — your comb is sealed', gatesNewFeature: false },
};

export function capabilityFor(stage: CompanionStage): CompanionCapability {
  return CAPABILITIES[stage] ?? CAPABILITIES[1];
}

export function keeperReached(input: { cappedCellCount: number; trackedCount: number }): boolean {
  if (input.trackedCount < COMPANION_KEEPER_QUOTA) return false;
  return input.cappedCellCount >= input.trackedCount;
}

const DRIFT_TRIGGER = 0.4;
export function driftHealthFromRecent(recentClampedRatios: number[]): DriftHealth {
  if (recentClampedRatios.length === 0) return 'settled';
  const meanAbsLn =
    recentClampedRatios.reduce((sum, r) => sum + Math.abs(Math.log(r)), 0) / recentClampedRatios.length;
  return meanAbsLn > DRIFT_TRIGGER ? 'curious' : 'settled';
}
```

- [ ] **Step A3 — Export from the barrel.** Append to `src/engine/index.ts`:
```ts
export {
  companionStageFor, capabilityFor, keeperReached, driftHealthFromRecent, COMPANION_KEEPER_QUOTA,
} from './companion';
export type { CompanionStage, CompanionCapability, DriftHealth } from './companion';
```
Run — expect **PASS**; then `npx eslint src/engine/companion.ts src/engine/index.ts src/engine/__tests__/companion.test.ts`.

- [ ] **Step A4 — Commit.**
```bash
git add src/engine/companion.ts src/engine/index.ts src/engine/__tests__/companion.test.ts
git commit -m "feat(engine): pure companion stage, capability, keeper, drift-health"
```

### Step group B — Domain + DB: extend `Companion` and add migration 0003 (TDD)

**Files:** `src/domain/types.ts`, `src/db/types.ts`, `src/db/migrations.ts`, `src/db/Database.ts`, `src/db/memoryDatabase.ts`, `src/db/sqliteDatabase.ts`, `src/db/__tests__/migrations.test.ts`

- [ ] **Step B1 — Write failing migration + adapter tests.** Append to `src/db/__tests__/migrations.test.ts`:

```ts
describe('MIGRATIONS 0003 — companion fuel fields (additive, monotonic)', () => {
  const migration0003 = MIGRATIONS[2]; // index 2 == 0003
  it('migration 0003 exists and is a string', () => { expect(typeof migration0003).toBe('string'); });
  it('adds the fuel columns + seed to companion', () => {
    expect(migration0003).toContain('ALTER TABLE companion ADD COLUMN lifetime_data_points');
    expect(migration0003).toContain('ALTER TABLE companion ADD COLUMN max_tier');
    expect(migration0003).toContain('ALTER TABLE companion ADD COLUMN keeper');
    expect(migration0003).toContain('ALTER TABLE companion ADD COLUMN seed');
    expect(migration0003).toContain('ALTER TABLE companion ADD COLUMN drift_health');
  });
  it('defaults keep existing rows valid', () => { expect(migration0003).toContain('DEFAULT 0'); });
});

describe('memoryDatabase — companion fuel layers', () => {
  it('getCompanion exposes the new fields with safe defaults', async () => {
    const db = createMemoryDatabase();
    const row = await db.getCompanion();
    expect(row.lifetimeDataPoints).toBe(0);
    expect(row.maxTier).toBe(0);
    expect(row.keeper).toBe(false);
    expect(typeof row.seed).toBe('number');
    expect(row.driftHealth).toBe('settled');
  });
  it('bumpLifetimeNectar increments Layer 1 monotonically', async () => {
    const db = createMemoryDatabase();
    await db.bumpLifetimeNectar(); await db.bumpLifetimeNectar();
    expect((await db.getCompanion()).lifetimeDataPoints).toBe(2);
  });
  it('raiseMaxTier is monotonic — max(prev, next)', async () => {
    const db = createMemoryDatabase();
    await db.raiseMaxTier(3); expect((await db.getCompanion()).maxTier).toBe(3);
    await db.raiseMaxTier(1); expect((await db.getCompanion()).maxTier).toBe(3);
  });
  it('setKeeper latches true and never clears', async () => {
    const db = createMemoryDatabase();
    await db.setKeeper(); expect((await db.getCompanion()).keeper).toBe(true);
    await db.setKeeper(); expect((await db.getCompanion()).keeper).toBe(true);
  });
  it('setDriftHealth stores the positive-only register', async () => {
    const db = createMemoryDatabase();
    await db.setDriftHealth('curious'); expect((await db.getCompanion()).driftHealth).toBe('curious');
  });
  it('setSeed only writes when no seed is set', async () => {
    const db = createMemoryDatabase();
    const original = (await db.getCompanion()).seed;
    await db.setSeed(original + 999);
    expect((await db.getCompanion()).seed).toBe(original);
  });
});
```

Run — expect **FAIL**.

- [ ] **Step B2 — Extend domain + db row types.** In `src/domain/types.ts` replace the `Companion` interface with the **final merged shape** (see coordination section — includes Part 5's `discoveryCount`; if Part 5 not yet built, omit that one line and add it in Part 5):
```ts
export interface Companion {
  reclaimedMinutesLifetime: number;
  lifetimeDataPoints: number;
  maxTier: number;
  keeper: boolean;
  seed: number;
  driftHealth?: 'settled' | 'curious';
}
```
In `src/db/types.ts` replace `CompanionRow`:
```ts
export interface CompanionRow {
  reclaimedMinutesLifetime: number;
  lifetimeDataPoints: number;
  maxTier: number;
  keeper: boolean;
  seed: number;
  driftHealth: 'settled' | 'curious';
}
```

- [ ] **Step B3 — Append migration 0003.** In `src/db/migrations.ts` add a third array entry:
```ts
  // 0003 — companion 3-layer fuel + procedural seed (additive, monotonic).
  `
  ALTER TABLE companion ADD COLUMN lifetime_data_points INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE companion ADD COLUMN max_tier INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE companion ADD COLUMN keeper INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE companion ADD COLUMN seed INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE companion ADD COLUMN drift_health TEXT NOT NULL DEFAULT 'settled';
  `,
```

- [ ] **Step B4 — Add port methods.** In `src/db/Database.ts` add to the interface:
```ts
  bumpLifetimeNectar(): Promise<void>;
  raiseMaxTier(next: number): Promise<void>;
  setKeeper(): Promise<void>;
  setDriftHealth(value: 'settled' | 'curious'): Promise<void>;
  setSeed(seed: number): Promise<void>;
```

- [ ] **Step B5 — Implement in the memory adapter.** In `src/db/memoryDatabase.ts` change the `companion` literal and add methods:
```ts
  const companion: CompanionRow = {
    reclaimedMinutesLifetime: 0, lifetimeDataPoints: 0, maxTier: 0,
    keeper: false, seed: 1, driftHealth: 'settled',
  };
  // ...inside the returned object:
    async bumpLifetimeNectar(): Promise<void> { companion.lifetimeDataPoints += 1; },
    async raiseMaxTier(next: number): Promise<void> { companion.maxTier = Math.max(companion.maxTier, Math.trunc(next)); },
    async setKeeper(): Promise<void> { companion.keeper = true; },
    async setDriftHealth(value: 'settled' | 'curious'): Promise<void> { companion.driftHealth = value; },
    async setSeed(seed: number): Promise<void> { if (companion.seed === 0) companion.seed = seed; },
```

- [ ] **Step B6 — Implement in the sqlite adapter.** In `src/db/sqliteDatabase.ts` extend `CompanionDbRow`, replace `getCompanion`, add methods:
```ts
interface CompanionDbRow {
  reclaimed_minutes_lifetime: number;
  lifetime_data_points: number;
  max_tier: number;
  keeper: number;
  seed: number;
  drift_health: string;
}
// getCompanion:
    async getCompanion(): Promise<CompanionRow> {
      const row = await db.getFirstAsync<CompanionDbRow>(
        `SELECT reclaimed_minutes_lifetime, lifetime_data_points, max_tier, keeper, seed, drift_health
           FROM companion WHERE id = 1`
      );
      return {
        reclaimedMinutesLifetime: row?.reclaimed_minutes_lifetime ?? 0,
        lifetimeDataPoints: row?.lifetime_data_points ?? 0,
        maxTier: row?.max_tier ?? 0,
        keeper: (row?.keeper ?? 0) === 1,
        seed: row?.seed ?? 0,
        driftHealth: row?.drift_health === 'curious' ? 'curious' : 'settled',
      };
    },
    async bumpLifetimeNectar(): Promise<void> {
      await db.runAsync('UPDATE companion SET lifetime_data_points = lifetime_data_points + 1 WHERE id = 1');
    },
    async raiseMaxTier(next: number): Promise<void> {
      await db.runAsync('UPDATE companion SET max_tier = MAX(max_tier, ?) WHERE id = 1', Math.trunc(next));
    },
    async setKeeper(): Promise<void> { await db.runAsync('UPDATE companion SET keeper = 1 WHERE id = 1'); },
    async setDriftHealth(value: 'settled' | 'curious'): Promise<void> {
      await db.runAsync('UPDATE companion SET drift_health = ? WHERE id = 1', value);
    },
    async setSeed(seed: number): Promise<void> {
      await db.runAsync('UPDATE companion SET seed = ? WHERE id = 1 AND seed = 0', Math.trunc(seed));
    },
```

Run — expect **PASS**: `npx jest src/db` ; then `npm run typecheck` + eslint on the touched files.

- [ ] **Step B7 — Commit.**
```bash
git add src/domain/types.ts src/db
git commit -m "feat(db): companion 3-layer fuel columns, seed, and migration 0003"
```

### Step group C — Repository: companion fuel ops (TDD)

**Files:** `src/db/repositories/companionRepo.ts`, `src/db/repositories/__tests__/companionRepo.test.ts`

- [ ] **Step C1 — Write the failing repo test.** Create `src/db/repositories/__tests__/companionRepo.test.ts`:
```ts
import { createMemoryDatabase } from '../../memoryDatabase';
import { makeCompanionRepo } from '../companionRepo';

describe('companionRepo — fuel ops route to monotonic port methods', () => {
  it('get exposes reclaim bank + all fuel layers', async () => {
    const repo = makeCompanionRepo(createMemoryDatabase());
    const row = await repo.get();
    expect(row.lifetimeDataPoints).toBe(0);
    expect(row.maxTier).toBe(0);
    expect(row.keeper).toBe(false);
  });
  it('bumpNectar increments Layer 1', async () => {
    const repo = makeCompanionRepo(createMemoryDatabase());
    await repo.bumpNectar(); expect((await repo.get()).lifetimeDataPoints).toBe(1);
  });
  it('raiseTier is monotonic', async () => {
    const repo = makeCompanionRepo(createMemoryDatabase());
    await repo.raiseTier(4); await repo.raiseTier(2);
    expect((await repo.get()).maxTier).toBe(4);
  });
  it('setKeeper latches true', async () => {
    const repo = makeCompanionRepo(createMemoryDatabase());
    await repo.setKeeper(); expect((await repo.get()).keeper).toBe(true);
  });
  it('ensureSeed is a no-op when a seed already exists', async () => {
    const repo = makeCompanionRepo(createMemoryDatabase());
    const before = (await repo.get()).seed;
    await repo.ensureSeed(() => before + 123);
    expect((await repo.get()).seed).toBe(before);
  });
});
```
Run — expect **FAIL**.

- [ ] **Step C2 — Extend `companionRepo.ts`** (merge with any existing methods — do not drop `deposit`/`depositToCategory`):
```ts
import type { Database } from '../Database';

export function makeCompanionRepo(db: Database) {
  return {
    get: () => db.getCompanion(),
    deposit: (deltaMin: number) => db.addReclaim(deltaMin),
    depositToCategory: (categoryId: string, deltaMin: number) => db.addCategoryReclaim(categoryId, deltaMin),
    bumpNectar: () => db.bumpLifetimeNectar(),
    raiseTier: (next: number) => db.raiseMaxTier(next),
    setKeeper: () => db.setKeeper(),
    setDrift: (value: 'settled' | 'curious') => db.setDriftHealth(value),
    ensureSeed: (generate: () => number) => db.setSeed(generate()),
  };
}
```
Run — expect **PASS**; eslint the two files.

- [ ] **Step C3 — Commit.**
```bash
git add src/db/repositories/companionRepo.ts src/db/repositories/__tests__/companionRepo.test.ts
git commit -m "feat(db): companionRepo fuel ops (nectar, tier, keeper, drift, seed)"
```

### Step group D — Store: wire fuel into `applyLog` + hydrate (TDD)

**Files:** `src/stores/calibrationStore.ts`, `src/stores/__tests__/calibrationStore.companion.test.ts` (create)

- [ ] **Step D1 — Write the failing store test.** Create `src/stores/__tests__/calibrationStore.companion.test.ts`:
```ts
import { useCalibrationStore } from '../calibrationStore';
import { createMemoryDatabase } from '@/src/db';
import { makeCompanionRepo, makeCategoryStatsRepo } from '@/src/db';

function freshStore() {
  const db = createMemoryDatabase();
  useCalibrationStore.setState({ db, logs: 0, statsByCategory: {} });
  return db;
}

describe('applyLog — fuel Layer 1 (lifetime nectar)', () => {
  it('bumps lifetime nectar on every COUNTED log', async () => {
    const db = freshStore();
    await useCalibrationStore.getState().applyLog({
      category: 'cleaning', estimateMin: 10, actualMin: 12,
      status: 'completed', source: 'timed', adaptSpeed: 'balanced', nowMs: 1000,
    });
    expect((await makeCompanionRepo(db).get()).lifetimeDataPoints).toBe(1);
  });
  it('does NOT bump nectar for an uncounted (abandoned) log', async () => {
    const db = freshStore();
    await useCalibrationStore.getState().applyLog({
      category: 'cleaning', estimateMin: 10, actualMin: null,
      status: 'abandoned', source: 'timed', adaptSpeed: 'balanced', nowMs: 1000,
    });
    expect((await makeCompanionRepo(db).get()).lifetimeDataPoints).toBe(0);
  });
});

describe('applyLog — fuel Layer 2 (maxTier) is monotonic', () => {
  it('raises maxTier on a tier-up, never regresses', async () => {
    const db = freshStore();
    await makeCategoryStatsRepo(db).upsert({
      categoryId: 'cleaning', n: 8, logEwma: 0, mEffective: 1.0, sharpness: 90,
      priorMult: 2.0, adaptSpeed: 'balanced', updatedAt: 1, reclaimedMinutes: 0,
    });
    await useCalibrationStore.getState().applyLog({
      category: 'cleaning', estimateMin: 10, actualMin: 10,
      status: 'completed', source: 'timed', adaptSpeed: 'balanced', nowMs: 2000,
    });
    expect((await makeCompanionRepo(db).get()).maxTier).toBeGreaterThanOrEqual(3);
  });
});

describe('applyLog — fuel Layer 3 is positive-only', () => {
  it('records a drift-health register on a counted log', async () => {
    const db = freshStore();
    await useCalibrationStore.getState().applyLog({
      category: 'cleaning', estimateMin: 10, actualMin: 11,
      status: 'completed', source: 'timed', adaptSpeed: 'balanced', nowMs: 3000,
    });
    expect(['settled', 'curious']).toContain((await makeCompanionRepo(db).get()).driftHealth);
  });
});
```
Run — expect **FAIL**.

- [ ] **Step D2 — Wire fuel into `applyLog`.** In `src/stores/calibrationStore.ts` add to the `@/src/engine` import: `companionStageFor, keeperReached, driftHealthFromRecent, TIERS, tierFor` (keep existing). Inside `applyLog`, in the `if (result.counted) { … }` block, after the reclaim deposit + recurring upsert, add:
```ts
      // ── Companion fuel (additive, monotonic, positive-only) ──────────────
      await companionRepo.bumpNectar();                               // Layer 1
      const tierIdxAfter = TIERS.indexOf(tierFor(result.category.sharpness));
      if (tierIdxAfter >= 0) await companionRepo.raiseTier(tierIdxAfter); // Layer 2
      const driftRatios = [...recentClampedRatios, clampRatio(input.estimateMin, input.actualMin)];
      await companionRepo.setDrift(driftHealthFromRecent(driftRatios)); // Layer 3
      // Stage 6 — Keeper latches when the comb is (near-)fully capped.
      const tracked = useCategoriesStore.getState().categories;
      let cappedCellCount = 0;
      for (const cat of tracked) {
        const s = cat.id === input.category ? result.category.sharpness : (await categoryStatsRepo.get(cat.id)).sharpness;
        if (tierFor(s) === 'Honest') cappedCellCount += 1;
      }
      if (keeperReached({ cappedCellCount, trackedCount: tracked.length })) {
        await companionRepo.setKeeper();
      }
```
(Ensure `companionRepo` is constructed in scope, and `clampRatio` signature matches the existing call site.) In `hydrate`, after seeding `statsByCategory`:
```ts
      const companionRepo = makeCompanionRepo(db);
      await companionRepo.ensureSeed(() => (Date.now() % 1_000_000) + 1);
```
Run — expect **PASS**: `npx jest src/stores` ; `npm run typecheck` ; eslint touched files.

- [ ] **Step D3 — Commit.**
```bash
git add src/stores/calibrationStore.ts src/stores/__tests__/calibrationStore.companion.test.ts
git commit -m "feat(store): drive companion fuel layers from applyLog; seed on hydrate"
```

### Step group E — Read-model + UI: 6 stages, capability copy, Keeper, seed

**Files:** `src/stores/calibrationStore.ts` (extend `ReclaimSummary`), `src/features/whenbee/useWhenbeeHub.ts`, `src/theme/tokens.ts`, `src/components/BeeMascot.tsx`, `src/features/whenbee/WhenbeeAvatar.tsx`, `src/features/whenbee/TierTrailHub.tsx`, `src/features/whenbee/__tests__/companionStage.test.tsx`

Skills (MANDATORY before touching UI/motion/copy): `ui-design:react-native-design` (every value a token), `creating-reanimated-animations` + `motion-design` (stage glow/float; reduce-motion fade fallback), `conversion-psychology` + `humanizer` (capability + Keeper copy — warm, non-evaluative, no guilt). All values via `useTheme()`.

- [ ] **Step E1 — Add companion tokens.** In `src/theme/tokens.ts` add a `companion` group (amber/indigo family only — never red):
```ts
  companion: {
    floatLift: [2, 3, 5, 7, 9, 11] as const,   // px lift per stage 1..6
    glow: [0, 0, 6, 12, 18, 24] as const,       // px glow radius per stage
    driftSettled: '<existing primarySoft token>',
    driftCurious: '<existing indigo accent token>',
  },
```
(Use real existing token references; do not introduce raw hex.)

- [ ] **Step E2 — Extend `ReclaimSummary` + its loader.** In `calibrationStore.ts` add a `companion` block to `ReclaimSummary` (`stage`, `capability`, `keeper`, `lifetimeNectar`, `driftHealth`, `seed`) and populate it in `loadReclaimSummary` via `companionStageFor` + `capabilityFor` from the companion row. Import the engine helpers/types.

- [ ] **Step E3 — Surface in `useWhenbeeHub.ts`.** Add the companion fields to `WhenbeeHubVM`, set from `summary.companion`, with an `EMPTY_COMPANION` default (`stage:1, keeper:false, lifetimeNectar:0, driftHealth:'settled', seed:1`). Keep the existing `tier` field (still drives the honeycomb).

- [ ] **Step E4 — Write the stage-mapping test.** Create `src/features/whenbee/__tests__/companionStage.test.tsx`:
```ts
import { companionStageFor, capabilityFor } from '@/src/engine';

describe('companion stage mapping (unit)', () => {
  it('Keeper node is the 6th trail node', () => {
    const TRAIL = ['Raw', 'Setting', 'Ripening', 'Thickening', 'Honest', 'Keeper'];
    expect(TRAIL).toHaveLength(6);
    expect(TRAIL[5]).toBe('Keeper');
  });
  it('avatar variant id matches the engine stage 1..6', () => {
    expect(`stage-${companionStageFor({ maxTier: 0, keeper: false })}`).toBe('stage-1');
    expect(`stage-${companionStageFor({ maxTier: 4, keeper: true })}`).toBe('stage-6');
  });
  it('Keeper capability gates nothing new', () => {
    expect(capabilityFor(6).gatesNewFeature).toBe(false);
  });
});
```
Run — expect **PASS** (engine already green).

- [ ] **Step E5 — Extend `BeeMascot.tsx`.** Widen the variant union to `'stage-1' … 'stage-6' | 'default'` and accept a `seed`. Switch glow/float amplitude from `t.companion.glow[stage-1]`/`floatLift[stage-1]`; tint identity-amber stripes from `seed` (deterministic hue rotation within the amber family — never red). One base artwork; expression scales by stage + seed.

- [ ] **Step E6 — Update `WhenbeeAvatar.tsx`.** Replace the tier mapping with a stage-driven prop set (`stage`, `capability`, `seed`, `driftHealth`, optional `name`). Render `BeeMascot variant={`stage-${stage}`} seed={seed}`, the optional name, and the capability label as warm microcopy. Mount/log lift via Reanimated `withSpring` using `t.companion.floatLift[stage-1]`; **reduce-motion** collapses to a plain fade (`useReducedMotion()`). `driftHealth === 'curious'` only changes tint to `t.companion.driftCurious` + a gentle wobble — never sad/wilt.

- [ ] **Step E7 — Add the Keeper node to `TierTrailHub.tsx`.** Extend the trail to six nodes; accept the companion `stage` and derive node state (`done`/`now`/`lock`) from `stage - 1`. Monotonic by construction.

- [ ] **Step E8 — Update `WhenbeeHub.tsx` call sites.** Pass `vm.companion.*` into `WhenbeeAvatar` and `vm.companion.stage` into `TierTrailHub`. Routes stay thin.

Run: `npx jest src/features/whenbee` ; `npm run typecheck` ; eslint the touched files.

- [ ] **Step E9 — Screenshot-verify on the sim.** `npm run ios`, open Whenbee tab, `xcrun simctl io booted screenshot`. Verify: glow/float scales Raw→Keeper; capability line warm/non-evaluative; 6-node trail with Keeper; no red; reduce-motion collapses to a fade. Critique spacing/alignment before marking done.

- [ ] **Step E10 — Commit.**
```bash
git add src/features/whenbee src/components/BeeMascot.tsx src/theme/tokens.ts src/stores/calibrationStore.ts
git commit -m "feat(whenbee): 6-stage companion with capability copy, Keeper node, seed recolor"
```

### Part 2 final verification

- [ ] **Step F1 — Full gate.** `npm run lint && npm run typecheck && npm test`. Confirm by inspection: `maxTier`/stage monotonic (`Math.max`/`MAX()`); `keeper` only ever set `1`; `driftHealth` only `'settled'|'curious'`; no streak/decay/pet-needs field; no red token; only on-device db writes added.

> Executor notes: migration index is positional — 0003 **must** be `MIGRATIONS[2]`; never reorder/edit 0001/0002. `noUncheckedIndexedAccess` is on — handle `T | undefined` on all token-array reads (`?? fallback`). The sqlite adapter never runs in Jest — db tests assert against `createMemoryDatabase()` + migration-SQL strings.

---

<!-- ============================================================ -->
<!-- PART 3 -->
<!-- ============================================================ -->

## Part 3 — Earned-Readiness paywall layer

> **Phase 4.5 — features D12–D17.** Adds a *readiness narrative* on top of the working paywall. Changes **no price, no trial length, not the `pro` entitlement** — RevenueCat stays the source of truth. Introduces per-category **Calibration Confidence** (Raw → Setting → Honest), an honest *range* before a category is Honest, a per-category **graduation moment**, a readiness-framed paywall headline, and a **$49 founder reservation** (price read from the store).

> **Confidence ≠ Tier.** The 5-step `Tier` (thresholds `[0,40,64,82,93]`) is the monotonic honey meter — **never touch it.** `CalibrationConfidence` is a separate 3-step label from **sample size + coefficient of variation of the clamped ratios**.

### Files map

| File | Action |
|---|---|
| `src/engine/confidence.ts` | new — `confidenceFor()` + `honestRangeFor()` + `reservePriceVisible()` |
| `src/engine/__tests__/confidence.test.ts` | new |
| `src/engine/constants.ts` | edit — confidence gate constants |
| `src/engine/index.ts` | edit — barrel export |
| `src/domain/types.ts` | edit — `CalibrationConfidence`, `HonestRange`, extend `CalibrationSummary` |
| `src/stores/calibrationStore.ts` | edit — populate `confidence`+`range`; kv-backed `graduatedCategories` |
| `src/features/category-detail/HonestCard.tsx` | edit — range vs tight-number |
| `src/features/category-detail/GraduationMoment.tsx` | new |
| `src/features/category-detail/useCategoryDetail.ts` | edit — detect first-Honest, return `justGraduated` |
| `src/features/shared/HonestSuggestionCard.tsx` | edit — range vs tight number |
| `src/features/patterns/usePatterns.ts` + `CalibrationMap.tsx` | edit — confidence dials |
| `src/features/paywall/Paywall.tsx` | edit — readiness headline + founder-reserve mount |
| `src/features/paywall/FounderReserveCard.tsx` | new |
| `src/features/paywall/useFounderReserve.ts` | new — kv flag, no charge |
| `src/app/(modals)/paywall.tsx` | edit — pass `readiness` props |

Skills (HARD RULE): `conversion-psychology` + `humanizer` (copy); `ui-design:react-native-design` + tokens (visuals); `creating-reanimated-animations` + `motion-design` (graduation count-up); `test-driven-development` + `typescript-expert` (engine).

- [ ] **Step 1 — add confidence gates.** Append to `src/engine/constants.ts`:
```ts
// ── Calibration Confidence (Earned-Readiness, Phase 4.5) ─────────────────────
export const CONFIDENCE_SETTING_MIN_LOGS = 3;
export const CONFIDENCE_HONEST_MIN_LOGS = 6;
export const CONFIDENCE_HONEST_MAX_CV = 0.35;
export const RANGE_MIN_HALF_WIDTH = 0.18;
export const RANGE_MAX_HALF_WIDTH = 0.5;
```
Commit: `chore(engine): add calibration-confidence + honest-range constants`

- [ ] **Step 2 — add the contracts.** In `src/domain/types.ts`:
```ts
export type CalibrationConfidence = 'raw' | 'setting' | 'honest';
export interface HonestRange { lowMinutes: number; highMinutes: number; }
```
Extend `CalibrationSummary` additively:
```ts
export interface CalibrationSummary {
  multiplier: number;
  honestMinutes: number;
  guessMinutes: number;
  basis: 'personal' | 'prior';
  label: string;
  sampleSize: number;
  confidence: CalibrationConfidence;   // new
  range: HonestRange | null;           // new — present only while !== 'honest'
}
```
Commit: `feat(domain): add CalibrationConfidence + HonestRange contracts`

- [ ] **Step 3 — write `src/engine/__tests__/confidence.test.ts` (RED).**
```ts
import { confidenceFor, honestRangeFor, reservePriceVisible } from '../confidence';

describe('confidenceFor', () => {
  it('is raw below the Setting log floor', () => {
    expect(confidenceFor({ n: 0, clampedRatios: [] })).toBe('raw');
    expect(confidenceFor({ n: 2, clampedRatios: [1.5, 1.6] })).toBe('raw');
  });
  it('is setting once at the personal floor but not yet settled', () => {
    expect(confidenceFor({ n: 4, clampedRatios: [1.2, 2.0, 1.1, 2.4] })).toBe('setting');
  });
  it('needs both enough logs AND a tight spread to be honest', () => {
    expect(confidenceFor({ n: 6, clampedRatios: [1.9, 2.0, 2.0, 2.1, 1.95, 2.05] })).toBe('honest');
    expect(confidenceFor({ n: 6, clampedRatios: [1.0, 3.0, 1.2, 2.8, 1.1, 3.0] })).toBe('setting');
  });
  it('never reports honest below the honest log floor', () => {
    expect(confidenceFor({ n: 5, clampedRatios: [2, 2, 2, 2, 2] })).toBe('setting');
  });
});
describe('honestRangeFor', () => {
  it('brackets the honest number and rounds to 5', () => {
    const r = honestRangeFor({ honestMinutes: 30, clampedRatios: [1.5, 2.5, 1.2, 2.8] });
    expect(r.lowMinutes % 5).toBe(0); expect(r.highMinutes % 5).toBe(0);
    expect(r.lowMinutes).toBeLessThan(30); expect(r.highMinutes).toBeGreaterThan(30);
  });
  it('low bound is never below 5 nor above the honest number', () => {
    const r = honestRangeFor({ honestMinutes: 5, clampedRatios: [1.1, 1.2, 1.0] });
    expect(r.lowMinutes).toBeGreaterThanOrEqual(5);
    expect(r.lowMinutes).toBeLessThanOrEqual(r.highMinutes);
  });
  it('a noisy category yields a wider band than a settled one', () => {
    const tight = honestRangeFor({ honestMinutes: 40, clampedRatios: [1.9, 2.0, 2.1, 2.0] });
    const noisy = honestRangeFor({ honestMinutes: 40, clampedRatios: [1.0, 3.0, 1.1, 2.9] });
    expect(noisy.highMinutes - noisy.lowMinutes).toBeGreaterThan(tight.highMinutes - tight.lowMinutes);
  });
});
describe('reservePriceVisible', () => {
  it('offers the founder reserve only before any category is honest', () => {
    expect(reservePriceVisible('raw')).toBe(true);
    expect(reservePriceVisible('setting')).toBe(true);
    expect(reservePriceVisible('honest')).toBe(false);
  });
});
```
Run — expect **FAIL** (`Cannot find module '../confidence'`).

- [ ] **Step 4 — implement `src/engine/confidence.ts` (GREEN).**
```ts
import {
  CONFIDENCE_SETTING_MIN_LOGS, CONFIDENCE_HONEST_MIN_LOGS, CONFIDENCE_HONEST_MAX_CV,
  RANGE_MIN_HALF_WIDTH, RANGE_MAX_HALF_WIDTH,
} from './constants';
import type { CalibrationConfidence, HonestRange } from '../domain/types';

interface ConfidenceInput { n: number; clampedRatios: number[]; }

function coefficientOfVariation(ratios: number[]): number {
  if (ratios.length < 2) return 0;
  const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  if (mean === 0) return 0;
  const variance = ratios.reduce((sum, r) => sum + (r - mean) ** 2, 0) / ratios.length;
  return Math.sqrt(variance) / mean;
}

export function confidenceFor({ n, clampedRatios }: ConfidenceInput): CalibrationConfidence {
  if (n < CONFIDENCE_SETTING_MIN_LOGS) return 'raw';
  const settled = coefficientOfVariation(clampedRatios) <= CONFIDENCE_HONEST_MAX_CV;
  if (n >= CONFIDENCE_HONEST_MIN_LOGS && settled) return 'honest';
  return 'setting';
}

interface RangeInput { honestMinutes: number; clampedRatios: number[]; }
function round5(min: number): number { return Math.max(5, Math.round(min / 5) * 5); }

export function honestRangeFor({ honestMinutes, clampedRatios }: RangeInput): HonestRange {
  const cv = coefficientOfVariation(clampedRatios);
  const halfWidth = Math.min(RANGE_MAX_HALF_WIDTH, Math.max(RANGE_MIN_HALF_WIDTH, cv));
  const low = round5(Math.min(honestMinutes, honestMinutes * (1 - halfWidth)));
  const high = round5(Math.max(honestMinutes, honestMinutes * (1 + halfWidth)));
  return { lowMinutes: low, highMinutes: high };
}

export function reservePriceVisible(confidence: CalibrationConfidence): boolean {
  return confidence !== 'honest';
}
```
Run — expect **PASS** (`Tests: 9 passed`).

- [ ] **Step 5 — export + lint + suite.** Add to `src/engine/index.ts`:
```ts
export { confidenceFor, honestRangeFor, reservePriceVisible } from './confidence';
```
`npx eslint src/engine/confidence.ts src/engine/index.ts src/engine/constants.ts` ; `npx jest src/engine/__tests__/`.
Commit: `feat(engine): calibration-confidence + honest-range (pure, tested)`

- [ ] **Step 6 — store wiring.** In `src/stores/calibrationStore.ts`, where `summary` is built via `resolveSuggestion(...)`, compute the clamped ratios from this category's completed logs and fold in `confidence`/`range`:
```ts
import { resolveSuggestion, confidenceFor, honestRangeFor, clampRatio } from '@/src/engine';
const clampedRatios = completed
  .filter((e) => e.actualMin != null && e.actualMin > 0)
  .map((e) => clampRatio(e.actualMin! / e.estimateMin));
const base = resolveSuggestion({ guessMinutes, category, recurring });
const confidence = confidenceFor({ n: base.sampleSize, clampedRatios });
const range = confidence === 'honest' ? null : honestRangeFor({ honestMinutes: base.honestMinutes, clampedRatios });
const summary = { ...base, confidence, range };
```
Add a kv-backed `graduatedCategories: Set<string>` + idempotent `markGraduated(categoryId)` (persist via `src/lib/kv.ts`). Expose `confidence` on `CategoryDetail`. Add a store unit test asserting `summary.confidence`/`range` populate and `markGraduated` is idempotent. `npx jest src/stores/__tests__/calibrationStore.test.ts`.
Commit: `feat(store): surface confidence + honest range, track per-category graduation`

- [ ] **Step 7 — `HonestCard.tsx`: range vs tight number.** Invoke design+copy skills first. Add `confidence: CalibrationConfidence` and `range: HonestRange | null` to `HonestCardProps`. Replace the number row so a non-honest category shows `low–high` + a no-guilt learning line ("Still learning your pace…" / "Getting clearer…"), and an honest one shows the existing tight `~28 min · runs 1.9×` + "now an honest number". Add a render test for both branches. `npx jest src/features/category-detail/__tests__/` ; eslint.
Commit: `feat(category-detail): honest range while learning, tight number once honest`

- [ ] **Step 8 — `HonestSuggestionCard.tsx`: quiet planning shift.** Add the same `confidence`/`range` props. When not honest, render the band + a quiet "still learning" suffix; keep the tight line at honest. Reuse existing token styles. Update `accessibilityLabel` to read the band. Render test both branches. eslint.
Commit: `feat(shared): live banner shows honest range until the category is honest`

- [ ] **Step 9 — graduation detection in `useCategoryDetail.ts`.** After `refresh()` yields `confidence === 'honest'` and the id is **not** in `graduatedCategories`, set `justGraduated = true` + `markGraduated(categoryId)`. Return `justGraduated`. Fires exactly once per category, ever.

- [ ] **Step 10 — `GraduationMoment.tsx`.** Invoke motion skills. Dismissible overlay: `haptics.success()` on mount, Reanimated count-up from old range midpoint to the honest number (timing/easing from the skills), copy "Now an honest number." All values from tokens; reduce-motion skips the count-up (shows final number). Success haptic only; count-up only upward. Render `<GraduationMoment>` when `justGraduated`, clear on `onDone`. `npx jest src/features/category-detail/__tests__/` ; eslint.
Commit: `feat(category-detail): one-time graduation moment when a category turns honest`

- [ ] **Step 11 — `usePatterns.ts`: confidence on the map row.** Compute `confidence: confidenceFor({ n, clampedRatios })` per category (filter `PatternsData.logs` by category → clamped ratios). Add `confidence: CalibrationConfidence` to `CalibrationMapRow`.

- [ ] **Step 12 — `CalibrationMap.tsx`: dial.** Add a 3-step dial (Raw→Setting→Honest) per row; honest rows read the tight `~N min`, raw/setting rows the band. Tokens only. Humanized readiness framing line. `npx jest src/features/patterns/__tests__/` ; eslint.
Commit: `feat(patterns): per-category confidence dial + readiness framing`

- [ ] **Step 13 — readiness headline.** In `src/app/(modals)/paywall.tsx` read a `readiness` param and pass to `<Paywall readiness={...} />`. In `Paywall.tsx` add optional `readiness?: 'pre' | 'honest'`. When `'honest'`, swap the heading to "Your numbers are real now." + the earned subhead; else keep the default. Pass `readiness` into `paywall_view` props. **Prices/plans/trial/CTA unchanged.** eslint + `npx jest src/features/paywall/__tests__/`.
Commit: `feat(paywall): readiness-framed headline when the paywall fires post-honest`

- [ ] **Step 14 — `useFounderReserve.ts`.** kv-backed `{ reserved, reserve() }` — records intent only (**no purchase, no entitlement change**); fires `founder_reserve { result:'reserved' }`. Unit-test the kv round-trip + idempotency. eslint.

- [ ] **Step 15 — `FounderReserveCard.tsx`.** Takes the founder package's `priceString` (from the live offering — **never hardcode "$49"**) + `reserved`. Copy: "Lock the founder price — {priceString}" + "Nothing's charged until your numbers are honest." Amber `AppButton` (disabled when reserved). Flat card + hairline, no shadow, tokens only. **If the founder package is absent from the offering, the card does not render.**

- [ ] **Step 16 — mount the reserve card.** In `Paywall.tsx`, when `readiness === 'pre'` (or `reserveEligible`) AND `reservePriceVisible(confidence)` AND the founder package exists, render `<FounderReserveCard>` above the plan picker. Suppressed once honest (headline takes over). Fire `founder_reserve` on tap. **`handleBuy`/`PlanPicker`/entitlement untouched.** eslint + `npx jest src/features/paywall/__tests__/`.
Commit: `feat(paywall): $49 founder-price reservation before readiness (price from RevenueCat, no charge)`

- [ ] **Step 17 — full gate.** `npm run typecheck && npm run lint && npm test`. Re-read the diff: no `priceString` hardcoded, `useEntitlement`/`purchasePackage` untouched, trial unchanged, `Tier`/`TIER_THRESHOLDS` untouched, every new visual value a token.
Commit: `test(earned-readiness): full suite green; no entitlement/price/tier change`

---

<!-- ============================================================ -->
<!-- PART 4 -->
<!-- ============================================================ -->

## Part 4 — "What steals your time" (Pro reason correlations + reason-aware note)

> S12 (Pro reason correlations) + B15 (reason-aware honest-number note). Reason **capture already ships** (`ReasonChips.tsx` → `setReason` → `log_tags` table, migration 0002 — verified). This part builds the **Pro read side only**: a pure deterministic correlation engine, two Pro-gated Patterns cards, and an optional never-overriding note on the honest-number surfaces. **No migration needed** — only a read-only `log_tags ⋈ task_events` join.

### Files map

**Data layer (read-only join):** `src/db/Database.ts`, `src/db/types.ts`, `src/db/memoryDatabase.ts`, `src/db/sqliteDatabase.ts`, `src/db/repositories/contextTagRepo.ts`, `src/db/__tests__/reasonRead.test.ts` (new)
**Engine (pure):** `src/domain/types.ts`, `src/engine/constants.ts`, `src/engine/reasons.ts` (new), `src/engine/index.ts`, `src/engine/__tests__/reasons.test.ts` (new)
**Store:** `src/stores/calibrationStore.ts` — `loadReasonInsights()`
**Patterns (Pro-gated):** `src/features/patterns/useReasonInsights.ts`, `StealsYourTime.tsx`, `StealsYourTimeWeekly.tsx`, `StealsYourTimeLocked.tsx` (all new), `src/app/(tabs)/patterns.tsx`, `__tests__/stealsYourTime.test.tsx` (new)
**B15 note:** `src/features/shared/HonestSuggestionCard.tsx`, `src/features/category-detail/HonestCard.tsx`, `useCategoryDetail.ts`, `__tests__/honestCardReasonNote.test.tsx` (new)

- [ ] **Step 1 — domain types + constants.** In `src/domain/types.ts` (after `ContextReason`):
```ts
export interface ReasonSample {
  category: Category;
  reason: ContextReason;
  direction: 'over' | 'under';
  hour: number;     // local 0–23
  weekday: number;  // local 0–6 (0 = Sunday)
}
export interface ReasonCorrelation {
  categoryId: string;
  reason: ContextReason;
  share: number;        // share of this category's OVER samples carrying this reason
  sampleCount: number;
  totalOver: number;
  timeSkew: 'afternoon' | 'morning' | null;
  weekdaySkew: number | null;
}
export interface ReasonInsight extends ReasonCorrelation { categoryName: string; }
```
In `src/engine/constants.ts`:
```ts
export const REASON_MIN_OVER_SAMPLES = 4;
export const REASON_DOMINANCE_SHARE = 0.5;
export const REASON_TIME_SHARE = 0.6;
export const REASON_AFTERNOON_HOUR = 16;
export const REASON_WEEKDAY_SHARE = 0.5;
export const REASON_NOTE_MIN_SHARE = 0.6;
```
Commit: `feat(domain): reason-correlation types + S12/B15 thresholds`

- [ ] **Step 2 — engine tests FIRST (red).** Create `src/engine/__tests__/reasons.test.ts`:
```ts
import { correlateReasons, reasonNoteFor, REASON_MIN_OVER_SAMPLES } from '@/src/engine';
import type { ReasonSample } from '@/src/domain/types';

function over(category: string, reason: string, hour = 10, weekday = 1): ReasonSample {
  return { category, reason, direction: 'over', hour, weekday };
}

describe('correlateReasons', () => {
  it('returns nothing below the min-over-sample gate', () => {
    const samples = Array.from({ length: REASON_MIN_OVER_SAMPLES - 1 }, () => over('cleaning', 'context_switch'));
    expect(correlateReasons(samples)).toEqual([]);
  });
  it('surfaces a dominant cause once it clears the gates', () => {
    const samples = [over('cleaning','context_switch'),over('cleaning','context_switch'),over('cleaning','context_switch'),over('cleaning','interrupted')];
    const [c] = correlateReasons(samples);
    expect(c?.categoryId).toBe('cleaning');
    expect(c?.reason).toBe('context_switch');
    expect(c?.share).toBeCloseTo(0.75, 5);
    expect(c?.sampleCount).toBe(3); expect(c?.totalOver).toBe(4);
  });
  it('does not surface when no cause is dominant (tie at the boundary)', () => {
    const samples = [over('cooking','context_switch'),over('cooking','interrupted'),over('cooking','underestimated'),over('cooking','context_switch')];
    expect(correlateReasons(samples)).toEqual([]);
  });
  it('ignores under-runs', () => {
    const samples: ReasonSample[] = [
      ...Array.from({ length: 4 }, () => over('email','context_switch')),
      { category: 'email', reason: 'focused', direction: 'under', hour: 9, weekday: 2 },
    ];
    expect(correlateReasons(samples)[0]?.totalOver).toBe(4);
  });
  it('detects an afternoon time skew', () => {
    const samples = [over('cleaning','context_switch',17),over('cleaning','context_switch',18),over('cleaning','context_switch',16),over('cleaning','context_switch',9)];
    expect(correlateReasons(samples)[0]?.timeSkew).toBe('afternoon');
  });
  it('reports no time skew when evenly split', () => {
    const samples = [over('cleaning','context_switch',17),over('cleaning','context_switch',18),over('cleaning','context_switch',9),over('cleaning','context_switch',10)];
    expect(correlateReasons(samples)[0]?.timeSkew).toBeNull();
  });
  it('sorts by share descending across categories', () => {
    const samples = [
      ...Array.from({ length: 4 }, () => over('a','interrupted')),
      over('b','context_switch'),over('b','context_switch'),over('b','context_switch'),over('b','interrupted'),
    ];
    expect(correlateReasons(samples).map((c) => c.categoryId)).toEqual(['a','b']);
  });
});

describe('reasonNoteFor (B15)', () => {
  it('returns null when the dominant share is below the note gate', () => {
    const samples = [over('cleaning','context_switch'),over('cleaning','context_switch'),over('cleaning','context_switch'),over('cleaning','interrupted'),over('cleaning','interrupted')];
    expect(reasonNoteFor('cleaning', samples, { share: 0.7 })).toBeNull();
  });
  it('builds a kind, deterministic note for a dominated category', () => {
    const samples = Array.from({ length: 5 }, () => over('cleaning','context_switch'));
    expect(reasonNoteFor('cleaning', samples)).toBe('Most overruns here trace back to getting pulled away.');
  });
  it('never throws on an unknown category', () => { expect(reasonNoteFor('cleaning', [])).toBeNull(); });
});
```
Run — expect **FAIL**.

- [ ] **Step 3 — implement `src/engine/reasons.ts` (green).**
```ts
// PURE correlation over captured over/under reasons. No React/RN/Expo, no clock.
// READ-ONLY: nothing here feeds calibration. No guilt: names the move, not a fault.
import type { ReasonCorrelation, ReasonSample } from '../domain/types';
import {
  REASON_AFTERNOON_HOUR, REASON_DOMINANCE_SHARE, REASON_MIN_OVER_SAMPLES,
  REASON_NOTE_MIN_SHARE, REASON_TIME_SHARE, REASON_WEEKDAY_SHARE,
} from './constants';

const REASON_PHRASE: Record<string, string> = {
  context_switch: 'getting pulled away',
  interrupted: 'getting interrupted',
  underestimated: 'the task being bigger than it looked',
};
const FALLBACK_PHRASE = 'a few recurring snags';
export function reasonPhrase(reason: string): string { return REASON_PHRASE[reason] ?? FALLBACK_PHRASE; }

function topCount<T extends string>(counts: Map<T, number>): { key: T; count: number } | null {
  let best: { key: T; count: number } | null = null;
  for (const key of [...counts.keys()].sort()) {
    const count = counts.get(key) ?? 0;
    if (best === null || count > best.count) best = { key, count };
  }
  return best;
}
function timeSkewOf(samples: ReasonSample[]): ReasonCorrelation['timeSkew'] {
  if (samples.length === 0) return null;
  const afternoon = samples.filter((s) => s.hour >= REASON_AFTERNOON_HOUR).length;
  const share = afternoon / samples.length;
  if (share >= REASON_TIME_SHARE) return 'afternoon';
  if (1 - share >= REASON_TIME_SHARE) return 'morning';
  return null;
}
function weekdaySkewOf(samples: ReasonSample[]): number | null {
  if (samples.length === 0) return null;
  const counts = new Map<number, number>();
  for (const s of samples) counts.set(s.weekday, (counts.get(s.weekday) ?? 0) + 1);
  let bestDay: number | null = null; let bestCount = 0;
  for (const day of [...counts.keys()].sort((a, b) => a - b)) {
    const c = counts.get(day) ?? 0;
    if (c > bestCount) { bestCount = c; bestDay = day; }
  }
  if (bestDay === null) return null;
  return bestCount / samples.length >= REASON_WEEKDAY_SHARE ? bestDay : null;
}
function correlateOne(categoryId: string, overSamples: ReasonSample[]): ReasonCorrelation | null {
  if (overSamples.length < REASON_MIN_OVER_SAMPLES) return null;
  const counts = new Map<string, number>();
  for (const s of overSamples) counts.set(s.reason, (counts.get(s.reason) ?? 0) + 1);
  const top = topCount(counts);
  if (top === null) return null;
  const share = top.count / overSamples.length;
  if (share <= REASON_DOMINANCE_SHARE) return null;
  const ofReason = overSamples.filter((s) => s.reason === top.key);
  return {
    categoryId, reason: top.key, share, sampleCount: top.count, totalOver: overSamples.length,
    timeSkew: timeSkewOf(ofReason), weekdaySkew: weekdaySkewOf(ofReason),
  };
}
export function correlateReasons(samples: ReasonSample[]): ReasonCorrelation[] {
  const byCategory = new Map<string, ReasonSample[]>();
  for (const s of samples) {
    if (s.direction !== 'over') continue;
    const bucket = byCategory.get(s.category);
    if (bucket) bucket.push(s); else byCategory.set(s.category, [s]);
  }
  const out: ReasonCorrelation[] = [];
  for (const categoryId of [...byCategory.keys()].sort()) {
    const corr = correlateOne(categoryId, byCategory.get(categoryId) ?? []);
    if (corr) out.push(corr);
  }
  return out.sort((a, b) => b.share - a.share || a.categoryId.localeCompare(b.categoryId));
}
export function reasonNoteFor(categoryId: string, samples: ReasonSample[], opts?: { share?: number }): string | null {
  const minShare = opts?.share ?? REASON_NOTE_MIN_SHARE;
  const overSamples = samples.filter((s) => s.direction === 'over' && s.category === categoryId);
  if (overSamples.length < REASON_MIN_OVER_SAMPLES) return null;
  const counts = new Map<string, number>();
  for (const s of overSamples) counts.set(s.reason, (counts.get(s.reason) ?? 0) + 1);
  const top = topCount(counts);
  if (top === null) return null;
  if (top.count / overSamples.length < minShare) return null;
  return `Most overruns here trace back to ${reasonPhrase(top.key)}.`;
}
```
Add to `src/engine/index.ts`:
```ts
export { correlateReasons, reasonNoteFor, reasonPhrase } from './reasons';
```
Run — expect **PASS** (`Tests: 10 passed`); eslint the touched files.
Commit: `feat(engine): deterministic reason correlations + B15 note (S12)`

- [ ] **Step 4 — read-only join API (no migration).** In `src/db/types.ts`:
```ts
export interface ReasonEventRow {
  eventId: string; category: string; reason: string;
  estimateMin: number; actualMin: number | null; createdAt: number;
}
```
In `src/db/Database.ts` add (with the off-the-loop comment) + import `ReasonEventRow`:
```ts
  listReasonEvents(limit: number): Promise<ReasonEventRow[]>;
```
In `src/db/repositories/contextTagRepo.ts` add `listReasonEvents: (limit) => db.listReasonEvents(limit)` alongside the existing `setReason`.

- [ ] **Step 5 — implement the join in both adapters.** Memory (`src/db/memoryDatabase.ts`):
```ts
    async listReasonEvents(limit: number): Promise<ReasonEventRow[]> {
      const rows: ReasonEventRow[] = [];
      for (const tag of contextTags.values()) {
        if (tag.key !== 'reason') continue;
        const event = events.get(tag.eventId);
        if (!event) continue;
        rows.push({
          eventId: tag.eventId, category: event.category, reason: tag.value,
          estimateMin: event.estimateMin, actualMin: event.actualMin, createdAt: event.createdAt,
        });
      }
      return rows.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
    },
```
Sqlite (`src/db/sqliteDatabase.ts`):
```ts
    async listReasonEvents(limit: number): Promise<ReasonEventRow[]> {
      const rows = await db.getAllAsync<{
        event_id: string; category: string; value: string;
        estimate_min: number; actual_min: number | null; created_at: number;
      }>(
        `SELECT t.event_id, e.category, t.value, e.estimate_min, e.actual_min, e.created_at
           FROM log_tags t JOIN task_events e ON e.id = t.event_id
          WHERE t.key = 'reason' ORDER BY e.created_at DESC LIMIT ?`,
        limit,
      );
      return rows.map((r) => ({
        eventId: r.event_id, category: r.category, reason: r.value,
        estimateMin: r.estimate_min, actualMin: r.actual_min, createdAt: r.created_at,
      }));
    },
```

- [ ] **Step 6 — adapter parity test.** Create `src/db/__tests__/reasonRead.test.ts`:
```ts
import { createMemoryDatabase } from '@/src/db/memoryDatabase';
import type { Database } from '@/src/db/Database';
import type { TaskEventRow } from '@/src/db/types';

function event(id: string, category: string, createdAt: number): TaskEventRow {
  return { id, category, label: null, estimateMin: 10, actualMin: 20, status: 'completed',
    source: 'timed', startedAt: null, endedAt: null, createdAt, suggestedHonestMin: null, reclaimDividendMin: 0 };
}

describe('listReasonEvents (memory adapter)', () => {
  let db: Database;
  beforeEach(() => { db = createMemoryDatabase(); });
  it('joins reason tags to events, newest first, excludes non-reason keys', async () => {
    await db.insertTaskEvent(event('e1','cleaning',100));
    await db.insertTaskEvent(event('e2','cooking',200));
    await db.insertContextTag({ eventId:'e1', key:'reason', value:'context_switch', source:'manual', createdAt:110 });
    await db.insertContextTag({ eventId:'e2', key:'reason', value:'interrupted', source:'manual', createdAt:210 });
    await db.insertContextTag({ eventId:'e2', key:'note', value:'ignored', source:'manual', createdAt:211 });
    const rows = await db.listReasonEvents(50);
    expect(rows.map((r) => r.eventId)).toEqual(['e2','e1']);
    expect(rows[0]?.reason).toBe('interrupted');
    expect(rows.some((r) => r.reason === 'ignored')).toBe(false);
  });
  it('drops orphan tags whose event was wiped', async () => {
    await db.insertTaskEvent(event('e1','cleaning',100));
    await db.insertContextTag({ eventId:'e1', key:'reason', value:'context_switch', source:'manual', createdAt:110 });
    await db.deleteEventsByCategory('cleaning');
    expect(await db.listReasonEvents(50)).toEqual([]);
  });
  it('honors the limit', async () => {
    for (let i = 0; i < 5; i += 1) {
      await db.insertTaskEvent(event(`e${i}`,'cleaning',i));
      await db.insertContextTag({ eventId:`e${i}`, key:'reason', value:'interrupted', source:'manual', createdAt:i });
    }
    expect(await db.listReasonEvents(2)).toHaveLength(2);
  });
});
```
Run — expect **PASS**; eslint the db files.
Commit: `feat(db): read-only reason⋈event join for Pro correlations`

> Verify the exact method names on the memory adapter (`deleteEventsByCategory`, `insertContextTag`, `insertTaskEvent`) against the current code and adjust the test if they differ.

- [ ] **Step 7 — store loader.** In `src/stores/calibrationStore.ts` add `loadReasonInsights(): Promise<ReasonInsight[]>`:
```ts
import { correlateReasons } from '@/src/engine';
import type { ReasonInsight, ReasonSample } from '@/src/domain/types';
const REASON_SCAN_LIMIT = 500;
// implementation:
  loadReasonInsights: async () => {
    const db = await resolveDb(get, set);
    const rows = await makeContextTagRepo(db).listReasonEvents(REASON_SCAN_LIMIT);
    const samples: ReasonSample[] = rows
      .filter((r) => r.actualMin !== null && r.actualMin > 0 && r.estimateMin > 0)
      .map((r) => {
        const d = new Date(r.createdAt);
        return {
          category: r.category, reason: r.reason,
          direction: (r.actualMin as number) > r.estimateMin ? 'over' : 'under',
          hour: d.getHours(), weekday: d.getDay(),
        };
      });
    return correlateReasons(samples).map((c) => ({ ...c, categoryName: detailCategoryName(c.categoryId) }));
  },
```
(The store derives `hour`/`weekday` — the engine stays clock-free. `detailCategoryName` already exists.) eslint.
Commit: `feat(store): loadReasonInsights read-only loader (S12)`

- [ ] **Step 8 — `useReasonInsights.ts`.** Thin loader hook mirroring `usePatterns`:
```ts
import { useEffect, useState } from 'react';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import type { ReasonInsight } from '@/src/domain/types';

export function useReasonInsights(): { insights: ReasonInsight[]; loading: boolean } {
  const load = useCalibrationStore((s) => s.loadReasonInsights);
  const [insights, setInsights] = useState<ReasonInsight[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void load().then((rows) => { if (active) { setInsights(rows); setLoading(false); } });
    return () => { active = false; };
  }, [load]);
  return { insights, loading };
}
```

- [ ] **Step 9 — the S12 cards + locked fallback.** Create `StealsYourTime.tsx`, `StealsYourTimeWeekly.tsx`, `StealsYourTimeLocked.tsx` per the authored section — all copy curiosity-framed ("steals/helps", never blame), all values from `useTheme()`, reusing the `PatternCard` rhythm; the locked teaser routes to the paywall. eslint the four files.
> Verify the paywall route + the analytics event name (`paywall_open` vs the existing event) against `src/app/(modals)/paywall.tsx` and `src/services/analytics.ts`; match the existing string.
Commit: `feat(patterns): "what steals your time" Pro cards + locked teaser (S12)`

- [ ] **Step 10 — wire behind `ProGate`.** In `src/app/(tabs)/patterns.tsx`, load `const { insights } = useReasonInsights();` and place, between `driftAlert` and `calibrationMap`:
```tsx
<ProGate fallback={insights.length > 0 ? <StealsYourTimeLocked /> : null}>
  <StealsYourTime insights={insights} />
  <StealsYourTimeWeekly insights={insights} />
</ProGate>
```
The teaser hides until there's a real insight to tease. eslint.
Commit: `feat(patterns): gate "what steals your time" behind ProGate`

- [ ] **Step 11 — card render + gating test.** Create `src/features/patterns/__tests__/stealsYourTime.test.tsx` asserting the empty case renders null and a populated insight renders the no-blame line + "Based on N of M". Run — expect **PASS**.
Commit: `test(patterns): cover "what steals your time" card render`

- [ ] **Step 12 — B15 note on the honest-number surfaces.** Add optional `reasonNote?: string` to `HonestSuggestionCard` + `HonestCard` (display-only second line; the number is never touched). In `useCategoryDetail.ts`, resolve the note **Pro-only** from the loaded insights at `≥ REASON_NOTE_MIN_SHARE`, else `undefined`; pass into `<HonestCard reasonNote={...} />`.

- [ ] **Step 13 — test the note is additive.** Create `src/features/category-detail/__tests__/honestCardReasonNote.test.tsx` asserting `~28` renders in both branches and the note appears only when passed. Run — expect **PASS**; eslint.
Commit: `feat(honest-number): optional reason-aware note, never overrides (B15)`

- [ ] **Step 14 — full gate + invariant pass.** `npm run lint && npm run typecheck && npm test`. Verify: `grep -n "applyLog\|upsertCategoryStat\|addReclaim" src/engine/reasons.ts` returns nothing (engine never writes); no `Date.now`/`new Date` in `reasons.ts`; cards + note Pro-gated; no-guilt copy; the honest number untouched.
Commit: `chore(patterns): verify S12/B15 invariants — read-only, pro-gated, no-guilt`

---

<!-- ============================================================ -->
<!-- PART 5 -->
<!-- ============================================================ -->

## Part 5 — Discoveries gallery

Bank each *distinct* aha into a permanent, append-only collection, surfaced on the Whenbee hub ("N things you've learned about your time", newest first). The aha **card** + `detectInsight` already ship — this adds (a) a `discoveries` table + repo + migration, (b) banking logic on the write path gated by one-per-category dedup + ≥0.4 re-fire, (c) the gallery surface. Monotonic + no-guilt: rows append-only, `discoveryCount` only rises, cards never expire.

> **MIGRATION NUMBER:** authored as "0003" — **rename to `0004` / `MIGRATIONS[3]`** when building after Part 2 (see coordination section). Likewise merge `discovery_count` into Part 2's already-extended `Companion`/`CompanionRow`/`getCompanion`/companion-literal rather than overwriting.

### Files map

**Domain/engine:** `src/domain/types.ts` (+`Discovery`, +`Companion.discoveryCount`), `src/engine/discovery.ts` (new), `src/engine/index.ts`, `src/engine/__tests__/discovery.test.ts` (new)
**DB:** `src/db/types.ts` (+`DiscoveryRow`, +`CompanionRow.discoveryCount`), `src/db/migrations.ts` (0004), `src/db/Database.ts`, `src/db/memoryDatabase.ts`, `src/db/sqliteDatabase.ts`, `src/db/repositories/discoveriesRepo.ts` (new), `companionRepo.ts` (+`incrementDiscoveryCount`), `src/db/index.ts`, `__tests__/discoveriesRepo.test.ts` (new), `__tests__/migrations.test.ts` (0004 block)
**Store:** `src/stores/calibrationStore.ts` (bank on `applyLog`, `loadDiscoveries`, `ReclaimSummary.discoveryCount`), `__tests__/calibrationStore.discoveries.test.ts` (new)
**UI:** `src/features/whenbee/DiscoveriesGallery.tsx`, `DiscoveriesPreviewCard.tsx` (new), `src/app/(modals)/discoveries.tsx` (new), `useWhenbeeHub.ts`, `WhenbeeHub.tsx`, `__tests__/discoveriesGallery.test.tsx` (new)

- [ ] **Step 1 — `Discovery` type + `discoveryCount`.** In `src/domain/types.ts` after `Insight`:
```ts
export interface Discovery {
  id: string; categoryId: string; multiplier: number;
  honestForFifteen: number; headline: string; discoveredAt: number;
}
```
Add `discoveryCount: number;` to `Companion` (merge with Part 2's fields). `tsc` is the gate (Step 13).

- [ ] **Step 2 — engine test FIRST.** Create `src/engine/__tests__/discovery.test.ts`:
```ts
import { shouldBankDiscovery } from '../discovery';
import { INSIGHT_MIN_GAP } from '../constants';

describe('shouldBankDiscovery', () => {
  it('banks the first discovery for a category', () => {
    expect(shouldBankDiscovery({ candidateMultiplier: 1.9, lastBankedMultiplier: null })).toBe(true);
  });
  it('does not re-bank when unchanged', () => {
    expect(shouldBankDiscovery({ candidateMultiplier: 1.9, lastBankedMultiplier: 1.9 })).toBe(false);
  });
  it('does not re-bank for a sub-gap move', () => {
    expect(shouldBankDiscovery({ candidateMultiplier: 2.1, lastBankedMultiplier: 1.9 })).toBe(false);
  });
  it('re-banks at exactly the gap', () => {
    expect(shouldBankDiscovery({ candidateMultiplier: 1.9 + INSIGHT_MIN_GAP, lastBankedMultiplier: 1.9 })).toBe(true);
  });
  it('re-banks well beyond the gap', () => {
    expect(shouldBankDiscovery({ candidateMultiplier: 2.5, lastBankedMultiplier: 1.9 })).toBe(true);
  });
  it('is symmetric for a downward move', () => {
    expect(shouldBankDiscovery({ candidateMultiplier: 1.4, lastBankedMultiplier: 1.9 })).toBe(true);
  });
});
```
Run — expect **FAIL**.

- [ ] **Step 3 — implement `src/engine/discovery.ts` + export.**
```ts
import { INSIGHT_MIN_GAP } from './constants';
interface ShouldBankInput { candidateMultiplier: number; lastBankedMultiplier: number | null; }
export function shouldBankDiscovery({ candidateMultiplier, lastBankedMultiplier }: ShouldBankInput): boolean {
  if (lastBankedMultiplier === null) return true;
  return Math.abs(candidateMultiplier - lastBankedMultiplier) >= INSIGHT_MIN_GAP;
}
```
Add `export { shouldBankDiscovery } from './discovery';` to `src/engine/index.ts`. Run — expect **PASS** (6 tests).

- [ ] **Step 4 — DB row type + port methods.** In `src/db/types.ts`:
```ts
export interface DiscoveryRow {
  id: string; categoryId: string; multiplier: number;
  honestForFifteen: number; headline: string; discoveredAt: number;
}
```
Add `discoveryCount: number;` to `CompanionRow` (merge with Part 2). In `src/db/Database.ts` import `DiscoveryRow` and add:
```ts
  insertDiscovery(row: DiscoveryRow): Promise<void>;
  listDiscoveries(limit: number): Promise<DiscoveryRow[]>;
  getLastDiscoveryForCategory(categoryId: string): Promise<DiscoveryRow | null>;
  incrementDiscoveryCount(): Promise<void>;
```

- [ ] **Step 5 — migration 0004 test FIRST.** Append to `src/db/__tests__/migrations.test.ts`:
```ts
describe('MIGRATIONS 0004 — discoveries gallery', () => {
  const migration0004 = MIGRATIONS[3]; // index 3 == 0004
  it('exists and is a string', () => { expect(typeof migration0004).toBe('string'); });
  it('creates the discoveries table (IF NOT EXISTS)', () => { expect(migration0004).toContain('CREATE TABLE IF NOT EXISTS discoveries'); });
  it('carries category, multiplier, headline, discovered_at', () => {
    expect(migration0004).toContain('category_id');
    expect(migration0004).toContain('multiplier');
    expect(migration0004).toContain('honest_for_fifteen');
    expect(migration0004).toContain('headline');
    expect(migration0004).toContain('discovered_at');
  });
  it('indexes newest-first + by category', () => {
    expect(migration0004).toContain('idx_discoveries_discovered_at');
    expect(migration0004).toContain('idx_discoveries_category');
  });
  it('adds companion.discovery_count', () => { expect(migration0004).toContain('ALTER TABLE companion ADD COLUMN discovery_count'); });
});
```
Run — expect **FAIL**.

- [ ] **Step 6 — implement migration 0004.** Append to `src/db/migrations.ts` (index 3):
```ts
  // 0004 — Discoveries gallery (append-only) + monotonic discoveryCount.
  `
  CREATE TABLE IF NOT EXISTS discoveries (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL,
    multiplier REAL NOT NULL,
    honest_for_fifteen REAL NOT NULL,
    headline TEXT NOT NULL,
    discovered_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_discoveries_discovered_at ON discoveries (discovered_at);
  CREATE INDEX IF NOT EXISTS idx_discoveries_category ON discoveries (category_id, discovered_at);
  ALTER TABLE companion ADD COLUMN discovery_count INTEGER NOT NULL DEFAULT 0;
  `,
```
Run — expect **PASS**.

- [ ] **Step 7 — memory adapter + repo test FIRST, then impl.** Create `src/db/__tests__/discoveriesRepo.test.ts` (port + repo round-trips: count monotonic, newest-first list, last-for-category, `list` default limit 50) per the authored section. Run — expect **FAIL**. Then in `src/db/memoryDatabase.ts` add `const discoveries = new Map<string, DiscoveryRow>();`, add `discoveryCount: 0` to the companion literal (merge with Part 2's literal), and implement `insertDiscovery`/`listDiscoveries`/`getLastDiscoveryForCategory`/`incrementDiscoveryCount`. Run — expect **PASS** (6 tests).

- [ ] **Step 8 — sqlite adapter.** In `src/db/sqliteDatabase.ts` add `DiscoveryDbRow` + `mapDiscovery`, add `discovery_count` to `CompanionDbRow` + the `getCompanion` SELECT (merge with Part 2), and implement the four methods (INSERT, `ORDER BY discovered_at DESC LIMIT ?`, last-for-category, `discovery_count + 1`). No new jest run (sqlite excluded); `tsc` is the gate.

- [ ] **Step 9 — repos + barrel.** Create `src/db/repositories/discoveriesRepo.ts` (`makeDiscoveriesRepo` with `bank` = insert + increment, `list(limit=50)`, `lastForCategory`); add `incrementDiscoveryCount` to `companionRepo.ts`; export `makeDiscoveriesRepo`/`DiscoveriesRepo`/`DiscoveryRow` from `src/db/index.ts`. Run `npx jest src/db` — expect **PASS**.

- [ ] **Step 10 — store banking test FIRST.** Create `src/stores/__tests__/calibrationStore.discoveries.test.ts` (banks exactly one on first qualifying insight; dedups on repeats; re-banks on ≥0.4 move; `loadDiscoveries` newest-first + count) per the authored section. Run — expect **FAIL**.

- [ ] **Step 11 — bank in `applyLog` + `loadDiscoveries` + `ReclaimSummary.discoveryCount`.** Reuse the existing `detectInsight` call on the write path. Compute `insight` once; **before** the fire-and-forget `try` block, when `insight` is non-null: `const last = await discoveriesRepo.lastForCategory(input.category)`; if `shouldBankDiscovery({ candidateMultiplier: insight.multiplier, lastBankedMultiplier: last?.multiplier ?? null })`, `await discoveriesRepo.bank({ id: makeId(nowMs), ...insight, discoveredAt: nowMs })`. Keep `analytics.capture('discovery_unlocked', …)` and the existing `aha_shown` beat inside the `try`. Do not swallow the bank write. Add `discoveryCount` to `ReclaimSummary` (from `companion.discoveryCount`) and add `loadDiscoveries()` returning `{ discoveries, discoveryCount }`. Run — expect **PASS**; re-run `npx jest src/stores`.
Commit (after Steps 1–11, or commit per group): `feat(discoveries): bank distinct ahas into a monotonic gallery (engine+db+store)`

- [ ] **Step 12 — gallery UI.** Per the authored section: `DiscoveriesGallery.tsx` (FlatList, memoized row, invitational empty state, dark/indigo card language from tokens), `DiscoveriesPreviewCard.tsx` (count + first 3, tap → modal), `src/app/(modals)/discoveries.tsx` (thin route loading via `loadDiscoveries`), wire `useWhenbeeHub.ts` to expose `discoveries`/`discoveryCount` (load on focus), and render `DiscoveriesPreviewCard` in `WhenbeeHub.tsx` between the Reclaim hero and blind-spot, only when `discoveryCount > 0`. Write `__tests__/discoveriesGallery.test.tsx` (empty state + newest-first render) FIRST. Run `npx jest src/features/whenbee` — expect **PASS**. Screenshot-verify on the sim (log ≥6 over-runs in one category → preview card → gallery; check dark mode + empty state).

- [ ] **Step 13 — full gate + commit.** `npm run typecheck && npx eslint src/engine/discovery.ts src/db src/stores/calibrationStore.ts src/features/whenbee 'src/app/(modals)/discoveries.tsx' && npx jest src/engine src/db src/stores src/features/whenbee`. All green.
Commit: `feat(discoveries): gallery surface on the Whenbee hub`

---

<!-- ============================================================ -->
<!-- PART 6 -->
<!-- ============================================================ -->

## Part 6 — Share with coach/partner

Fulfills the existing paywall benefit "Share an honest plan with a partner or coach in a tap" (`Paywall.tsx:42`) — currently a promise with no implementation. Delivers a real **on-device** share: render a Whenbee-styled summary image locally and hand it to the iOS share sheet. No upload, no account, no network (privacy invariant holds). Pro-gated. Two surfaces: the Start-By plan and the time archetype.

### Files map

| Path | Action |
|---|---|
| `package.json` | edit (`expo install`) — `expo-sharing`, `react-native-view-shot` |
| `src/services/share.ts` + `__tests__/share.test.ts` | new — guarded share service |
| `src/services/analytics.ts` | edit — `plan_shared` event |
| `src/components/ShareableCard.tsx` | new — tokenized capture card (plan + archetype) |
| `src/features/share/useShareCard.ts` + `__tests__/useShareCard.test.ts` | new — gate → capture → share |
| `src/app/(tabs)/plan.tsx` | edit — Share button + off-screen card |
| `src/features/patterns/Archetype.tsx` | edit — Share button + off-screen card |
| `src/theme/tokens.ts` | edit — `size.shareCard`, `size.timelineCol` |

- [ ] **Step 1 — install native deps.**
```bash
npx expo install expo-sharing react-native-view-shot
npx expo-doctor
```
Expected: both added to `dependencies` (SDK-54-compatible); doctor `18/18`.
Commit: `build: add expo-sharing and react-native-view-shot for on-device share`

- [ ] **Step 2 — `plan_shared` analytics (additive).** In `src/services/analytics.ts` under the Monetization block:
```ts
  plan_shared: { surface: 'plan' | 'archetype'; is_pro: boolean; result: 'shared' | 'gated' | 'error' };
```
Add a funnel assertion in `src/services/__tests__/analytics.funnel.test.ts`. Run that test — expect **PASS**.
Commit: `feat(analytics): add plan_shared event for on-device share`

- [ ] **Step 3 — guarded `share.ts` (test FIRST).** Create `src/services/__tests__/share.test.ts` (stub in Expo Go; native on dev build reports `shared`; `unavailable` when sheet missing; never rejects → `error`) per the authored section. Run — expect **FAIL**. Then implement `src/services/share.ts`:
```ts
import { isExpoGo } from '@/src/lib/isExpoGo';
export type ShareResult = 'shared' | 'unavailable' | 'error';
export interface ShareNativeModule {
  isAvailableAsync: () => Promise<boolean>;
  shareAsync: (url: string, options?: Record<string, unknown>) => Promise<void>;
}
export interface ShareModule { isStub: boolean; share: (fileUri: string) => Promise<ShareResult>; }
const stub: ShareModule = { isStub: true, share: async () => 'unavailable' };
function createNative(native: ShareNativeModule): ShareModule {
  return {
    isStub: false,
    share: async (fileUri: string): Promise<ShareResult> => {
      try {
        if (!(await native.isAvailableAsync())) return 'unavailable';
        await native.shareAsync(fileUri, { mimeType: 'image/png', dialogTitle: 'Share your honest plan', UTI: 'public.png' });
        return 'shared';
      } catch { return 'error'; }
    },
  };
}
export function resolveShareModule(expoGo: boolean, loadNative: () => ShareNativeModule): ShareModule {
  return expoGo ? stub : createNative(loadNative());
}
const loadNativeSharing = (): ShareNativeModule =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('expo-sharing') as ShareNativeModule;
let cached: ShareModule | null = null;
export function getShare(): ShareModule {
  if (!cached) cached = resolveShareModule(isExpoGo, loadNativeSharing);
  return cached;
}
```
Run — expect **PASS** (4 tests); eslint.
Commit: `feat(services): guarded on-device share service wrapping expo-sharing`

- [ ] **Step 4 — `ShareableCard.tsx` + size tokens.** Add `size.shareCard: 340` and `size.timelineCol: 110` to `src/theme/tokens.ts` (and retrofit `PlanTimeline.tsx`'s `minWidth: 110` to `t.size.timelineCol`). Create `src/components/ShareableCard.tsx` (a `forwardRef` `View`, `collapsable={false}`, two variants `plan`/`archetype`, all values from tokens, footer "Made with Whenbee · learned on-device") per the authored section. **No service/store imports** (component boundary). eslint the three files.
Commit: `feat(ui): ShareableCard for on-device share images; tokenize share/timeline sizes`

- [ ] **Step 5 — `useShareCard` (test FIRST).** Create `src/features/share/__tests__/useShareCard.test.ts` testing the pure `runShareFlow` (non-Pro → gate, no capture/share, `result:'gated'`; Pro → capture + share, `result:'shared'`; empty ref → nothing; capture throws → `result:'error'`, never rejects). Run — expect **FAIL**. Then implement `src/features/share/useShareCard.ts` with the injectable `runShareFlow` + the `useShareCard(surface)` hook (uses `useEntitlement.isPro`, routes free users to `/(modals)/paywall?trigger=settings_upgrade`, captures via `react-native-view-shot`, shares via `getShare()`, fires `plan_shared`). Run — expect **PASS** (4 tests); eslint.
> Verify the paywall route path + `trigger` param against `src/app/(modals)/` before finalizing the `router.push` literal.
Commit: `feat(share): Pro-gated useShareCard flow (capture off-screen card, share on-device)`

- [ ] **Step 6 — wire the Start-By plan share.** In `src/app/(tabs)/plan.tsx` add `const planShare = useShareCard('plan');`, a ghost "Share this plan" `AppButton` in the result row, an off-screen `<ShareableCard ref={planShare.ref} data={planShareData(result, draft.deadline)} />` (absolute, `left:-9999`, `pointerEvents="none"`) when a result exists, and the `planShareData` mapper (focal = `feasibleDeadline` for push-deadline else `startBy`). `npx eslint src/app/(tabs)/plan.tsx && npm run typecheck`.
Commit: `feat(planner): share the Start-By plan via on-device share sheet (Pro)`

- [ ] **Step 7 — wire the archetype share.** In `src/features/patterns/Archetype.tsx` add `const archetypeShare = useShareCard('archetype');`, a ghost "Share my archetype" button, and the off-screen `<ShareableCard ref={archetypeShare.ref} data={{ kind:'archetype', title, blurb, averageMultiplier }} />` (match the file's actual prop names). eslint + typecheck.
Commit: `feat(patterns): share the time archetype via on-device share sheet (Pro)`

- [ ] **Step 8 — sharpen the paywall benefit copy.** Update `Paywall.tsx:42` to the concrete line: `'Send your honest plan or time profile to a coach or partner — one tap, stays on your phone.'` eslint.
Commit: `copy(paywall): sharpen the share benefit now that on-device share ships`

- [ ] **Step 9 — full gate + device verify.** `npm run lint && npm run typecheck && npm test` (new: `share.test.ts` 4, `useShareCard.test.ts` 4, funnel assertion). Then `npm run ios`, build a plan as Pro → "Share this plan" → confirm the iOS share sheet shows a Whenbee-styled PNG; `xcrun simctl io booted screenshot /tmp/whenbee-share.png`; critique alignment. Confirm non-Pro tap opens the paywall (no capture) + `plan_shared {result:'gated'}`. If layout tweaks needed, commit `fix(ui): align share card …`.

### Invariant checklist (must all hold)
On-device only (no network); Expo-Go-safe (stub `unavailable`, never throws); Pro-gated (entry point visible, action gated); no guilt / no fabricated numbers; tokens only; layer rules (component imports no service/store; orchestration in `src/features/share/`); TDD for service + flow.

---

## Final integration & verification (after all 6 parts)

- [ ] **Full CI-parity gate.** `npm run lint && npm run typecheck && npm test` — all green.
- [ ] **Migrations sequential + clean upgrade.** Confirm `MIGRATIONS` = `[0001, 0002, 0003 (companion fuel), 0004 (discoveries)]`, indices `0..3`, none reordered. On a device build, launch over an existing install and confirm no migration crash (companion columns + discoveries table apply).
- [ ] **`Companion`/`CompanionRow` final shape** carries all fields from Parts 2 + 5; `getCompanion` SELECT lists every column; the memory companion literal initializes all of them.
- [ ] **Device smoke (dev build):** widget + Live Activity live (Part 1); companion shows 6 stages + Keeper + capability copy, no red, reduce-motion safe (Part 2); category detail shows range→tight + graduation, paywall readiness headline + founder reserve (Part 3); "what steals your time" cards appear for Pro with captured reasons, locked teaser for free, B15 note never moves the number (Part 4); discoveries bank + gallery (Part 5); share sheet produces an on-device PNG, gated for free (Part 6).
- [ ] **Invariant sweep:** no streaks/decay/guilt; amber-never-red; honey + companion + reclaim + discoveryCount monotonic; core loop has no network call; all prices from `priceString`; no AI/co-author trailers in any commit.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-15-whenbee-full-launch.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration. Build Parts 1→6 in order; the device-only steps (Part 1.5, screenshot checks) run on a real build between subagent batches.
2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
