# 02 — Honest Week / Month review ritual  ·  Pro

**Status:** spec · **Tier:** Pro (`pro` entitlement) · **Skills applied:** retention-optimization, ui-design:react-native-design, ui-design:interaction-design, motion-design, ux-principles, conversion-psychology, humanizer

> Read [specs/README.md](README.md) first. This spec only states what is specific to the ritual; it never repeats the shared invariants (no-guilt, no-streak, on-device, no-network, no-calendar, tokens-only, ProGate on the `pro` entitlement, RevenueCat pricing). Rationale in [../07-PRO-VALUE-IDEAS.md §1.2 + §"truth #5"](../07-PRO-VALUE-IDEAS.md).

---

## 1. What it is (one paragraph)

Every Monday morning Whenbee quietly assembles a short, calm recap of the week that just ended: where your guesses landed, which one or two categories tightened, the single task that surprised you most, and how much time your honest numbers protected you from losing. Once a month it assembles a slightly longer version covering the four weeks behind you. The recap is not a dashboard you go hunting for and it is never a score — it is a one-screen, scrollable letter from your own data, surfaced as a soft card on the Patterns tab plus an optional gentle notification. It reuses the insight the app already computes (archetype, plan-vs-wing, biggest surprise, drift, the Pro "what steals your time" / "when you're sharpest" correlations) and packages them into a scheduled moment instead of a wall of always-on cards. The recurring moment — not any single fact — is what the subscription buys.

## 2. The user problem + evidence

