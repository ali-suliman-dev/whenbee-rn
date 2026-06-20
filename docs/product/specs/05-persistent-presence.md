# 05 — Persistent presence  ·  Pro

**Status:** spec · **Tier:** mixed — static widget + minimal Live Activity are **FREE / never cut**; the rich finish-time ring, overrun states, and the "got ahead" widget payoff are **Pro** (`pro` entitlement) · **Skills applied:** `react-native-expert`, `ui-design:mobile-ios-design` (WidgetKit + ActivityKit HIG), `ui-design:visual-design-foundations`, `motion-design`, `svg-animations`, `vercel-react-native-skills`

> **Read first:** [`docs/NATIVE-PRESENCE.md`](../../NATIVE-PRESENCE.md) (scaffold status + device steps) and [README §Shared conventions](README.md). This spec **finishes a scaffold that already exists** — the App-Group payload shape, the RN bridge, the call sites, the analytics, and the Swift widgets are all written and CI-green. The single missing piece is the native `WhenbeePresence` module that turns the bridge's no-ops real, plus the Pro gating + ring design layered on top. Do not re-design the payload; mirror what's already agreed on both sides.

---

## 1. What it is (one paragraph a non-engineer understands)

Whenbee keeps your current task **on screen even when the app is closed**. A small Home/Lock-screen **widget** always shows your next task and the honest time it would really finish, with a one-tap **Start**. The moment you start a timer, a **Live Activity** appears on the Lock Screen and (on iPhone 14 Pro and newer) in the **Dynamic Island** — a live countdown to your *honest* finish, not your optimistic guess. It keeps ticking with the app fully closed and quietly shifts to "running over — that's data" if you pass the honest finish, never to a guilt-red alarm. This kills the deepest ADHD failure mode: *if I can't see it, it's erased from my timeline.*

## 2. The user problem + evidence  (cites 07-PRO-VALUE-IDEAS §1.5)

- **Out-of-sight = out-of-mind is the #1 reason their to-do apps fail.** *"If I can't see it, it might as well have been erased from the timeline"* — [r/ADHD](https://www.reddit.com/r/ADHD/comments/myf2aj/) (07 §1.5). A task that lives only behind an app icon does not exist for this brain.
- **A timer that stays visible after you leave the app is the single most-begged Llama Life convenience** (07 §1.5). The running timer vanishing on app-switch is a named, repeated complaint.
- **Widgets are a documented retention driver** — an ambient daily touchpoint used dozens of times a day. The value *lapses the moment they stop paying*, which is exactly why the rich version is a defensible recurring Pro driver (07 §1.5 "Why they pay recurringly").
- **Effort is Med-High but mostly spent** — the `WhenbeePresence` widget/Live Activity targets are already scaffolded (07 §1.5; `docs/NATIVE-PRESENCE.md`). This spec is the killer consumer reason to finish them. It is a **REFINEMENT** (finish the scaffold + gate the rich version), not greenfield.

## 3. Where it lives  (surface; entry points; free vs Pro)

Three OS-level surfaces plus one in-app settings/upsell entry. None is part of the core guess → timer → learn loop — every write is fire-and-forget and a clean no-op in Expo Go / tests / a binary built before the native module is linked.

| Surface | Family | Tier | Source of truth |
|---|---|---|---|
| **Home/Lock-screen widget — "Next task"** | `systemSmall`, `systemMedium` | **FREE** (basic: label + honest finish + Start). Pro adds the "got ahead of Nm today" evening payoff + reclaim line. | `WidgetSnapshot` written by `publishWidgetSnapshot` from `useToday.ts` |
| **Live Activity — Lock Screen** | ActivityKit banner | **FREE = minimal** (label + plain monospace countdown). **Pro = the finish-time ring + "running over — that's data" overrun copy + Whenbee presence.** | `FinishTimeAttributes` started by `startFinishTimeActivity` from `useTimer.ts` |
| **Dynamic Island** (iPhone 14 Pro+) | compact / expanded / minimal | Same free/Pro split as the Live Activity | same |
| **In-app entry** | `Settings → Presence` row + paywall teaser | — | new Settings row (§9) |

**Entry points to enable:**
1. iOS Home Screen long-press → **+** → search **Whenbee** → add "Next task". (OS-driven; no in-app step.)
2. Live Activity auto-starts on every timer start (free, minimal). The **rich** ring/states light up only for Pro users — same Activity, gated `ContentState` (see §9).
3. `Settings → Presence` explains the surfaces, links to "How to add the widget", and — for non-Pro — shows the locked teaser for the rich ring.

**Free vs Pro is explicit and load-bearing here (per the plan, the static widget is "never cut"):**

