# Persistent Presence — Rich Widget + Live Activity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the scaffolded `WhenbeePresence` feature so the Home-screen widget and the running-timer Live Activity render real, live data with a Pro finish-time ring — turning today's placeholder-only native surfaces into the product's re-engagement channel.

**Architecture:** The JS app stays the source of truth and pre-formats every string; the native widgets are presentation-only. JS writes a `WidgetSnapshot` into the App Group and starts/updates/ends an ActivityKit Live Activity through a guarded bridge (`src/services/liveActivity.ts`). This plan (a) extends the already-agreed payload with two fields (`honestFinishEpoch`, `isPro`) and the Live-Activity `ContentState` with `isProRich`, (b) adds one pure formatting helper (`arcFraction`), (c) refines the two Swift widget files to render the ring + WB color set gated on `isPro`/`isProRich`, and (d) creates the missing native Expo module that makes the bridge's no-ops real. Free content is never degraded; Pro buys the richer presence only.

**Tech Stack:** TypeScript (engine + RN), Expo SDK 54, `react-native-purchases` (entitlement, guarded), WidgetKit + ActivityKit (Swift, iOS 16.2+), `@bacons/apple-targets` (widget target), `expo-modules-core` (native module), `react-native-svg` (in-app teaser ring).

**Spec:** `docs/product/specs/05-persistent-presence.md`. **Read first:** `docs/NATIVE-PRESENCE.md`.

## Global Constraints

- **No-guilt invariant:** no red anywhere. Overrun uses amber `WBAccent`/`WBAccentEdge`, never `colors.danger`. No danger color is added to the widget catalog. No streaks, no shame copy.
- **Off the core loop:** every presence write is fire-and-forget and a clean no-op in Expo Go / tests / a pre-link binary (`getNativePresence().isStub`). The guess → timer → learn loop must never break for a widget write.
- **Presentation-only widgets:** the Swift side never computes the honest number; JS pre-formats every string. The only math Swift does is `arcFraction` (mirrored from the TS formula).
- **On-device only:** App Group payload carries only task label, category name, a clock string, a deep link, reclaim minutes, the Pro flag, and two epochs. No PII, no network, no calendar.
- **Copy rules:** no em-dash, no rule-of-three, no AI vocab, no guilt language. Exact strings come from spec §10.
- **Tokens are law:** widget asset colors are copied verbatim from `src/theme/tokens.ts` (spec §5.1). RN components use `useTheme()` tokens only — no raw hex / numbers.
- **iOS deployment floor:** widget + module target iOS **16.2** (Live Activities need 16.1+; `@available(iOS 16.2, *)` guards on all ActivityKit calls).
- **Never merge:** open a PR and stop. The founder reviews and merges every PR by hand.
- **Verify before commit:** `npm run lint` (0 warnings), `npm run typecheck`, `npx jest <changed>` green before every commit. Swift is verified by Xcode build + SwiftUI Previews (Tasks 6–10) and a physical-device pass (Task 13) — it cannot be verified in CI/simulator.

### Resolved open questions (from spec §13)

1. **Rich/minimal Live-Activity split** → carried in `ContentState.isProRich` (self-contained, survives updates).
2. **`widget_added {surface:'home'}` timing** → JS one-shot the first time `presenceAvailable()` is true and a snapshot is written this session (no Swift→JS back-channel).
3. **Mid-session arc refresh** → none. Digits tick live via `Text(timerInterval:)`; the arc steps only on start + overrun-flip.
4. **Asset-catalog generation** → commit `targets/widget/Assets.xcassets` directly (do not rely on plugin generation); verify it survives `prebuild`.
5. **Stale threshold** → `kStaleSeconds = 6 * 3600`.

### Out of scope (explicit, do not build here)

- **Real "reclaimed today" sum:** `reclaimTodayMin` stays `0` from `useToday` for now (no per-day reclaim aggregation exists yet). The Pro evening "got ahead" state stays dormant until a follow-up wires a today-reclaim source. The widget code path for it is still built and gated, so wiring it later is a one-line change.
- **Android presence, StandBy, Control Center, Lock-Screen accessory widgets.**

---

## File Structure

**New files**
- `src/engine/presence.ts` — pure `arcFraction` helper.
- `src/engine/__tests__/presence.test.ts` — TDD for `arcFraction`.
- `modules/whenbee-presence/expo-module.config.json` — declares the iOS module.
- `modules/whenbee-presence/ios/WhenbeePresenceModule.swift` — the 5-method Expo module.
- `modules/whenbee-presence/ios/FinishTimeAttributes.swift` — byte-identical copy of the activity attributes.
- `targets/widget/Assets.xcassets/` — WB* color set.
- `src/components/PresenceRingTeaser.tsx` — RN Svg static ring for the Settings teaser.

