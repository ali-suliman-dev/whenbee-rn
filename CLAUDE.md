# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this app is

Whenbee — a near-zero-friction iOS app for "time optimists". The user guesses a task duration, runs a one-tap timer, and the app learns their personal per-category bias (a multiplier), then shows an **honest number** wherever they plan. The wedge is **calibration** (free); **Pro is a payoff bundle** — PDF report export, the Honest Week/Month review ritual, day-capacity check, confidence band, persistent presence, routines, long-range history, hyperfocus guardrail, focus-window planner, per-category goals + the existing correlations. Specs: `docs/product/specs/`.

> **⛔ DO NOT SUBMIT TO THE APP STORE until every P0 + P1 item in [`docs/product/11-APP-STORE-LAUNCH-BLOCKERS.md`](docs/product/11-APP-STORE-LAUNCH-BLOCKERS.md) is checked off.** That doc is the pre-submission gate from the 2026-06-21 reviewer-mindset audit — it lists real rejection/friction risks (missing paywall Terms+Privacy links, privacy-disclosure mismatch with PostHog/Sentry, no hosted Privacy Policy URL, iPad layout, stray permission strings, Apple-LLM crash guard, encryption flag) with a fix plan and production-ready legal/reviewer copy for each. **If the user asks to ship, launch, submit, or build for the App Store, point them at this doc first and confirm the gate is clear.** Open the doc, don't summarize from memory — the checklist is the source of truth.

> **⚠️ CALENDAR / HONEST-DAY IS BACK — as a Pro feature (decided 2026-06-21).** It was dropped 2026-06-19, then reinstated. **Do NOT remove calendar code, the `expo-calendar` plugin, or `NSCalendarsUsageDescription` in `app.json`** — they ship. The earlier "B2 removal" in `docs/product/02-GAP-ANALYSIS.md` is **void**. Calendar / Honest-Day belongs in the **Pro bundle**. Anything in the docs that still says "calendar dropped" is stale — this note wins.

**Product invariants — never violate these:**

- **No guilt, ever.** Amber never becomes red; no streaks, no shame mechanics.
- **Honey/sharpness is monotonic.** Tier never goes backward.
- **Core loop is on-device-only.** No network call in the guess → timer → learn loop.
- **Pricing is read from RevenueCat**, never hardcoded.

## Commands

```bash
npm start              # Metro / expo start
npm run ios            # native iOS build (dev client)
npm run lint           # eslint . --max-warnings=0  (0 warnings or it fails)
npm run typecheck      # tsc --noEmit
npm run format         # prettier --write .
npm test               # jest

npx jest <path>        # single test file   (e.g. src/engine/__tests__/engine.test.ts)
npx jest -t "<name>"   # tests matching a name
```

Run lint + typecheck + test before every commit — CI runs the same set on every push/PR and blocks merge on failure. After editing specific files, lint just those: `npx eslint <files>` (this repo uses the flat `eslint.config.js` — there is no `.eslintrc.js`).

**ALWAYS run the tests after any code change — never report a task done without it.** Run the affected suite (`npx jest <path>`) plus the full suite (`npm test`) before claiming a change works. If a CI failure looks flaky (passes locally), do NOT shrug it off — reproduce the race and fix the root cause; a test that passes only sometimes is a real bug (usually an async/effect ordering window in the code under test, not "just CI").

**Full how-to — env setup, Expo Go vs. dev builds, EAS build/submit profiles, troubleshooting — is in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).** Use `npx expo install <pkg>` (not `npm install`) for Expo/RN deps, then `npx expo-doctor` (expect 18/18).

## Modal / sheet UI — HARD RULE

**Every modal and sheet MUST use `headerShown: false`.** The native iOS header bar is a white bar that clashes with the dark-themed app on every mode. It is NEVER acceptable. Rules:

