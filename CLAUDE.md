# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this app is

Whenbee — a near-zero-friction iOS app for "time optimists". The user guesses a task duration, runs a one-tap timer, and the app learns their personal per-category bias (a multiplier), then shows an **honest number** wherever they plan. The wedge is **calibration**; the Pro feature is Honest-Day calendar padding.

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

**Full how-to — env setup, Expo Go vs. dev builds, EAS build/submit profiles, troubleshooting — is in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).** Use `npx expo install <pkg>` (not `npm install`) for Expo/RN deps, then `npx expo-doctor` (expect 18/18).

## Known gotchas (scaffold defaults that bite)

- **Dev build only — Expo Go cannot run this app.** Native modules (`react-native-purchases`, `@sentry`, `@expo/ui`, `expo-glass-effect`, `expo-dev-client`) make Expo Go spin forever. Use `npm run ios`.
- **`reactCompiler` + nativewind `jsxImportSource` drop function-form styles on `Pressable`.** `style={({ pressed }) => …}` silently renders nothing. Put visual style on an inner `View`; keep `Pressable` a bare touch wrapper (see `AppButton`/`Chip`). Read/write reanimated shared values with `.get()/.set()`, never `.value`.
- **No CSS `boxShadow`** on RN 0.81 / Fabric — it renders as a hard line, not a soft shadow. For depth use a View-based edge (see `AppButton`'s coin edge) or `Platform.select` shadow.
- **Footers/tab bar must add `useSafeAreaInsets().bottom`** — `Screen` only insets top/left/right, so anything pinned to the bottom otherwise sits under the home indicator.
- **Zustand persist + sync kv (`zustandKv`) rehydrates during `create()`.** Set hydration flags via the captured `state` in `onRehydrateStorage`, never the store const (TDZ → flag never flips → infinite boot spinner). See `onboardingStore`.
- **Fonts live in `src/assets/fonts/`**, not root `assets/`. `@/*` resolves both `./` and `./src/*` — check both roots before assuming a file is missing.
- **Verify UI on the sim:** there's no CLI tap. Reset onboarding by deleting `Documents/SQLite/ExpoSQLiteStorage` + `whenbee.db` in the app data container (`xcrun simctl get_app_container booted com.whenbee.app data`), then `xcrun simctl launch booted com.whenbee.app`; capture with `xcrun simctl io booted screenshot`.

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

## Deferred / fast-follow (build later — not in the shipped MVP)

These are intentionally **not built yet**. Build when prioritized; keep them off the on-device core loop.

- **Feedback board (highest of these):** anonymous-default feature-request + vote board. Needs a backend not yet wired into the app — add `@supabase/supabase-js`, env keys (project URL + anon key), a `src/services/feedback.ts` guarded so a network failure never touches the loop, a Settings entry, and the `feature_requests`/`feature_votes` tables + **RLS** in the user's Supabase project. It is a **separate data class** — never task/calibration data. (Was Phase F.1; deferred by the founder.)
- **Discoveries gallery:** banking aha/insight cards into a growing collection (`build-plan-final/03b §7`). The aha *card* already ships (category-detail); only the gallery surface + `discoveries` table defer.
- **Native `WhenbeePresence` Swift module:** the widget/Live Activity targets are scaffolded (`docs/NATIVE-PRESENCE.md`) but the App-Group-write + ActivityKit module is linked on the device build; the JS bridge is a guarded no-op until then.
- **Pro correlations + context tags** (the second paywall): the over/under reason *capture* ships (capture-only, model-isolated); only the correlation *read* + reason-aware honest number defer.

## TypeScript strictness

`strict`, `noUncheckedIndexedAccess`, and `noImplicitOverride` are all on. Indexed access returns `T | undefined` — handle the undefined case; do not silence with `!` unless provably safe.

## Testing discipline

TDD is required for all **logic-layer** code (engine, db, stores, services, `src/lib/*`). Write the test first. UI-only components don't require TDD but interaction/snapshot tests are welcome. The engine's purity makes it cheap to test exhaustively — keep it that way.

## Commits

Conventional Commits. **Never** add `Co-Authored-By` or AI-attribution trailers (project policy). Use the `/init-cmt` skill for commits (global rule).

## MANDATORY skill usage

These skills are **required**, not optional. Before writing or changing code in the matching area, invoke the skill via the Skill tool and follow it. When several apply, invoke all relevant ones (e.g. a new RN screen → `react-native-expert` + `typescript-expert` + `clean-code` + `coding-standards`).

| When you are… | Invoke skill(s) |
|---|---|
| Writing/editing **any** code (always, baseline) | `clean-code`, `coding-standards` |
| Writing/editing any **TypeScript** — types, generics, engine/domain contracts | `typescript-expert` |
| Building or changing **React Native components, screens, hooks, navigation, native integrations** | `react-native-expert` |
| Optimizing RN **performance, re-renders, lists, bundle, startup** | `vercel-react-native-skills` |
| Making **architecture/structure** decisions — new layers, stores, data flow, module boundaries, folder layout | `react-native-architecture` |
| Making **any design decision** — spacing, sizing, fonts/typography, layout, color, visual hierarchy, creating or styling **any** UI element | `ui-design:react-native-design` |
| Creating, editing, or adding **any animation or transition** — Reanimated worklets, gestures, micro-interactions, screen/page transitions, loading/state motion | `creating-reanimated-animations`, `motion-design` |
| Writing or editing **any user-facing copy** — strings, labels, button text, headings, onboarding/paywall/empty-state text, microcopy, errors, notifications | `conversion-psychology`, `humanizer` |

Process skills come first: for new features run `superpowers:brainstorming` before implementing; for bugs run `superpowers:systematic-debugging` before proposing a fix. Then the implementation skills above.

### Design, motion & copy — HARD RULE

- **`ui-design:react-native-design` is mandatory for every design-related change.** No spacing value, font size, element, or layout gets chosen by eye or guessed — invoke the skill first and let it drive the decision so spacing rhythm, type scale, and alignment are deliberate.
- **Every spacing/size/font/color value MUST come from a theme token in `src/theme/tokens.ts`** via `useTheme()`. Never inline a raw number or hex. If the value you need doesn't exist as a token, **add it to `tokens.ts`** (it'll be reused) and consume the token — do not hardcode a one-off.
- **`creating-reanimated-animations` + `motion-design` are mandatory before writing or touching any animation.** Invoke both whenever motion is created, edited, or added — timing, easing, and choreography come from the skills, not arbitrary durations. (Honor the project invariants: no guilt motion; honey/sharpness stays monotonic.)
- **`conversion-psychology` + `humanizer` are mandatory for every piece of user-facing copy.** Any string a user reads — labels, buttons, headings, onboarding/paywall/empty-state, microcopy, errors, notifications — gets shaped by `conversion-psychology` (persuasion, clarity, motivation) and passed through `humanizer` (strip AI-slop tells). No raw, generic, AI-sounding text ships. (Honor the project invariant: no guilt/shame language — never violate it for the sake of conversion.)
