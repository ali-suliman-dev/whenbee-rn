# 11 — App Store launch blockers

> **⛔ DO NOT SUBMIT TO THE APP STORE UNTIL EVERY P0 + P1 ITEM BELOW IS CHECKED OFF.**
> This doc is the pre-submission gate. It comes out of a full reviewer-mindset audit of the codebase (2026-06-21). Each item is a real, evidenced App Store rejection or friction risk — not a hypothetical. Work top-down: P0 first, then P1, then P2. P3 is polish and may ship later.
>
> When an item is done, change its box to `[x]` and add the commit/PR that fixed it. Nothing here is "probably fine" — verify on a device.

Cross-refs: audit was run against `app.json`, `src/features/paywall/*`, `src/services/*`, `src/providers/*`. Brand voice for every string here already passed [`06-BRAND-VOICE.md`](06-BRAND-VOICE.md) + `humanizer` + `conversion-psychology`.

---

## The gate (check before you submit)

| # | Pri | Item | Status |
|---|-----|------|--------|
| 1 | P1 | Terms of Use (EULA) + Privacy Policy links on the paywall | `[ ]` |
| 2 | P1 | Hosted Privacy Policy URL live + added to App Store Connect | `[ ]` |
| 3 | P1 | Privacy disclosure matches reality (manifest data types + ASC nutrition labels) | `[ ]` |
| 4 | P2 | iPad: verify layout, or set `supportsTablet: false` | `[ ]` |
| 5 | P2 | Remove/replace stray permission strings (Face ID, Reminders) via `app.json` | `[ ]` |
| 6 | P2 | Verify `react-native-apple-llm` does not crash on a non–Apple-Intelligence device | `[ ]` |
| 7 | P2 | Set `ios.config.usesNonExemptEncryption: false` | `[ ]` |
| 8 | P3 | Bump version `0.1.0` → `1.0.0` | `[ ]` |
| 9 | P3 | Optional: analytics opt-out toggle in Settings | `[ ]` |
| 10 | — | Paste the App Review notes (Appendix A) into App Store Connect | `[ ]` |

**None of 1–7 are optional for first submission.** 1–3 are the most common auto-renew/privacy rejections; 4–6 are crash/quality rejections that surface on the reviewer's specific device.

---

## Fix plans

Every code-touching item lists the skills to invoke first (project rule: skills drive the change, not guesswork). Reminder from `AGENTS.md`: `ios/` and `android/` are CNG output and gitignored — **fix everything in `app.json` / plugin config / source, never by hand-editing `ios/`**, or `npx expo prebuild --clean` wipes it.

### 1 — Terms + Privacy links on the paywall (P1)

**Guideline:** 3.1.2 (auto-renewable subscriptions). Apple requires a functional link to the Terms of Use (EULA) and the Privacy Policy on the screen where the user buys.

**What's wrong:** The paywall only has Restore and Manage links. No Terms, no Privacy.
**Evidence:** `src/features/paywall/Paywall.tsx` (link row ~277–292). A Privacy screen exists at `src/app/privacy.tsx` but is only reachable from Settings, and there is no Terms page anywhere.

**Fix:**
1. Add a legal link row to the paywall, below the existing Restore / Manage row, using the labels in **Appendix B**.
2. "Terms" opens the EULA URL; "Privacy" opens the Privacy Policy URL. Open with `expo-web-browser` (`WebBrowser.openBrowserAsync`) — already a dependency.
3. Pull the two URLs from a single constants source (e.g. `src/lib/legal.ts`) so the paywall, Settings, and onboarding all use the same strings.
4. Also surface both links in Settings (Privacy row already exists — add a Terms row beside it).

**Skills to invoke first:** `react-native-expert`, `typescript-expert`, `clean-code`, `coding-standards`, `ui-design:react-native-design`, `ui-design:interaction-design`. Link labels are user-facing copy → already shaped here, but re-run `humanizer` if you reword.

**Verify:** Open the paywall on device, tap each link, confirm both pages load. Tap from Settings too.

---

### 2 — Hosted Privacy Policy URL (P1)

