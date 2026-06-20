# Calendar Padding / Honest-Day — Reintroduction Research

*Date: 2026-06-20 · Research + strategy deep-dive. Re-opens the **calendar / Honest-Day** feature that was dropped 2026-06-19 (B2 in [../02-GAP-ANALYSIS.md](../02-GAP-ANALYSIS.md)). Founder asked to rethink and reintroduce it, driven by real, current data: how to read the calendar, the cleanest way to apply padding, Google Calendar vs. native iOS calendar (pros/cons, auth costs), and what other apps do.*

> **Skills driving this doc:** game-changing-features (10x), market-research-expert, reddit-opportunity-research, retention-optimization. Four parallel live-web research streams (technical/auth, competitor mechanics, Reddit user-voice, market/WTP) run 2026-06-20 with sources cited inline. Self-reported vendor numbers flagged DIRECTIONAL.

---

## TL;DR — the verdict

**Reintroduce it — but as read-only native-EventKit padding, opt-in, Pro-gated, post-activation. Not Google OAuth. Not write-back. Not an onboarding gate.**

1. **The access question has a clear winner: native Apple EventKit via `expo-calendar`, read access only.** It transparently reads the user's iCloud **+ Google + Outlook/Exchange** calendars (any account they added in iOS Settings → Calendar), costs **$0**, needs **no backend, no OAuth, no Google verification, no CASA security assessment, no token storage**, and — critically — **keeps the core loop on-device** (no network in the read path). The direct Google Calendar API path costs weeks of Google verification, only sees Google calendars, and effectively needs a backend. EventKit is strictly better for this app.
2. **The mechanic is uncontested whitespace.** No shipping app pads a calendar from the user's *personal historical accuracy*. Every "buffer/padding" feature in the market is either a static rule (Google Speedy Meetings, Outlook shorten-events) or map-distance travel time (Apple Calendar, Fantastical, Reclaim). Whenbee's learned per-category multiplier applied to real events is genuinely unoccupied.
3. **Demand is real, repeated, and emotional** — concentrated in r/ADHD, r/adhdwomen, r/ADHD_Programmers, r/ProductivityApps. Users already do the manual version ("just double your estimate," "put prep/travel/buffer in as fake events") and are explicitly requesting the auto-adjust engine. Brand-voice fit is excellent against the loud "time-blocking is a toxic trap / makes me feel behind" sentiment.
4. **The money is real but modest — proceed with caution.** The closest comp (Reclaim.ai) topped out at ~$2.1M ARR / ~5% conversion before a $40.2M Dropbox acqui-hire. Treat calendar padding as a **margin-accretive Pro payoff and retention amplifier for already-activated users**, not a headline acquisition hook. Lean ADHD/time-blindness (fastest-growing segment, 17.5% CAGR) and price in the consumer band.
5. **It reconciles with the invariants — if built read-only.** "Core loop on-device-only" is *preserved* by EventKit (no network). "No guilt" is preserved by framing (honest overlay, amber-not-red, no "you're failing"). The original drop reason (dead, permission-bearing code risking App Review) is answered by a lazy, contextual, single-purpose read permission.

---

## 1. Why we're re-opening a settled call

The calendar / Honest-Day feature — read calendar events, apply the learned per-category bias multiplier to each event's duration, show an honest (padded) version of the day, flag when it's physically over-packed — was **THE original Pro feature**. It was dropped 2026-06-19 (founder call; rationale: drop calendar entirely, remove dead permission-bearing code before App Review). Removal is still pending as B2.

Since then, **independent research has re-nominated calendar padding as the single strongest way to monetize Whenbee's honest-duration data** — twice, unprompted ([10-MONETIZATION-OPPORTUNITIES §1.3](../10-MONETIZATION-OPPORTUNITIES.md), [07-PRO-VALUE-IDEAS](../07-PRO-VALUE-IDEAS.md)). The data asset Whenbee uniquely owns — *actual vs. guessed minutes per category* — is most valuable exactly where it meets a real schedule. This doc is the deliberate "still dropped?" re-evaluation, grounded in fresh 2025–26 data.

