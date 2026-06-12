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

Process skills come first: for new features run `superpowers:brainstorming` before implementing; for bugs run `superpowers:systematic-debugging` before proposing a fix. Then the implementation skills above.
