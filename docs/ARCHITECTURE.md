# Architecture

## Folder layout

```
src/app/            expo-router routes (kept THIN)
                      Groups: (onboarding), (tabs), (modals)
                      Plus: index (boot gate), settings

src/components/     App UI primitives: Screen, AppText, AppButton, Card, Chip
                      All token-driven via useTheme()

components/ui/      gluestack-ui v3 generated components (ESLint-ignored)

src/theme/          tokens.ts — THE design-token source
                    useTheme — resolves tokens for the current color mode
                    useColorMode — reads / sets color mode

src/stores/         Zustand stores
                      settingsStore  — colorMode (system | light | dark)
                      onboardingStore — completion flag

src/services/       analytics (PostHog), purchases (RevenueCat, guarded), haptics

src/features/       Feature-scoped hooks and components
                      onboarding/useOnboarding
                      paywall/useEntitlement + ProGate

src/providers/      AppProviders — gesture root, safe-area, gluestack, PostHog,
                      PostHog error boundary + init

src/lib/            kv       — KV store wrapper (expo-sqlite/kv-store)
                    env      — typed EXPO_PUBLIC_* environment variables
                    isExpoGo — runtime guard for native-only features
```

## Layer import rule (ESLint-enforced)

UI layers (`src/app/**`, `src/components/**`) must **not** import from `src/services/*` or `src/db/*` directly. Reach services through a store, provider, or feature hook. This rule is enforced by the ESLint config and will cause a CI failure if violated.

## Boot flow

1. `src/app/index.tsx` renders while the onboarding store hydrates from the KV store.
2. Once hydrated:
   - Onboarding complete → redirect to `(tabs)`.
   - Not complete → redirect to `(onboarding)/welcome`.

## Key design principles

- **Routes are thin.** Business logic lives in feature hooks and stores, not in screen files.
- **Primitives are token-driven.** `Screen`, `AppText`, `AppButton`, `Card`, and `Chip` read from `useTheme()` and use `style` props — no hardcoded colors or spacing.
- **Native-only code is guarded.** Anything that requires a native build (real RevenueCat purchases) checks `isExpoGo` at runtime and stubs gracefully in Expo Go.
- **Single persistence layer.** `src/lib/kv.ts` wraps `expo-sqlite/kv-store`, which is synchronous and Expo Go-safe. Nothing else writes to persistent storage directly.
