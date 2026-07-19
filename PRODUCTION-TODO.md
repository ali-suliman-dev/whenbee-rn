# Whenbee — Production Launch TODO (Google Play)

Everything left to ship Whenbee to the Play Store. Full evidence/rationale in
[`docs/product/12-PLAY-STORE-LAUNCH-BLOCKERS.md`](docs/product/12-PLAY-STORE-LAUNCH-BLOCKERS.md).
Status legend: ✅ done · ⏳ needs your input · 🔲 not started.

---

## 1. Environment variables (EAS + local `.env`)

EAS project: **`@alx-organization/whenbee`** (id `4be512ee-fdc9-429e-8e14-d27d7b187be6`).
Set with `eas env:create <env> --name <NAME> --value <VALUE> --visibility sensitive --force`.
`EXPO_PUBLIC_*` values are inlined into the APK → only PUBLIC/publishable keys.

| Var | production | preview | development | Notes |
|---|---|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | ✅ | ✅ | ✅ | ⏳ **confirm ref** — `.mcp.json`=`iptnmqcrmxakwqbaqugs` vs `.env.example`=`vxvifohhogckedqfrymz` |
| `EXPO_PUBLIC_POSTHOG_HOST` | ✅ | ✅ | ✅ | `https://eu.i.posthog.com` |
| `EXPO_PUBLIC_POSTHOG_KEY` | ✅ | ✅ | ✅ | PostHog project **whenbee** (id 227146, EU), key `phc_sSgC…ELEBF` |
| `EXPO_PUBLIC_SENTRY_DSN` | 🔲 | 🔲 | 🔲 | Sentry → Project → Client Keys (DSN) |
| `EXPO_PUBLIC_RC_ANDROID_KEY` | 🔲 **needs `goog_` (see §2)** | ✅ test | ✅ test | prod must NOT use the `test_` Test-Store key |
| `EXPO_PUBLIC_RC_IOS_KEY` | — (iOS later) | ✅ test | ✅ test | not needed for Play |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | 🔲 | 🔲 | 🔲 | Supabase → API → **anon** key (NEVER `service_role`) |

---

## 2. RevenueCat — production `goog_` key

The current key `test_eNXvgxIhPcfvyDpDrJRoqMZoFRi` is RevenueCat's **Test Store** key
(sandbox). For a real Play release you need the production Android public SDK key:

- 🔲 In RevenueCat → add an **Android app** (package `com.whenbee.app`).
- 🔲 Connect a **Google Play service account** (Play Console → Setup → API access) to RevenueCat.
- 🔲 Create products/entitlement (`pro`) + offering in RevenueCat, matching the Play Console IAPs
  (monthly, yearly, lifetime).
- 🔲 RevenueCat then issues the `goog_…` key → set `EXPO_PUBLIC_RC_ANDROID_KEY` in the **production** EAS env.

Code is ready: `configurePurchases()` reads the platform key from env and RC hydrates at boot.

**Prices:** production prices come from **Google Play Console** IAP config (RC mirrors the store), NOT RevenueCat. Set `$4.99/mo · $34.99/yr · $89 lifetime` there when creating the IAPs. ✅ Test-Store prices fixed (2026-07-19): the old placeholder products ($9.99/$79.99/$99.99) were archived and replaced with `monthly_499`/`yearly_3499`/`lifetime_89` at the real prices (prices are create-only in the v2 API, so replacement was the only path). New products are attached to the `default` offering packages + the `Whenbee Pro` entitlement.

**Entitlement identifier:** code now matches the live RC entitlement `Whenbee Pro` (a legacy `pro` is archived, lookup_key reserved but unreachable via API). If you consolidate RC back to a clean `pro` entitlement later, update `PRO_ENTITLEMENT_ID` in `src/services/purchases.ts`.

---

## 3. Android signing / keystore

- 🔲 First `eas build --profile production --platform android` prompts to **generate the EAS-managed
  upload keystore** — accept it. EAS keeps it; back it up via `eas credentials -p android`.
- ⚠️ The Play upload MUST come from **`npm run build:prod`** (EAS). Never upload the local
  `deploy.sh` / device APK — it's signed with the debug key and Play rejects it.

---

## 4. Play Console setup

- 🔲 Create the app in Play Console (package `com.whenbee.app`).
- 🔲 **Data Safety form** — declare: App activity (product interactions, PostHog), App info &
  performance (crash/diagnostics, Sentry), **Device or other IDs** (anon distinct_id / install_id),
  **Other user-generated content** (feedback free-text → Supabase). None used for tracking/ads.
- 🔲 **Permission declarations:** exact-alarm (`USE_EXACT_ALARM` — timer app), + prominent disclosure
  for RECORD_AUDIO (mic → on-device speech) and READ/WRITE_CALENDAR (Honest-Day).
- 🔲 **Hosted privacy + terms URLs live** (no 404) — `src/lib/legal.ts` (`/privacy`, `/terms`).
- 🔲 Content rating questionnaire, pricing & distribution, store listing (title/desc/screenshots/feature graphic).
- 🔲 **Google Play service account JSON** wired for `npm run submit:prod` (else first upload is manual).

---

## 5. Remaining code / config (from doc 12)

- 🔲 Sentry plugin `organization: "your-org"` in `app.json` → set real org + add `SENTRY_AUTH_TOKEN`
  EAS secret (for source-map upload / symbolicated crashes).
- 🔲 Add a Sentry `beforeSend`/`beforeBreadcrumb` scrubber (no PII leak today, but no safety net).
- 🔲 Verify stray Android perms are gone from a **cloud** build manifest: `SYSTEM_ALERT_WINDOW`,
  `READ/WRITE_EXTERNAL_STORAGE` (remove/cap if present).
- 🔲 Decide R8/minify + `mapping.txt` upload (off by default).
- 🔲 Bump `version` `0.1.0 → 1.0.0` (app.json + package.json + build.gradle versionName).
- 🔲 `supportsTablet: true` is iOS-only; N/A for Play but revisit for an iOS build.

## ✅ Already done this session
- P0: dev "Unlock Pro" toggle gated to `__DEV__`; override inert in production.
- Removed unused `expo-secure-store` (dropped FaceID + biometric perms) + `react-native-purchases-ui`.
- Strip unused Reminders permission (`plugins/withNoRemindersPermission.js`); set `usesNonExemptEncryption:false`.
- **Fixed broken RevenueCat init** — `configurePurchases()` + entitlement hydrate at boot.
- EAS linked; `eas.json` profiles/environments (prod AAB/store, preview APK, submit Play internal draft).
- `package.json` scripts: `build:dev` / `build:debug` / `build:prod` / `submit:prod`.

---

## Build & submit reference

```bash
npm run build:debug    # production-like APK, installable, for QA (preview env)
npm run build:prod     # AAB for Play (production env) — first run generates keystore
npm run submit:prod    # upload latest AAB to Play internal track (draft)
```