**Modified files**
- `src/services/liveActivity.ts` — payload + attribute fields, `isProRich`, `presenceAvailable()`, `home`-surface one-shot.
- `src/services/liveActivity.test.ts` (or existing test file) — `presenceAvailable` + signature tests.
- `src/features/today/useToday.ts` — add `honestFinishEpoch` + `isPro` to the snapshot call.
- `src/features/timer/useTimer.ts` — pass entitlement → `isProRich`.
- `src/services/analytics.ts` — add `'persistent_presence'` trigger.
- `targets/widget/SharedStore.swift` — `honestFinishEpoch?` + `isPro?`, `arcFraction`, `kStaleSeconds`.
- `targets/widget/NextTaskWidget.swift` — WB colors, medium ring, gating, `#Preview`.
- `targets/widget/FinishTimeActivity.swift` — Pro ring, `isProRich` gate, WB colors, overrun keyline, copy fix, `#Preview`.
- Settings screen + boot reconcile path.

---

## Task 1: `arcFraction` pure engine helper

**Files:**
- Create: `src/engine/presence.ts`
- Test: `src/engine/__tests__/presence.test.ts`
- Modify: `src/engine/index.ts` (add export)

**Interfaces:**
- Produces: `arcFraction(updatedAtEpoch: number, honestFinishEpoch: number, nowSec: number): number` — clamped `[0,1]`.

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/__tests__/presence.test.ts
import { arcFraction } from '@/src/engine';

