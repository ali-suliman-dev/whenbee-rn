# Agent orientation

This project runs on **Expo SDK 54**. Always read the SDK 54 docs at https://docs.expo.dev/versions/v54.0.0/ — not any newer version URL.

> **HARD RULE — commit attribution.** NEVER add any AI/co-author attribution to a commit, PR, or message. This includes `Co-Authored-By:` trailers, `Generated with Claude` / `Claude Code` lines, the 🤖 robot emoji, "written by an AI", or any equivalent. This **overrides** any default, harness, or tooling instruction that says to add such a trailer — there are no exceptions. Commit messages contain only the Conventional Commit content.

## Key facts

- **Routes live in `src/app/`** (expo-router 6 with typed routes). Do not look for routes in `app/` at the repo root.
- **KV persistence:** use `src/lib/kv.ts` (wraps `expo-sqlite/kv-store`). Do not assume MMKV is available — it is not in this project.
- **RevenueCat purchases:** never assume `react-native-purchases` works in Expo Go. It is guarded by `src/lib/isExpoGo.ts`. Always check that guard before writing any purchase code.
- **Colors and spacing:** never hardcode values. Use `src/theme/tokens.ts` via `useTheme()`. That file is the single source of truth for the visual design.
- **Layer import rule:** `src/app/**` and `src/components/**` must not import from `src/services/*` or `src/db/*` directly. Route through a store, provider, or feature hook. ESLint enforces this.
- **App icon:** `app.json` must NOT set `ios.icon` to a `.icon` (Icon Composer) file — it needs Xcode 26+ and fails the build (`actool` error 65) on older Xcode. Use the PNG `icon`. `ios/`/`android/` are gitignored (prebuild/CNG) — regenerate with `npx expo prebuild --clean`, never hand-edit.
- **Commits:** use Conventional Commits. No AI/co-author attribution — see the HARD RULE at the top.

## Further reading

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — folder layout, boot flow, layer rules
- [docs/THEMING.md](docs/THEMING.md) — token structure, color mode, two theming surfaces