- **FREE, never gated, never moved behind the wall later** (Forest "rug-pull" landmine, 07 §Pricing): the static "Next task" widget (label, honest finish, Start) **and** a *minimal* Live Activity (task label + a plain monospaced `Text(timerInterval:)` countdown + the keyline tint). The "it exists / I can see it" guarantee is free for everyone, forever.
- **PRO** (`pro` entitlement): the **honest finish-time ring** (the circular progress arc filling toward the honest finish), the **no-guilt overrun state** ("running over — that's data" + amber keyline), the **"you got ahead of Nm today" reclaim widget state**, and the **reclaim/honey accents**. Pro buys the *richer, calmer, more legible* presence — not the existence of presence.

## 4. User flow  (numbered — happy path + non-Pro path)

**Happy path (Pro):**
1. User adds the "Next task" widget once. It shows their actual next focus task + honest finish + Start. (`useToday.ts` already publishes this on focus-task change.)
2. User taps **Start** on the widget → deep link `whenbee://timer?taskId=…` opens the timer (already wired).
3. Timer starts → `startFinishTimeActivity` fires → Live Activity appears on Lock Screen + Dynamic Island, showing the **honest finish-time ring** counting down (Pro state).
4. User locks the phone and walks away. The ring keeps ticking with the app closed (no per-second push — WidgetKit renders the countdown from the immutable `finishDate`).
5. If they pass the honest finish, `updateFinishTimeActivity({ isOverrun: true })` flips the copy to "running over — that's data" and the keyline to amber. Never red, never an alarm.
6. Timer stop/abandon → `endFinishTimeActivity` removes the Activity; the widget returns to the next task, or (evening, nothing queued) the **"you got ahead of Nm today"** reclaim state.

**Non-Pro path:**
1–2. Identical free static widget and Start.
3. Timer start still spawns a Live Activity, but in **minimal** form: task label + a plain monospace countdown, system keyline. No ring, no overrun copy, no reclaim accents.
4. In `Settings → Presence`, the rich-ring teaser shows a static preview of the ring with a calm "Unlock the honest ring" CTA → `/(modals)/paywall?trigger=persistent_presence`.

## 5. Screens & states  (layout, tokens, type scale, spacing, wireframes)

Two presentation environments: **WidgetKit/SwiftUI** (the native targets — sizes in pt, colors from the asset catalog mirroring our tokens) and the **in-app Settings/teaser** (RN, real `useTheme()` tokens). The widgets are presentation-only and never compute the honest number — JS pre-formats every string in `WidgetSnapshot`.

### 5.1 Color bridge — tokens → asset catalog (REQUIRED, do not eyeball)

The Swift widgets currently use `.tint` / `.yellow` / `.secondary` system colors. Replace these with a **Whenbee color set in the widget target's asset catalog** whose light/dark values are copied verbatim from `src/theme/tokens.ts` so the widget matches the app exactly. Add these asset-catalog colors (`targets/widget/Assets.xcassets`, generated via `expo-target` config — see §13):

| Asset color | Light (from tokens) | Dark (from tokens) | Used for |
|---|---|---|---|
| `WBAccent` | `#EEAE4D` (`colors.light.accent`) | `#EEAE4D` (`colors.dark.accent`) | ring fill, honest-finish text, keyline tint |
| `WBAccentEdge` | `#C68A30` (`accentEdge`) | `#C68A30` | ring inner shadow / overrun keyline |
| `WBPrimary` | `#6B5BE6` (`colors.light.primary`) | `#8275F0` (dark primary) | Start button fill, honey dot |
| `WBInk` | `#20233A` (`ink`) | `#F4F2FC`-ish on dark | primary text |
| `WBInkSoft` | `#5C5F73` (`inkSoft`) | (dark inkSoft) | captions / secondary |
| `WBRingTrack` | `#E4DFD3` (`ringTrack`) | dark track | the unfilled ring track |
| `WBSurface` | `#FFFFFF` (`surface`) | dark surface | widget container background |
| `WBOnAmber` | `#20233A` (`onAmber`) | `#20233A` | text/icon on amber fill |

**Invariant guard:** there is **no red asset color**. Overrun uses `WBAccent`/`WBAccentEdge` (amber), never `colors.danger`. This is enforced by simply not adding a danger color to the widget catalog.

### 5.2 Static "Next task" widget — `systemSmall` (free)

Layout (existing `NextTaskWidget.swift`, refined): `VStack(alignment: .leading)`, container padding 14pt, inner spacing 6pt (these map to `space.2.5`≈10 / `space.4`=16; keep 14 = the existing card-pad analog).