- Every `<Stack.Screen>` entry in `src/app/(modals)/_layout.tsx` must have `headerShown: false`. No exceptions.
- Any new modal route added to `(modals)/` must be explicitly listed in `_layout.tsx` with `headerShown: false` — unlisted screens fall through to the layout default and will show a header.
- Screens must render their own title using `type.subtitle` + `t.colors.ink` (see `add-task.tsx` for the pattern).
- Sheets that slide up (non-full-screen) must start with `<SheetGrabber />`.
- Never set `presentation: 'card'` on a modal that has content — use `formSheet` or `fullScreenModal`.
- **formSheet side gutters live on the native `contentStyle: { paddingHorizontal: t.space[5] }` in `src/app/_layout.tsx`** (sheet screens pass `horizontalPadding={false}` to `<Screen>`). react-native-screens drops the LEFT padding of a padded JS child inside a native sheet, so the gutter MUST come from `contentStyle` — if that line is lost (e.g. a merge), EVERY drawer goes edge-to-edge. Don't re-add per-screen `paddingHorizontal`.
- **react-native-screens' formSheet collapses a `flex:1` child to its content height** → pinned bottom footers/controls float mid-sheet with dead space below. Anchor the root column to the sheet height to pin them: `minHeight: winH * 0.95 - insets.bottom` (0.95 = the sheet detent; `winH` from `useWindowDimensions`). See `timer.tsx` / `add-task.tsx`.

## Animation — HARD RULE (no tacky entrances)

**Never animate a UI element by sliding it up into place and bouncing.** A content element that translates in (translateY) and settles with a spring/overshoot — "drops in and bounces" — is tacky and banned. Specifically:

