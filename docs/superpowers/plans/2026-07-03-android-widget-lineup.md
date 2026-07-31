# Android Widget Lineup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Turn the single, static "next task" Android widget into a small **family** of genuinely-useful, live-updating home-screen widgets that lead with Whenbee's unique calibration data — per the approved strategy in `docs/product/12-WIDGET-STRATEGY.md`.

**Scope (this branch = Android only).** iOS WidgetKit parity is a separate effort (needs a paid Apple team to device-test) and is out of scope here. Ships three Android widgets:
1. **Honest Finish** (free) — the existing widget, made to actually update (broadened triggers) + polished content.
2. **Does Today Fit?** (Pro) — day-capacity verdict; reuses the existing `honestDayLoad` engine.
3. **Your Bias** (Pro) — the standout per-category multiplier + honey tier.

**Architecture.** Generalize the native write path from the single `writeWidgetSnapshot(json)` to **`writeWidgetData(key, json)` / `clearWidgetData(key)`** (keys: `nextTask`, `capacity`, `bias`) so each widget has its own decoupled SharedPreferences slice + its own JS publisher + update triggers. Each widget is a native RemoteViews `AppWidgetProvider` in the existing `modules/whenbee-presence` module. JS publishing lives in small dedicated hooks that subscribe to the right stores. Pro widgets gate value **and** marker (no pro-gate leak).

**Tech Stack:** Expo SDK 54, RN 0.81.5, TypeScript (strict), Kotlin (Expo module, RemoteViews), Jest. `androidx.core 1.17.0` already pinned.

## Global Constraints

