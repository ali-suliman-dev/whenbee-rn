# Agent orientation

This project runs on **Expo SDK 54**. Always read the SDK 54 docs at https://docs.expo.dev/versions/v54.0.0/ — not any newer version URL.

## Key facts

- **Routes live in `src/app/`** (expo-router 6 with typed routes). Do not look for routes in `app/` at the repo root.
- **KV persistence:** use `src/lib/kv.ts` (wraps `expo-sqlite/kv-store`). Do not assume MMKV is available — it is not in this project.
- **RevenueCat purchases:** never assume `react-native-purchases` works in Expo Go. It is guarded by `src/lib/isExpoGo.ts`. Always check that guard before writing any purchase code.
- **Colors and spacing:** never hardcode values. Use `src/theme/tokens.ts` via `useTheme()`. That file is the single source of truth for the visual design.
- **Layer import rule:** `src/app/**` and `src/components/**` must not import from `src/services/*` or `src/db/*` directly. Route through a store, provider, or feature hook. ESLint enforces this.
- **Commits:** use Conventional Commits. Never add `Co-Authored-By` or AI-attribution trailers.

## Further reading

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — folder layout, boot flow, layer rules
- [docs/THEMING.md](docs/THEMING.md) — token structure, color mode, two theming surfaces
