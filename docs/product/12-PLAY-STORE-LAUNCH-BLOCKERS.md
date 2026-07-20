# 12 — Play Store launch blockers (full pre-submission scan)

> **⛔ DO NOT SUBMIT TO GOOGLE PLAY UNTIL EVERY P0 + P1 BELOW IS CLEARED.**
> Companion to [`11-APP-STORE-LAUNCH-BLOCKERS.md`](11-APP-STORE-LAUNCH-BLOCKERS.md) (that doc is Apple-focused). This one is a full-codebase reviewer-mindset scan run 2026-07-18 across six dimensions: dev/debug toggles, leftover debug strings, permissions-vs-usage, secrets/network, build/release config, and data-collection-vs-disclosure. Every item cites code evidence.
>
> Skills that drove this: `eas-app-stores` (`references/play-store.md`), `gplay-submission-checks`, `apple-appstore-reviewer`, `security-scanning:security-sast`. When fixing a code item, invoke the project's mandatory skills first (see CLAUDE.md).

Verify claims marked **(VERIFY)** against a **fresh `npx expo prebuild`** — some Android manifest findings were read from a locally-generated `android/` tree (CNG/gitignored) that may be stale.

> **Re-verified 2026-07-20.** Status column re-checked against code. All three P0s are **fixed**; items 10, 13, 19 done. Permission findings 5–7 now read from the **Gradle merged release manifest** (`android/app/build/intermediates/merged_manifests/release/processReleaseManifest/AndroidManifest.xml`) rather than the source manifest — that is the true packaged permission set, so the (VERIFY) caveat is resolved for 5–6. Item 4 remains **unverified**: `eas-cli` is not installed locally, so EAS keystore state was never checked. `[~]` = partially cleared (code/policy side done, Play Console form still to fill).
>
> True merged release permission set: `ACCESS_NETWORK_STATE`, `INTERNET`, `POST_NOTIFICATIONS`, `POST_PROMOTED_NOTIFICATIONS`, `READ_APP_BADGE`, `READ_CALENDAR`, `READ_EXTERNAL_STORAGE`, `RECEIVE_BOOT_COMPLETED`, `RECORD_AUDIO`, `SCHEDULE_EXACT_ALARM`, `SYSTEM_ALERT_WINDOW`, `USE_EXACT_ALARM`, `VIBRATE`, `WAKE_LOCK`, `WRITE_CALENDAR`, `WRITE_EXTERNAL_STORAGE`.

---

## The gate

