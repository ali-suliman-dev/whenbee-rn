# Contributing

## Commit conventions

Use [Conventional Commits](https://www.conventionalcommits.org/). Examples:

```
feat: add haptic feedback to primary button
fix: guard RevenueCat import behind isExpoGo
refactor: extract useEntitlement from paywall screen
docs: update ARCHITECTURE layer rule
chore: bump eslint-config-expo
```

**Never add `Co-Authored-By` or AI-attribution trailers to commits.** This is project policy.

## Before every commit

```bash
npm run lint       # must pass with 0 warnings
npm run typecheck  # must pass with 0 errors
npm test           # all tests must pass
```

CI runs the same three checks on every push and pull request. A failing check blocks the merge.

## Test-driven development for logic

Write tests first for all logic-layer code:

- Design tokens (`src/theme/tokens.ts`)
- KV store wrapper (`src/lib/kv.ts`)
- Environment helpers (`src/lib/env.ts`)
- Runtime guards (`src/lib/isExpoGo.ts`)
- Zustand stores (`src/stores/`)
- Service modules (`src/services/`)

UI-only components (layout, visuals) do not require TDD, but snapshot or interaction tests are welcome.

## File and layer conventions

- **Keep files small and single-responsibility.** If a file is doing two things, split it.
- **Respect the layer import boundary.** `src/app/**` and `src/components/**` must not import from `src/services/*` or `src/db/*` directly. Route data through a store, provider, or feature hook. This is ESLint-enforced.
- **No hardcoded colors or spacing.** Always use `useTheme()` and the tokens from `src/theme/tokens.ts`.
- **Guard native-only code.** Anything that requires a real native build must check `isExpoGo` at runtime and stub gracefully.

## Adding a new screen

1. Create a route file in `src/app/` (keep it thin — no business logic).
2. Create a feature hook in `src/features/` if the screen needs non-trivial state or side effects.
3. Use existing primitives (`Screen`, `AppText`, `AppButton`, etc.) rather than styling from scratch.

## Adding a new service

1. Create the module in `src/services/`.
2. If it requires native APIs not available in Expo Go, wrap the import with `isExpoGo`.
3. Expose it to screens via a store or provider — not by direct import from a route file.
4. Write unit tests covering the happy path and any error / stub branches.