```
┌──────────────────────────┐  systemSmall (~158×158pt)
│ ● Whenbee                 │  honey dot 7pt (WBPrimary) + caption2 semibold WBInkSoft
│                           │
│ Write the report          │  .headline / WBInk · lineLimit 2  ← nextTaskLabel
│ Honest finish 7:10        │  .subheadline.medium / WBAccent   ← honestFinishClock
│ ┌────────┐                │
│ │ Start  │                │  capsule, WBPrimary fill, .caption.semibold / white
│ └────────┘                │  padH 12 / padV 5 (= space.3 / ~space.1.5)
└──────────────────────────┘
```

Type scale (SwiftUI semantic fonts, which honor Dynamic Type per HIG): `caption2` (Whenbee tag) → `subheadline` (finish) → `headline` (task). Three steps, each ≥1.25 ratio. The honest finish is the only `WBAccent` element — the single amber "10%" accent, matching the 60-30-10 rule in tokens.

### 5.3 Static "Next task" widget — `systemMedium` (free; Pro adds reclaim line)

Two-column: left = task block (same as small), right = a **mini honest-finish ring** (free shows a static dot; **Pro shows the filled arc** at "now vs honest finish" proportion, computed from `updatedAtEpoch` + `finishEpoch` so it does not need per-second updates).

```
┌──────────────────────────────────────────────┐  systemMedium (~338×158pt)
│ ● Whenbee                          ╭─────╮     │
│                                    │ 7:10│     │  ring 56pt (size from honeycomb.hub),
│ Write the report                   │  ◜  │     │  track WBRingTrack 4pt, fill WBAccent
│ Deep work                          ╰─────╯     │  center: honestFinishClock .headline WBInk
│ ┌────────┐                                     │
│ │ Start  │   +18m reclaimed today (Pro)        │  reclaim line: .caption WBInkSoft, Pro-only
│ └────────┘                                     │
└──────────────────────────────────────────────┘
```

- Ring diameter 56pt = `tokens.honeycomb.hub` (56). Stroke 4pt = `tokens.bar.track` analog. Fill `WBAccent`, track `WBRingTrack`. The category caption uses `WBInkSoft` `.subheadline`.
- **Pro-only** elements in medium: the *filled* arc (free renders only the track + a dot) and the "+Nm reclaimed today" line (driven by `reclaimTodayMin`, already in the payload).

### 5.4 Widget empty + evening states

- **Nothing queued (free):** `.headline` WBInk "Nothing queued" + `.caption` WBInkSoft "Add a task to see its honest finish." Calm, no guilt (already in scaffold, keep).
- **Evening "got ahead" (Pro):** when `nextTaskLabel == ""` and `reclaimTodayMin > 0` → `.headline` "You got ahead of {N}m today" + `.caption` WBInkSoft "Honest time, learned on-device." (already scaffolded; gate the *filled* honey accent and reclaim emphasis to Pro — free users see the plain "Nothing queued" state instead).
- **Stale snapshot:** if `now − updatedAtEpoch > 6h`, dim the finish line to `WBInkSoft` and drop the "Honest finish" prefix to just the clock — avoids showing a confidently-wrong time. (Add this check in `NextTaskWidgetView`; threshold const `kStaleSeconds = 6*3600`.)

### 5.5 Live Activity — Lock Screen (the headline Pro surface)

Refine `LockScreenFinishView`. **Pro** layout adds the finish-time ring; **free** keeps the right-aligned plain countdown the scaffold already has.

```
PRO ─────────────────────────────────────────────
┌────────────────────────────────────────────────┐
│ Whenbee                              ╭──────╮    │  Activity bg tint = WBSurface @ subtle
│ Write the report                     │ 12:48│    │  ring 44pt, track WBRingTrack 3.5pt,
│                                      │  ◜◜  │    │  fill WBAccent sweeping to finishDate
│                                      ╰──────╯    │  center: Text(timerInterval:) .title2
│                                   to honest finish│  monospacedDigit semibold WBInk
└────────────────────────────────────────────────┘  caption2 WBInkSoft label

FREE ────────────────────────────────────────────
┌────────────────────────────────────────────────┐
│ Whenbee                                   12:48  │  plain monospaced countdown, no ring
│ Write the report                  to honest finish│  WBInk / WBInkSoft
└────────────────────────────────────────────────┘
```