| # | Pri | Area | Item | Status |
|---|-----|------|------|--------|
| 1 | **P0** | Dev toggle | "Unlock Pro (testing)" switch ships to prod, ungated → free Pro for any user | `[x]` fixed — `__DEV__` gate, `settings.tsx:728` |
| 2 | **P0** | Permissions | `expo-secure-store` unused → strips FaceID + biometric perm strings | `[x]` fixed — 0 refs in `package.json`/`app.json` |
| 3 | **P0** | Permissions | `expo-calendar` injects unused **Reminders** strings (app is EVENT-only) | `[x]` fixed — `./plugins/withNoRemindersPermission` (`app.json:66`) |
| 4 | P1 | Build | Local `android/` release uses **debug keystore** → must ship via EAS production build | `[ ]` **unverified** — no `eas-cli` installed, credential state unchecked |
| 5 | P1 | Permissions | `SYSTEM_ALERT_WINDOW` in release manifest, no code uses it (VERIFY) | `[ ]` **confirmed present** — source: `expo-file-system` |
| 6 | P1 | Permissions | `READ/WRITE_EXTERNAL_STORAGE` broad, cap with `maxSdkVersion` or remove (VERIFY) | `[ ]` **confirmed present** — source: `expo-file-system` |
| 7 | P1 | Console | Exact-alarm declaration for `USE_EXACT_ALARM` (presence timer) | `[ ]` perms confirmed in merged manifest; Console declaration outstanding |
| 8 | P1 | Data Safety | Feedback free-text + `install_id` upload is **undisclosed** in privacy policy/manifest/form | `[~]` policy now discloses it (live, verified); Data Safety form outstanding |
| 9 | P1 | Data Safety | "Identifiers: None" is wrong — PostHog/feedback/RC anon IDs are persistent → declare "Device or other IDs" | `[~]` policy names all 3 IDs; Console form answer outstanding |
| 10 | P1 | Config | Set `ios.config.usesNonExemptEncryption: false` (blocks every submission) | `[x]` set — `app.json:17` |
| 11 | P1 | Config | Complete Data Safety form + prominent disclosure for RECORD_AUDIO + calendar | `[ ]` |
| 12 | P2 | Config | Sentry plugin `organization: "your-org"` placeholder → source maps won't upload | `[x]` **resolved by removal** — Sentry (and its `app.json` plugin block) has been removed entirely; the placeholder no longer exists |
| 13 | P2 | Config | eas.json: add `cli.appVersionSource`, make `distribution:store` + `buildType:app-bundle` explicit | `[x]` done — all three present |
| 14 | P2 | Privacy | Sentry has no `beforeSend`/breadcrumb scrub — no safety net if task text ever logged | `[x]` **resolved** — Sentry removed; error reporting moved to PostHog with `errorTracking.autocapture.console: false`, which is the equivalent safeguard (console breadcrumbs never captured, so they can't carry task text off-device) |
| 15 | P2 | Config | Decide R8/minify + `mapping.txt` upload (currently off → obfuscated-free but larger AAB) | `[ ]` |
| 16 | P2 | Secrets | Out-of-band: confirm EAS `EXPO_PUBLIC_RC_*` = RC **public** keys, `SUPABASE_ANON_KEY` = **anon** | `[ ]` |
| 17 | P2 | Secrets | Confirm **RLS enabled** on `feedback_submissions` (only guard on that path) | `[ ]` |
| 18 | P3 | Config | Bump `version` 0.1.0 → 1.0.0 (app.json, package.json) | `[ ]` |
| 19 | P3 | Legal | `src/lib/legal.ts` privacy/terms URLs must be live (no 404) before submit | `[x]` live 2026-07-19 |
| 20 | P2 | Config | `supportsTablet:true` (iOS) — verify layout or set false (Apple; N/A Play but same build) | `[ ]` |

---

## P0 — hard blockers

> **All three P0s below were fixed after this scan was written (verified 2026-07-20).** The findings are kept for the audit trail; the resolution is noted under each.

### 1. "Unlock Pro (testing)" toggle ships to production — ✅ RESOLVED
**Resolution:** the whole `Developer` block is now `{__DEV__ && ( … )}` at `src/app/settings.tsx:728`, so the toggle (and the paywall-variant row) never render in a release build.
- **`src/app/settings.tsx:726-740`** — the `Developer` section header + the `Unlock Pro (testing)` `Switch` render **unconditionally**. Only the "Seed demo data" row below (line 741) is `{__DEV__ && …}`. The Pro toggle is **not** gated.
- **`src/features/paywall/useEntitlement.ts:11-38`** — `setPro(true)` writes persistent KV `dev_pro_override='1'`; `hydrate()` short-circuits to `isPro:true` whenever set, overriding real RevenueCat on every launch. Net: any user → Settings → Developer → flip → permanent free Pro. Revenue bypass + store-review rejection risk.
- **Fix:** wrap the `Developer` `<View>` (line 726) in `{__DEV__ && ( … )}`, matching the seed row. Defense-in-depth: gate `setPro`/`dev_pro_override` in `useEntitlement.ts` too.

### 2. `expo-secure-store` — unused, injects biometric perms — ✅ RESOLVED
**Resolution:** plugin + dependency removed; zero `secure-store` references remain in `package.json` or `app.json`. No biometric perms in the merged release manifest.
- SecureStore is imported **nowhere** in `src/`. Plugin (`app.json:51`) still injects iOS `NSFaceIDUsageDescription` (boilerplate copy) + Android `USE_BIOMETRIC` / `USE_FINGERPRINT`.
- Unused FaceID string with default copy = classic Apple metadata rejection; biometric perms on Play draw scrutiny.
- **Fix:** remove the `expo-secure-store` plugin from `app.json` and the dependency.

### 3. `expo-calendar` injects unused Reminders strings — ✅ RESOLVED
**Resolution:** custom config plugin `./plugins/withNoRemindersPermission` (`app.json:66`) strips the Reminders strings; only the Calendars permission copy ships (`app.json:63`).
- App uses `Calendar.EntityTypes.EVENT` only (`src/services/calendar.ts:259,283,312,341`), never Reminders. Plugin still ships `NSRemindersUsageDescription` + `NSRemindersFullAccessUsageDescription` (placeholder copy).
- **Fix:** suppress the Reminders strings via plugin option / `expo-build-properties` plist-mod / small config plugin, leaving only the Calendars strings.

---

## P1 — must clear before submit

### 4. Debug-keystore release signing (Android)
- Local `android/app/build.gradle:117` — `release { signingConfig signingConfigs.debug }`. Fine for the founder's `deploy.sh android` data-safe device installs, but a debug-signed AAB is **rejected by Play**.
- **Fix / rule:** the Play upload MUST come from `eas build --profile production` (regenerates `android/`, signs with EAS-managed upload keystore). Confirm `eas credentials -p android` has a keystore. **Never upload the `deploy.sh`/whenbee-device APK.**

### 5–6. Stray Android permissions in release manifest (VERIFY)
- `SYSTEM_ALERT_WINDOW` present in the release packaged manifest with no draw-over code found → remove for release (`tools:node="remove"`) unless a shipping feature needs it.
- `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE` auto-injected → cap with `maxSdkVersion` or remove; Play flags broad storage.
- **Confirmed 2026-07-20 against the Gradle merged release manifest** (not the source manifest) — all three are genuinely in the packaged permission set. **Source traced: `expo-file-system`** (`node_modules/expo-file-system/android/src/main/AndroidManifest.xml`) declares them; nothing in `src/` or `modules/` uses them.
- **Fix:** a small config plugin adding `tools:node="remove"` for `SYSTEM_ALERT_WINDOW`, and `tools:node="remove"` or `android:maxSdkVersion="32"` for the two storage perms. Re-check the merged manifest after the change — removing them from the source manifest alone does nothing, since these merge in from the library.

### 7 & 11. Play Console declarations (perms are justified, paperwork isn't optional)
- **`USE_EXACT_ALARM`** (presence overrun flip — `WhenbeePresenceModule.kt:39`, `TimerAlarmReceiver.kt`): complete the Play Console exact-alarm declaration, positioning Whenbee as a timer app (qualifies).
- **RECORD_AUDIO** (voice quick-add, genuinely used) + **READ/WRITE_CALENDAR** (Honest-Day): fill Data Safety + in-app prominent disclosure.

### 8–9. Disclosure gaps (Data Safety / privacy)
- **Feedback path undisclosed:** `src/services/feedback.ts:11-21` uploads user-typed free-text `body` + stable anonymous `install_id` + category name to Supabase `feedback_submissions`. Privacy policy (11-doc Appendix C), manifest, and nutrition labels mention **none of it**. Reviewer opens Settings → Send feedback, sees a text box uploading to a server the disclosure denies. Add: "Other user-generated content" (App activity) + the Supabase data class to Play Data Safety, ASC labels, privacy manifest, and policy copy. Note: no server-side deletion path for feedback rows — answer the "can users request deletion" question accordingly.
- **Identifiers understated:** PostHog `distinct_id`, feedback `install_id`, RC anonymous id are persistent pseudonymous IDs. Play Data Safety → **"Device or other IDs" = Yes** (currently implied No).

### 10. Encryption compliance flag — ✅ RESOLVED
**Resolution:** `ios.config.usesNonExemptEncryption: false` is set at `app.json:17`. This is also the accurate answer to Play's **US export laws** declaration — the app uses only standard TLS via its SDKs, no custom cryptography.

---

## P2 / P3 — friction + polish
- **12** ✅ **RESOLVED BY REMOVAL** — Sentry and its `app.json` plugin block (with the `organization:"your-org"` placeholder) have been removed entirely; there is no source-map upload step to break.
- **13** ✅ **RESOLVED** — eas.json has `cli.appVersionSource: "remote"`, production `distribution: "store"` + `android.buildType: "app-bundle"`, and submit defaults to the `internal` track as a `draft`.
- **14** ✅ **RESOLVED BY REMOVAL** — no Sentry means no `beforeSend`/breadcrumb scrubber is needed. Error reporting is now PostHog (`errorTracking.autocapture`) with console autocapture explicitly OFF, which is the equivalent safeguard against task text leaking via breadcrumbs.
- **15** Decide on R8/`minifyEnabled` + `mapping.txt` deobfuscation upload (currently off).
- **16–17** Out-of-band: confirm RC/Supabase env values are the **public/anon** variants; confirm **RLS** on `feedback_submissions`.
- **18** Bump `version` → 1.0.0.
- **19** Host privacy/terms URLs in `src/lib/legal.ts` before submit.
- **20** `supportsTablet:true` — verify iPad layout or set false.

---

## Swept clean (no findings)
- No `console.*` / `debugger` / TODO/FIXME markers in shipping `src/`.
- No hardcoded secrets: all keys `EXPO_PUBLIC_*` env-injected; `.env` gitignored; no tracked keystore/service-account/`.pem`; no cleartext HTTP endpoints.
- **No PII in analytics:** typed allow-list (numbers/enums/category names only); `name_set` sends length-only; PostHog touch-autocapture OFF; voice STT + on-device LLM never leave the device.
- No dev/debug expo-router routes; no secret gestures/debug menus; RevenueCat stub + seed-demo-data both correctly gated.
- targetSdk 36 (Play needs ≥35), minSdk 24, Hermes on, New Arch on — all OK. No foreground service (avoids the heaviest Play policy burden).

---

## Order of operations
1. Clear P0 (1–3) — code + config, small.
2. P1 config/build (4, 10) + manifest verify (5–6).
3. Rewrite the disclosure surfaces (8–9, 11) — privacy policy, manifest, and both stores' forms — then complete Console declarations (7). **Paste-ready answers for 7, 8–9, 11: [`13-PLAY-CONSOLE-ANSWERS.md`](13-PLAY-CONSOLE-ANSWERS.md); the hosted policy (19) is live and already covers the feedback path.**
4. P2/P3 cleanup, then EAS production build → internal track → pre-launch report → production.
