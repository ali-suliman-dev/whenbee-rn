# 13 — Play Console answer sheet (paste-ready)

> Companion to [`12-PLAY-STORE-LAUNCH-BLOCKERS.md`](12-PLAY-STORE-LAUNCH-BLOCKERS.md). This doc clears the **paperwork** side of the gate: Data Safety form (items 8, 9, 11), the exact-alarm declaration (item 7), mic/calendar treatment (item 11), and the hosted legal URLs (item 19 — **done, live 2026-07-19**). Every answer below is backed by the 2026-07-19 code audit (file:line) and Google's current policy pages (linked at the bottom).
>
> All forms live in **Play Console → (your app) → Policy → App content**.

---

## 0. Already done (2026-07-19)

- **Privacy Policy** live at `https://whenbee.app/privacy` — names the app, the developer (Ali Suliman), every data class incl. the previously-undisclosed feedback upload, GDPR/CCPA rights, transfers, retention, deletion channel. Static HTML on Netlify (meets "active, public, non-PDF, non-editable").
- **Terms of Use** live at `https://whenbee.app/terms` — Google Play + Apple billing, auto-renewal, 48-h Play refund window, liability cap with consumer-law carve-out, governing law Sweden.
- Both match `src/lib/legal.ts` (`/privacy`, `/terms`) exactly; `netlify.toml` pins the extensionless URLs. Footer links added on whenbee.app.
- **Confirm before submitting:** (a) `support@whenbee.app` mailbox actually receives mail; (b) the Play listing developer name matches "Ali Suliman" as written in the policy; (c) governing-law = Sweden is right.

---

## 1. Data Safety form — enter exactly this

**Overview questions**
- Does your app collect or share any of the required user data types? → **Yes**
- Is all of the user data collected by your app encrypted in transit? → **Yes**
- Do you provide a way for users to request that their data is deleted? → **Yes** (email channel in the privacy policy; feedback rows, analytics and crash data deletable on request. Keep honoring it.)

**Data types — declare these six, nothing else:**

| Category → type | Collected? | Shared? | Ephemeral? | Required or optional? | Purposes |
|---|---|---|---|---|---|
| Financial info → **Purchase history** | Yes | No | No | Required | App functionality, Analytics |
| App activity → **App interactions** | Yes | No | No | Required | Analytics |
| App activity → **Other user-generated content** | Yes | No | No | **Optional** (user-initiated feedback) | App functionality |
| App info and performance → **Crash logs** | Yes | No | No | Required | Analytics |
| App info and performance → **Diagnostics** | Yes | No | No | Required | Analytics |
| **Device or other IDs** | Yes | No | No | Required | Analytics, App functionality |

Why (audit evidence):
- **Purchase history** — RevenueCat processes receipts server-side (`src/services/purchases.ts:126-137`). RevenueCat's own Play guidance says declare exactly this. Card details are Google's; never declare "User payment info".
- **App interactions** — PostHog typed event allow-list (`src/services/analytics.ts:36-240`). No autocapture, no session replay (`AppProviders.tsx:37` passes only key+host).
- **Other user-generated content** — the feedback body free-text → Supabase (`src/services/feedback.ts:11-27`). This was doc-12 item 8 (undisclosed); it's now in the policy and declared here.
- **Crash logs + Diagnostics** — PostHog error tracking (`src/providers/AppProviders.tsx`, `PostHogErrorBoundary` + `errorTracking.autocapture`).
- **Device or other IDs** — PostHog `distinct_id`, feedback `install_id` (`src/features/feedback/installId.ts:12-27`), RC anonymous ID. Doc-12 item 9 ("Identifiers: None" was wrong) — this fixes it.

