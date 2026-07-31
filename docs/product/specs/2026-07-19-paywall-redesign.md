# Paywall redesign — spec + build plan (2026-07-19)

Status: **approved for build** (founder locked every decision below across the 2026-07-19 brainstorm).
Mocks (source of visual truth):

- `mocks/paywall-redesign-2026-07.html` — A/B skeletons, success screen (C), error states (D)
- `mocks/paywall-refine-2026-07.html` — V3 Editorial skeleton (locked)
- `mocks/paywall-featline3-2026-07.html` — G5 + H3 feature sections, all 12 features, full context
- `mocks/paywall-h3colors-dark-2026-07.html` — C3 colors + both layouts in dark mode

Research basis (agent-verified, sources in session log): Blinkist trial-timeline case (+23% trial starts, −55% complaints from an explicit "we remind you" promise), RevenueCat SOSA 2025/2026 (yearly pre-select → 35–45% annual mix; lifetime <5% of purchases → anchor role), Adapty/Superwall (value must be visible without leaving the paywall; scroll > tap for long lists; one plan must be the obvious answer).

---

## 1. Locked decisions (do not re-litigate)

1. **Skeleton = V3 Editorial**, in this exact order:
   grabber → Pro coin chip + title + sub → **feature section** (variant, see §3) → founder-reserve card (only when the live offering carries a founder package, unchanged logic) → plan picker → trial timeline (airy, card-less) → inline error band (when present) → amber CTA → footer group.
   No BeeBurst sunburst, no BeforeAfterHero, no TopProof, no ValueStack. Fewest surfaces; plan cards are the only boxes above the CTA.
2. **Both feature-section variants ship**, switchable at runtime for device testing (§3.3): **G5 "A day with Pro"** and **H3 "Plan · Do · Learn"**. Default: G5.
3. **Color: C3 all-indigo brand mono.** Feature checks/coins/icons/chips are indigo-family only. Amber appears in exactly three places on the paywall: the Pro coin chip, G5's Sunday payoff moment, and the CTA + trial-timeline "Today" dot. (Amber = honey/payoff semantics — unchanged token rule.)
4. **Plan picker: Lifetime → Yearly (pre-selected) → Monthly.** Yearly badge = `MOST POPULAR`. Yearly shows the **per-month equivalent as the big number** ("$2.92" + "per month" beneath), note = "7 days free, then {yearlyPrice} a year". Lifetime note = "Pay once. Yours forever." Prices always from the live offering `priceString` — never hardcoded.
5. **Trial timeline keeps the reminder promise** and we **actually schedule the Day-5 local notification** on trial purchase (§6). Timeline copy is fixed (§7).
6. **Footer = one quiet group**: reassurance line → calibration trust line → renew line → single link row `Restore Purchases · Terms · Privacy`. **"Manage subscription" is removed from the paywall** (Settings-only; verify Settings still has an entry, add if missing).
7. **Errors**: user-cancel = silent (no message). Recoverable = inline band above the CTA, CTA becomes the retry. Restore-with-nothing-found = neutral tone, never red. (§5)
8. **Success screen** is a new post-purchase route with celebration + billing dates + reminder confirmation + one CTA (§4).
9. **Copy bans hold everywhere**: no em dashes, no "unlock", no guilt language, no fake urgency, no invented numbers.

---

## 2. Screen spec — shared shell

File: `src/features/paywall/Paywall.tsx` (restructure).

| Element | Spec |
|---|---|
| Header | `ProCoin` (existing, amber chip "WHENBEE PRO") → `type.title` heading → `type.body` sub, colors `ink` / `inkSoft`. Title + sub stay **trigger-adaptive** via `copyFor()` (existing `paywallCopy.ts` MAP is kept; `proof`/`lead` fields become unused → removed). |
| Feature section | Variant component, §3. Sits directly under the sub; no intro line of its own. |
| Plan picker | §2.1. |
| Trial timeline | §2.2. Rendered only when selected plan is a subscription (existing rule). |
| CTA | `AppButton` amber, fullWidth. Label: sub selected → `Try 7 days free`; lifetime → `Get Pro forever · {priceString}`; busy → `One moment…`; after a recoverable error → `Try again`. |
| Footer | New `PaywallFooter.tsx`, §2.3. |

All spacing/typography from tokens (`t.space`, `type.*`); no raw values. Mock px values map to nearest tokens (mock 16 gap → `t.space[4]`, etc.).

### 2.1 PlanPicker changes (`PlanPicker.tsx`)