- **No spring/bounce/overshoot on content entrances.** No `withSpring` that overshoots, no bounce easing on text, cards, badges, numbers. Entrances settle, they don't wobble.
- **No translate-in slides on content** (text, stats, badges rising up into place). Fade with opacity instead.
- **Never animate buttons** in/out/up/down on entrance — with one deliberate, approved exception: the **onboarding CTA**. `Reveal.tsx`'s staggered `FadeInDown` (used by `welcome.tsx` / `categories.tsx` / `ready.tsx`) is intentional and approved (founder, 2026-07-15) — do NOT "fix" it to `FadeIn`. Everywhere else a button appears at full opacity, full size. Don't fade, slide, or pop it in.
- **What IS allowed:** animate the actual SVG **paths** (draw, fill, morph — e.g. the bee's micro-life), **opacity** fades, a **subtle resize** (scale settling with `ease-out`, no overshoot), or a small **wiggle**. Prefer path/opacity/scale over moving elements around.
- Durations stay short (UI < ~300ms; a hero reveal may stagger opacity fades but each ≤ the motion tokens). Reduced-motion → final state, no travel.

This applies everywhere. The archetype reveal is the content reference: card fades + settles a hair in scale, the bee animates its paths, text fades — nothing slides up, nothing bounces. The one carve-out is the onboarding CTA entrance noted above (`Reveal.tsx`'s `FadeInDown`), which is approved and stays.

## Button sizing — HARD RULE

**Onboarding and primary-CTA buttons use the standard `AppButton` default size. Never `size="lg"` for them.** `lg` (52pt tall, 20pt label, 24 padX) reads as an oversized, clumsy slab next to the rest of the flow. The onboarding `Continue` / `Get started` / `Next` / `Open my day` buttons are all the default `AppButton` (md) — keep every onboarding primary button visually identical. A quiz `Next` in a Skip+Next row is the default size inside a `flex:1` container, not `lg`.

## Known gotchas (scaffold defaults that bite)

- **Dev build only — Expo Go cannot run this app.** Native modules (`react-native-purchases`, `@sentry`, `@expo/ui`, `expo-glass-effect`, `expo-dev-client`) make Expo Go spin forever. Use `npm run ios`.
- **`reactCompiler` + nativewind `jsxImportSource` drop function-form styles on `Pressable`.** `style={({ pressed }) => …}` silently renders nothing. Put visual style on an inner `View`; keep `Pressable` a bare touch wrapper (see `AppButton`/`Chip`). Read/write reanimated shared values with `.get()/.set()`, never `.value`.
- **No CSS `boxShadow`** on RN 0.81 / Fabric — it renders as a hard line, not a soft shadow. For depth use a View-based edge (see `AppButton`'s coin edge) or `Platform.select` shadow.
- **Drag-and-drop reorder "flash" = a per-row `entering` animation replaying.** `react-native-reorderable-list` swaps its **whole `data` array** on a drop, re-mounting cells → any Reanimated `entering` prop on a row (e.g. `FadeIn`) **re-fires on every reorder**, so rows blink from invisible → visible = the flash. The library's own docs flag this (they point to `LayoutAnimationConfig` to strip entering/exiting). Fix: let the entrance fade play **once on mount**, then drop the `entering` prop (guard it with a state flag flipped by a short `setTimeout` ~ the stagger duration) so a reorder just glides — the library animates the move itself. See `DayTimeline.tsx` (`entrancesDone`). Separately, to make the dropped row settle **instantly** (not after the async store round-trip), render an **optimistic local order** from the drop and persist in the background; reconcile by comparing a **stable task-id STRING**, never the plan object — `useDayPlan` recomputes a fresh plan every render off `Date.now()`, so a ref/identity check clears the override the next frame and the lag returns.
- **Footers/tab bar must add `useSafeAreaInsets().bottom`** — `Screen` only insets top/left/right, so anything pinned to the bottom otherwise sits under the home indicator.
- **Zustand persist + sync kv (`zustandKv`) rehydrates during `create()`.** Set hydration flags via the captured `state` in `onRehydrateStorage`, never the store const (TDZ → flag never flips → infinite boot spinner). See `onboardingStore`.
- **Fonts live in `src/assets/fonts/`**, not root `assets/`. `@/*` resolves both `./` and `./src/*` — check both roots before assuming a file is missing.
- **`react-native-svg` ignores `pathLength`.** A stroke-draw via `strokeDasharray={1}`+`pathLength={1}` renders DOTTED, not normalized. Dash by the path's REAL length (`strokeDasharray={len}`, animate `strokeDashoffset` `len→0`), and OVERESTIMATE `len` — if it's shorter than the true path the tail stays permanently hidden (a gap in the shape at rest). See `ArchetypeQuizGlyph`.
- **Verify UI on the sim:** there's no CLI tap. Jump straight to a mid-flow screen with a deep link — `xcrun simctl openurl booted "whenbee:///(onboarding)/quiz/0"` (scheme `whenbee`, expo-router path) — then `xcrun simctl io booted screenshot`. (To restart onboarding from scratch instead, delete `Documents/SQLite/ExpoSQLiteStorage` + `whenbee.db` in the app data container — `xcrun simctl get_app_container booted com.whenbee.app data` — then `xcrun simctl launch booted com.whenbee.app`.) Deep-link can't trigger taps, so press-driven animations still need a manual tap on the connected sim.
- **Worktree Android device build:** a worktree's `node_modules` can be missing hoisted deps and the global Metro cache goes stale → `Unable to resolve module …` at the `createBundleReleaseJsAndAssets` Gradle task. Fix: `npm ci` in the worktree **and** `rm -rf ~/.tmp/metro-cache` before `assembleRelease`. The Android device build (prebuild → `assembleRelease` → `adb install`) is wrapped by the `whenbee-device` skill's `build-and-launch-android.sh`.
- **`ActionSheetIOS` is iOS-only — it CRASHES on Android.** Never use it. Use the cross-platform `src/components/ActionSheet.tsx` (controlled: `visible`/`items`/`onCancel`) for any menu/picker. (add-task's date picker crashed on Android because it still called `ActionSheetIOS`.)
- **Android formSheet keyboard won't auto-rise for an input.** A react-native-screens `formSheet` is presented in its OWN window; focusing during the slide-up (via `autoFocus`, a `setTimeout`, or even `transitionEnd`/`onAppear`) lands before that window owns IME focus → Android silently drops the keyboard, and no delay-tuning wins the race. Fix = let `autoFocus` fire on a FRESH mount once the screen owns focus: re-`key` the `TextInput` on `useIsScreenFocused()` + a `requestAnimationFrame(() => ref.focus())` in `onLayout`. rn-screens fixed this natively only in **4.19**; we're pinned to 4.16. See `TaskTitleField.tsx`. Works via deep-link but NOT warm in-app push, so verify the actual push path.
- **Tests that render `TaskTitleField` must mock expo-router `useNavigation`** (it now uses `useIsScreenFocused`): `useNavigation: () => ({ isFocused: () => true, addListener: () => () => {} })`. Missing it → `useNavigation is not a function`.
- **⛔ Android device rebuild is DATA-SAFE only WITHOUT a prebuild.** `app.json` has **no `android.versionCode`** (the generated `android/app/build.gradle` is hand-set, currently `3`). `npx expo prebuild -p android` regenerates build.gradle and resets versionCode to **1** → `adb install -r` fails `INSTALL_FAILED_VERSION_DOWNGRADE` → the only install path is `adb uninstall` = **wipes the founder's data (never do this)**. For JS/native-source changes DON'T prebuild — the `whenbee-device` script only prebuilds if `android/gradlew` is missing, so plain `assembleRelease` + `install -r` keeps versionCode + the `debug.keystore` (same signing key) + all data. If you MUST prebuild (new native dep / `app.json` plugin change), set `android.versionCode` ≥ installed FIRST. Also never `--clean` (regenerates the keystore → `INSTALL_FAILED_UPDATE_INCOMPATIBLE` → forces uninstall). Verify a running timer's presence on device via `adb shell dumpsys notification` after a cold `am start -a android.intent.action.VIEW -d 'whenbee:///timer?label=X&estimateMin=25&guessMin=25'` (route group `(modals)` is stripped from the URL; wait ~15s for JS boot).
- **On-device verification quirks:** the Release build is **not debuggable** → `run-as`/on-device `sqlite3` is DENIED, so verify a *logged* value (actualMin/category/guess) from the **reward screen** via `adb exec-out screencap`, not the DB. Drive the UI with `adb shell input tap <x> <y>` (multiply screencap-displayed coords by the reported scale to get device px). Quick-start test flow: center FAB (opens the arc) → the indigo play button = Timer/quickStart. **Every on-device timer stop LOGS a real event into the founder's calibration** — end a throwaway test via the capture sheet's **"Skip for now"** (abandons, no log), never Save, and tell the founder which test logs you added (they can clear a category via the app's reset).
- **⚠️ `adb shell input tap` does NOT reliably trigger the reanimated FAB / small chips** (the animated `Pressable` swallows synthetic taps). Don't loop on coordinates. Reach a screen by deep link instead (`adb shell am start -a android.intent.action.VIEW -d 'whenbee:///add-task'`) and read state from `adb shell dumpsys input_method` (`mInputShown`, `mServedView`) / `screencap`; hand the actual in-app button path to the founder for tap-driven confirmation.
- **To device-test an uncommitted PR branch on the founder's Android, do NOT build from a git worktree.** The worktree's symlinked `node_modules` breaks the Gradle JS bundle (`createBundleReleaseJsAndAssets` → node exit 1), and a fresh `npm ci` there hits a reanimated↔worklets CMake link race (`libworklets.so … missing and no known rule to make it`). Reliable path: overlay the branch's source files onto MAIN — `git checkout <branch> -- <files>` — run the `whenbee-device` Android script (reuses main's warm native build; `install -r` = data-safe, versionCode stays 3), then revert main (`git reset --hard HEAD` + `rm` the new untracked files). Main's git HEAD / node_modules / founder data stay untouched.

## Architecture big picture

Detailed layout is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/THEMING.md](docs/THEMING.md). The non-obvious cross-file structure:

**Layered, one-directional data flow:**

```
UI (src/app, src/components, src/features)
   → stores (src/stores, Zustand) / providers / feature hooks
      → services (src/services) + db (src/db)
         → engine (src/engine, PURE) ← domain types (src/domain)
```

- **`src/engine/` is pure TypeScript** — no React, RN, Expo, or clock/`Date.now()` access. It is the calibration core (priors → ratio clamp → EWMA → blend-with-prior → honest number → sharpness tiers → insight/trend) plus the read-only reverse **Start-By planner**. All of it is exported through `src/engine/index.ts` and is the most heavily unit-tested area. Tune behavior via `src/engine/constants.ts`, not scattered magic numbers.
- **`src/domain/types.ts` is the contract** between engine, db, stores, and UI. Also pure TS. Change types here first.
- **`src/db/` is the system of record.** `TaskEvent` rows are raw logs; only `status: 'completed'` trains the model. There are two `Database` implementations behind one interface — `createMemoryDatabase` (tests/Expo Go) and `createSqliteDatabase` (`expo-sqlite`) — selected in `client.ts`. Access data through repositories (`categoryStatsRepo`, `taskEventsRepo`, `recurringRepo`), never raw SQL from features.
- **`src/lib/kv.ts` is the only KV persistence** (wraps `expo-sqlite/kv-store`, synchronous, Expo Go-safe). Nothing else writes persistent KV.

**Hard boundaries (ESLint-enforced — see `eslint.config.js`):**

- `src/app/**` and `src/components/**` must **not** import `@/src/services/*` or `@/src/db/*` directly. Route through a store, provider, or feature hook.
- Routes in `src/app/` are **thin** — no business logic; it lives in `src/features/*` hooks and `src/stores/*`.

**Two component dirs — don't confuse them:** root `components/ui/` holds generated **gluestack-ui** primitives (`box`, `button`, `text`, `hstack`…) — leave these alone. App components live in `src/components/` (`AppButton`, `HonestNumber`, `Screen`…) and are what the ESLint `src/components/**` boundary covers. Build new UI in `src/components/`, not root `components/`.

**Theming:** all colors/spacing come from `src/theme/tokens.ts` via `useTheme()`. Two independent theming surfaces exist (app tokens vs. gluestack-ui config) — read [docs/THEMING.md](docs/THEMING.md) before touching styles.

**Native guards:** native-only code (real RevenueCat, full Sentry) must check `src/lib/isExpoGo.ts` at runtime and stub gracefully.

**Path aliases:** `@/*` resolves to both `./` and `./src/*` (tsconfig + babel-plugin-module-resolver). `import/no-unresolved` is off because Metro resolves the alias.

## Project status — this is a code-complete v1, NOT an MVP

Whenbee is **not an MVP**. Nearly the entire final build plan is implemented in `src/`: the full calibration engine, the Honeycomb + Whenbee companion (6 stages, capability unlocks, drift-health), the Reclaim Bank, the **Discoveries gallery**, the Start-By planner, the Patterns self-insight tab **including the Pro correlations** (steals-your-time, accuracy, context), RevenueCat monetization, onboarding, settings, PostHog + Sentry. The **calendar / Honest-Day feature is reinstated as a Pro feature** (2026-06-21, reversing the 2026-06-19 drop) — its code STAYS; the B2 removal in `docs/product/02-GAP-ANALYSIS.md` is void (see the flag at the top of this file). Treat this as a near-shippable product — the remaining work is the new Pro bundle, finishing, device verification, and launch. **Full picture: [docs/product/](docs/product/) (start at `README.md` → `00-STATUS.md` → `02-GAP-ANALYSIS.md`).**

### Genuinely not built yet (future / post-launch)

Keep these off the on-device core loop. The first three are the real pre-launch gaps; the rest are gated on hitting **D7 ≥ 25%**.

- **Feedback board:** anonymous-default feature-request + vote board. Needs `@supabase/supabase-js`, env keys, a guarded `src/services/feedback.ts`, a Settings entry, and `feature_requests`/`feature_votes` tables + **RLS**. A **separate data class** — never task/calibration data. Build before TestFlight.
- **Native `WhenbeePresence` module — iOS side:** widget/Live Activity targets are scaffolded (`docs/NATIVE-PRESENCE.md`); the App-Group-write + ActivityKit module links on the device build (needs a **paid** Apple team). The JS bridge (`services/liveActivity.ts`) is a guarded no-op until then. The static widget is "never cut"; the Live Activity may fast-follow.
- **Android presence IS built (native — this feature branch/PR).** Home-screen widget + persistent live-timer notification, both in the `modules/whenbee-presence` Expo module (Kotlin), fed by the same `liveActivity.ts` bridge via `createAndroidPresence` + `androidPresence.android.ts` → native `WhenbeePresence` module. **Do NOT use `react-native-android-widget`** — it renders blank + crashes on Android 16; we removed it. Full detail: `docs/NATIVE-PRESENCE.md` (Android section). Android presence needs **no paid account**.
  - **Widget** = native RemoteViews `AppWidgetProvider` (API 24+). RemoteViews only allows whitelisted views — a bare `<View>` ⇒ "Can't load widget"; use only FrameLayout/LinearLayout/RelativeLayout/TextView/ImageView/ProgressBar/Chronometer. Fed by native `writeWidgetSnapshot(json)` → SharedPreferences `"<pkg>.presence"` key `widget`; `arcFraction` is mirrored in Kotlin from `src/engine/presence.ts`.
  - **Persistent notification** = Android-16 promoted "Live Update" (status-bar chip near the clock + pinned lock screen): `setRequestPromotedOngoing(true)` + `POST_PROMOTED_NOTIFICATIONS` + a **system style** (`ProgressStyle`). Promotion **forbids custom RemoteViews** (`setCustomContentView`) — a custom big-timer layout silently demotes it (grouped, no chip). Live countdown = system **chronometer** (`setUsesChronometer`+`setChronometerCountDown`+`setWhen(future)`), ticks with no process; **seconds show in the chip only if `setShortCriticalText` is NOT set**. ProgressStyle's bar is **manual** → advanced by a self-rescheduling ~45s AlarmManager re-post (`ACTION_PROGRESS`). Overrun flip = native AlarmManager at finish (`ACTION_OVERRUN`) — a JS `setTimeout` won't fire while backgrounded/locked.
  - **Min API:** promoted Live Update + ProgressStyle are **API 36 only**; API 24–35 degrades to a plain ongoing chronometer notification (no chip/pin). Requires **androidx.core 1.17.0** (bumped app-wide) for `setRequestPromotedOngoing`/`ProgressStyle`.
  - **⛔ Promotion disqualifiers — these SILENTLY break the chip (→ bare icon dot) and the pinned lock-screen card. This shape is verified-working (2026-07-05); do not regress it:** (1) **NEVER `setColorized(true)`** — a colorized notification is NOT promotable; `setColor(...)` accent tint is fine. (2) **Channel must be `IMPORTANCE_DEFAULT`, not LOW** — LOW lands it in the lock screen's SILENT bucket → collapses to an icon (the clock chip still works at LOW, but the pinned lock-screen CARD needs DEFAULT; sound stays off via `setSound(null,null)`). Channel importance is locked after creation → raising it needs a NEW channel id (`whenbee.timer.v2`). (3) **`POST_PROMOTED_NOTIFICATIONS` must be in the BUILT APK** — it's in `app.json`, but `android/` is CNG and a stale prebuild drops it (promotion then denied); if the generated `android/app/src/main/AndroidManifest.xml` lacks it, add it there directly. **Verify on device:** `adb shell dumpsys notification` → flag `PROMOTED_ONGOING`, `importance=3`, `Aggregate_AlertingSection` (NOT `Aggregate_SilentSection`).
  - **⛔ Notification "Stop & log" / guardrail "Wrap up" MUST log from the timer STORE, never route params.** Both deep-link `whenbee:///timer?action=stop`; `timer.tsx` returns a bare `<PresenceStopHandler/>` for that (it does NOT mount `useTimer`) which calls `stopPresenceSessionAndLog()` in `src/features/timer/stopPresenceSession.ts` — reads startedAt/category/guess/honest/label/taskId from `useTimerStore` (calls `resumeFromKv()` on cold boot; the store uses MANUAL KV persist, not zustand auto-rehydrate), computes `actualMin` via the store's `stop()`, then applyLog + reward (mirrors `useTimer.onStopAndLog`'s non-quick branch). **Do NOT route the stop through the timer SCREEN** — the deep link carries no session context, so `useTimer` fails to match and calls `start()` with defaults (startedAt=now) → logs ~0 elapsed against the wrong category/guess (the exact bug fixed 2026-07-05). Quick-start → returns `'needs-capture'` → opens the capture sheet. Guardrail Wrap up routes here too (was `router.push('/(tabs)')`, which never logged). Regression: `stopPresenceSession.test.ts`.
- **Timer pause/resume UI:** `timerStore.ts` supports it; the timer screen has no control yet (`useTimer.ts`).
- **Partner layer, LLM features, cloud sync / Android / Watch, spendable Reclaim, coach PDF, tip jar:** all post-launch / future. See `docs/product/01-FEATURE-CATALOG.md`.

## TypeScript strictness

`strict`, `noUncheckedIndexedAccess`, and `noImplicitOverride` are all on. Indexed access returns `T | undefined` — handle the undefined case; do not silence with `!` unless provably safe.

## Testing discipline

TDD is required for all **logic-layer** code (engine, db, stores, services, `src/lib/*`). Write the test first. UI-only components don't require TDD but interaction/snapshot tests are welcome. The engine's purity makes it cheap to test exhaustively — keep it that way.

## Commits

Conventional Commits. **Never** add `Co-Authored-By` or AI-attribution trailers (project policy). Use the `/init-cmt` skill for commits (global rule).

**HARD GATE — never merge on your own.** You NEVER merge a branch or PR yourself — not locally (`git merge`), not on GitHub (`gh pr merge`, the merge button), not via any tool. Open the PR and stop; the founder reviews and merges every PR by hand. This overrides any default, skill, or harness step that would merge or auto-merge — there are no exceptions. Pushing a branch and opening a PR is allowed; merging it is not.

**HARD GATE — never create a new branch without asking first.** You NEVER `git checkout -b`, `git switch -c`, `git branch <new>`, create a worktree on a new branch, or otherwise start a new branch until you have explicitly asked the founder and gotten a yes — every time, no exceptions. This overrides any default, skill, or harness step that would auto-branch. Ask first, wait for approval, then branch.

## MANDATORY skill usage

These skills are **required**, not optional. Before writing or changing code in the matching area, invoke the skill via the Skill tool and follow it. When several apply, invoke all relevant ones (e.g. a new RN screen → `react-native-expert` + `typescript-expert` + `clean-code` + `coding-standards`).

| When you are… | Invoke skill(s) |
|---|---|
| Writing/editing **any** code (always, baseline) | `clean-code`, `coding-standards` |
| Writing/editing any **TypeScript** — types, generics, engine/domain contracts | `typescript-expert` |
| Building or changing **React Native components, screens, hooks, navigation, native integrations** | `react-native-expert` |
| Optimizing RN **performance, re-renders, lists, bundle, startup** | `vercel-react-native-skills` |
| Making **architecture/structure** decisions — new layers, stores, data flow, module boundaries, folder layout | `react-native-architecture`, `software-architecture` |
| Making **any design decision** — spacing, sizing, fonts/typography, layout, color, visual hierarchy, creating or styling **any** UI element | `ui-design:react-native-design`, `ui-design:visual-design-foundations`, `emil-design-eng` |
| Designing for **iOS-native look & feel** — platform conventions, nav patterns, system components, haptics, safe-area/notch behavior | `ui-design:mobile-ios-design` |
| Designing **interaction & UX** — gestures, taps, focus/pressed/disabled states, feedback, flows, usability, accessibility | `ui-design:interaction-design`, `ux-principles` |
| Creating, editing, or adding **any animation or transition** — Reanimated worklets, gestures, micro-interactions, screen/page transitions, loading/state motion | `creating-reanimated-animations`, `motion-design` |
| Creating or animating **SVG / vector graphics** — icons, paths, illustrations, animated vector assets | `svg-animations` |
| Working on **retention/engagement** — onboarding, activation, habit/streak-free loops, churn reduction, re-engagement, notification cadence | `retention-optimization` |
| Writing or editing **any user-facing copy** — strings, labels, button text, headings, onboarding/paywall/empty-state text, microcopy, errors, notifications | `conversion-psychology`, `humanizer` |

Process skills come first: for new features run `superpowers:brainstorming` before implementing; for bugs run `superpowers:systematic-debugging` before proposing a fix. Then the implementation skills above.

### Design, motion & copy — HARD RULE

- **The design skill set is mandatory for every design-related change** — `ui-design:react-native-design` + `ui-design:visual-design-foundations` + `emil-design-eng` for any visual/layout work, plus `ui-design:mobile-ios-design` for iOS-native fit and `ui-design:interaction-design` + `ux-principles` for any interaction/flow/state. No spacing value, font size, element, or layout gets chosen by eye or guessed — invoke the relevant skills first and let them drive the decision so spacing rhythm, type scale, alignment, and interaction states are deliberate.
- **`svg-animations` is mandatory before creating or animating any SVG/vector asset** — icons, paths, illustrations. Don't hand-roll vector motion.
- **`retention-optimization` is mandatory for any retention/engagement work** — onboarding, activation, re-engagement, notification cadence, loop design. (Honor the project invariants: no guilt, no streaks, no shame mechanics — never trade them for engagement.)
- **`software-architecture` is mandatory (with `react-native-architecture`) for any structural decision** — new layers, stores, module boundaries, data flow, folder layout.
- **Every spacing/size/font/color value MUST come from a theme token in `src/theme/tokens.ts`** via `useTheme()`. Never inline a raw number or hex. If the value you need doesn't exist as a token, **add it to `tokens.ts`** (it'll be reused) and consume the token — do not hardcode a one-off.
- **`creating-reanimated-animations` + `motion-design` are mandatory before writing or touching any animation.** Invoke both whenever motion is created, edited, or added — timing, easing, and choreography come from the skills, not arbitrary durations. (Honor the project invariants: no guilt motion; honey/sharpness stays monotonic.)
- **`conversion-psychology` + `humanizer` are mandatory for every piece of user-facing copy.** Any string a user reads — labels, buttons, headings, onboarding/paywall/empty-state, microcopy, errors, notifications — gets shaped by `conversion-psychology` (persuasion, clarity, motivation) and passed through `humanizer` (strip AI-slop tells). No raw, generic, AI-sounding text ships. (Honor the project invariant: no guilt/shame language — never violate it for the sake of conversion.)
