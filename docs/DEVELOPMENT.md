# Development guide

How to set up, run, build, and ship Whenbee. For folder layout see [ARCHITECTURE.md](ARCHITECTURE.md); for styling see [THEMING.md](THEMING.md); for commit/PR rules see [CONTRIBUTING.md](CONTRIBUTING.md). For the Home-screen widget + Live Activity (scaffolded; needs a physical device to validate) see [NATIVE-PRESENCE.md](NATIVE-PRESENCE.md).

## 1. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node | `20.19.x` | Matches CI. Use nvm/asdf to pin. |
| npm | bundled with Node | Project uses npm (committed `package-lock.json`). |
| Xcode | latest stable | Required for `ios` native builds + simulator. |
| EAS CLI | `>= 16.0.0` | `npm i -g eas-cli`, then `eas login`. Only for cloud builds/submits. |
| Expo Go | App Store | Fast iteration for JS-only changes (no native-only features). |

## 2. First-time setup

```bash
npm install                 # install deps
cp .env.example .env        # create local env (values optional — app stubs when blank)
npx expo-doctor             # sanity check (expect 18/18)
```

### Environment variables

All public keys are `EXPO_PUBLIC_*` (read at build time, exposed to the client) and parsed in `src/lib/env.ts`. Every one is **optional** — when blank, the matching service stubs gracefully:

| Var | Used by | Blank behavior |
|---|---|---|
| `EXPO_PUBLIC_POSTHOG_KEY` | analytics | analytics disabled |
| `EXPO_PUBLIC_POSTHOG_HOST` | analytics | defaults to `https://eu.i.posthog.com` |
| `EXPO_PUBLIC_SENTRY_DSN` | crash reporting | Sentry disabled |
| `EXPO_PUBLIC_RC_IOS_KEY` / `EXPO_PUBLIC_RC_ANDROID_KEY` | RevenueCat | purchases stubbed (also stubbed in Expo Go) |
| `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` | feedback channel | `getFeedbackClient()` returns `null`; feedback submit is queued locally, changelog fetch returns `[]` |

Because keys are optional, the core guess → timer → learn loop runs fully offline with an empty `.env`. Never hardcode prices — read them from RevenueCat.

## 3. Running locally

```bash
npm start            # Metro + dev menu; press i for iOS, w for web
npm run ios          # build & launch the native iOS app (dev client) on simulator/device
npm run web          # web preview (react-native-web)
```

**Expo Go vs. dev client.** Expo Go is fastest for JS/UI work, but native-only features (real RevenueCat, full Sentry) are guarded by `src/lib/isExpoGo.ts` and stub out there. To exercise those, use a development build:

```bash
eas build --profile development --platform ios   # cloud dev-client build
# or, with a local toolchain:
npm run ios                                       # expo run:ios
```

## 4. The change → verify loop

Run these before every commit (CI runs the same set and blocks merge on failure):

```bash
npm run lint        # eslint . --max-warnings=0   — 0 warnings or it fails
npm run typecheck   # tsc --noEmit
npm test            # jest
npm run format      # prettier --write .          (optional, auto-fix style)
```

Targeted test runs while iterating:

```bash
npx jest src/engine/__tests__/engine.test.ts   # one file
npx jest -t "blendWithPrior"                    # tests matching a name
npx jest --watch                                # watch mode
npx jest --coverage                             # coverage report (→ coverage/)
```

After editing specific files, lint just those: `npx eslint src/engine/update.ts` (this repo uses the flat `eslint.config.js`).

## 5. EAS builds & submission

Profiles are defined in `eas.json`. App identity (`bundleIdentifier` / `package`: `com.whenbee.app`, `scheme: whenbee`, New Architecture on, React Compiler on) lives in `app.json`.

| Profile | Command | What it produces |
|---|---|---|
| development | `eas build --profile development --platform ios` | dev-client build, internal distribution, iOS simulator-capable |
| preview | `eas build --profile preview --platform ios` | internal-distribution build for testers |
| production | `eas build --profile production --platform ios` | store build; `autoIncrement` bumps the build number |

Submit a finished production build to the stores:

```bash
eas submit --profile production --platform ios
```

First build will prompt for credentials — let EAS manage them unless you have a reason not to. Bump the user-facing version in `app.json` (`expo.version`) for releases; `autoIncrement` only handles the internal build number.

## 6. Useful one-offs

```bash
npx expo-doctor                 # dependency health — run after any dep change
npx expo install <pkg>          # add a dep at the SDK-54-compatible version (NOT plain npm install)
npm run reset-project           # scripts/reset-project.js — resets to a blank app scaffold
```

> Always use `npx expo install` (not `npm install`) for Expo/React Native packages so versions stay aligned with SDK 54. Verify with `npx expo-doctor` afterward.

## 7. Troubleshooting

| Symptom | Try |
|---|---|
| Stale bundle / weird Metro errors | `npm start -- --clear` (clears Metro cache) |
| `expo-doctor` flags version mismatch | re-install the offending pkg with `npx expo install <pkg>` |
| Native module "not available" in Expo Go | expected for guarded features — use a dev build (§3) |
| iOS build fails after native dep change | delete `ios/`, run `npx expo prebuild --clean`, then `npm run ios` |
| Lint fails on `components/ui/**` | it's intentionally ESLint-ignored; don't edit generated gluestack files to satisfy lint |