**Guideline:** App Store Connect requires a Privacy Policy URL as a metadata field. An in-app text screen alone does not satisfy it.

**What's wrong:** Privacy content lives only as static in-app text (`src/app/privacy.tsx`). No public URL.

**Fix:**
1. Host the policy in **Appendix C** at a stable URL. Suggested: `https://whenbee.app/privacy`. Confirm the domain you control and adjust everywhere.
2. Host the EULA (**Appendix D**) at `https://whenbee.app/terms`, or use Apple's standard EULA URL (see Appendix D) if you don't want a custom one.
3. Enter the Privacy Policy URL in App Store Connect → App Privacy.
4. Put both URLs in `src/lib/legal.ts` (item 1).

**Skills:** none code-heavy; copy already passed `humanizer` + `conversion-psychology`. Re-run them if you edit the policy text.

**Verify:** Both URLs load on a fresh browser (no auth wall). ASC accepts the Privacy URL.

---

### 3 — Privacy disclosure matches reality (P1)

**Guideline:** 5.1.1 + App Privacy accuracy. What you declare must match what you collect.

**What's wrong:** The generated privacy manifest declares `NSPrivacyCollectedDataTypes` **empty** and `NSPrivacyTracking false`, but the app sends anonymous usage events and crash/error reports to PostHog. Empty declaration + real collection = post-review rejection.
**Evidence:** `src/services/analytics.ts` (PostHog typed events), `src/providers/AppProviders.tsx` (`PostHogErrorBoundary` + `errorTracking.autocapture`). Manifest is regenerated, so the fix is in config, not the `ios/` file.

**What's actually collected (use this for the nutrition labels):**
- **Usage Data** (PostHog) — anonymous product-analytics events: numeric metrics (guess minutes, actual minutes, sharpness, ratio), category names, event names. **No task text, no account, no IDFA.** Not linked to identity. Not used for tracking.
- **Crash Data / Diagnostics** (PostHog error tracking) — stack traces, device/OS metadata. Not linked to identity. Not used for tracking.

**Fix:**
1. Declare the two data types in the privacy manifest. The reliable way under Expo CNG is a config plugin / `expo-build-properties` privacy-manifest entry, or a small custom config plugin that injects `NSPrivacyCollectedDataTypes`. Each entry: `linkage = false`, `tracking = false`, purpose = App Functionality (PostHog) / App Functionality + Analytics as appropriate.
2. In App Store Connect → App Privacy, fill the nutrition labels to match **Appendix F** exactly.
3. Keep `NSPrivacyTracking = false` — correct, since there's no ATT/IDFA. Don't add ATT; you don't track.

**Skills to invoke first:** `react-native-expert` (config plugin), `typescript-expert`, `software-architecture` (the legal-constants + plugin placement is a small structural decision).

**Verify:** `npx expo prebuild --clean`, then read the regenerated `ios/Whenbee/PrivacyInfo.xcprivacy` and confirm both data types are present. Confirm ASC labels match.

---

### 4 — iPad layout (P2)

**Guideline:** 2.1 (App Completeness). Reviewers test on iPad when the app declares iPad support. A broken or letterboxed tablet layout gets rejected.

**What's wrong:** `app.json` sets `supportsTablet: true` and the generated Info.plist enables iPad landscape. The app is designed portrait-phone; iPad is likely untested.

**Fix — pick one:**
- **A (fast, recommended for v1):** Set `supportsTablet: false` in `app.json`. Ship iPhone-only, run on iPad in compatibility mode. Removes the whole risk.
- **B:** Keep iPad support, but actually test every screen on an iPad simulator (onboarding, all tabs, paywall, Honest-Day, timer) and fix layout/safe-area issues. More work.

**Skills (if B):** `react-native-expert`, `ui-design:react-native-design`, `ui-design:responsive-design`, `ui-design:mobile-ios-design`.

**Verify:** Launch on iPad simulator. If A: confirm it runs in iPhone-compat mode without layout breakage. If B: screenshot every screen, judge alignment/spacing.

---

### 5 — Stray permission strings (P2)

**Guideline:** 5.1.1. Purpose strings must map to a real, visible feature. Generic placeholder strings for unused capabilities invite reviewer questions.