People who track themselves churn the instant the insight resolves to a fact ("I learned my multiplier, I'm done"). What retains a self-insight subscription is a **cadenced ritual**: the value regenerates every week with new data, and the cadence itself is a reason to re-open ([07-PRO-VALUE-IDEAS §1.2](../07-PRO-VALUE-IDEAS.md); truth #5b). Concretely:

- Sunsama's weekly review and Bearable's reports are *the* retention mechanism — the subscription buys a recurring moment, not a datum.
- Exist users: *"insights and trend info is the best part."*
- It closes the universally-voiced *"beautiful charts, zero actionable wisdom"* gap ([Medium: 5.5 years of mood tracking](https://medium.com/@k4m1tsuki/5-5-years-of-mood-tracking-why-data-doesnt-equal-insight-67b624050b8b)).

This is the retention spine of the recommended opening Pro bundle ("the cadenced mirror" — review ritual + long-range history + the existing correlations; [§"First Pro build order"](../07-PRO-VALUE-IDEAS.md)). The funnel question that validates it: *does the paid cohort actually return for the weekly review?* (`review_opened` weekly cohort retention).

This is a **REFINEMENT**, not greenfield: the one-off `WeeklyReview` card (`src/features/patterns/WeeklyReview.tsx`) and every `derive*` projection in `usePatterns.ts` already exist. This spec packages them into a scheduled, full-screen ritual and folds the Pro correlations in.

## 3. Where it lives

**Surface:** a dedicated full-screen review at route `src/app/(modals)/review.tsx` (a modal presented over the tab stack, like the paywall), entered three ways:

1. **The ritual card on Patterns** — replaces today's inline `WeeklyReview` card at the top of `src/app/(tabs)/patterns.tsx`. When a fresh recap is ready and unseen, the card reads as an envelope ("Your honest week is ready") and is the single amber-tinted element on the tab. Tapping it opens the full review modal.
2. **Manual entry — "View this week"** — the same card, once the fresh recap has been opened, collapses to a quiet always-available row ("Your honest week" + chevron) so the user can re-open the current period on demand. This is the manual path the prompt requires; there is no waiting for rollover to look.
3. **Opt-in local notification** (Pro only, see §10) — Monday ~9:00 local, deep-links to the review modal.

**Free vs Pro view:**
- **Pro:** full multi-card review modal + the Monday card + the notification.
- **Non-Pro:** the Patterns ritual card renders as a **locked teaser** (`ReviewRitualLocked`) showing the *shape* — the eyebrow, the period label, and a blurred/withheld one-line tease — with "Unlock with Pro". The modal route itself is Pro-gated; a non-Pro deep-link redirects to the paywall with `trigger: 'review_ritual'`.

The ritual never touches the Today loop or fogs free calibration. Patterns stays free; only the *packaged scheduled ritual surface* + the correlation cards within it are Pro.

## 4. User flow

**Happy path (Pro):**
1. Sunday 23:59 local, the week rolls over. Nothing is written yet — the recap is recomputed on demand (§7).
2. Monday, the user opens the app. The Patterns ritual card shows the unseen state: amber envelope, "Your honest week is ready," small period label "Jun 9–15".
3. (If notifications are on) a single Monday 9:00 ping fires; tapping it deep-links straight to step 4.
4. User taps → the review modal opens. Cards animate in top-to-bottom (§6): cover → accuracy read → tightened categories → biggest surprise → time protected → (Pro correlations) steals-your-time + sharpest-window → closing reflection.
5. User scrolls, reads, taps "Done" (or swipes the modal down). `review_completed` fires with `cards_seen` + `scroll_depth`.
6. The Patterns card collapses to the quiet "Your honest week" row; re-opening any time recomputes the *current* period (always live, never a stale snapshot).
7. Monthly: on the 1st, the same flow runs with period = last calendar month and one extra "month vs the month before" line. Monthly supersedes weekly for that day (one ritual per open, never two cards stacked).

**Locked path (non-Pro):**
1. Patterns ritual card renders `ReviewRitualLocked` — same eyebrow and period label, the lead line withheld behind a soft scrim, "Unlock with Pro →".
2. Tap → `/(modals)/paywall?trigger=review_ritual`. The paywall fires `paywall_view` on mount (single source of truth — the card does not double-fire).
3. On purchase, returning to Patterns shows the live card; the modal becomes reachable.

## 5. Screens & states

All values are tokens from `src/theme/tokens.ts` via `useTheme()` (`t.*`) and roles from `src/theme/typography.ts` (`type.*`). No raw hex/number. The review modal reuses `Screen`, `Card`, `AppButton`, `Chip`, `HonestNumber`, `Ionicons`, and the existing `Archetype` / `BiggestSurprise` / `StealsYourTime` / `AccuracyCorrelations` card bodies where possible.

### 5a. The Patterns ritual card — unseen ("ready") state

The one amber element on Patterns this week. `Card tone="flat"` with a 1px `t.colors.accent`-tinted edge via the View-edge technique (no `boxShadow`).

```
┌────────────────────────────────────────────┐
│  ✉  YOUR HONEST WEEK            Jun 9–15  →  │  eyebrow row
│                                              │
│  Seven days are in. Here is where your       │  type.bodyLg / ink
│  time actually went.                         │
│                                              │
│  Open your week                          ▸   │  AppButton, amber, full-width-ish
└────────────────────────────────────────────┘
```

| Element | Token / role |
|---|---|
| Card padding | `Card` default; inner `gap: t.space[3]` |
| Eyebrow icon | `mail-outline`, `t.iconSize.sm`, `t.colors.accent` |
| Eyebrow text | `type.eyebrow`, `t.colors.amberText` ("YOUR HONEST WEEK" / "YOUR HONEST MONTH") |
| Period label | `type.caption`, `t.colors.inkSoft`, right-aligned, tabular |
| Lead line | `type.bodyLg`, `t.colors.ink` |
| CTA | `AppButton` (amber/accent tone), label "Open your week" / "Open your month" |
| Accent edge | `t.borderWidth.share` (1px) in `t.colors.accent`, View-edge technique |

### 5b. The Patterns ritual card — seen ("quiet row") state

After the fresh recap was opened this period. Neutral, no amber, just an affordance to re-open.

```
┌────────────────────────────────────────────┐
│  YOUR HONEST WEEK              Jun 9–15   →  │  caption + chevron, inkSoft
└────────────────────────────────────────────┘
```

- Single row, `Card tone="flat"`, height ≈ `t.size.control.md`.
- Text `type.caption` `t.colors.inkSoft`; chevron `chevron-forward` `t.iconSize.sm`.
- No CTA button, no amber — it has done its job; it stays available, not insistent.

### 5c. The review modal — card sequence

`Screen` inside a presented modal; a `ScrollView` with `contentContainerStyle={{ gap: t.space[5], paddingBottom: t.space[12] + insets.bottom }}`. A pinned top bar holds a left "Done" (`AppButton` ghost) and a centered period title. Each card is a `Card` with `gap: t.space[3]`. Order is fixed (cover → reads → correlations → close); any card with no earned data is **omitted entirely** (never a blank or a fake chart).

```
 ┌──────────────────────────────────────────┐
 │  Done            Jun 9–15                 │  top bar (caption period, ghost Done)
 ├──────────────────────────────────────────┤
 │                                          ⌄ │
 │  ╔══════════════════════════════════════╗ │
 │  ║   YOUR HONEST WEEK                    ║ │  ① COVER
 │  ║   Seven days, read honestly.         ║ │  type.title / ink
 │  ║   12 tasks · 6h 40m logged           ║ │  type.caption / inkSoft (only real counts)
 │  ╚══════════════════════════════════════╝ │
 │                                            │
 │  ┌──────────────────────────────────────┐ │
 │  │ HOW YOUR GUESSES LANDED              │ │  ② ACCURACY READ
 │  │ Steady week — your reads held.       │ │  type.body / ink (no number-as-score)
 │  │ Sharpest in the afternoons.          │ │  type.bodySm / inkSoft (from correlations)
 │  └──────────────────────────────────────┘ │
 │                                            │
 │  ┌──────────────────────────────────────┐ │
 │  │ WHAT TIGHTENED                       │ │  ③ TIGHTENED CATEGORIES
 │  │ Getting ready  1.9× → 1.6×       ↓   │ │  category + before→after multiplier
 │  │ Email          2.4× → 2.1×       ↓   │ │  amber chip on the arrow, never red
 │  └──────────────────────────────────────┘ │
 │                                            │
 │  ┌──────────────────────────────────────┐ │
 │  │ YOUR BIGGEST SURPRISE                │ │  ④ (reuses BiggestSurprise body)
 │  │ Laundry ran about 2.3× your guess.   │ │
 │  │ 20m guessed · 46m real               │ │
 │  └──────────────────────────────────────┘ │
 │                                            │
 │  ┌──────────────────────────────────────┐ │
 │  │ TIME YOU PROTECTED                   │ │  ⑤ TIME PROTECTED (reclaim, this period)
 │  │            2h 15m                     │ │  HonestNumber-style big number, amber
 │  │ honest numbers spared you this week  │ │  type.bodySm / inkSoft
 │  └──────────────────────────────────────┘ │
 │                                            │
 │  ┌──────────────────────────────────────┐ │
 │  │ WHAT STEALS YOUR TIME                 │ │  ⑥ Pro correlation (reuses StealsYourTime)
 │  └──────────────────────────────────────┘ │
 │  ┌──────────────────────────────────────┐ │
 │  │ WHEN YOU'RE SHARPEST                   │ │  ⑦ Pro correlation (reuses AccuracyCorrelations)
 │  └──────────────────────────────────────┘ │
 │                                            │
 │  ┌──────────────────────────────────────┐ │
 │  │ One thing worth a little more time    │ │  ⑧ CLOSING REFLECTION
 │  │ next week?                            │ │  type.bodySm italic / inkSoft (rotating Q)
 │  └──────────────────────────────────────┘ │
 │                                            │
 │             [ Done ]                        │  AppButton primary, full-width
 └──────────────────────────────────────────┘
```

**Card composition map (which existing thing each card is):**

| # | Card | Source it reuses | Pro-only inside? |
|---|---|---|---|
| ① | Cover | new (period + real counts from `ReviewSummary`) | no |
| ② | How your guesses landed | `view.youVsPast` → `trendLine` wording (lift from `WeeklyReview.tsx`) + `view.accuracyCorrelations` skew phrase | no |
| ③ | What tightened | new `deriveTightened` (drift, kindward direction only) | no |
| ④ | Your biggest surprise | `BiggestSurprise` card body + `view.biggestSurprise` | no |
| ⑤ | Time you protected | new period-scoped reclaim sum (§8) | no |
| ⑥ | What steals your time | `StealsYourTime` (reason correlations) | **yes** |
| ⑦ | When you're sharpest | `AccuracyCorrelations` | **yes** |
| ⑧ | Closing reflection | rotating question (lift `QUESTIONS` from `WeeklyReview.tsx`) | no |

Because the whole modal is already behind a ProGate, cards ⑥/⑦ render unconditionally inside it (no nested gate). The non-Pro never reaches the modal.

### 5d. States

- **Loading:** modal opens with cover card visible immediately (period is clock-derived, instant), remaining cards fade in as the snapshot resolves (one async `loadPatternsData`). No spinner blocking the screen; a brief skeleton shimmer on the body cards using `t.colors.surfaceSunken` is acceptable for the < ~150ms gap.
- **Not-enough-data (calm honesty, never a fake chart):** if the period has **0 completed logs**, the modal shows only the cover restyled to a calm empty state: eyebrow + "This week was quiet. Nothing logged — that is allowed." + a single line "Your week fills in as you log. Come back next Monday." No empty cards, no zeroed numbers, no placeholder bars. The Patterns card in this case stays in the quiet-row state (not the amber envelope) so the user is not pulled toward an empty room.
- **Low-data (1+ but below a card's gate):** each card self-gates exactly as `usePatterns` already does (returns `null` → omitted). A review with only cover + biggest-surprise is fine and complete; we never pad it.
- **Error:** if `loadPatternsData` rejects, the modal shows the cover plus one quiet line "Couldn't pull your week just now. It'll be here when you come back." and a Done button. Never a red error surface (no-guilt extends to system tone here).

## 6. Motion

Tokens from `tokens.motion`; Reanimated worklets; honor `ReduceMotion.System`; entering-only animations on the conditionally-mounted modal cards (no `exiting` layout anim — SIGABRTs on Fabric). Read/write shared values with `.get()/.set()`.

- **Modal present:** default modal slide-up (router presentation), `tokens.motion.sheet` (340ms) feel.
- **Card cascade:** each review card enters with `FadeInDown` + small `translateY` (8pt), staggered by `tokens.motion.enterStagger` (70ms) top-to-bottom, eased `tokens.motion.easing.out`. Whole cascade budget < ~700ms so it reads as the page settling, not a slideshow.
- **Cover number / time-protected:** the "time you protected" figure counts up once from 0 over `tokens.motion.honeyFill` (900ms) eased `tokens.motion.easing.honey` — the one celebratory beat, amber, calm. **Skipped under reduced motion** (renders final value immediately).
- **Patterns "ready" card:** the amber envelope icon does a single soft `beeBlink`-scale "settle" on mount (one breath, `tokens.motion.base`), not a loop. No pulsing badge, no attention-grabbing bounce (no-guilt = no nagging).
- **Reduced motion:** all entrances become instant opacity 0→1; the count-up renders the final value; stagger collapses to 0.

## 7. Data model

**Prefer recompute over persist.** The review is a pure projection over data the app already stores (`TaskEvent` rows + `CategoryStats` + `Companion`). We do **not** add a `reviews` table or snapshot rows — that would create a second source of truth that can drift from the logs and complicates the no-guilt invariant (a stored bad week could resurface). The current period is always recomputed live from the logs, which also makes the manual "view this week" path trivially correct.

**What is persisted (KV only, via `src/lib/kv.ts`):**

| Key | Type | Purpose |
|---|---|---|
| `whenbee.review.lastSeenPeriodId` | string | the period id (`2026-W24` / `2026-M06`) of the last review the user opened → drives envelope-vs-quiet-row state |
| `whenbee.review.notifyEnabled` | boolean | opt-in Monday notification preference (default **false**) |
| `whenbee.review.lastNotifiedPeriodId` | string | guard so we schedule at most one ping per period |

**Domain types to add** (`src/domain/types.ts`, pure TS, contract-first):

```ts
/** The kind of review cadence. */
export type ReviewPeriodKind = 'week' | 'month';

/** A resolved review window (epoch ms, half-open [startMs, endMs)). */
export interface ReviewPeriod {
  id: string;            // '2026-W24' (ISO-ish week) | '2026-M06'
  kind: ReviewPeriodKind;
  startMs: number;
  endMs: number;
  label: string;         // 'Jun 9–15' | 'May'
}

/** The composed recap — every field optional so empty/low-data degrades cleanly. */
export interface ReviewSummary {
  period: ReviewPeriod;
  loggedCount: number;        // completed logs in window (0 ⇒ empty state)
  loggedMinutes: number;      // sum actualMin in window
  accuracyLine: string | null;     // ② lead line
  sharpestPhrase: string | null;   // ② support line (from accuracy correlations)
  tightened: TightenedRow[];       // ③ (may be empty)
  biggestSurprise: BiggestSurpriseCard | null; // ④ (reuse existing type)
  protectedMinutes: number;        // ⑤ period reclaim sum (≥ 0)
  reflection: string;              // ⑧ rotating question (always present)
  // ⑥/⑦ correlation cards are read straight from PatternsView at render time.
}

/** ③ one category that moved toward 1.0 (tightened) over the window. */
export interface TightenedRow {
  categoryId: string;
  categoryName: string;
  earlyMultiplier: number;
  recentMultiplier: number; // recent < early ⇒ tightened (the only direction we surface as a win)
}
```

## 8. Engine / logic (pure, TDD)

All new math is **pure, clock-free, dependency-free** in `src/engine/`, exported via `src/engine/index.ts`, tuned via `src/engine/constants.ts`. The one unavoidable clock read (today's date → period bounds) happens in the hook, not the engine; the engine takes `nowMs` as an argument exactly like `deriveBiggestSurprise` already does.

**New file `src/engine/review.ts`:**

```ts
/** Resolve the week window that just ENDED, given a clock instant. */
export function resolveWeekPeriod(nowMs: number): ReviewPeriod;
/** Resolve last calendar month, given a clock instant. */
export function resolveMonthPeriod(nowMs: number): ReviewPeriod;
/** Pick which cadence to surface today: 'month' on the 1st, else 'week'. null = none yet. */
export function reviewCadenceFor(nowMs: number): ReviewPeriodKind;

/** Categories that moved toward 1.0 within the window (early→recent halves). */
export function deriveTightened(
  logsByCategory: { categoryId: string; categoryName: string; ratios: number[] }[],
): TightenedRow[];

/** Sum of reclaim dividends for logs whose createdAt ∈ [start,end). */
export function protectedMinutesIn(
  logs: { createdAt: number; reclaimDividendMin: number }[],
  startMs: number,
  endMs: number,
): number;

/** Compose the full ReviewSummary from a PatternsData-like snapshot + period. */
export function buildReviewSummary(input: ReviewBuildInput): ReviewSummary;
```

- `deriveTightened` reuses the same half-split + geometric-mean-of-clamped-ratios math already in `deriveDriftAlert` / `multiplierFromRatios` (lift the helper into the engine or share it). It surfaces **only** categories where `recentMultiplier < earlyMultiplier − constants.REVIEW_TIGHTEN_GAP` (default 0.15) — i.e. *only the kind direction*. A category running looser this week is **not** shown as a negative; drift in the other direction is the existing `DriftAlert`'s job and stays framed neutrally there, not in the review.
- `protectedMinutesIn` sums the already-stored `reclaimDividendMin` per `TaskEvent` (no recomputation, O(n)); non-negative by construction (the bank can only rise), so ⑤ can never show a loss.
- `accuracyLine` wording is lifted verbatim from `WeeklyReview.tsx`'s `trendLine` (steady / sharper / looser-is-just-data) so the no-guilt phrasing is reused, not reinvented.

**New constants (`src/engine/constants.ts`):**
```ts
export const REVIEW_TIGHTEN_GAP = 0.15;      // min M drop to call a category "tightened"
export const REVIEW_MAX_TIGHTENED = 2;        // cap ③ at the two clearest wins
export const REVIEW_EMPTY = 0;                // loggedCount === 0 ⇒ empty state
```

**TDD cases (write first):**
- `resolveWeekPeriod`: a Monday returns the prior Mon–Sun; a Wednesday returns the prior full week; year boundary; DST week (window stays 7 calendar days, label correct).
- `resolveMonthPeriod`: 1st of month returns the previous calendar month; Jan 1 returns prior December (year decrements); Feb leap year length.
- `reviewCadenceFor`: returns `'month'` only on day-of-month 1, else `'week'`.
- `deriveTightened`: surfaces only categories dropping ≥ gap; ignores too-thin categories (< `COMPARE_MIN_LOGS`); caps at `REVIEW_MAX_TIGHTENED`; never returns a *loosened* category; ties broken by larger drop.
- `protectedMinutesIn`: sums only in-window logs; returns 0 for empty window; never negative; boundary is half-open (endMs excluded).
- `buildReviewSummary`: 0 logs ⇒ `loggedCount===0` and all card fields null/empty but `reflection` present; partial data ⇒ only earned cards populated; deterministic for fixed input + nowMs.

**Hook (`src/features/review/useReview.ts`, layer-clean):** loads the cross-category snapshot through `useCalibrationStore.loadPatternsData()` (same as `usePatterns`), resolves the period from a pinned `nowMs` ref, runs `buildReviewSummary`, and exposes `{ summary, period, isFresh, markSeen() }`. `isFresh = period.id !== kv.getString('whenbee.review.lastSeenPeriodId')`. `markSeen()` writes the KV key. No `src/db` / `src/services` import in the hook beyond the store (boundary rule).

## 9. Gating

- The **modal route** `src/app/(modals)/review.tsx` checks `useEntitlement((s) => s.isPro)`; non-Pro is `router.replace('/(modals)/paywall?trigger=review_ritual')` on mount (defensive — the UI never offers the link to non-Pro, but a stale deep-link is handled).
- The **Patterns ritual card** is wrapped:
  ```tsx
  <ProGate fallback={summary ? <ReviewRitualLocked period={period} /> : null}>
    <ReviewRitualCard summary={summary} isFresh={isFresh} />
  </ProGate>
  ```
  (mirrors the existing `StealsYourTime` / `StealsYourTimeLocked` pairing in `patterns.tsx`).
- **Paywall trigger name:** add `'review_ritual'` to the `paywall_view.trigger` union in `src/services/analytics.ts`. (Reusing `steals_your_time` would muddy the funnel — the ritual is the headline retention surface and deserves its own trigger so we can measure ritual→purchase conversion distinctly.)
- **Locked teaser (`ReviewRitualLocked`):** same card shell as 5a but the lead line is withheld behind a soft scrim (`t.colors.scrim` at low alpha over a one-line placeholder), eyebrow + real period label shown (the *shape* of the value is honest and visible), CTA "Unlock with Pro →" → paywall. Pattern + copy modeled on `StealsYourTimeLocked.tsx`. The `Pressable` is a bare touch wrapper; visuals live on the inner `Card` (RN reactCompiler/nativewind gotcha).

## 10. Copy (exact strings, humanizer-checked, no-guilt)

Voice: one honest, calm person. No em-dash in shipped strings, no "unlock your potential", no rule-of-three, no fake urgency, no guilt/streak language. A looser week is *data, not a verdict*.

**Patterns card — ready (weekly):**
- Eyebrow: `YOUR HONEST WEEK`
- Lead: `Seven days are in. Here is where your time actually went.`
- CTA: `Open your week`

**Patterns card — ready (monthly):**
- Eyebrow: `YOUR HONEST MONTH`
- Lead: `A month is in. Here is the longer view.`
- CTA: `Open your month`

**Patterns card — quiet row:** `Your honest week` / `Your honest month` (caption + chevron).

**Modal — cover:**
- Title: `Your honest week` / `Your honest month`
- Subtitle (when counts exist): `{n} tasks · {hh}h {mm}m logged` (omit if 0)
- Empty cover: `This week was quiet. Nothing logged, and that is allowed.` + `Your week fills in as you log. See you next Monday.`

**Modal — ② accuracy read** (lifted from `trendLine`, reused intentionally):
- sharper: `Your estimates got a little sharper.`
- looser: `Estimates ran a bit looser. That is just data, not a verdict.`
- steady: `Steady week. Your reads held.`
- sharpest-phrase (optional support, from correlations): `Sharpest in the {afternoons|mornings}.`

**Modal — ③ what tightened:**
- Header: `WHAT TIGHTENED`
- Row: `{Category}   {early}× → {recent}×` with a downward ↓ chip (amber, never red). No row → card omitted.

**Modal — ④ biggest surprise:** reuse existing `BiggestSurprise` copy. Header `YOUR BIGGEST SURPRISE`.

**Modal — ⑤ time you protected:**
- Header: `TIME YOU PROTECTED`
- Caption: `honest numbers spared you this week` / `this month`
- (0 minutes ⇒ omit the card; never show "0m protected".)

**Modal — ⑥/⑦:** reuse `StealsYourTime` (`WHAT STEALS YOUR TIME`) and `AccuracyCorrelations` (`WHEN YOU'RE SHARPEST`) headers/bodies as-is.

**Modal — ⑧ reflection** (rotate deterministically by period id, lift `QUESTIONS` from `WeeklyReview.tsx`):
- `Which task surprised you most this week?`
- `What is one thing worth a little more time next week?`
- `When did you feel most on-pace?`
- `Which area is quietly getting sharper?`

**Modal — Done button:** `Done`

**Locked teaser (non-Pro):**
- Eyebrow: `YOUR HONEST WEEK` (+ real period label)
- Lead (withheld behind scrim, but the line that *would* show): `Your week is ready. See where your time went, what tightened, and the time you protected.`
- CTA: `Unlock with Pro`

**Notification (opt-in, Pro):**
- Settings toggle label: `Monday review` · sub: `A gentle nudge when your honest week is ready. Off by default.`
- Notification title: `Your honest week is ready`
- Notification body: `A calm look back, whenever you have a minute.`
- (Never "you missed", never "don't break your streak", never a count of skipped weeks. If the user ignored last week's, we say nothing about it.)

## 11. Edge cases & guardrails

- **No-guilt audit:** ③ shows *only tightened* (kind direction); a loosened category is never surfaced as negative here. ⑤ is non-negative by construction. The notification never references a missed/skipped week. Empty state is calm and self-permitting. No streak counter, no "weeks in a row".
- **Rollover correctness:** period bounds come from `resolveWeekPeriod`/`resolveMonthPeriod` against a pinned `nowMs`; tested across year/month/DST boundaries. The review is recomputed live, so opening at 23:59 Sunday vs 00:01 Monday correctly shows different periods.
- **Monthly vs weekly collision:** on the 1st, `reviewCadenceFor` returns `'month'` and the monthly ritual supersedes the weekly card for that day (one ritual surface, never two stacked). The weekly that ended is still reachable via long-range history (spec 07) later; not duplicated here.
- **Low-n / brand-new user:** below per-card gates ⇒ cards omitted; 0 logs ⇒ empty cover only, and the Patterns card stays in the quiet-row form (no amber envelope luring into an empty room). The ritual never fabricates a chart.
- **Manual re-open is always live:** re-opening a current period recomputes from logs (no snapshot), so a log added mid-week is reflected. (Re-opening *past* periods is explicitly spec 07's job, not this one.)
- **Notification permission:** reuse the guarded `getModule()` + `ensureNotificationPermission()` pattern from `src/services/timerNotifications.ts`; a missing native module (Expo Go / tests) makes scheduling a silent no-op. Default OFF (opt-in only). Reschedule logic guards on `lastNotifiedPeriodId` so we never double-fire. Add `scheduleWeeklyReview()` / `cancelWeeklyReview()` alongside the existing timer functions (or a new `src/services/reviewNotifications.ts` following the identical guard shape).
- **Privacy / on-device:** zero network; the recap is computed from local SQLite + KV only. No recap text leaves the device. (The optional LLM phrasing mentioned in §1.2 is explicitly out of scope here and would be the separate off-loop Estimate Coach feature.)
- **Color-mode + reduced-motion:** all surfaces use light/dark tokens; the count-up and cascade have instant fallbacks.
- **Amber scarcity:** exactly one amber focal element per surface — the envelope on Patterns, the "time protected" number in the modal. Everything else is neutral ink.

## 12. Analytics (`src/services/analytics.ts`, fire-and-forget)

Add to `AppEventProps`:

```ts
review_card_shown: { period_kind: 'week' | 'month'; state: 'ready' | 'quiet'; is_pro: boolean };
review_opened: { period_kind: 'week' | 'month'; source: 'card' | 'notification' | 'manual' };
review_completed: { period_kind: 'week' | 'month'; cards_seen: number; scroll_depth: number; protected_min: number };
review_notify_toggled: { enabled: boolean };
review_notification_sent: { period_kind: 'week' | 'month' };
```

And extend the existing union:
```ts
paywall_view: { trigger: 'make_day_honest' | 'settings_upgrade' | 'steals_your_time' | 'review_ritual'; readiness?: 'pre' | 'honest' };
```

- `review_card_shown` on the Patterns card mount (both Pro states + locked counts via the existing `paywall_view` from the paywall route).
- `review_opened` on modal mount with `source`.
- `review_completed` on Done/dismiss — `review_opened`→`review_completed` is the engagement signal; the **weekly cohort return rate on `review_opened` is THE retention metric** that validates the feature (§2).
- Locked-teaser tap does not fire its own paywall event (the paywall route owns `paywall_view`, single source of truth).

## 13. Build manifest & effort

**Add:**
- `src/engine/review.ts` — pure period + summary math · **M**
- `src/engine/__tests__/review.test.ts` — TDD first · **M**
- `src/features/review/useReview.ts` — store-backed hook · **S**
- `src/features/review/ReviewRitualCard.tsx` — Patterns card (ready + quiet) · **S**
- `src/features/review/ReviewRitualLocked.tsx` — non-Pro teaser (model on `StealsYourTimeLocked`) · **S**
- `src/features/review/ReviewModal.tsx` — the card-sequence body · **M**
- `src/features/review/cards/*` — ③ TightenedCard, ⑤ ProtectedTimeCard, ① CoverCard (④⑥⑦ reuse existing) · **M**
- `src/app/(modals)/review.tsx` — gated route + `Stack.Screen` modal presentation · **S**
- `src/services/reviewNotifications.ts` — guarded opt-in Monday ping (mirror `timerNotifications.ts`) · **S**

**Edit:**
- `src/domain/types.ts` — add `ReviewPeriodKind`, `ReviewPeriod`, `ReviewSummary`, `TightenedRow` · **S**
- `src/engine/index.ts` + `src/engine/constants.ts` — export new fns + 3 constants · **S**
- `src/app/(tabs)/patterns.tsx` — replace inline `WeeklyReview` with the gated `ReviewRitualCard` pair · **S**
- `src/services/analytics.ts` — 5 new events + extend `paywall_view.trigger` · **S**
- Settings screen — add the "Monday review" opt-in toggle (default off) wired to `review_notify_toggled` + scheduling · **S**
- `src/app/(modals)/_layout.tsx` — register the `review` modal route · **XS**

**Remove / supersede:** the always-on inline `WeeklyReview.tsx` card is superseded by the ritual; keep its `trendLine` + `QUESTIONS` (lift into engine/cards) then delete the component, or leave it dormant if long-range history will reuse it.

**Dependencies:** none new — reuses `expo-notifications` (already guarded), existing engine, store, ProGate, paywall, analytics. No network, no calendar.

**Total effort:** **M** (≈ 2–3 focused days). Mostly composition of existing projections; the only genuinely new math is period resolution + the period-scoped reclaim sum + `deriveTightened`, all small and pure.

**Open questions:**
1. **Monthly cadence trigger** — fire monthly on the literal 1st, or on the first app-open on/after the 1st (handles users who don't open on the 1st)? Recommend the latter via `lastSeenPeriodId` so a quiet user still gets their month when they return.
2. **Notification time** — fixed 09:00 local, or a "morning" the user already tends to open (from log timestamps)? MVP: fixed 09:00, revisit with funnel data.
3. **Long-range history overlap (spec 07)** — this spec deliberately recomputes only the *current* period. Re-opening *past* reviews is spec 07; confirm the `ReviewSummary` shape there is the same so 07 can persist/replay it without a second model.
4. **Should ② surface a single accuracy number** at all, or stay purely verbal? Current spec keeps it verbal (no score) to protect the no-guilt invariant; confirm with founder.