- `ORDER = ['lifetime', 'yearly', 'monthly']`.
- Default selection stays **yearly** (`heroId` logic in `Paywall.tsx` unchanged — it already picks yearly).
- Badge: fixed string `MOST POPULAR` on the yearly row (remove the savings calculation — `savingsLabel`/`FALLBACK_SAVINGS` deleted; research: "Most Popular" outperforms savings-on-cheapest, and the per-month number now carries the value story).
- Yearly right column: `perMonthLabel()` result as the **primary price** (`Inter-Bold`, `t.fontSize.lg`, tabular) with caption `per month` beneath; note line `7 days free, then {priceString} a year`. If `perMonthLabel` returns null (unparseable locale), fall back to the yearly `priceString` as the big number and note `7 days free, then billed yearly` — graceful, never wrong math.
- Lifetime note: `Pay once. Yours forever.` Monthly note unchanged.
- Selected style unchanged (primarySoft fill + primary border) — matches chips elsewhere.

### 2.2 TrialTimeline rewrite (`TrialTimeline.tsx`)

Vertical, card-less ("airy" from V3):

- 3 steps; left rail column `t.space[6]` wide; dots `t.iconSize.lg` (24) circles.
- Today dot: `accent` fill + check glyph (`onAmber`) + halo ring `accentSoft` (4pt spread via a wrapper view, not shadow). Day 5 / Day 7 dots: `surface` fill + 1.5pt inset ring `primarySoft`.
- Connector: 2pt **dotted** vertical line, color `gapStripeHi` (#C8C2F0 — existing token).
- Text: head `type.bodySm` bold ink; desc `type.caption` inkSoft, "We remind you" bolded ink.
- No entrance animation (paywall content appears at rest; house animation rules).

### 2.3 PaywallFooter (`PaywallFooter.tsx`, new)

Column, centered, gap `t.space[2.5]`:

1. Reassure: `No payment now. Cancel anytime.` — `type.bodySm` semibold `inkSoft`. (Hidden when lifetime selected → replace with `One payment. No renewals, ever.`)
2. Trust: `**Calibration stays free, always.** Pro just adds the payoff.` — caption, bold lead ink, rest inkSoft.
3. Renew: `Plans renew until cancelled.` — caption `inkFaint`. (Hidden when lifetime selected.)
4. Links row: `Restore Purchases · Terms · Privacy` — caption bold `inkSoft`, interpuncts `inkFaint`; Restore triggers existing `handleRestore`, Terms/Privacy open `LEGAL.termsUrl` / `LEGAL.privacyUrl` via `WebBrowser` (Apple 3.1.2 satisfied — link row lives on the buy screen).
5. Founder quote: **dropped from the paywall** (was text weight at the decision moment; no measured value).

Expo Go note (`isExpoGo` purchases-simulated caption) stays, appended after the footer.

---

## 3. Feature section — the two variants

### 3.0 Shared data: `src/features/paywall/proFeatures.ts` (new, pure TS)

Single registry both variants consume — one source of truth for the 12 features:

```ts
export type ProFeatureKey =
  | 'calendar' | 'capacity' | 'focusWindows' | 'routines' | 'goalCoach'
  | 'confidenceBand' | 'stealsTime' | 'weeklyReview' | 'pdfExport'
  | 'history' | 'presence' | 'hyperfocusGuard';

export interface ProFeature {
  key: ProFeatureKey;
  label: string;                       // "Honest calendar", "Day capacity", …
  group: 'plan' | 'run' | 'learn';     // H3 grouping
  moment: 'morning' | 'deepwork' | 'midday' | 'evening' | 'week'; // G5 grouping
  icon: keyof typeof Ionicons.glyphMap; // mapped in the UI layer, key here as string
}
```

Labels (final): Honest calendar · Day capacity · Focus windows · Routines · Goal coach · Confidence band · What steals your time · Weekly review · PDF export · Full history · Lock-screen timer · Hyperfocus guard.

Groups: plan = calendar, capacity, focusWindows, confidenceBand · run = routines, goalCoach, presence, hyperfocusGuard · learn = stealsTime, weeklyReview, pdfExport, history.

Moments: morning = routines, goalCoach · deepwork = focusWindows, presence, hyperfocusGuard · midday = capacity, confidenceBand · evening = calendar · week = weeklyReview, pdfExport, history, stealsTime.

Unit-test the registry: 12 unique keys, every key has a group and a moment, groups partition 4/4/4, moments partition 2/3/2/1/4.

### 3.1 G5 · `DayWithPro.tsx` (new) — default variant

Vertical day rail, 5 moments:

| Time | Moment heading | Feature chips |
|---|---|---|
| 7:00 | The morning starts honest | Routines · Goal coach |
| 9:30 | Deep work, kept company | Focus windows · Lock-screen timer · Hyperfocus guard |
| 13:00 | Before you say yes to more | Day capacity · Confidence band |
| 17:00 | The evening actually fits | Honest calendar |
| Sun | The week, understood | Weekly review · PDF export · Full history · What steals your time |

- Row anatomy: time column (fixed width `t.size.calTimeCol` ≈ 52 or nearest token, right-aligned, `fontFamily.mono`? No — mock uses Inter tabular caption `inkFaint`) → rail column with a 30pt **coin** (surface fill, `surfaceRaisedEdge` bottom edge 2.5pt — same coin language as tactile tiles) holding a 14pt primary icon → content: moment heading `type.bodySm` bold ink + wrapped chips.
- Chips: `primaryWash` fill (light) / `primarySoft` (dark), `radii.full`, caption bold ink, padY `t.space[1]`, padX `t.space[2.5]`.
- Sunday moment: coin `accent` fill w/ `accentEdge` edge + `onAmber` icon; chips `accentSoft`. (The one amber moment — payoff semantics.)
- Connector between coins: 2pt dotted `gapStripeHi` (light) / primary-at-45% (dark).
- Icons per moment coin: routines-repeat, bell, capacity-gauge, calendar, review-doc (from the registry's icon field where possible; custom moment icons acceptable via Ionicons equivalents — no hand-rolled SVG unless Ionicons lacks a fit, then a small component in `src/components/icons/` per `svg-animations` skill).
- Static at rest. No entrance animation.

### 3.2 H3 · `FeatureGroups.tsx` (new)

- 3 groups with small-caps headers (`type.eyebrow`, letterSpacing `wide`): `PLAN HONESTLY` / `RUN THE DAY` / `LEARN YOUR PATTERNS` — color `inkSoft` (C3: headers muted; mock row-1 C3 panel is the reference).
- Under each header a 2-column grid (gap `t.space[2]` / `t.space[2.5]`) of items: 19pt round coin `primarySoft` fill + primary check (Ionicons `checkmark`, size `iconSize.xs`) + label `type.caption` bold ink.
- All indigo; zero amber inside the section.

### 3.3 Variant toggle (device testing)

- kv key `paywall.featureVariant`: `'day' | 'groups'`, default `'day'`. Read through a tiny hook `usePaywallVariant()` in `src/features/paywall/` backed by `src/lib/kv.ts` (no new store).
- Dev screen (`src/app/(modals)/dev`) gets a toggle row "Paywall feature section: A day with Pro / Plan·Do·Learn".
- `paywall_view` analytics event gains `feature_variant` prop so results are comparable later; if a real A/B is wanted post-launch it moves to a RevenueCat/PostHog experiment — out of scope now.

---

## 4. Success screen — `src/app/(modals)/pro-welcome.tsx` (new route)

- Route: `(modals)/pro-welcome`, `presentation: 'fullScreenModal'`, `headerShown: false` (hard rule), listed explicitly in `(modals)/_layout.tsx`, `unstable_settings` anchor already handled by the group.
- Entry: on successful purchase/restore-to-Pro, `Paywall` calls `router.replace('/pro-welcome?plan=yearly&trialEnd=<iso>')` instead of `router.back()`. Params: `plan` (`yearly|monthly|lifetime`), `purchasedAt` ISO.
- Layout (from mock C):
  1. Halo: 120pt soft `accentSoft` radial ring behind a 76pt amber coin (accent fill, `accentEdge` bottom edge) containing the **bee glyph** (reuse `BeeGlyph`/`WhenbeeAvatar` asset — not a plain check) sized ~34pt.
  2. `You're Pro.` — `type.title` ink, centered.
  3. Sub: `Every honest number you earned now works everywhere you plan.` — body inkSoft centered.
  4. Confirmation card (surface, `radii.card`): 3 rows, icon tile `primaryWash` 30pt + text.
     - Subs: `**7-day free trial started.** Nothing is charged before {chargeDate}.` / `**Reminder set for {reminderDate}.** We'll nudge you before the trial ends.` / `**Your day is honest now.** Calendar, routines, insights, review, lock-screen timer.`
     - Lifetime: `**Pro is yours, forever.** One payment, no renewals.` / `**Your day is honest now.** …` (2 rows, no dates).
     - Dates computed from `purchasedAt` (+5d reminder, +7d charge), formatted via the app's existing date formatting util.
  5. CTA: `AppButton` amber fullWidth `See my honest day` → `router.replace('/(tabs)')` (Today/day view).
- **Animation** (build with `creating-reanimated-animations` + `motion-design` + `svg-animations` skills):
  - Halo ring: opacity 0 → 1, 400ms ease-out.
  - Coin: opacity 0→1 + scale 0.95→1, 240ms, `Easing.out(cubic)` — **no overshoot, no spring**.
  - Bee: SVG **path draw** (strokeDashoffset real-length → 0, overestimated length per the `react-native-svg` gotcha), starts 120ms after coin.
  - Rows: staggered opacity fades, 60ms apart, each ≤ 240ms. CTA renders at full opacity immediately (never animate buttons).
  - Reduced motion: everything at final state.
- Analytics: `pro_welcome_view {plan}`, `pro_welcome_cta`.

---

## 5. Purchase error handling (in `Paywall.tsx` + new `InlineNotice.tsx`)

- New component `src/features/paywall/InlineNotice.tsx`: `tone: 'danger' | 'neutral'`, icon dot + text. Danger: `dangerSoft` bg (NEW token, §8), first sentence bold `danger`, rest ink. Neutral: `surfaceSunken` bg, inkSoft text, no icon.
- `handleBuy` catch classifies the RevenueCat error:
  - `userCancelled` → **no UI at all**, no error analytics `result: 'error'` (log `result: 'cancelled'`).
  - Purchase-not-allowed / payment declined codes → danger notice: `**Your payment method was declined.** You weren't charged. Check it in App Store settings, then try again.` (Android: "Google Play settings" via `Platform.select`.)
  - Everything else (network/store) → danger notice: `**That didn't go through.** You weren't charged. Check your connection and try once more.`
- While an error is shown, CTA label = `Try again`; selection preserved; a new attempt clears the notice.
- Restore outcomes: nothing found → **neutral** notice `No earlier purchase on this Apple ID. If you subscribed on another account, switch and restore there.` (platform-adapted); restore network error → danger notice (generic).
- Add a purchase watchdog: if the purchase promise neither resolves nor rejects in 30s, clear `busy` and show the generic danger notice (CTA can never spin forever).
- Regression tests: cancel shows nothing; declined shows declined copy; CTA relabels; watchdog fires (fake timers).

## 6. Day-5 trial reminder — `src/services/trialReminder.ts` (new)

- Pure date fn `trialReminderDate(purchasedAt: Date): Date` → +5 days at 10:00 local (unit-tested, in the service but pure — no engine dependency).
- `scheduleTrialReminder(purchasedAt)` — guarded by the expo-notifications native probe (existing gotcha: probe before import-use in Expo Go). **Founder decision 2026-07-19:** silently skipping when permission is missing would break the paywall's explicit "we remind you" promise (misleading), so the success screen carries the honest ask: if permission already granted → schedule immediately and show `Reminder set for {date}`; if undetermined → the reminder row renders as a tappable `Get the Day-5 reminder` that fires the system permission prompt and schedules on grant; if denied → row copy `Reminder needs notifications. You can still cancel anytime in Settings.` Capture `trial_reminder_skipped {reason}` when not scheduled.
- Notification copy (no guilt): title `Your Pro trial ends in 2 days`, body `Keep it or cancel in Settings. Either way, your calibration stays.` Deep link: `whenbee:///settings`.
- Called from the purchase-success path for subscription plans only. Cancel any previously scheduled trial reminder before scheduling (idempotent id).
- Analytics: `trial_reminder_scheduled`.

## 7. Final copy strings (paste-exact; humanizer + ban-list applied)

- Timeline: `Today / All of Pro, free. Nothing is charged.` · `Day 5 / We remind you the trial is ending.` · `Day 7 / Trial ends. Cancel before and you pay nothing.`
- Reassure: `No payment now. Cancel anytime.` — lifetime: `One payment. No renewals, ever.`
- Trust: `Calibration stays free, always. Pro just adds the payoff.`
- Renew: `Plans renew until cancelled.`
- CTA: `Try 7 days free` / `Get Pro forever · {price}` / `One moment…` / `Try again`.
- G5 moment headings + chips: exactly §3.1 table.
- H3 headers: `PLAN HONESTLY` / `RUN THE DAY` / `LEARN YOUR PATTERNS`.
- Errors + restore + notification: §5 / §6 verbatim.
- Success screen: §4 verbatim.

## 8. Token additions (`src/theme/tokens.ts` + `useTheme` enumeration check)

- `dangerSoft`: light `rgba(209,67,67,0.08)`, dark `rgba(224,100,100,0.14)` — inline error band fill.
- Everything else uses existing tokens (verify `gapStripeHi` reads on dark; if not, dark maps the connector to `rgba(130,117,240,0.45)` as a dark-side value of the same token pair).
- Remember the `useTheme` enumeration memory: new color keys are picked up automatically only if inside `colors` — confirm, else update `resolveTheme`.

## 9. File inventory

**New:** `proFeatures.ts` (+test) · `DayWithPro.tsx` · `FeatureGroups.tsx` · `usePaywallVariant.ts` (+test) · `PaywallFooter.tsx` · `InlineNotice.tsx` · `src/services/trialReminder.ts` (+test) · `src/app/(modals)/pro-welcome.tsx` (+ layout entry) · possible `src/components/icons/*` if an Ionicons gap forces custom glyphs.

**Modified:** `Paywall.tsx` (restructure, error classification, success routing, watchdog) · `PlanPicker.tsx` (order/badge/per-month-primary) · `TrialTimeline.tsx` (airy rewrite) · `paywallCopy.ts` (drop `proof`/`lead`, keep trigger titles/subs) · `tokens.ts` (+dangerSoft) · dev screen (variant toggle) · `(modals)/_layout.tsx` (pro-welcome, headerShown false) · settings (ensure Manage subscription entry) · analytics event props.

**Deleted (with their tests):** `BeforeAfterHero.tsx`, `TopProof.tsx`, `ValueStack.tsx`, `TrialTimeline` old test, savings-calc tests. `FounderReserveCard` stays.

## 10. Build plan (phases; TDD on all logic)

| Phase | Work | Gate |
|---|---|---|
| 0 | **Ask founder → new branch** (hard gate) + worktree | founder yes |
| 1 | Tokens (`dangerSoft`) · `proFeatures.ts` + tests · `trialReminderDate` + tests · `usePaywallVariant` + tests | `npx jest` green |
| 2 | UI components: `DayWithPro`, `FeatureGroups`, `PaywallFooter`, `InlineNotice`, `TrialTimeline` rewrite, `PlanPicker` changes (skills: react-native-expert, ui-design set, typescript-expert) | lint + typecheck |
| 3 | `Paywall.tsx` restructure + error classification + watchdog + dev toggle + analytics props; update/replace existing paywall tests | affected suites green |
| 4 | `pro-welcome` screen + animation (skills: creating-reanimated-animations, motion-design, svg-animations) + `trialReminder` scheduling wired into purchase success | suites green |
| 5 | Cleanup deletions · settings Manage entry · full `npm run lint && npm run typecheck && npm test` | all green |
| 6 | Sim verification: deep-link `whenbee:///paywall?trigger=settings_upgrade` light+dark, both variants via dev toggle, error state (airplane mode), purchase-sim success in Expo-Go-guarded mode; screenshots to founder | founder eyeballs |
| 7 | Device test: Android via `whenbee-device` script (JS-only change, **no prebuild**, `install -r` data-safe); founder flips the dev toggle to compare G5 vs H3 in real use | founder verdict |
| 8 | PR (`/init-cmt`), **no merge** — founder merges | — |

Phases 2 and 4 are parallelizable across two subagents (feature-section variants are file-disjoint: one takes `DayWithPro` + G5 wiring, the other `FeatureGroups` + H3) — with the worktree-subagent cwd guard (verify HEAD after each task).

## 11. Out of scope / later

- Real A/B of G5 vs H3 (RevenueCat experiment) — after device pick.
- 14-day-trial test, "3 vs 12 features" test — post-launch experiment list.
- iOS Live Activity on the success screen, localized notification copy (i18n pass).
- Founder-reserve card visual refresh (unchanged this round).

## 12. Open questions for the founder (blocking phase 0)

1. OK to create the branch? Proposed name: `feat/paywall-redesign-v3`.
2. Trial-reminder permission: if notifications were never granted, is silently skipping the reminder OK for v1 (analytics-tracked), or do you want a soft pre-prompt on the success screen ("Want the Day-5 reminder? Allow notifications")? Spec assumes **soft-ask on the success screen** is v2; v1 = schedule-if-granted.
3. Lifetime CTA wording `Get Pro forever · $89.00` — approve?