- Task label `.headline` WBInk, `lineLimit(1)`; "Whenbee" tag `.caption2.semibold` WBInkSoft.
- **Pro ring:** 44pt diameter, stroke 3.5pt. The ring is a `ProgressView(timerInterval:)` style arc OR a `Circle().trim(...)` driven by `ContentState`-free interpolation; because ActivityKit cannot push per-second, the **arc uses `Text(timerInterval:)` for the digits and a static-at-publish arc fraction** recomputed only on the few `updateLiveActivity` calls (start, overrun-flip). This is the ActivityKit constraint (see §6) — the *digits* tick live for free via the OS; the *arc* steps on updates only. Acceptable: the digits carry the per-second truth; the arc carries the at-a-glance progress.
- **Overrun (Pro):** on `isOverrun == true`, label flips to "running over — that's data", keyline + ring fill → `WBAccentEdge` (deeper amber), digits switch to count-**up** since finish. No red.
- **Overrun (free):** the scaffold's `"over"` / `"to honest finish"` caption swap is fine; keep it.

### 5.6 Dynamic Island (iPhone 14 Pro+)

Keep the scaffold's three presentations; gate the ring/accents to Pro.

- **compactLeading:** `hourglass` SF Symbol, tint `WBAccent` (Pro) / `.secondary` (free).
- **compactTrailing:** `Text(timerInterval:countsDown:)` monospaced, `maxWidth 44`. Free + Pro identical (the live digits stay free — that's the "I can see it" guarantee).
- **minimal:** `hourglass` glyph, `WBAccent` (Pro) / system (free).
- **expanded:**
  - `.leading`: `Label(taskLabel, systemImage:"hourglass")` `.caption.semibold` lineLimit 1.
  - `.trailing`: **Pro** = the 36pt finish ring with the countdown inside; **free** = the plain `Text(timerInterval:)` `.title3` the scaffold has.
  - `.bottom`: `context.state.isOverrun ? "Running over — that's data" : "Honest finish ahead"` `.caption2` `WBInkSoft`.
  - `keylineTint`: `WBAccent`, or `WBAccentEdge` when `isOverrun` (Pro). Free uses system keyline.

### 5.7 In-app `Settings → Presence` (RN — real tokens)

A standard Settings row group reusing existing `src/components` primitives (`Screen`, list rows, `AppButton`). Token usage: section padding `t.space[4]`, row gap `t.space[3]`, card `t.radii.card`, hairline `t.colors.hairline`.

```
Presence
┌───────────────────────────────────────────┐
│  Keep your task on screen                  │  type.title3 / t.colors.ink
│  Your next task and its honest finish,     │  type.body / t.colors.inkSoft
│  even when Whenbee is closed.              │
│                                            │
│  [ How to add the widget ]                 │  AppButton, secondary
│                                            │
│  ── Honest finish ring ───────── PRO ──    │  locked teaser (non-Pro), see §9
│  ╭──────╮  Watch the ring fill toward your │  static ring preview (RN Svg), t.colors.accent
│  │ 7:10 │  real finish on the Lock Screen. │  type.body / inkSoft
│  ╰──────╯  [ Unlock the honest ring ]      │  primary CTA → paywall
└───────────────────────────────────────────┘
```

- **Loading/empty:** none needed — this is a static explainer; the live preview ring uses fixed demo values.
- **Not-enough-data:** N/A (presence reflects whatever the timer/today state is; no model threshold).
- **Error:** if the native module is absent (e.g. Expo Go, pre-link build), show a quiet inline note "Available on the App Store build" instead of the "How to add" button — read `getNativePresence().isStub` via a tiny exposed selector (add `presenceAvailable()` to the bridge returning `!getNativePresence().isStub`).

## 6. Motion  (within ActivityKit constraints)

**Motion personality: Premium/Calm** — matches the app's existing `tokens.motion.easing.calm`/`premium` curves. No bounce, 0% overshoot, no guilt motion. Honor `ReduceMotion.System`.

- **Live-Activity ring fill:** ActivityKit **cannot animate per-second** and disallows custom timed animations inside the Activity — only `Text(timerInterval:)` ticks live, and views re-render on `update` calls. So:
  - The **digits** count down live for free (OS-rendered) — this is the primary motion layer and it's continuous.
  - The **arc** is recomputed on the sparse `update` events (start, overrun-flip, and at most one mid-session refresh if added later). Use SwiftUI's default implicit `.animation(.default)` on the `trim` end so each step eases rather than jumps; keep it ≤ `0.3s` (matches `tokens.motion.base` 220ms region).
- **Overrun transition (Pro):** when `isOverrun` flips, cross-fade label + keyline from `WBAccent` → `WBAccentEdge` over ~250ms ease-in-out. A *color/copy* change, calm, never a shake or flash (that would read as alarm/guilt). Per motion-design state-feedback rules, errors get firm motion — but overrun is **not an error here**, so it gets the gentle on-screen ease-in-out, deliberately.
- **Widget updates:** WidgetKit timeline reloads are not animated by the OS; no motion to design. The RN bridge pokes `WidgetCenter.reloadAllTimelines()` on each snapshot write so the next task appears promptly.
- **In-app teaser ring (RN):** a one-time entrance fill of the preview arc on screen focus — Reanimated `withTiming(1, { duration: tokens.motion.honeyFill /*900*/, easing: tokens.motion.easing.honey })`, `entering`-only (never `exiting` — SIGABRTs on Fabric per README). Read/write the shared value with `.get()/.set()`. Skip the fill under `ReduceMotion.System` (render at final state).

## 7. Data model  (types; persistence)

**No new domain types, no new DB table, no new migration.** The payload contracts already exist and are mirrored on both sides — reuse them verbatim:

- `WidgetSnapshot` (`src/services/liveActivity.ts` ↔ `SharedStore.swift`): `nextTaskLabel`, `category`, `honestFinishClock`, `startDeepLink`, `reclaimTodayMin`, `updatedAtEpoch`. **Add one field** to carry the ring fraction without per-second updates: `honestFinishEpoch: number` (Unix seconds of the honest finish) so the widget can compute `arcFraction = clamp((now − updatedAtEpoch) / (honestFinishEpoch − updatedAtEpoch))`. Mark it optional in the Swift `Codable` (`let honestFinishEpoch: Double?`) so older snapshots still decode (the scaffold's back-compat pattern). Mirror it in the JS `WidgetSnapshot` interface.
- `LiveActivityAttributes` / `FinishTimeAttributes`: `taskLabel`, `finishEpoch` (immutable) + `ContentState { isOverrun }` (mutable). **No change** — `finishEpoch` already carries the honest finish; the ring derives from it.
- **Persistence:** the only persisted bytes are the App-Group `UserDefaults` JSON at key `whenbee.widgetSnapshot` (written by the native module) and the OS-owned Live Activity. **Nothing new in SQLite or `kv.ts`.** The snapshot is a derived projection of `timerStore` / `useToday`, never a system of record.
- **Pro flag for the widget:** the widget cannot read RevenueCat. Add `isPro: boolean` to `WidgetSnapshot` (JS writes the current entitlement at snapshot time; mirror `let isPro: Bool?` in Swift, default false). The widget renders the rich arc/reclaim only when `isPro == true`. For the Live Activity, JS already decides whether to start the rich vs minimal variant — pass it via `ContentState` (see §9).

## 8. Engine / logic  (pure functions; TDD)

This feature is presentation glue, so engine additions are minimal and purely about **formatting** the payload — no calibration math (that stays where it is). All new pure helpers live in `src/engine/` or `src/lib/` and are unit-tested first (TDD).

- **`arcFraction(updatedAtEpoch, honestFinishEpoch, nowSec): number`** — pure, clamped `[0,1]`; returns `1` when `now ≥ finish`, `0` when `finish ≤ updatedAt`. File: `src/engine/presence.ts`, exported via `src/engine/index.ts`. Mirror the *same* formula in Swift (`SharedStore.arcFraction`) so the static-and-live arcs agree.
  - TDD cases: now before window → 0; halfway → 0.5; past finish → 1; degenerate `finish == updatedAt` → 1 (avoid divide-by-zero); negative span → 0.
- **`projectedFinish` / `formatClock`** — already exist and are already used at the call sites (`useToday.ts`, `useTimer.ts`). Reuse; do not duplicate.
- **Snapshot assembly** stays in the feature hook layer (`useToday.ts`), not the engine — it reads `summary.honestMinutes` + reclaim + entitlement and calls `publishWidgetSnapshot`. Add `honestFinishEpoch` and `isPro` to that existing call object.
- **`presenceAvailable(): boolean`** — add to `src/services/liveActivity.ts` returning `!getNativePresence().isStub`, so Settings can branch (already-stubbed, pure-ish, no new test infra needed beyond the existing `resolveNativePresence` tests).

## 8b. Native module — the remaining glue (THE build core)

Create the custom Expo native module the bridge probes for (`requireOptionalNativeModule('WhenbeePresence')`). Per `docs/NATIVE-PRESENCE.md` it needs exactly these methods; this section pins the implementation.

**Module layout (`modules/whenbee-presence/`):**
```
modules/whenbee-presence/
  expo-module.config.json        # declares the iOS module + "WhenbeePresence" name
  ios/
    WhenbeePresenceModule.swift  # the Expo module (methods below)
    FinishTimeAttributes.swift   # byte-identical copy of targets/widget/FinishTimeActivity.swift's struct
```

**`WhenbeePresenceModule.swift` — exact methods (match `NativePresenceModule` in liveActivity.ts):**

1. `writeSnapshot(_ dict)` — encode the dict to JSON, write to `UserDefaults(suiteName: "group.com.whenbee.app")` at key `"whenbee.widgetSnapshot"`, then `WidgetCenter.shared.reloadAllTimelines()`.
2. `clearSnapshot()` — `removeObject(forKey:)` at the same key, then `reloadAllTimelines()`.
3. `startLiveActivity(_ dict)` — build `FinishTimeAttributes(taskLabel:, finishEpoch:)` + initial `ContentState(isOverrun: false)`, call `Activity<FinishTimeAttributes>.request(attributes:, content:)`. Guard `ActivityAuthorizationInfo().areActivitiesEnabled`; store the returned `Activity` id (a module-held `var currentActivity`).
4. `updateLiveActivity(_ dict)` — `await currentActivity?.update(using: ContentState(isOverrun: dict["isOverrun"]))`. Carry the `isProRich` flag here too if the rich/minimal split is driven by `ContentState` (see §9).
5. `endLiveActivity()` — `await currentActivity?.end(nil, dismissalPolicy: .immediate)`; clear `currentActivity`.

**Critical correctness notes (avoid the canonical traps):**
- The `FinishTimeAttributes` struct **must be byte-identical** in shape across `modules/whenbee-presence/ios/` and `targets/widget/` — `Activity<FinishTimeAttributes>` only matches when both copies agree (the comment in `FinishTimeActivity.swift` already warns this). If they drift, `request` silently no-ops or the widget never matches the activity.
- Mark ActivityKit calls `@available(iOS 16.2, *)` and the module methods that touch them guarded; the deployment target for the module is **16.2** to match the widget target.
- `request`/`update`/`end` are `async`/`throws` — wrap in `Task { try? ... }` so a failure never propagates to JS (the bridge already swallows, but don't throw across the boundary).
- **App Group entitlement** must be on **both** the app target and the module/widget — `app.json` already declares `group.com.whenbee.app`; verify the module inherits it after `prebuild` (it shares the main-app entitlements, which already include the group).
- This module is **iOS-only**. On Android the bridge resolves to the stub (no Android presence in this cut); document that in `expo-module.config.json` (omit the Android platform).

## 9. Gating  (ProGate placement, paywall trigger, locked teaser)

**Where gating lives:** the OS surfaces can't call `ProGate`, so entitlement is decided **in JS at write/start time** and carried in the payload.

- **Static widget:** `publishWidgetSnapshot` includes `isPro` (read once non-reactively via `useEntitlement.getState().isPro` inside `useToday`'s effect, or pass through). The Swift widget shows the rich arc + reclaim line only when `isPro == true`; everything essential (label, finish, Start) renders regardless. **The free widget is never degraded below the scaffold's current free content.**
- **Live Activity:** in `useTimer.ts`, branch at `startFinishTimeActivity`: pass the entitlement so the native module starts the **rich** variant (ring + accents) for Pro and the **minimal** variant for free. Implement by adding `isProRich: boolean` to `ContentState` (so it survives updates) OR by reading it in the widget from a second App-Group flag the snapshot already carries. Prefer `ContentState.isProRich` — it's self-contained to the Activity. The live countdown digits stay free in both.
- **In-app:** `Settings → Presence` wraps the rich-ring teaser block in `<ProGate fallback={<PresenceRingTeaser/>}>`. Pro sees a "Ring is on" confirmation; non-Pro sees the static preview ring + CTA.

**Paywall trigger name:** `persistent_presence`. Add it to the `paywall_view` trigger union in `src/services/analytics.ts` (currently `'make_day_honest' | 'settings_upgrade' | 'steals_your_time'`) → add `'persistent_presence'`. CTA routes to `/(modals)/paywall?trigger=persistent_presence`.

**Locked teaser design** (`PresenceRingTeaser`, RN): the static finish-time ring rendered with real tokens (`t.colors.accent` fill, `t.colors.ringTrack` track, `t.radii.full`), a one-line value statement, and a primary `AppButton` "Unlock the honest ring". Shows the *shape* of the value (per README gating rule) without fogging anything free. Never blurs or fakes the free widget.

## 10. Copy  (exact strings; humanizer-checked; no-guilt)

Every string below is written for one honest person's voice — no em-dash, no rule-of-three, no AI vocab, no guilt. (Where the scaffold already has good copy, it's kept and marked ✓.)

**Static widget:**
- Task present: `{label}` / `Honest finish {clock}` ✓ / `Start` ✓
- Category caption (medium): `{categoryName}`
- Reclaim line (Pro, medium): `+{N}m reclaimed today`
- Nothing queued: `Nothing queued` ✓ / `Add a task to see its honest finish` ✓
- Evening (Pro): `You got ahead of {N}m today` ✓ / `Honest time, learned on-device` ✓
- Stale: drop the prefix, show just `{clock}`

**Live Activity / Dynamic Island:**
- Label: `{taskLabel}` ✓
- Sub-label (on track): `to honest finish`
- Sub-label (expanded bottom, on track): `Honest finish ahead`
- Overrun label: `Running over — that's data` *(NOTE: the scaffold uses an em-dash here; per humanizer + README "no em-dash", change to:)* → **`Running over, and that's just data`**
- Overrun caption (Lock Screen, replaces "to honest finish"): `over` ✓ (keep; it's the compact form)

**Settings → Presence:**
- Title: `Keep your task on screen`
- Body: `Your next task and its honest finish stay visible, even when Whenbee is closed.`
- Button: `How to add the widget`
- Teaser title: `Honest finish ring`
- Teaser body: `Watch the ring fill toward your real finish on the Lock Screen.`
- Teaser CTA: `Unlock the honest ring`
- No-module note: `Available on the App Store build.`

**Humanizer pass applied:** removed the em-dash from the overrun string; no "elevate/seamless/leverage"; no three-part lists; sentences read aloud naturally. No-guilt verified: overrun is framed as data, the empty state is calm, there is no "behind"/"late"/"missed"/red anywhere.

## 11. Edge cases & guardrails

- **No next task:** widget shows the calm empty state; `clearWidgetSnapshot()` is already called from `useToday` when `focus`/`honestMin` is null. ✓
- **Timer running over:** never red, never an alarm. Amber copy/keyline only. The Live Activity keeps counting (up, after finish). Honors no-guilt invariant.
- **App killed mid-timer:** the Live Activity persists (OS-owned) and the countdown keeps ticking from `finishDate` with zero pushes. `timerStore.resumeFromKv` rehydrates the in-app state on relaunch; the Activity is reconciled (if the store has no running timer on launch but an Activity exists, `endFinishTimeActivity()` cleans it — add this reconcile in the boot path that calls `resumeFromKv`).
- **Stale snapshot (>6h):** rendered as a bare clock, no confident "Honest finish" claim (§5.4).
- **Expo Go / tests / pre-link binary:** `getNativePresence()` returns the stub; every call is a no-op; analytics stay silent (`if (!presence.isStub)` guards already in the bridge). CI stays green.
- **Pre-iOS-16.2 / non-Dynamic-Island devices:** Live Activity needs 16.1+; the widget falls back to the system container background pre-iOS-17 (`widgetBackground()` already guards this). Devices without Dynamic Island still get the Lock-Screen Activity.
- **Privacy:** the App-Group payload contains only the task label, category name, a clock string, a deep link, reclaim minutes, and the Pro flag — all already on-device, no PII beyond what the user typed, no network. The widget does no calibration and reads nothing it wasn't handed. On-device invariant intact; no calendar anywhere.
- **Entitlement flips mid-session:** if a user upgrades while a timer runs, the next `updateLiveActivity`/snapshot write carries the new `isPro`; the ring appears on the next render. No need to force-refresh.
- **Activity limit / user-disabled Live Activities:** guard `areActivitiesEnabled`; if false, `startLiveActivity` no-ops and the widget still carries the presence. Never error.

## 12. Analytics  (event names + props)

Reuse the existing native-presence events (already typed in `analytics.ts`) and add the paywall trigger. All fire-and-forget, guarded by `!presence.isStub` so they're silent until the module lands.

- `widget_added` `{ surface: 'home' | 'lock' | 'live_activity' }` — already fired on Live Activity start. **Also fire `{ surface: 'home' }`** the first time a real (non-placeholder) snapshot is read — implement as a one-shot in the native `getTimeline` writing a `widget_seen` App-Group flag back, OR (simpler, no back-channel) fire `widget_added {surface:'home'}` from JS the first session `presenceAvailable()` is true and a snapshot was written. Prefer the JS approach (no Swift→JS channel needed).
- `widget_engaged` `{ surface: 'live_activity' }` — already fired on stop. **Add `{ surface: 'home' }`** on the widget Start deep-link open: detect the `whenbee://timer?taskId=…` deep-link source in the router and fire it.
- `paywall_view` `{ trigger: 'persistent_presence' }` — add `'persistent_presence'` to the trigger union; fired when the Settings teaser CTA opens the paywall.

No new event *names* are required beyond the trigger string — the funnel slots cleanly into the existing native-presence + monetization tables.

## 13. Build manifest & effort

**Native module (NEW) — the core remaining work:**
- `modules/whenbee-presence/expo-module.config.json` — **S**
- `modules/whenbee-presence/ios/WhenbeePresenceModule.swift` — **M** (5 methods, ActivityKit + App-Group)
- `modules/whenbee-presence/ios/FinishTimeAttributes.swift` — **S** (byte-identical copy)

**Swift widget targets (EDIT existing):**
- `targets/widget/expo-target.config.js` — add `Assets.xcassets` color set generation (or add the asset catalog directly) — **S**
- `targets/widget/Assets.xcassets/*` — the WB* color set (NEW assets) — **S**
- `targets/widget/NextTaskWidget.swift` — swap system colors → WB* assets; add the medium ring + reclaim line; add `isPro` + stale gating; add `honestFinishEpoch` ring fraction — **M**
- `targets/widget/FinishTimeActivity.swift` — add the Pro finish-time ring to Lock Screen + expanded island; gate rich vs minimal on `ContentState.isProRich`; WB* colors; overrun keyline `WBAccentEdge`; copy fix — **M**
- `targets/widget/SharedStore.swift` — add `honestFinishEpoch: Double?` + `isPro: Bool?` to `WidgetSnapshot`; add `arcFraction` + `kStaleSeconds` — **S**

**JS / RN (EDIT existing + small NEW):**
- `src/services/liveActivity.ts` — add `honestFinishEpoch` + `isPro` to `WidgetSnapshot`; add `isProRich` to the Live Activity attributes/state; add `presenceAvailable()` — **S**
- `src/features/today/useToday.ts` — include `honestFinishEpoch` + `isPro` in the existing `publishWidgetSnapshot` call — **S**
- `src/features/timer/useTimer.ts` — pass entitlement to `startFinishTimeActivity` (rich vs minimal) — **S**
- `src/engine/presence.ts` (NEW) + export in `src/engine/index.ts`; `__tests__/presence.test.ts` (NEW, TDD) — **S**
- `src/services/analytics.ts` — add `'persistent_presence'` to the `paywall_view` trigger union — **S**
- `src/features/paywall/` or `src/components/` — `PresenceRingTeaser.tsx` (RN Svg static ring) — **S/M**
- Settings screen (`src/app/.../settings` or the settings feature) — add the **Presence** row group — **S**
- Deep-link source tagging for `widget_engaged {surface:'home'}` in the router — **S**

**Dependencies:** none new. Uses existing `@bacons/apple-targets`, `expo-modules-core`, ActivityKit/WidgetKit (system), and `react-native-svg` (already in the app) for the teaser ring.

**Signing / device notes (cannot be done in CI or simulator — see `docs/NATIVE-PRESENCE.md`):**
- Set `ios.appleTeamId` in `app.json`.
- `npx expo prebuild --clean` after any `app.json` / target-config / module-config change (`ios/` is gitignored CNG — never hand-edit).
- Live Activities + Dynamic Island work **only on a physical device**; build with `npm run ios --device` or an EAS dev build.
- Verify the App-Group write with `defaults read group.com.whenbee.app whenbee.widgetSnapshot`.
- Confirm `widget_added` (surface `live_activity`) fires on timer start once the module is linked.

**Total effort: Med-High** — but ~70% is scaffolded; the real remaining cost is the native module (M) + the two Swift widget refinements (M+M). The JS side is a handful of S edits.

**Open questions:**
1. **Rich/minimal split mechanism for the Live Activity** — `ContentState.isProRich` (self-contained, survives updates, recommended) vs a second App-Group flag the widget reads. Decide before building the module; both are cheap but the contract must be picked once.
2. **`widget_added {surface:'home'}` timing** — JS one-shot on first available snapshot (recommended, no Swift back-channel) vs a real widget-impression signal (needs Swift→JS, heavier). Confirm the JS approximation is acceptable for the funnel.
3. **Mid-session arc refresh** — do we ever call `updateLiveActivity` purely to advance the arc (e.g. at the 50% mark), or is "digits live + arc steps on start/overrun only" sufficient? Leaning sufficient (avoids burning ActivityKit update budget), but flag for the funnel review.
4. **Asset-catalog generation via `@bacons/apple-targets`** — confirm the plugin emits the `Assets.xcassets` color set on prebuild, or whether the catalog must be committed under `targets/widget/` directly. (Affects the §13 `expo-target.config.js` edit.)
5. **Stale threshold** — 6h is a guess for "don't show a confidently wrong finish". Tune against real session gaps once live.