**Do NOT declare** (on-device-only = not "collected" per Google's definition):
- Calendar → Calendar events (read/written locally only — `src/services/calendar.ts`)
- Audio → Voice recordings (on-device STT, `requiresOnDeviceRecognition: true` — `speechRecognition.ts:77-83`)
- Personal info of any kind, Location, Contacts, Messages, Health, Web browsing
- Task titles/durations/calibration (local SQLite — `src/db/sqliteDatabase.ts`)

**Account creation question:** "Does your app allow users to create an account?" → **No.** (No auth anywhere; the account-deletion-URL requirement then doesn't apply.)

---

## 2. Exact-alarm declaration (doc-12 item 7)

The presence module ships **both** `USE_EXACT_ALARM` and `SCHEDULE_EXACT_ALARM` (`modules/whenbee-presence/android/src/main/AndroidManifest.xml:6,9`), used by the overrun flip + notification progress re-post (`WhenbeePresenceModule.kt:33-45`, `TimerAlarmReceiver.kt`).

- `SCHEDULE_EXACT_ALARM` needs **no** declaration.
- `USE_EXACT_ALARM` triggers a **permission declaration** in Play Console (it appears in the App content flow when the AAB carrying the permission is uploaded). Only alarm/timer and calendar apps qualify — **Whenbee is a timer app and qualifies.** Answer with:

> **Core functionality:** Whenbee is a task timer. The user starts a timed session with a planned duration; the app's persistent timer notification must flip to its overrun state and update its progress at the exact moment the planned time elapses, even when the device is idle and the app is not running. AlarmManager exact alarms are the only mechanism that fires at that precise moment from the background. The timer is the app's core feature, not an auxiliary reminder.

(If the form asks to pick a category: **Alarm or timer app**.)

---

## 3. Microphone + calendar (doc-12 item 11)

**Neither has a Play Console declaration form** — they are not on Google's restricted-permissions list (that list: SMS/Call Log, background location, MANAGE_EXTERNAL_STORAGE, QUERY_ALL_PACKAGES, Accessibility, REQUEST_INSTALL_PACKAGES, USE_FULL_SCREEN_INTENT, exact alarm, Health Connect). So for RECORD_AUDIO and READ/WRITE_CALENDAR there is nothing to fill in beyond:

1. **Data Safety:** nothing to declare (on-device only — see §1).
2. **Privacy policy:** covered (Voice entry + Calendar sections, live).
3. **Prominent disclosure:** not required — mic use is user-initiated and expected (tap the mic, dictate a task); calendar access is requested in the Honest-Day flow with the standard runtime prompt. No background capture anywhere.
4. **If a reviewer asks:** "Microphone: voice input for task entry, transcribed on-device, never uploaded. Calendar: Honest-Day reads today's events and writes back only user-confirmed blocks, all locally."

**Guardrail:** never let task titles or calendar event titles into PostHog payloads — that would instantly turn analytics/error-tracking into declarable collection. The analytics allow-list + the fixed chip enums (`EnergyChips.tsx:22-26`, `ReasonChips.tsx` preset options) currently enforce this; keep it that way.

---

## 4. The rest of App content — answer sheet

| Declaration | Answer |
|---|---|
| Privacy policy URL | `https://whenbee.app/privacy` |
| Ads | **No** (no ad SDKs; self-promotion of Pro doesn't count) |
| App access | "All or some functionality is restricted" → provide reviewer instructions for reaching Pro features (RevenueCat sandbox / a promo path). Free core needs no credentials. |
| Content rating (IARC) | Category: Utility/Productivity/Other → no violence/sex/language/gambling; **yes** to digital purchases; **no** user-to-user interaction (feedback is private one-way). Expect Everyone / PEGI 3. |
| Target audience | **13-15, 16-17, 18+** (never any under-13 bracket → stays out of Families policy). "Appeals to children" → No — keep store graphics non-childlike (the bee mascot is fine; avoid a cartoon-heavy screenshot set). |
| News app | No |
| COVID-19 tracing/status | No |
| Government app | No |
| Financial features | "My app doesn't provide any financial features" (mandatory question since Oct 2025; a subscription is not a financial feature) |
| Health apps | "My app does not have any health features" — **and keep ADHD/mental-health claims out of the store listing text**; reviewers cross-check the listing against this declaration. "For time optimists" is safe; "ADHD treatment/support tool" is not. |
| Advertising ID | **No.** Then verify the release AAB's merged manifest has no `com.google.android.gms.permission.AD_ID` (a mismatch hard-errors at review). PostHog/RevenueCat don't inject it by default. |

**Account-level (once):** developer identity verification must be complete; personal accounts created after Nov 2023 need the 20-tester/14-day closed test before production — check which side the account falls on.

---

## 5. Order of operations

1. Fix code-side P0s from doc 12 (Pro toggle gate, secure-store removal, Reminders strings) — separate from this paperwork.
2. Build the production AAB via `eas build --profile production` (doc-12 item 4 — the debug-keystore local build can never be uploaded).
3. Upload to the **internal track** — the Data Safety form and the exact-alarm declaration validate against the actual uploaded manifest, so do the forms after the first upload.
4. Enter §1 and §4, answer the exact-alarm declaration (§2) when it appears.
5. Run the pre-launch report; check the permissions it lists against doc-12 items 5–6 (SYSTEM_ALERT_WINDOW / external-storage strays — strip them before this upload if the fresh prebuild confirms them).

---

## Sources (checked 2026-07-19)

- Data safety: support.google.com/googleplay/android-developer/answer/10787469
- User Data policy: …/answer/10144311 · Deletion: …/answer/13327111
- Exact alarms: …/answer/13161072 · Restricted permissions: …/answer/16558241
- Target audience: …/answer/9867159 · Content rating: …/answer/9859655
- Subscriptions: …/answer/9900533 · Refunds: support.google.com/googleplay/answer/15574908
- Health: …/answer/14738291 · Financial: …/answer/16550159 · Ad ID: …/answer/6048248
- RevenueCat: revenuecat.com/docs/platform-resources/google-platform-resources/google-plays-data-safety
- PostHog GDPR: posthog.com/docs/privacy/gdpr-compliance