The reason it was dropped is no longer load-bearing once you separate two things the original framing conflated:
- **Calendar write-back** (mutating the user's calendar) — genuinely heavy, higher App-Review risk, brand-awkward. **Stays dropped.**
- **Read-only calendar import** (reading events to compute an honest overlay shown *inside Whenbee*) — cheap, on-device, low-risk via EventKit. **This is what to reintroduce.**

---

## 2. The access decision — Google Calendar vs. native iOS calendar

This is the heart of the founder's question. Three paths were evaluated against an Expo SDK 54 / RN iOS app with **no backend** and an **on-device-only** invariant.

### 2.1 The decisive fact

**Apple EventKit reads from the device's unified calendar database, which already consolidates iCloud, Google/Gmail, Microsoft Exchange/Outlook, and any CalDAV account the user added in iOS Settings → Calendar → Accounts.** Once an account is added there, its events are visible to any EventKit app ([Apple EventKit](https://developer.apple.com/documentation/eventkit), [account consolidation](https://livebook.manning.com/book/ios-4-in-action/chapter-16/)).

This collapses the "Google vs. native" question. **You do not need both.** Reading the native iOS calendar *gives you Google for free* — if the user syncs Google to their iPhone (the overwhelmingly common case), Whenbee sees those events through Apple with zero Google integration. Building direct Google OAuth *on top of* EventKit would add cost and coverage gaps for almost no marginal benefit.

### 2.2 Comparison table

| Path | Auth cost ($) | Dev effort | Data coverage | On-device / offline | App Review risk | Maintenance |
|---|---|---|---|---|---|---|
| **1. Apple EventKit (`expo-calendar`)** — RECOMMENDED | **$0** | **Low** — one Expo lib + config plugin + permission prompt | **All** calendars in iOS Calendar (iCloud + Google + Outlook/Exchange + CalDAV) | **Fully on-device.** No network in the read loop | **Low** if permission is lazy + single-purpose | **Very low** — Apple-maintained, stable |
| **2. Google Calendar API (OAuth)** | **$0 fees** for `calendar.readonly` (sensitive scope → verification, **no CASA**). Restricted scopes would be ~$540–$4,500/yr CASA. | **High** — OAuth flow, Google Cloud project, consent screen, **annual** re-verification, refresh-token handling | **Google only** (no iCloud/Outlook) | **Not on-device** — network + Google servers per read | **Moderate** — must justify sign-in + disclose | **High** — annual Google re-review, token/secret handling |
| **3. CalDAV / other** | $0 fees, but Google now **mandates OAuth** for CalDAV (since Mar 2025); iCloud needs app-specific passwords | **Very high** — hand-roll transport, per-provider quirks, recurrence parsing | Per-provider, one config each | Network-bound | **Moderate–high** — credential handling | **Very high** — brittle |

### 2.3 Path 1 — Apple EventKit via `expo-calendar` (recommended)

- **API (SDK 54):** `Calendar.requestCalendarPermissionsAsync()`, `Calendar.getCalendarsAsync()`, `Calendar.getEventsAsync(calendarIds, startDate, endDate)` ([Expo Calendar docs](https://docs.expo.dev/versions/latest/sdk/calendar/)).
- **Permission model (iOS 17+):** Apple split calendar access into **full access** (required to *read*) and **write-only** (create-only). Read needs `NSCalendarsFullAccessUsageDescription`; the Expo config plugin emits it via `calendarPermission`. On iOS 17 the old `requestAccess(to:)` is a no-op; Expo migrated to `requestFullAccessToEvents` ([Expo issue #24343](https://github.com/expo/expo/issues/24343), [PR #24545](https://github.com/expo/expo/pull/24545/files)). There is no "read-only" tier — **full access *is* the read tier**; request it, never request write-only/reminders you don't use.
- **Privacy posture:** declare calendar data as **not collected / not linked / not used for tracking** in App Privacy labels — the cleanest possible nutrition label, true only because the data never leaves the device. Expo handles the `PrivacyInfo.xcprivacy` manifest aggregation (mandatory since 2024-05-01) ([Apple TN3183](https://developer.apple.com/documentation/technotes/tn3183-adding-required-reason-api-entries-to-your-privacy-manifest), [Expo privacy manifests](https://docs.expo.dev/guides/apple-privacy/)).
- **Caveat:** EventKit reads what the OS has *synced*; it doesn't force a live pull, and `refreshSourcesIfNecessary()` doesn't reliably trigger an immediate Google sync ([Apple forum #766375](https://developer.apple.com/forums/thread/766375)). For padding recent/upcoming events, normal sync cadence is fine.
- **Cost: $0. Backend: none. Offline: fully on-device** — aligned with the invariant.

### 2.4 Path 2 — Google Calendar API directly (only if a future feature needs live Google-side data)

- **Scope classification (the key disambiguation):** `calendar.readonly` is **SENSITIVE, not RESTRICTED** — Google lists "reading events stored in Google Calendar" as a canonical *sensitive* example ([Google sensitive-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)). So **no CASA security assessment and no fee** — but it still requires Google **OAuth verification**: brand verification, per-scope justification, a **demo video**, and a public **privacy policy**, and sensitive-scope apps are **periodically re-verified**. (Restricted scopes — full Gmail/Drive — are what trigger CASA at ~$540–$4,500/yr; you avoid that by staying read-only on Calendar — [DeepStrike CASA 2025](https://deepstrike.io/blog/google-casa-security-assessment-2025).)
- **Backend:** `expo-auth-session` supports Authorization Code + PKCE client-side, but robust **refresh-token** handling effectively wants a server — Expo's own auth guidance steers you to one ([Expo AuthSession](https://docs.expo.dev/versions/latest/sdk/auth-session/), [Expo authentication](https://docs.expo.dev/develop/authentication/)). That breaks "no backend" and "on-device-only."
- **Coverage:** Google calendars *only* — misses the user's iCloud and Outlook events.
- **Verdict:** higher effort, recurring Google review burden, partial coverage, invariant-breaking. Reserve strictly for a hypothetical future need for Google-side data the OS hasn't synced.

### 2.5 Path 3 — CalDAV / other (skip)

Google killed basic-auth CalDAV (OAuth mandatory since 2025-03-14 — [Google](https://support.google.com/a/answer/14114704)), so CalDAV buys no escape from OAuth; iCloud CalDAV needs app-specific passwords (terrible in-app UX). Very high effort and maintenance, worse review story. Dead end.

### 2.6 App Review note

Guideline 5.1.1 requires requesting only data you need, with a clear in-app reason ([Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)). Whenbee clears the bar *if* it: (1) ships a specific purpose string ("Whenbee reads your upcoming events to apply your personal time-padding"), (2) asks **lazily** at first use of the padding feature, not at launch, (3) requests no write-only/reminders access, (4) reflects "no data leaves device" honestly. The original drop reason — *dead, permission-bearing code risks App Review questions* — is fully answered by a live, single-purpose, lazily-requested read permission.

---

## 3. What other apps do (competitor mechanics)

| App | Calendar connection | Padding / buffer feature | Pricing | Traction (DIRECTIONAL) |
|---|---|---|---|---|
| **Reclaim.ai** | Cloud OAuth, **Google + Outlook only**; no iCloud, **no native mobile app**; two-way write-back | **Buffer Time** (auto prep/recovery) + auto **travel time**; defrag. Durations **user-set** | Free Lite; $8–18/seat/mo | Dropbox acquired Aug 2024 **~$40.2M**; ~320K users / 43K cos; ~$2.1M ARR; ~16K paying |
| **Motion** | Cloud OAuth, **Google + Outlook + iCloud**; two-way | AI auto-schedule; *third-party reviews claim* it learns task duration from actuals — **not confirmed in official docs** (docs show user-set) | $19–29/seat/mo | **$50M ARR (Aug 2025)**; >$500M valuation |
| **Sunsama** | Google + MS + Apple; two-way | **No auto-buffer.** Signature = **overcommitment warning** (sums per-task estimates vs. daily capacity). Manual, no learning | $16–20/mo | ~$1.5M ARR (2024), bootstrapped |
| **Akiflow** | Google + MS + Exchange + iCloud + CalDAV; two-way | Buffer only inside booking-link "Slots" | $19–34/mo | ~$200K rev (2024), YC |
| **Structured** | **iOS: native EventKit only**, read-only, no write-back. Android/web: Google OAuth | No buffer; has task durations + AI parse | Free; $6.49/mo · $19.99/yr · $64.99 lifetime | **15M+ downloads, 1.5M active, 500K+ Pro**; Editors' Choice |
| **Fantastical** | Direct account connections (own sync) + secondary "show iOS calendars" toggle; two-way | **Travel time + "time to leave"** (traffic/weather); booking links | Free; ~$57/yr Premium | Apple Design Award pedigree |
| **Tiimo** (ADHD) | **Import-only (one-way)** from Apple/Google/Outlook | None built-in (community-requested); AI gives *initial* estimates only | $54/yr iOS | **$4.8M raised; 50K paid / 500K free**; **Apple iPhone App of the Year 2025** |
| **Llama Life** (ADHD) | None native (standalone) | None; reports planned vs. actual, user calibrates mentally | $12.99/yr · $29.99 lifetime | ~$135K rev 2024 / ~950 customers |
| **Google / Outlook / Apple Calendar** | Native | Static rules (Speedy Meetings, shorten-events) / map-distance travel time | Free | Billions; no personal-duration learning |

### 3.1 The dominant pattern

Two camps, split by app type:
- **Cloud-OAuth schedulers** (Reclaim, Motion, Sunsama, Akiflow) connect server-side to Google + Microsoft and **write back**, because their job is to *put blocks on your calendar*. Reclaim has no native mobile app at all.
- **Native-iOS consumer planners** (Structured on iOS, Apple Calendar, Fantastical's secondary path, Tiimo's import) read through **EventKit**, read-only, and avoid the Google OAuth gauntlet entirely.

**The norm for a consumer iOS daily planner is read-only EventKit.** Structured is the textbook case — a pure EventKit reader at 15M+ downloads; for Google events you add the Google account in iOS Settings and Structured sees it through Apple ([Structured help](https://help.structured.app/en/articles/329730)). This is exactly the path recommended in §2.

### 3.2 The whitespace

**No shipping app adjusts event/task durations based on the user's personal historical accuracy and surfaces it as an honest number.** "Buffer/padding" in the market is always one of three static things — shorten-the-meeting rules, map-distance travel time, or user-configured gaps. Apps that *show* estimate-vs-actual (Llama Life, Sunsama's capacity sum, Google Time Insights) make *you* do the calibration. Motion is the only product that even *claims* to learn from actuals, and that claim lives only in third-party reviews, used to *schedule*, never to surface an honest number ([usemotion docs](https://www.usemotion.com/help/time-management/auto-scheduling)). Super Productivity explicitly tracks actuals "rather than automatically adjusting estimates" ([super-productivity](https://super-productivity.com/use-cases/time-tracker/)) — i.e., it stops where Whenbee starts. **A learned, per-category, visible multiplier applied to make a calendar day honest is uncontested** — most so in the ADHD niche, which has no learning loop at all.

---

## 4. User demand (Reddit)

Concentrated in r/ADHD, r/adhdwomen, r/ADHD_Programmers, r/ProductivityApps. *Thread existence: HIGH confidence (live URLs). Exact wording: MEDIUM (search-snippet level, not body-scraped). Nothing fabricated.*

| Pain point | User phrasing | Thread | Fit |
|---|---|---|---|
| Tasks take 2–3× longer than blocked | "Usually things take 2 or 3 times longer than I think. So I'm late…" | [r/ADHD](https://www.reddit.com/r/ADHD/comments/1ou9ubq/time_blindness_is_the_adhd_symptom_nobody_talks/) | **Perfect** — core wedge |
| Manual rule: "just double it" | "Put twice your estimates. Accept the chaos…" | [r/adhdwomen](https://www.reddit.com/r/adhdwomen/comments/1n8d7sb/dae_feels_like_productivity_advice_assumes_you/) | **Perfect** — Whenbee automates the ×2, personalized |
| DIY padding as fake events | "putting prep/travel/buffer time into my calendar as if they were events" | [r/adhdwomen](https://www.reddit.com/r/adhdwomen/comments/17l7xew/people_who_were_always_late_and_then_changed_what/) | **High** — the labor Whenbee removes |
| Explicit feature request | "the app adjusts the duration of future tasks… and adjusts the calendar accordingly" | [r/ProductivityApps](https://www.reddit.com/r/ProductivityApps/comments/1ejeiba/automated_task_timing_adjustment_in_app/) | **Perfect** — literally requests the engine |
| Time-blocking shame/rigidity | "Time-blocking is a toxic trap for AuDHD brains." | [r/AuDHDWomen](https://www.reddit.com/r/AuDHDWomen/comments/1t0phfq/timeblocking_is_a_toxic_trap_for_audhd_brains/) | **High** — "no guilt, no streaks" answers it |

**Recurring search language** (for ASO/landing/onboarding copy): *"everything takes 2x longer than I think"*, *"double your time estimate"*, *"time blindness"*, *"add a buffer / buffer time"*, *"prep/travel/buffer as calendar events"*, *"estimate vs actual time"*, *"time blocking never works / toxic trap"*, *"I'm always late."*

The emotional core is shame — "people think I'm lazy/disrespectful when I'm genuinely trying." Whenbee's no-guilt positioning is the direct antidote. Honor the invariant: this is a hook for *empathy* copy, never for guilt.

---

## 5. Market & WTP

**Verdict: PROCEED WITH CAUTION.**

- **Reclaim economics (closest comp):** ~$2.1M ARR (2024, +62% YoY), ~16K paying, ~$132 ACV, ~320K total users → **~5% free→paid conversion**; acquired by Dropbox **$40.2M** (2024-07-26) ([Getlatka](https://getlatka.com/companies/reclaimai), [GeekWire](https://www.geekwire.com/2024/dropbox-acquires-reclaim-a-calendar-app-that-uses-ai-scheduling-to-boost-productivity/), [MarketScreener](https://www.marketscreener.com/quote/stock/DROPBOX-INC-45013534/news/Dropbox-Inc-acquired-Reclaim-ai-Inc-for-40-2-million-47716890/)). The poster child sold at ~19× ARR on a modest base and converted at the freemium baseline *despite* every structural advantage. Don't assume calendar integration lifts conversion above baseline.
- **Market size:** calendar/scheduling software ~$2.5–5.7B, ~9–11% CAGR; **ADHD apps $1.9B (2025) → $6.7B by 2033, 17.5% CAGR** — the fastest slice and the best-fit framing ([Grand View](https://www.grandviewresearch.com/industry-analysis/adhd-apps-market-report)).
- **WTP:** AI schedulers price $16–34/mo (B2B/prosumer); consumer ADHD planners price **$3.50–12/mo** (Tiimo, Numo). Model Whenbee's Pro in the consumer band, conversion at the **3–5% freemium reality**, not trial-rate optimism.
- **ADHD validation:** Tiimo ~10% conversion (50K of 500K), Apple's 2025 iPhone App of the Year; Inflow raised $11M, acquired by Cerebral 2026. The audience pays — but is the *most* subscription-fatigued cohort in software (53% cancel-and-restart deliberately), so value must be bound clearly.
- **Activation risk:** calendar permission is a **retention amplifier for the converted minority** (integrated productivity apps run 50–70% DAU/MAU) but an **activation tax if forced up front** (early/forced permission asks depress onboarding completion). The two reconcile only one way for Whenbee: keep the core loop calendar-free; surface padding as an opt-in Pro feature with a contextual, value-first prompt.

---

## 6. The cleanest way to apply it (proposed mechanic)

A reintroduction that fits the invariants and the whitespace:

1. **Read-only, native EventKit, opt-in, Pro-gated.** No write-back. The honest overlay lives *inside Whenbee*; the user's real calendar is never mutated. This is the cleanest App Review story and the strongest brand fit (we show truth; we don't rearrange your life).
2. **Lazy, contextual permission.** Ask only when the user first opens "Make my day honest" — never at launch, never in onboarding. Copy leads with value ("See your real day — padded by what tasks *actually* take you").
3. **Map each event to a learned multiplier.** Infer category from the event title via a light on-device keyword map; let the user correct/assign once and remember it. Where there's no signal, fall back to the global multiplier (or leave the event unpadded and labelled "not calibrated yet").
4. **Show the honest day, calmly.** For each event: scheduled duration → honest duration (= scheduled × category multiplier). Surface where the day overflows the available hours and where back-to-back events collide once padded. **Amber-not-red. No "you're failing."** Pair with the existing Start-By planner: "to make your 9am, start by 8:12."
5. **Compose with what already shipped, don't duplicate.** The day-capacity check (planned Plan-tab tasks vs. hours) and Honest-Day (fixed calendar events + tasks) are complementary: capacity check = *your tasks*; Honest-Day = *your fixed commitments + tasks*. Frame Honest-Day as the capacity check extended over real calendar events — same "will my day fit?" payoff, now over the schedule the user actually keeps.
6. **Keep write-back dropped.** Travel-time/auto-reschedule is incumbent territory (Reclaim/Motion/Fantastical) and heavy. Whenbee's edge is the *honest number*, not scheduling automation. Don't chase it.

This positions Whenbee as **the only app that pads your calendar by what *you personally* actually take** — the uncontested whitespace, on the fastest-growing segment, at $0 integration cost, without breaking a single invariant.

---

## 7. Risks & invariant reconciliation

| Concern | Resolution |
|---|---|
| "Core loop is on-device-only" | EventKit read is **on-device, no network**. Padding is a Pro payoff layer, not the core loop. Invariant intact. |
| "No guilt, ever" | Honest overlay is amber-not-red, no streaks, no "you failed." Reddit shows this audience is *rejecting* shaming tools — our framing is the differentiator, not a compromise. |
| Original drop reason (dead permission-bearing code → App Review) | Answered by a live, single-purpose, lazily-requested read permission with a precise purpose string. |
| Activation drag from permission ask | Never gate onboarding; ask contextually at first feature use, post-activation, value-first. |
| Modest revenue ceiling (Reclaim comp) | Treat as margin-accretive Pro + retention amplifier, not an acquisition hook. Price consumer band, model 3–5% conversion. |
| Re-opening a settled founder decision | This doc *is* the deliberate re-evaluation the prior docs asked for. Founder confirmation required before build. |

---

## 8. Open decisions / next steps

1. **Founder GO/NO-GO** on reintroduction as scoped here (read-only EventKit, opt-in, Pro, no write-back). If GO, supersede B2's "delete calendar end-to-end" with "keep read-only EventKit path; remove only write-back + the old `make_day_honest` paywall framing," and add an Honest-Day spec under `specs/`.
2. **Category inference design** — keyword map vs. one-tap assignment vs. reuse of existing category model; decide the cold-start behavior for uncalibrated events.
3. **Packaging** — does Honest-Day sit inside the existing day-capacity Pro tier or as its own line in the bundle? (Recommend folding into the "will my day fit?" payoff alongside capacity check.)
4. **Build order** — slot after the first validated Pro build (PDF export + review ritual + capacity check + confidence band), since it reuses the capacity-check UI and the engine's multiplier output.
5. **Re-validate live** — once shipped, watch (PostHog) whether calendar-connected Pro users show higher D7/D30 return, per the retention-amplifier thesis.

---

## Sources

Live web research 2026-06-20, four streams. Technical: [Expo Calendar](https://docs.expo.dev/versions/latest/sdk/calendar/), [Apple EventKit](https://developer.apple.com/documentation/eventkit), [Expo iOS-17 permission PR #24545](https://github.com/expo/expo/pull/24545/files), [Google sensitive-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification), [DeepStrike CASA 2025](https://deepstrike.io/blog/google-casa-security-assessment-2025), [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), [Google CalDAV→OAuth](https://support.google.com/a/answer/14114704). Competitors: [Structured help](https://help.structured.app/en/articles/329730), [usemotion docs](https://www.usemotion.com/help/time-management/auto-scheduling), [Flexibits](https://flexibits.com/fantastical-ios/help/getting-started), Reclaim/Latka/GeekWire (below). Reddit: thread URLs inline (§4). Market/WTP: [Getlatka — Reclaim](https://getlatka.com/companies/reclaimai), [GeekWire — Dropbox acquires Reclaim](https://www.geekwire.com/2024/dropbox-acquires-reclaim-a-calendar-app-that-uses-ai-scheduling-to-boost-productivity/), [MarketScreener — $40.2M](https://www.marketscreener.com/quote/stock/DROPBOX-INC-45013534/news/Dropbox-Inc-acquired-Reclaim-ai-Inc-for-40-2-million-47716890/), [Grand View — ADHD apps](https://www.grandviewresearch.com/industry-analysis/adhd-apps-market-report), [Adapty conversion benchmarks](https://adapty.io/blog/trial-conversion-rates-for-in-app-subscriptions/). Vendor revenue/user/conversion figures are self-reported or estimated — DIRECTIONAL.