describe('arcFraction', () => {
  const start = 1_000;
  const finish = 2_000; // 1000s window

  it('returns 0 before the window starts', () => {
    expect(arcFraction(start, finish, 500)).toBe(0);
  });

  it('returns 0 at the start of the window', () => {
    expect(arcFraction(start, finish, start)).toBe(0);
  });

  it('returns 0.5 at the halfway point', () => {
    expect(arcFraction(start, finish, 1_500)).toBeCloseTo(0.5, 5);
  });

  it('returns 1 at the honest finish', () => {
    expect(arcFraction(start, finish, finish)).toBe(1);
  });

  it('returns 1 past the honest finish', () => {
    expect(arcFraction(start, finish, 5_000)).toBe(1);
  });

  it('returns 1 for a degenerate window (finish == updatedAt) to avoid divide-by-zero', () => {
    expect(arcFraction(start, start, start)).toBe(1);
  });

  it('returns 0 for a negative span (finish before updatedAt)', () => {
    expect(arcFraction(2_000, 1_000, 1_500)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/engine/__tests__/presence.test.ts`
Expected: FAIL with "arcFraction is not a function" (or import undefined).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/engine/presence.ts
//
// Pure presentation helper for the persistent-presence surfaces (widget +
// Live Activity ring). No calibration math here — this only turns the three
// epochs in the App-Group snapshot into a [0,1] arc fraction. The SAME formula
// is mirrored in targets/widget/SharedStore.swift (`arcFraction`) so the static
// widget arc and the live ring agree. Keep the two in sync.

/**
 * Fraction of the way from `updatedAtEpoch` to `honestFinishEpoch` at `nowSec`.
 * Clamped to [0,1]. Returns 1 for a degenerate/zero or negative span so the ring
 * never divides by zero and never reads as "less than done" once finished.
 */
export function arcFraction(
  updatedAtEpoch: number,
  honestFinishEpoch: number,
  nowSec: number,
): number {
  const span = honestFinishEpoch - updatedAtEpoch;
  if (span <= 0) return honestFinishEpoch <= updatedAtEpoch && nowSec >= honestFinishEpoch ? 1 : 1;
  const elapsed = nowSec - updatedAtEpoch;
  if (elapsed <= 0) return 0;
  if (elapsed >= span) return 1;
  return elapsed / span;
}
```

Note: the degenerate-span branch returns `1` unconditionally (per spec §8 TDD case "degenerate `finish == updatedAt` → 1"). Simplify the branch:

```ts
  const span = honestFinishEpoch - updatedAtEpoch;
  if (span <= 0) return 1;
```

Use the simplified form. The negative-span test expects `0` only when the span is negative AND we treat it as "no progress shown" — but spec §8 says "negative span → 0". Reconcile: negative span → 0, zero span → 1. Final implementation:

```ts
export function arcFraction(
  updatedAtEpoch: number,
  honestFinishEpoch: number,
  nowSec: number,
): number {
  const span = honestFinishEpoch - updatedAtEpoch;
  if (span < 0) return 0;       // finish before start → show nothing
  if (span === 0) return 1;     // degenerate → treat as complete (no divide-by-zero)
  const elapsed = nowSec - updatedAtEpoch;
  if (elapsed <= 0) return 0;
  if (elapsed >= span) return 1;
  return elapsed / span;
}
```

- [ ] **Step 4: Add the export**

In `src/engine/index.ts`, after the `reclaim` export line (line 18), add:

```ts
export { arcFraction } from './presence';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/engine/__tests__/presence.test.ts`
Expected: PASS (7 passing).

- [ ] **Step 6: Lint + commit**

```bash
npx eslint src/engine/presence.ts src/engine/__tests__/presence.test.ts src/engine/index.ts
git add src/engine/presence.ts src/engine/__tests__/presence.test.ts src/engine/index.ts
git commit -m "feat(engine): add arcFraction presence helper"
```

---

## Task 2: Extend the bridge payload + add `presenceAvailable()`

**Files:**
- Modify: `src/services/liveActivity.ts`
- Test: `src/services/liveActivity.test.ts` (create if absent; otherwise extend the existing `resolveNativePresence` test file)

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `WidgetSnapshot` gains `honestFinishEpoch: number` and `isPro: boolean`.
  - `LiveActivityAttributes` gains `isProRich: boolean`.
  - `updateLiveActivity` state type becomes `{ isOverrun: boolean }` (unchanged); rich flag lives in attributes/ContentState on the native side.
  - `presenceAvailable(): boolean` — `!getNativePresence().isStub`.
  - `startFinishTimeActivity(attributes: LiveActivityAttributes)` signature unchanged (attributes now carry `isProRich`).

- [ ] **Step 1: Write the failing test**

```ts
// src/services/liveActivity.test.ts
import { resolveNativePresence, type NativePresenceModule } from '@/src/services/liveActivity';

const fake = (over: Partial<NativePresenceModule> = {}): NativePresenceModule => ({
  isStub: false,
  writeSnapshot: () => {},
  clearSnapshot: () => {},
  startLiveActivity: () => {},
  updateLiveActivity: () => {},
  endLiveActivity: () => {},
  ...over,
});

describe('resolveNativePresence', () => {
  it('returns the stub in Expo Go', () => {
    expect(resolveNativePresence(true, () => fake()).isStub).toBe(true);
  });
  it('returns the native module when linked in a dev build', () => {
    expect(resolveNativePresence(false, () => fake()).isStub).toBe(false);
  });
  it('falls back to the stub when the native module is absent', () => {
    expect(resolveNativePresence(false, () => null).isStub).toBe(true);
  });
});
```

(If the repo already has these `resolveNativePresence` tests, keep them and just confirm they still pass after the type changes — the new fields are on the data interfaces, not on `NativePresenceModule`, so the fake stays valid.)

- [ ] **Step 2: Run test to verify the current state**

Run: `npx jest src/services/liveActivity.test.ts`
Expected: PASS (the type changes in Step 3 must keep it green).

- [ ] **Step 3: Add the new fields and `presenceAvailable()`**

In `src/services/liveActivity.ts`, extend `WidgetSnapshot` (after `updatedAtEpoch`, line 49):

```ts
  /** Unix seconds when this was written (lets the widget detect a stale snapshot). */
  updatedAtEpoch: number;
  /** Unix seconds of the honest finish. Lets the widget compute the ring arc
   *  fraction without per-second updates (arcFraction(updatedAtEpoch, this, now)). */
  honestFinishEpoch: number;
  /** Current Pro entitlement at write time. The widget renders the rich arc +
   *  reclaim line only when true; everything essential renders regardless. */
  isPro: boolean;
```

Extend `LiveActivityAttributes` (after `finishEpoch`, line 57):

```ts
  /** Honest finish as Unix seconds; the ring counts down to this. */
  finishEpoch: number;
  /** Whether to start the rich (ring + accents) Live Activity. Decided in JS at
   *  start time from the entitlement; the live countdown digits stay free either way. */
  isProRich: boolean;
```

Add `presenceAvailable()` near the public API (after `endFinishTimeActivity`):

```ts
/**
 * Whether a real native presence module is linked (i.e. not the stub). Lets
 * Settings branch between "How to add the widget" and the "App Store build only"
 * note. Pure read of the resolved module.
 */
export function presenceAvailable(): boolean {
  return !getNativePresence().isStub;
}
```

- [ ] **Step 4: Add the one-shot `widget_added {surface:'home'}`**

Add a module-level guard and fire it from `publishWidgetSnapshot`:

```ts
let homeWidgetSeen = false;

export function publishWidgetSnapshot(snapshot: WidgetSnapshot): void {
  try {
    const presence = getNativePresence();
    presence.writeSnapshot(snapshot);
    if (!presence.isStub && !homeWidgetSeen) {
      homeWidgetSeen = true;
      analytics.capture('widget_added', { surface: 'home' });
    }
  } catch {
    // best-effort; a widget write must never block the core loop
  }
}
```

- [ ] **Step 5: Run typecheck + test**

Run: `npm run typecheck && npx jest src/services/liveActivity.test.ts`
Expected: typecheck has NEW errors at the call sites (`useToday.ts`, `useTimer.ts`) because the required fields are missing — that is expected; Tasks 3 and 4 fix them. The jest file passes.

> Do not commit yet — commit Tasks 2–4 together so typecheck stays green at each commit boundary. Proceed to Task 3.

---

## Task 3: Feed `honestFinishEpoch` + `isPro` from `useToday`

**Files:**
- Modify: `src/features/today/useToday.ts:165-173` (the `publishWidgetSnapshot` call)

**Interfaces:**
- Consumes: `WidgetSnapshot` (now requires `honestFinishEpoch`, `isPro`).
- Produces: a complete snapshot write.

- [ ] **Step 1: Add the entitlement import**

At the top of `src/features/today/useToday.ts`, add:

```ts
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
```

- [ ] **Step 2: Complete the snapshot call**

Replace the `publishWidgetSnapshot({ ... })` block (lines 166–173) with:

```ts
    const honestFinishEpoch = Math.round(projectedFinish(now, honestMin) / 1000);
    publishWidgetSnapshot({
      nextTaskLabel: focus.label,
      category: categoryName(focus.category),
      honestFinishClock: formatClock(projectedFinish(now, honestMin)),
      startDeepLink: `whenbee://timer?taskId=${focus.id}`,
      reclaimTodayMin: 0, // out of scope: no per-day reclaim source yet (see plan)
      updatedAtEpoch: epoch,
      honestFinishEpoch,
      // Read non-reactively: a widget write must not re-render Today on entitlement change.
      isPro: useEntitlement.getState().isPro,
    });
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: `useToday.ts` errors cleared; `useTimer.ts` still errors (fixed in Task 4).

---

## Task 4: Pass entitlement → `isProRich` from `useTimer`

**Files:**
- Modify: `src/features/timer/useTimer.ts:134-137` (the `startFinishTimeActivity` call)

- [ ] **Step 1: Add the entitlement import**

At the top of `src/features/timer/useTimer.ts`, add:

```ts
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
```

- [ ] **Step 2: Complete the start call**

Replace the `startFinishTimeActivity({ ... })` block (around line 134) with:

```ts
    startFinishTimeActivity({
      taskLabel: focusLabel,
      finishEpoch: Math.round(projectedFinish(startedAt, suggestedHonestMin) / 1000),
      isProRich: useEntitlement.getState().isPro,
    });
```

(Keep the existing `taskLabel` expression the file already uses; only add the `isProRich` line.)

- [ ] **Step 3: Run typecheck + lint + tests**

Run: `npm run typecheck && npx eslint src/services/liveActivity.ts src/features/today/useToday.ts src/features/timer/useTimer.ts && npx jest src/services/liveActivity.test.ts`
Expected: all green.

- [ ] **Step 4: Commit Tasks 2–4**

```bash
git add src/services/liveActivity.ts src/services/liveActivity.test.ts src/features/today/useToday.ts src/features/timer/useTimer.ts
git commit -m "feat(presence): carry honestFinishEpoch + isPro through the widget bridge"
```

---

## Task 5: Add the `persistent_presence` paywall trigger

**Files:**
- Modify: `src/services/analytics.ts:100-102` (the `paywall_view` trigger union)

- [ ] **Step 1: Extend the trigger union**

Change line 101 from:

```ts
    trigger: 'make_day_honest' | 'settings_upgrade' | 'steals_your_time' | 'honest_range';
```

to:

```ts
    trigger:
      | 'make_day_honest'
      | 'settings_upgrade'
      | 'steals_your_time'
      | 'honest_range'
      | 'persistent_presence';
```

- [ ] **Step 2: Typecheck + commit**

Run: `npm run typecheck && npx eslint src/services/analytics.ts`
Expected: green.

```bash
git add src/services/analytics.ts
git commit -m "feat(analytics): add persistent_presence paywall trigger"
```

---

## Task 6: Extend the Swift `WidgetSnapshot` + add `arcFraction`

> Swift tasks (6–10) are verified by Xcode build + SwiftUI Previews, not CI. Build the widget scheme in Xcode after each; run the device pass in Task 13.

**Files:**
- Modify: `targets/widget/SharedStore.swift`

- [ ] **Step 1: Add the two optional fields to the Codable**

In `struct WidgetSnapshot`, after `updatedAtEpoch` (line 35), add:

```swift
    let updatedAtEpoch: Double
    /// Unix seconds of the honest finish. Optional so older snapshots still decode.
    /// Drives the ring arc fraction (see `arcFraction`).
    let honestFinishEpoch: Double?
    /// Pro entitlement at write time. The widget renders the rich arc + reclaim
    /// line only when true. Optional/defaulted false for back-compat.
    let isPro: Bool?
```

Update `placeholder` to set realistic values:

```swift
    static var placeholder: WidgetSnapshot {
        WidgetSnapshot(
            nextTaskLabel: "Write the report",
            category: "Deep work",
            honestFinishClock: "7:10",
            startDeepLink: "whenbee://timer",
            reclaimTodayMin: 0,
            updatedAtEpoch: Date().timeIntervalSince1970,
            honestFinishEpoch: Date().addingTimeInterval(45 * 60).timeIntervalSince1970,
            isPro: true
        )
    }
```

- [ ] **Step 2: Add `arcFraction` + `kStaleSeconds` to `SharedStore`**

Add inside `enum SharedStore` (mirror of `src/engine/presence.ts` — keep identical):

```swift
    /// Seconds after which a snapshot is "stale" and the finish line drops its
    /// confident "Honest finish" prefix. Mirrors kStaleSeconds in the plan.
    static let staleSeconds: Double = 6 * 3600

    /// Fraction [0,1] of the way from `updatedAt` to `finish` at `now`.
    /// Byte-mirror of arcFraction() in src/engine/presence.ts. Negative span → 0,
    /// zero span → 1 (no divide-by-zero), past finish → 1.
    static func arcFraction(updatedAt: Double, finish: Double, now: Double) -> Double {
        let span = finish - updatedAt
        if span < 0 { return 0 }
        if span == 0 { return 1 }
        let elapsed = now - updatedAt
        if elapsed <= 0 { return 0 }
        if elapsed >= span { return 1 }
        return elapsed / span
    }
```

- [ ] **Step 3: Build the widget target in Xcode**

After `npx expo prebuild --clean`, open `ios/`, select the widget scheme, build.
Expected: compiles. (Decoding back-compat: older snapshots without the new keys still decode because both fields are optional.)

---

## Task 7: Add the WB* color set to the widget asset catalog

**Files:**
- Create: `targets/widget/Assets.xcassets/` with one `.colorset` per WB color (spec §5.1)

- [ ] **Step 1: Create the color sets**

Create `targets/widget/Assets.xcassets/Contents.json`:

```json
{ "info": { "author": "xcode", "version": 1 } }
```

For each color below, create `targets/widget/Assets.xcassets/<Name>.colorset/Contents.json` with the light value as the universal color and a `luminosity: dark` appearance for the dark value. Values copied verbatim from `src/theme/tokens.ts`:

| Color set | Light | Dark |
|---|---|---|
| `WBAccent` | `#EEAE4D` | `#EEAE4D` |
| `WBAccentEdge` | `#C68A30` | `#C68A30` |
| `WBPrimary` | `#6B5BE6` | `#8275F0` |
| `WBInk` | `#20233A` | `#F4F2FC` |
| `WBInkSoft` | `#5C5F73` | `#A9ABBC` |
| `WBRingTrack` | `#E4DFD3` | `#3A3A46` |
| `WBSurface` | `#FFFFFF` | `#1B1B22` |
| `WBOnAmber` | `#20233A` | `#20233A` |

Template for one colorset (`WBAccent.colorset/Contents.json`, hex `EEAE4D` → `0xEE/0xAE/0x4D`):

```json
{
  "colors": [
    {
      "idiom": "universal",
      "color": { "color-space": "srgb", "components": { "red": "0xEE", "green": "0xAE", "blue": "0x4D", "alpha": "1.000" } }
    },
    {
      "idiom": "universal",
      "appearances": [ { "appearance": "luminosity", "value": "dark" } ],
      "color": { "color-space": "srgb", "components": { "red": "0xEE", "green": "0xAE", "blue": "0x4D", "alpha": "1.000" } }
    }
  ],
  "info": { "author": "xcode", "version": 1 }
}
```

> Confirm the dark hex values against `src/theme/tokens.ts` before committing — the dark `inkSoft`, `ringTrack`, and `surface` values in the table are the spec's stand-ins; use the token file's exact dark values where they differ.

- [ ] **Step 2: Verify the catalog is linked**

`npx expo prebuild --clean`, open Xcode, confirm the color sets appear under the widget target's asset catalog and resolve via `Color("WBAccent", bundle: .main)`.

- [ ] **Step 3: Commit Tasks 6–7**

```bash
git add targets/widget/SharedStore.swift targets/widget/Assets.xcassets
git commit -m "feat(widget): add WB color set + honestFinishEpoch/isPro + arcFraction"
```

---

## Task 8: Refine `NextTaskWidget.swift` — WB colors, medium ring, gating, Previews

**Files:**
- Modify: `targets/widget/NextTaskWidget.swift`

- [ ] **Step 1: Swap system colors → WB assets**

Replace every `.tint` / `.secondary` with the WB equivalents:
- honey dot `.fill(.tint)` → `.fill(Color("WBPrimary"))`
- task label → `.foregroundStyle(Color("WBInk"))`
- "Honest finish …" → `.foregroundStyle(Color("WBAccent"))`
- Start capsule `.background(.tint, …)` → `.background(Color("WBPrimary"), in: Capsule())`, text `.foregroundStyle(.white)`
- captions `.secondary` → `.foregroundStyle(Color("WBInkSoft"))`
- "Whenbee" tag → `.foregroundStyle(Color("WBInkSoft"))`

- [ ] **Step 2: Add a stale-aware finish line**

Add to `NextTaskWidgetView`:

```swift
    private var isStale: Bool {
        Date().timeIntervalSince1970 - entry.snapshot.updatedAtEpoch > SharedStore.staleSeconds
    }
    private var finishLine: String {
        isStale ? entry.snapshot.honestFinishClock
                : "Honest finish \(entry.snapshot.honestFinishClock)"
    }
```

Use `Text(finishLine)` instead of the hard-coded `"Honest finish \(…)"`, and tint it `WBInkSoft` when `isStale`, else `WBAccent`.

- [ ] **Step 3: Split small vs medium; add the medium ring**

Add `@Environment(\.widgetFamily) var family`. For `.systemMedium`, lay out two columns (HStack): the existing task block on the left, and on the right a 56pt ring built from `Circle().trim`:

```swift
    private var arc: Double {
        guard let finish = entry.snapshot.honestFinishEpoch else { return 0 }
        return SharedStore.arcFraction(
            updatedAt: entry.snapshot.updatedAtEpoch,
            finish: finish,
            now: Date().timeIntervalSince1970
        )
    }
    private var isPro: Bool { entry.snapshot.isPro ?? false }

    private var ring: some View {
        ZStack {
            Circle().stroke(Color("WBRingTrack"), lineWidth: 4)
            if isPro {
                Circle()
                    .trim(from: 0, to: arc)
                    .stroke(Color("WBAccent"), style: StrokeStyle(lineWidth: 4, lineCap: .round))
                    .rotationEffect(.degrees(-90))
            } else {
                // Free: a quiet dot at the top of the track, no filled arc.
                Circle().fill(Color("WBRingTrack")).frame(width: 6, height: 6)
                    .offset(y: -26)
            }
            Text(entry.snapshot.honestFinishClock)
                .font(.headline)
                .foregroundStyle(Color("WBInk"))
        }
        .frame(width: 56, height: 56)
    }
```

- [ ] **Step 4: Add the Pro reclaim line (medium)**

Below the Start button in the medium layout, when `isPro && reclaimToday > 0`:

```swift
            if isPro && reclaimToday > 0 {
                Text("+\(reclaimToday)m reclaimed today")
                    .font(.caption)
                    .foregroundStyle(Color("WBInkSoft"))
            }
```

- [ ] **Step 5: Gate the evening state to Pro**

In the `else if reclaimToday > 0` branch, only show the "You got ahead of Nm today" copy when `isPro`; otherwise fall through to the plain "Nothing queued" state. (Free users never see the reclaim payoff — spec §5.4.)

- [ ] **Step 6: Add SwiftUI Previews (free dev loop, no device)**

```swift
#if DEBUG
#Preview("Small · task", as: .systemSmall) {
    NextTaskWidget()
} timeline: {
    NextTaskEntry(date: .now, snapshot: .placeholder)
}

#Preview("Medium · Pro ring", as: .systemMedium) {
    NextTaskWidget()
} timeline: {
    NextTaskEntry(date: .now, snapshot: .placeholder)
}
#endif
```

- [ ] **Step 7: Verify in Xcode Canvas**

Open `NextTaskWidget.swift`, open Canvas (⌥⌘↩). Confirm small + medium render, the ring fills proportionally, colors match the app, and no red appears anywhere.

- [ ] **Step 8: Commit**

```bash
git add targets/widget/NextTaskWidget.swift
git commit -m "feat(widget): WB colors, medium finish-time ring, Pro gating + stale state"
```

---

## Task 9: Refine `FinishTimeActivity.swift` — Pro ring, `isProRich` gate, copy fix

**Files:**
- Modify: `targets/widget/FinishTimeActivity.swift`

- [ ] **Step 1: Add `isProRich` to `ContentState`**

```swift
    public struct ContentState: Codable, Hashable {
        var isOverrun: Bool
        /// Whether to render the rich (ring + accents) presentation. Set at start
        /// from the entitlement; survives updates. The live digits stay free either way.
        var isProRich: Bool
    }
```

- [ ] **Step 2: Lock Screen — add the Pro ring, keep the free plain countdown**

In `LockScreenFinishView`, branch on `context.state.isProRich`:
- **Pro:** replace the trailing `VStack` with a 44pt ring (`Circle().trim` to the at-publish arc fraction computed from `context.attributes.finishEpoch` and the activity start) wrapping `Text(timerInterval: Date()...context.attributes.finishDate, countsDown: true)` `.title2.monospacedDigit().weight(.semibold)` in `Color("WBInk")`, with the `to honest finish` / `over` caption in `WBInkSoft`. Ring track `WBRingTrack` 3.5pt, fill `WBAccent` (or `WBAccentEdge` when `isOverrun`).
- **Free:** keep the existing plain right-aligned countdown exactly as-is.

Colors throughout: `Whenbee` tag + captions → `WBInkSoft`; task label → `WBInk`.

> ActivityKit constraint: the arc fraction is static-at-publish (recomputed only on the sparse `update` calls). The digits carry the per-second truth via `Text(timerInterval:)`; the arc carries at-a-glance progress. Do not attempt per-second arc animation.

- [ ] **Step 3: Overrun (Pro) styling**

When `context.state.isOverrun && context.state.isProRich`: label → `Running over, and that's just data` (spec §10 — note: NOT the em-dash version), keyline + ring fill → `Color("WBAccentEdge")`, digits count up. Free overrun keeps the scaffold's `"over"` caption swap.

- [ ] **Step 4: Dynamic Island — gate ring/accents to `isProRich`**

- compactLeading / minimal: `hourglass` tinted `WBAccent` when `isProRich`, else default.
- compactTrailing: unchanged (live digits stay free).
- expanded `.trailing`: Pro = 36pt ring with countdown inside; free = the existing plain `Text(timerInterval:)`.
- expanded `.bottom`: `isOverrun ? "Running over, and that's just data" : "Honest finish ahead"`, `WBInkSoft`.
- `.keylineTint`: `Color("WBAccent")`, or `Color("WBAccentEdge")` when `isOverrun` and `isProRich`; free keeps system keyline.

- [ ] **Step 5: Add Live Activity Previews**

```swift
#if DEBUG
extension FinishTimeAttributes {
    static var preview: FinishTimeAttributes {
        FinishTimeAttributes(taskLabel: "Write the report",
                             finishEpoch: Date().addingTimeInterval(20 * 60).timeIntervalSince1970)
    }
}

#Preview("Lock Screen · Pro", as: .content, using: FinishTimeAttributes.preview) {
    FinishTimeActivityWidget()
} contentStates: {
    FinishTimeAttributes.ContentState(isOverrun: false, isProRich: true)
    FinishTimeAttributes.ContentState(isOverrun: true, isProRich: true)
    FinishTimeAttributes.ContentState(isOverrun: false, isProRich: false)
}
#endif
```

- [ ] **Step 6: Verify in Xcode Canvas**

Confirm the lock-screen card + Dynamic Island compact/expanded/minimal render for Pro and free, overrun shows amber (never red), and the no-em-dash copy is used.

- [ ] **Step 7: Commit**

```bash
git add targets/widget/FinishTimeActivity.swift
git commit -m "feat(presence): Pro finish-time ring + isProRich gate on the Live Activity"
```

---

## Task 10: Create the native `WhenbeePresence` module (the remaining glue)

**Files:**
- Create: `modules/whenbee-presence/expo-module.config.json`
- Create: `modules/whenbee-presence/ios/WhenbeePresenceModule.swift`
- Create: `modules/whenbee-presence/ios/FinishTimeAttributes.swift`

- [ ] **Step 1: Module config (iOS-only)**

```json
{
  "platforms": ["apple"],
  "apple": { "modules": ["WhenbeePresenceModule"] }
}
```

- [ ] **Step 2: Byte-identical attributes copy**

`modules/whenbee-presence/ios/FinishTimeAttributes.swift` — copy `struct FinishTimeAttributes` (including the updated `ContentState { isOverrun; isProRich }`) **verbatim** from `targets/widget/FinishTimeActivity.swift`. The struct shape must match byte-for-byte or `Activity<FinishTimeAttributes>` won't match across targets.

- [ ] **Step 3: The Expo module**

`modules/whenbee-presence/ios/WhenbeePresenceModule.swift`:

```swift
import ExpoModulesCore
import ActivityKit
import WidgetKit

public class WhenbeePresenceModule: Module {
    private let appGroupId = "group.com.whenbee.app"
    private let snapshotKey = "whenbee.widgetSnapshot"

    @available(iOS 16.2, *)
    private static var currentActivity: Activity<FinishTimeAttributes>?

    public func definition() -> ModuleDefinition {
        Name("WhenbeePresence")

        Function("writeSnapshot") { (snapshot: [String: Any]) in
            guard let defaults = UserDefaults(suiteName: self.appGroupId),
                  let data = try? JSONSerialization.data(withJSONObject: snapshot),
                  let json = String(data: data, encoding: .utf8) else { return }
            defaults.set(json, forKey: self.snapshotKey)
            WidgetCenter.shared.reloadAllTimelines()
        }

        Function("clearSnapshot") {
            UserDefaults(suiteName: self.appGroupId)?.removeObject(forKey: self.snapshotKey)
            WidgetCenter.shared.reloadAllTimelines()
        }

        Function("startLiveActivity") { (attrs: [String: Any]) in
            guard #available(iOS 16.2, *),
                  ActivityAuthorizationInfo().areActivitiesEnabled,
                  let label = attrs["taskLabel"] as? String,
                  let finish = attrs["finishEpoch"] as? Double else { return }
            let isProRich = (attrs["isProRich"] as? Bool) ?? false
            let attributes = FinishTimeAttributes(taskLabel: label, finishEpoch: finish)
            let state = FinishTimeAttributes.ContentState(isOverrun: false, isProRich: isProRich)
            Task {
                Self.currentActivity = try? Activity.request(
                    attributes: attributes,
                    content: .init(state: state, staleDate: nil)
                )
            }
        }

        Function("updateLiveActivity") { (state: [String: Any]) in
            guard #available(iOS 16.2, *) else { return }
            let isOverrun = (state["isOverrun"] as? Bool) ?? false
            Task {
                guard let activity = Self.currentActivity else { return }
                let prevRich = activity.content.state.isProRich
                await activity.update(.init(
                    state: .init(isOverrun: isOverrun, isProRich: prevRich), staleDate: nil
                ))
            }
        }

        Function("endLiveActivity") {
            guard #available(iOS 16.2, *) else { return }
            Task {
                await Self.currentActivity?.end(nil, dismissalPolicy: .immediate)
                Self.currentActivity = nil
            }
        }
    }
}
```

> The JS bridge already returns a module whose `isStub` is derived from `requireOptionalNativeModule` finding this module. No `isStub` property is needed on the Swift side — its mere presence flips the bridge off the stub.

- [ ] **Step 4: Prebuild + build to confirm the bridge links**

```bash
npx expo prebuild --clean
npm run ios   # simulator build is enough to confirm it COMPILES + links
```

In a simulator dev build, add a temporary log to confirm `presenceAvailable()` returns `true`. (Live Activity won't actually appear in the simulator — that's Task 13 — but `writeSnapshot` + widget rendering can be checked in the sim.)

- [ ] **Step 5: Commit**

```bash
git add modules/whenbee-presence
git commit -m "feat(presence): add native WhenbeePresence module (App Group + ActivityKit)"
```

---

## Task 11: Settings → Presence row + locked teaser

**Files:**
- Create: `src/components/PresenceRingTeaser.tsx`
- Modify: the Settings screen (`src/app/(tabs)/settings.tsx` or the settings feature — confirm the path) to add the Presence row group

**Interfaces:**
- Consumes: `presenceAvailable` from `liveActivity.ts`, `useEntitlement`, `useTheme`, `ProGate`, `analytics`.

- [ ] **Step 1: Build `PresenceRingTeaser` (RN Svg, real tokens)**

A static finish-time ring (`react-native-svg` `Circle` track + arc) using `t.colors.accent` fill, `t.colors.ringTrack` track, `t.radii.full`, a one-line value statement, and a primary `AppButton` "Unlock the honest ring" routing to `/(modals)/paywall?trigger=persistent_presence`. One-time entrance fill via Reanimated `withTiming(1, { duration: t.motion.honeyFill, easing: t.motion.easing.honey })`, `entering`-only, `.get()/.set()` on the shared value, skipped under `ReduceMotion`. Fire `analytics.capture('paywall_view', { trigger: 'persistent_presence' })` on CTA press.

- [ ] **Step 2: Add the Presence row group**

A section with title `Keep your task on screen`, body `Your next task and its honest finish stay visible, even when Whenbee is closed.`, then:
- If `presenceAvailable()`: an `AppButton` secondary `How to add the widget` (opens a short how-to sheet or links to instructions).
- Else: a quiet inline note `Available on the App Store build.`
- A `<ProGate fallback={<PresenceRingTeaser />}>` block; Pro sees a calm "Ring is on" confirmation row.

All spacing/sizes from `useTheme()` tokens (`t.space[4]` section pad, `t.space[3]` row gap, `t.radii.card`, `t.colors.hairline`).

- [ ] **Step 3: Lint + typecheck + verify on the simulator**

Run: `npm run lint && npm run typecheck`. Launch the app, open Settings, confirm the Presence group renders, the teaser ring animates once, and the CTA opens the paywall with the right trigger. Screenshot-verify spacing/alignment before reporting done.

- [ ] **Step 4: Commit**

```bash
git add src/components/PresenceRingTeaser.tsx src/app   # adjust to the real settings path
git commit -m "feat(settings): Presence row + locked honest-ring teaser"
```

---

## Task 12: Reconcile a stale Live Activity on boot

**Files:**
- Modify: the boot path that calls `timerStore.resumeFromKv` (find via `grep -rn "resumeFromKv" src/`)

- [ ] **Step 1: Add the reconcile**

After `resumeFromKv` runs on launch, if the store has **no** running timer, call `endFinishTimeActivity()` so an orphaned OS-owned Activity (app was killed, timer already ended) is cleaned up. Guard it the same fire-and-forget way; it's a no-op when no activity exists.

- [ ] **Step 2: Typecheck + commit**

```bash
npm run typecheck && npx eslint <changed-file>
git add <changed-file>
git commit -m "fix(presence): end an orphaned Live Activity when no timer resumes on boot"
```

---

## Task 13: Device verification pass (cannot run in CI / simulator)

> Per `docs/NATIVE-PRESENCE.md` + spec §13. This needs a physical device, an Apple Team id, and a paid Apple Developer Program membership (App Groups + Live Activities don't work on a free personal team).

- [ ] Set `ios.appleTeamId` in `app.json`; `npx expo prebuild --clean`.
- [ ] Build to a physical device: `npm run ios --device` (or an EAS dev build).
- [ ] Add the "Next task" widget (long-press Home → + → Whenbee). Confirm it shows the real next task + honest finish, the medium ring fills, and Start deep-links into the timer.
- [ ] Start a timer; lock the device. Confirm the Live Activity countdown appears on the Lock Screen and (iPhone 14 Pro+) the Dynamic Island. Confirm the Pro ring shows for a Pro account and the minimal countdown for a free account.
- [ ] Run past the honest finish; confirm the copy flips to "Running over, and that's just data" with an amber (never red) keyline, digits counting up.
- [ ] Stop the timer; confirm the Activity ends and the widget returns to the next task.
- [ ] Inspect the payload: `defaults read group.com.whenbee.app whenbee.widgetSnapshot`.
- [ ] Confirm analytics: `widget_added {surface:'live_activity'}` on start, `{surface:'home'}` once on first snapshot, `widget_engaged` on stop, `paywall_view {trigger:'persistent_presence'}` from the teaser.

---

## Self-Review

**Spec coverage:** §3 surfaces (widget + Live Activity + Dynamic Island + Settings) → Tasks 8/9/11. §5 layouts/states → 8/9. §5.1 color bridge → 7. §6 motion (within ActivityKit limits) → 9/11. §7 data model (`honestFinishEpoch`, `isPro`, `isProRich`) → 2/3/4/6. §8 `arcFraction` + `presenceAvailable` → 1/2. §8b native module → 10. §9 gating + trigger → 4/5/11. §10 copy (no em-dash) → 9/11. §11 edge cases (stale, overrun, boot reconcile) → 6/8/12. §12 analytics → 2/5/13. §13 manifest/device → all + 13.

**Out-of-scope flagged:** real `reclaimTodayMin` source (evening Pro state stays dormant, code path built and gated).

**Type consistency:** `WidgetSnapshot` gains `honestFinishEpoch:number` + `isPro:boolean` (TS) / `honestFinishEpoch:Double?` + `isPro:Bool?` (Swift). `ContentState` gains `isProRich:Bool` on both Swift copies (Tasks 9 + 10 — must stay byte-identical). `arcFraction(updatedAt, finish, now)` signature matches across TS and Swift.