- **Reuse existing contracts / logic — never re-derive.** `honestDayLoad` (`src/engine/honestDayLoad.ts`), `useDayCapacity` (`src/features/today/useDayCapacity.ts`), `resolveSuggestion`/`honestNumber` (`src/engine/multiplier.ts`), `tierFor` (`src/engine/sharpness.ts`), `statsByCategory` (`src/stores/calibrationStore.ts`), `formatClock`/`projectedFinish` (`src/lib/time.ts`), `categoryName` pattern (`src/features/today/useToday.ts:70`). Import them.
- **Presence is best-effort.** Every publish/native call is fire-and-forget in a `swallow`/try-catch; a widget failure must never throw into the guess→timer→learn loop.
- **On-device-only core loop; no network.** All widget data computed locally.
- **Pro gating gates value AND marker** — a free user must see neither the Pro number nor its position/track. Audit the free render path per task.
- **Invariants:** no guilt, no streaks, amber-never-red. Capacity "over" is informational, never a scold (no red, no "you're failing").
- **RemoteViews only supports whitelisted views** (FrameLayout/LinearLayout/RelativeLayout/TextView/ImageView/ProgressBar/Chronometer…). A bare `<View>` ⇒ "Can't load widget". No custom views.
- **Theme values** mirror `src/theme/tokens.ts` hex as named constants in the widget layouts (the RemoteViews process can't use `useTheme`), with a comment naming the token. Existing widget uses: surface `#1F2130`, ink `#F4F1EA`, inkSoft `#ADA9B5`, accent `#EEAE4D`, surfaceSunken `#15161F`.
- **Layer rule (ESLint):** widget publishing lives in `src/features/*` hooks / `src/services/*`; no `src/services`/`src/db` imports from `src/app`/`src/components`.
- **Conventional Commits. NO AI/co-author attribution in any commit or PR.**
- **Run `npm run lint && npm run typecheck && npx jest <changed suites>` before every commit; `npm test` before the device build.**

---

## File Structure

**New (JS/TS):**
- `src/services/presence/widgetData.ts` — thin JS API `publishWidgetData(key, payload)` / `clearWidgetData(key)` routed through the native module (mirrors the existing `publishWidgetSnapshot` guards).
- `src/features/today/useWidgetPublisher.ts` — one hook, mounted once, that subscribes to the stores and publishes all three widget payloads on the right triggers.
- Types for the two new payloads (in `src/services/presence/widgetData.ts` or alongside `WidgetSnapshot` in `liveActivity.ts`).

**New (Kotlin, in `modules/whenbee-presence/android/`):**
- `DoesTodayFitWidgetProvider.kt`, `YourBiasWidgetProvider.kt` (+ their `res/layout/*.xml`, `res/xml/*_info.xml`, `res/values` strings, preview drawables).
- Generalized `writeWidgetData`/`clearWidgetData` Functions in `WhenbeePresenceModule.kt`; a shared `WidgetDataStore` object (SharedPreferences per-key) refactored out of the existing provider path.

**Modified:**
- `modules/whenbee-presence/android/.../WhenbeePresenceModule.kt` — add generic write/clear; keep the notification Functions.
- `modules/whenbee-presence/android/.../NextTaskWidgetProvider.kt` — read from the new keyed store (key `nextTask`).
- `modules/whenbee-presence/android/src/main/AndroidManifest.xml` — add the two new receivers.
- `src/services/presence/createAndroidPresence.ts` (+ test) — expose `writeWidgetData`/`clearWidgetData` on the module surface.
- `src/services/presence/androidPresence.android.ts` — wire the new native Functions.
- `src/services/liveActivity.ts` — `NativePresenceModule` gains `writeWidgetData`/`clearWidgetData`; keep `writeSnapshot` delegating to `writeWidgetData('nextTask', …)` for back-compat, OR migrate call sites (see Task 2).
- `src/features/today/useToday.ts` — mount `useWidgetPublisher` (or move the existing publish into it).
- `docs/NATIVE-PRESENCE.md` — document the widget family + keyed store.

**Tests:**
- `src/services/presence/__tests__/createAndroidPresence.test.ts` (extend for writeWidgetData/clearWidgetData).
- `src/features/today/__tests__/useWidgetPublisher.test.ts` (publish triggers, guards, Pro gating of payload).
- Any engine helper added (e.g. a `pickTopBiasCategory` selector) gets its own pure test.

---

## Phase 1 — Honest Finish updates for real (free)

### Task 1: Generic keyed native write path — `writeWidgetData`/`clearWidgetData` (TDD on the JS factory)

**Files:** `src/services/liveActivity.ts` (interface), `src/services/presence/createAndroidPresence.ts` + test, `src/services/presence/androidPresence.android.ts`, `modules/whenbee-presence/android/.../WhenbeePresenceModule.kt`, a new `WidgetDataStore.kt`, `NextTaskWidgetProvider.kt` (read keyed store).

**Interfaces:**
- `NativePresenceModule` gains `writeWidgetData(key: string, json: string): void` and `clearWidgetData(key: string): void`.
- Kotlin: `Function("writeWidgetData") { key: String, json: String -> WidgetDataStore.write(context, key, json); <update the matching provider> }`, `Function("clearWidgetData") { key: String -> … }`. `WidgetDataStore` = SharedPreferences file `"<pkg>.presence"`, one key per widget (`widget.<key>`), with a guarded read returning `null`.
- Back-compat: keep `writeSnapshot(snapshot)` → internally `writeWidgetData('nextTask', JSON.stringify(snapshot))` so nothing else breaks this task.

- [ ] Step 1: Extend the `createAndroidPresence` test — assert `writeWidgetData(key, json)` forwards to `notif.writeWidgetData` and `clearWidgetData(key)` forwards; null-notif no-ops; a throwing dep is swallowed.
- [ ] Step 2: Run it → FAIL.
- [ ] Step 3: Add `writeWidgetData`/`clearWidgetData` to the `NativePresenceModule` interface + `createAndroidPresence` factory (forward to `deps.notif?.writeWidgetData(...)`), and to the `NotifModule` type + `androidPresence.android.ts` wiring.
- [ ] Step 4: Kotlin — add `WidgetDataStore.kt` (keyed SharedPreferences), the two Functions, and repoint `NextTaskWidgetProvider` to read `WidgetDataStore.read(ctx, "nextTask")`. `writeWidgetData("nextTask", …)` triggers `NextTaskWidgetProvider.updateAll`. Compile: `./gradlew :whenbee-presence:compileReleaseKotlin` → BUILD SUCCESSFUL.
- [ ] Step 5: Run the JS tests → PASS; `npm run typecheck` + eslint clean.
- [ ] Step 6: Commit `feat(widgets): generic keyed writeWidgetData native path`.

### Task 2: `useWidgetPublisher` — broaden the Honest Finish triggers (TDD)

**Files:** Create `src/services/presence/widgetData.ts` (`publishWidgetData`/`clearWidgetData` guarded JS wrappers), `src/features/today/useWidgetPublisher.ts`, test `src/features/today/__tests__/useWidgetPublisher.test.ts`; modify `src/features/today/useToday.ts` to mount the publisher and REMOVE its inline `publishWidgetSnapshot` effect (moved into the hook).

**Interfaces:**
- `useWidgetPublisher()` — mounted once (in `useToday` or the Today screen). Subscribes reactively to: `focus` + `honestMin` (next task), `useTimerStore(s => s.isRunning)`, `useEntitlement(s => s.isPro)`, and `useCalibrationStore(s => s.statsByCategory[focus?.category]?.mEffective)`. On any change, republishes the `nextTask` payload (existing `WidgetSnapshot` shape) via `publishWidgetData('nextTask', snapshot)`; clears when no focus.
- Keeps the existing `WidgetSnapshot` fields; `isPro` now read **reactively** so a purchase lights the widget immediately.

- [ ] Step 1: Write the failing test — mock the stores + `publishWidgetData`; assert republish fires on focus change, honestMin change, timer start/stop, entitlement change, and mEffective change; assert `clearWidgetData('nextTask')` when focus is null; assert a throw in publish never escapes.
- [ ] Step 2: Run → FAIL.
- [ ] Step 3: Implement `widgetData.ts` (guarded wrappers) + `useWidgetPublisher` with the broadened subscriptions; move the snapshot construction out of `useToday` into the hook (reuse `honestFor`, `categoryName`, `formatClock`, `projectedFinish`).
- [ ] Step 4: Run → PASS; ensure existing `liveActivity`/`useToday` tests still pass (`npx jest src/features/today src/services`).
- [ ] Step 5: `npm run typecheck` + eslint clean.
- [ ] Step 6: Commit `feat(widgets): live-updating Honest Finish via useWidgetPublisher`.

---

## Phase 2 — Does Today Fit? widget (Pro)

### Task 3: Capacity payload + publisher (TDD)

**Files:** add a `capacity` payload type + `publishCapacity()` to `useWidgetPublisher.ts` (or a sibling `useCapacityWidgetPublisher.ts`); test.

**Interfaces:**
- Payload `CapacityWidgetData = { verdict: 'comfortable'|'snug'|'over'; plannedMin: number; windowMin: number; overByMin: number; slackMin: number; updatedAtEpoch: number; isPro: boolean }`.
- Source: the existing `useDayCapacity()` hook (`load: DayLoadResult` with `taskMin/committedMin/freeMin/openMin/verdict/overByMin`). Map its result → `CapacityWidgetData`. Publish on the hook's result change + `isPro`. When not Pro, still publish `{ isPro:false }` so the widget shows a locked state (see Task 5) — but with NO real numbers in the payload (gate the value at the source, not just the view).

- [ ] Step 1: Failing test — given a mocked `useDayCapacity` result, assert `publishWidgetData('capacity', mappedPayload)` fires with the right verdict/slack/overBy; assert that when `isPro` is false the payload carries no real minutes (only `{ isPro:false, verdict:'comfortable' as neutral }` or an explicit locked sentinel).
- [ ] Step 2: Run → FAIL.
- [ ] Step 3: Implement the mapping + publish. Reuse `useDayCapacity`; do not recompute capacity.
- [ ] Step 4: Run → PASS; typecheck + eslint.
- [ ] Step 5: Commit `feat(widgets): day-capacity widget payload + publisher`.

### Task 4: `DoesTodayFitWidgetProvider` (native RemoteViews, Pro)

**Files:** `DoesTodayFitWidgetProvider.kt`, `res/layout/widget_does_today_fit.xml`, `res/xml/does_today_fit_info.xml`, strings, preview drawable; `WhenbeePresenceModule.writeWidgetData('capacity', …)` triggers its `updateAll`; `AndroidManifest.xml` receiver.

**Interfaces:** reads `WidgetDataStore.read(ctx, "capacity")`; renders:
- Verdict line — **"Your day fits — ~40 min slack"** (comfortable/snug) / **"Runs ~25 min long"** (over) — computed from slackMin/overByMin. Never red; "over" uses the accent/ink, not a warning color.
- A slim capacity bar (ProgressStyle-style horizontal `ProgressBar`, `committedMin/windowMin`).
- **Pro gate:** if `!isPro` (or the locked sentinel), render a quiet locked state — *"Does today fit? — Pro"* — with NO bar and NO numbers (gate value+marker). Tap → paywall deep link.

- [ ] Step 1: Build the provider + layout + manifest receiver + info xml + strings + preview. Kotlin verdict/slack text from the payload; guarded JSON parse → locked state on null.
- [ ] Step 2: `npx expo prebuild -p android` + `./gradlew :whenbee-presence:compileReleaseKotlin :app:processDebugResources` → BUILD SUCCESSFUL; confirm the receiver merges into the app manifest.
- [ ] Step 3: Commit `feat(widgets): Does Today Fit native widget (Pro-gated)`.

### Task 5: Wire capacity publisher into the app + Pro-gate audit

**Files:** mount the capacity publisher where `useDayCapacity` is available (Today/planner); ensure the free path publishes only the locked sentinel.

- [ ] Step 1: Mount the publisher; verify (unit) the free path never emits real capacity numbers into the payload.
- [ ] Step 2: `npm test` (full) green; typecheck + eslint.
- [ ] Step 3: Commit `feat(widgets): publish day-capacity from Today; free path locked`.

---

## Phase 3 — Your Bias widget (Pro)

### Task 6: Top-bias selector + payload (TDD)

**Files:** `src/engine/widgetBias.ts` — a pure `pickTopBias(statsByCategory)` returning `{ categoryId, multiplier, tier } | null` (most-notable = highest sample-backed |multiplier−1|, tie-break by sampleSize; only categories with `basis:'personal'` / n≥min qualify). Test `src/engine/__tests__/widgetBias.test.ts`. Add the publish to the publisher.

**Interfaces:** `BiasWidgetData = { categoryLabel: string; multiplierText: string; tier: string; isPro: boolean; updatedAtEpoch: number }` — e.g. `{ categoryLabel:'Deep Work', multiplierText:'1.4× over', tier:'Ripening', isPro:true }`. `multiplierText` formatted in JS.

- [ ] Step 1: Failing test for `pickTopBias` (picks the most-notable personal category; returns null when none qualify; ignores prior-only categories).
- [ ] Step 2: Run → FAIL.
- [ ] Step 3: Implement `pickTopBias` (pure); reuse `tierFor`. Add `publishWidgetData('bias', payload)` to the publisher, on `statsByCategory` change + `isPro`.
- [ ] Step 4: Run → PASS; typecheck + eslint.
- [ ] Step 5: Commit `feat(widgets): top-bias selector + Your Bias payload`.

### Task 7: `YourBiasWidgetProvider` (native RemoteViews, Pro)

**Files:** `YourBiasWidgetProvider.kt`, `res/layout/widget_your_bias.xml`, `res/xml/your_bias_info.xml`, strings, preview; manifest receiver; `writeWidgetData('bias', …)` → its `updateAll`.

**Interfaces:** reads `WidgetDataStore.read(ctx, "bias")`; renders **"Deep Work"** + **"you run 1.4× over"** + a subtle tier mark. Pro gate → locked *"Your bias — Pro"* with no number. Empty (no qualifying category) → quiet *"Keep logging to learn your bias."* Tap → Patterns (or paywall when locked).

- [ ] Step 1: Build provider + layout + manifest + info + strings + preview; guarded parse → empty/locked states.
- [ ] Step 2: prebuild + `compileReleaseKotlin` + `processDebugResources` → BUILD SUCCESSFUL; receiver merged.
- [ ] Step 3: Commit `feat(widgets): Your Bias native widget (Pro-gated)`.

---

## Phase 4 — Ship & verify

### Task 8: Full gate + device build + on-device verify

- [ ] Step 1: `npm run lint && npm run typecheck && npm test` all green.
- [ ] Step 2: Clear metro cache (`rm -rf ~/.tmp/metro-cache`) + `npx expo prebuild --clean -p android` + `assembleRelease` from the worktree; `adb install`. (The `whenbee-device` android script wraps this.)
- [ ] Step 3: On the Pixel — add all three widgets from the picker. Honest Finish updates when a task completes / timer starts / Pro unlocks. Does Today Fit? shows the verdict + slack, locked state for free. Your Bias shows the top category multiplier, locked for free. Tap actions route correctly.
- [ ] Step 4: Fix anything found; re-verify.

### Task 9: Docs

- [ ] Update `docs/NATIVE-PRESENCE.md` — the widget family, the keyed `WidgetDataStore`, per-widget update triggers, and the Pro gating. Mark `docs/product/12-WIDGET-STRATEGY.md` Tier-1/Tier-2 Android items as built.
- [ ] Commit `docs(widgets): document the Android widget family`.

---

## Self-Review checklist
- **Spec coverage:** W2 Honest Finish (live) = Phase 1; W3 Does Today Fit = Phase 2; W4 Your Bias = Phase 3; W1 Live Focus already shipped (notification). Free/Pro split honored (Honest Finish free; Does-Today-Fit + Your-Bias Pro, gated value+marker).
- **No re-derivation:** capacity via `honestDayLoad`/`useDayCapacity`; bias via `statsByCategory`+`tierFor`; time via `src/lib/time.ts`. Flag any duplicate logic.
- **Pro-gate leak:** each Pro widget's FREE render path must emit neither number nor marker — audited in Tasks 4/5/7 with the payload gated at the source.
- **Invariants:** no red/guilt in capacity "over"; no streaks; on-device only.
- **iOS:** intentionally deferred (separate paid-team branch) — note in the PR.