**What's wrong:** The generated Info.plist carries:
- `NSFaceIDUsageDescription` = "Allow Whenbee to access your Face ID biometric data." (from `expo-secure-store`; no biometric code exists).
- `NSRemindersUsageDescription` / `NSRemindersFullAccessUsageDescription` = "Allow Whenbee to access your reminders" (from `expo-calendar`; the app only uses `Calendar.EntityTypes.EVENT`, never Reminders — see `src/services/calendar.ts`).

**Fix (in `app.json`, not `ios/`):**
1. `expo-calendar` plugin: it injects Reminders strings by default. Configure it so Reminders permission is not requested, or supply an accurate string. Check the SDK 54 `expo-calendar` plugin options (https://docs.expo.dev/versions/v54.0.0/sdk/calendar/) — pass only the calendar permission, drop reminders.
2. `expo-secure-store`: it injects the Face ID string. If Face ID is genuinely unused, suppress it (plugin option `faceIDPermission: false`) or replace the placeholder with an accurate sentence. Confirm nothing in the app calls secure-store with biometric `requireAuthentication`.
3. If a string can't be removed cleanly via plugin options, write a tiny config plugin to delete the key from `Info.plist` at prebuild.

**Skills to invoke first:** `react-native-expert`, `coding-standards`. Any replacement string is user-facing → `humanizer` + `conversion-psychology`.

**Verify:** `npx expo prebuild --clean`, grep the regenerated `Info.plist` — Face ID + Reminders keys gone (or carrying accurate strings).

---

### 6 — Apple LLM crash guard (P2)

**Guideline:** 2.1 (crashes = rejection).

**What's wrong:** `react-native-apple-llm` uses Apple Foundation Models, which need iOS 26 + Apple Intelligence enabled. Deployment target is 16.4. A reviewer's device may not have Apple Intelligence on. The audit found an `availability()` guard (`src/services/ai/appleLlmProvider.ts`) and a rules fallback (`src/services/voice/spokenTaskStructurer.ts`), so this looks handled — but it must be confirmed on hardware, not assumed.

**Fix:** No code change expected. Confirm the guard returns cleanly (`appleIntelligenceNotEnabled` / `modelNotReady`) and the voice flow silently falls back to rules with no crash and no error UI dead end.

**Skills (only if a fix is needed):** `react-native-expert`, `typescript-expert`, `systematic-debugging`.

**Verify:** Run voice task entry on (a) a device/simulator without Apple Intelligence, (b) ideally iOS < 26. Speak a task. Confirm: no crash, task still gets created via rules fallback.

---

### 7 — Encryption compliance flag (P2)

**Not a rejection, but it blocks/prompts every single submission until set.**

**Fix:** Add to `app.json` under `ios`:
```json
"config": { "usesNonExemptEncryption": false }
```
(The app uses only standard HTTPS/exempt encryption — no custom crypto — so `false` is correct. If that ever changes, revisit.)

**Verify:** Submit a build; the "Export Compliance" question no longer appears.

---

### 8 — Version bump (P3)

`app.json` `version` is `0.1.0`. Set to `1.0.0` for launch. Cosmetic, but `0.x` reads as unfinished to a reviewer skimming metadata.

### 9 — Analytics opt-out (P3, optional)

Not required (analytics are anonymous, no tracking). A Settings toggle to disable PostHog capture is a trust win and cheap. If added, gate `analytics.capture` on the stored flag. Skills: `react-native-expert`, `retention-optimization` (framing), `humanizer` (toggle copy).

---

## Appendix A — App Review notes (paste into App Store Connect)

> Refined, reviewer-friendly. No marketing fluff — reviewers want the fastest path to your core value and an explanation of every permission.

```
Whenbee works fully offline and needs NO account or login. Nothing to sign up for.

CORE (free)
On the Today tab: add a task, type a time guess, tap the timer, then Stop.
After a few logs the app learns your personal per-category time bias and starts
showing an adjusted "honest" estimate. This loop runs entirely on device — no
network, no sign-in.

PRO (in-app purchase)
Tap any section marked "Pro" (in the Patterns tab, or Honest-Day on Plan) to
reach the paywall. Monthly and Yearly are auto-renewable subscriptions with a
7-day free trial; Lifetime is a one-time purchase. Prices come from the App
Store. Test with a sandbox Apple ID. "Restore" is on the paywall and in Settings.

PERMISSIONS (each is requested only when you tap the related feature, never at launch)
- Microphone + Speech Recognition: optional — speak a task instead of typing.
  Transcription runs on device and is not sent anywhere.
- Calendar: only when you open Honest-Day (Pro). Reads today's events to show a
  realistic day; writes back only times you explicitly confirm.
- Notifications: only if you turn on "Time-up reminders" in Settings. Local
  notifications only; no push server.

PRIVACY
No tracking, no IDFA, no ads. Analytics are anonymous usage counts only (never
task text, never your name). Crash reports contain no personal data. Optional
on-device Apple Intelligence tidies voice input and falls back to local rules on
devices without it.

Privacy Policy: https://whenbee.app/privacy
Terms of Use: https://whenbee.app/terms
```

*(Update both URLs to the real hosted locations before submitting.)*

---

## Appendix B — Paywall + Settings legal links

**Placement:** A single quiet row at the bottom of the paywall, under the Restore / Manage row. Same muted link style.

**Labels (exact strings):**
- `Terms`
- `Privacy`

If you want one line of context above them (optional, keeps the row from looking like orphaned legal text):

```
Subscriptions renew until cancelled. Terms · Privacy
```

**Behavior:** `Terms` → EULA URL. `Privacy` → Privacy Policy URL. Open in an in-app browser (`expo-web-browser`).

**Constants file** (`src/lib/legal.ts`) — single source so nothing drifts:
```ts
export const LEGAL = {
  privacyUrl: 'https://whenbee.app/privacy',
  termsUrl: 'https://whenbee.app/terms',
} as const;
```

---

## Appendix C — Privacy Policy (host at /privacy)

> Production-ready. Plain, honest, matches the app's actual behavior and the on-device promise. Replace the bracketed contact + date before publishing. Keep it truthful — every claim here is enforced by code, so don't add data uses you don't actually have.

```
Whenbee — Privacy Policy
Last updated: [DATE]

Short version: Whenbee keeps your data on your phone. There's no account, we
don't sell anything, and we don't track you across other apps. The longer version
explains exactly what that means.

What stays on your device
Your tasks, time guesses, timer results, categories, and the calibration the app
learns from them live in local storage on your phone. We don't upload them, and
there's no account or cloud copy. If you delete the app, that data is gone.

What we collect, and why
1. Anonymous usage analytics (PostHog). To understand which features get used and
   where people get stuck, the app sends anonymous events — for example "task
   logged", "trial started", along with numbers like a time guess, an actual
   duration, and a category name. These are not linked to your identity. We never
   send the text of your tasks, your name, or any device advertising identifier.
2. Crash and error reports (PostHog). When something breaks, we receive a technical
   report — what failed and basic device/OS info — so we can fix it, processed in
   the EU alongside our analytics. No personal data, no task content.

What we do NOT do
- No advertising, no ad networks, no IDFA.
- No tracking you across other companies' apps or websites.
- No selling or sharing your data with data brokers.
- No account, so nothing tied to an email or profile.

Microphone and speech
If you use voice entry, your speech is transcribed on your device and is not sent
to us or to any server. The microphone is only active while you're recording a task.

Calendar
If you use Honest-Day, the app reads your calendar to show a realistic view of your
day, and writes events back only when you confirm them. This happens on your device,
only when you open that feature, and only after you grant permission.

On-device AI
If your device supports Apple Intelligence, Whenbee can use Apple's on-device model
to tidy a spoken task into a short title. This runs on your phone. On devices
without it, the app uses simple local rules instead.

Purchases
Subscriptions and the lifetime purchase are processed by Apple and managed through
RevenueCat, which tells the app whether your Pro access is active. Apple handles
payment; we never see your card details.

Children
Whenbee is not directed at children under 13 and does not knowingly collect data
from them.

Your choices
Because there's no account, you control your data directly: "Erase everything" in
Settings clears your local data, and deleting the app removes it all.

Changes
If this policy changes, we'll update the date above and post the new version here.

Contact
Questions: [support@whenbee.app]
```

---

## Appendix D — Terms of Use / EULA (host at /terms)

You have two options. Pick one before submitting.

**Option 1 — Apple's standard EULA (fastest).** If you don't need custom terms, link Apple's standard Licensed Application End User License Agreement:
`https://www.apple.com/legal/internet-services/itunes/dev/stdeula/`
Use this exact URL as the "Terms" link in the app and as the EULA field in App Store Connect. Nothing to host.

**Option 2 — Short custom EULA (host at /terms).** Production-ready draft:

```
Whenbee — Terms of Use
Last updated: [DATE]

By using Whenbee, you agree to these terms.

The app
Whenbee helps you estimate how long tasks take by learning from your own timing.
It's a personal tool, not professional, medical, or financial advice. Its estimates
are guidance, not guarantees.

Your data
Whenbee stores your data on your device. You're responsible for your device and for
keeping a backup if you want one — there's no account or cloud copy to restore from.
See our Privacy Policy: https://whenbee.app/privacy

Purchases
Whenbee is free to use. Pro is an optional upgrade. Subscriptions (monthly, yearly)
renew automatically through your Apple ID until you cancel, which you can do anytime
in your Apple subscription settings. The lifetime option is a one-time purchase.
Prices are shown in the app and charged by Apple. Trials convert to paid unless
cancelled before they end. Refunds are handled by Apple under their policies.

Acceptable use
Don't try to break, reverse-engineer, or misuse the app.

No warranty
Whenbee is provided "as is." We work to keep it reliable but can't guarantee it's
error-free or that its estimates fit every situation.

Changes
We may update these terms; the date above shows the latest version.

Contact
[support@whenbee.app]
```

> Note: for auto-renewable subscriptions Apple also requires the standard subscription
> disclosures (length, price, auto-renew, how to cancel) — these already appear on the
> paywall (`src/features/paywall/PlanPicker.tsx`). Keep them there.

---

## Appendix E — In-app privacy screen (refined copy)

The existing `src/app/privacy.tsx` text is good and honest. Tighten it to these four cards and add a link out to the full hosted policy so the in-app and web versions agree.

```
It stays on this phone
Your tasks, guesses, and timer results are saved locally. No account, no cloud copy.

No account, no email
There's nothing to sign up for. Nothing about you is stored on a server.

Anonymous counts only
We see which features get used through anonymous events and crash reports — never
your task names, times, or categories.

Your calendar, only on request
Honest-Day reads your calendar to show a realistic day, and writes back only the
times you confirm. Only when you open it, only after you allow it.

[ Read the full privacy policy → ]   (opens https://whenbee.app/privacy)
```

---

## Appendix F — App Store Connect privacy nutrition labels

Set these in App Store Connect → App Privacy. They must match Appendix C and the privacy manifest (item 3).

| Data type | Collected? | Linked to identity? | Used for tracking? | Purpose |
|---|---|---|---|---|
| Usage Data (product interaction) | Yes | No | No | Analytics / App Functionality |
| Diagnostics (crash data) | Yes | No | No | App Functionality |
| Identifiers (IDFA / user ID) | No | — | — | — |
| Contacts, Location, Health, Financial, Browsing, Messages, Photos | No | — | — | — |
| Purchases (managed by Apple/RevenueCat) | Not collected by us | — | — | — |

Answer "No" to "Do you or your partners use data for tracking?" — correct, there's no ATT/IDFA.

---

## Done = all of this is true

- Paywall shows Terms + Privacy, both load. (1)
- Privacy Policy URL is live and in ASC. (2)
- Manifest + ASC labels declare Usage + Crash data, nothing more, nothing less. (3)
- iPad either works or is turned off. (4)
- Regenerated Info.plist has no stray Face ID / Reminders strings. (5)
- Voice entry survives a device without Apple Intelligence. (6)
- Export-compliance flag set. (7)
- Version is 1.0.0. (8)
- App Review notes pasted into ASC. (10)

Only then submit.
