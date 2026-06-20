# 07 — Long-range history & re-openable report archive  ·  Pro

**Status:** spec · **Tier:** Pro (`pro` entitlement) · **Skills applied:** react-native-architecture, ui-design:react-native-design, ui-design:visual-design-foundations, vercel-react-native-skills, conversion-psychology, humanizer

> Read [specs/README.md](README.md) first. This spec states only what is specific to long-range history; it never repeats the shared invariants (no-guilt, no-streak, on-device, no-network, no-calendar, tokens-only, ProGate on the `pro` entitlement, RevenueCat pricing). Rationale in [../07-PRO-VALUE-IDEAS.md §2.2 + truth #5c](../07-PRO-VALUE-IDEAS.md). Coordinates with [02-review-ritual.md](02-review-ritual.md) for re-opening past reviews.

---

## 1. What it is (one paragraph)

Whenbee logs every completed task on your device and never deletes a row. The free app shows you the recent stretch of that history: roughly the last month of receipts and a 30-day trend line. Pro lifts the lid on the rest. You can pull the trend chart back to 90 days, a year, or all time; line this season next to the one before it ("this month vs last", "these 90 days vs the 90 before"); scroll the full archive of every task you have ever logged; and re-open any past weekly or monthly review the way it read the morning it landed. None of this changes the math or unlocks anything you did not already record. It changes how far back you can *look*. The free window stays generous on purpose, so Pro reads as "your data, going further back" and never as "pay to see what you already own". The point is the moat: the longer you have logged, the more your own history is worth, and the higher the cost of starting over somewhere else (truth #5c).

## 2. The user problem + evidence

Self-tracking apps that resolve to a single fact lose people the moment the fact lands. A history that deepens every month is the opposite: it gets *more* valuable the longer you stay, which is the switching cost that keeps a self-insight subscription alive ([07-PRO-VALUE-IDEAS §2.2](../07-PRO-VALUE-IDEAS.md); truth #5c).

- **This is the exact lever Bearable ships.** Bearable gates history depth — free sees ~30 days, Pro sees 60/90/365 ([07-PRO-VALUE-IDEAS §2.2](../07-PRO-VALUE-IDEAS.md)). It is a proven, understood paywall in this category.
- **The trap to avoid is the category's loudest complaint.** Bearable's top gripe is "pay to understand your own data" ([07-PRO-VALUE-IDEAS truth #1](../07-PRO-VALUE-IDEAS.md)). The defense is a *display* gate on a generous recent window, never a *data* gate: every row stays on-device and free; Pro widens the view.
- **Depth + cadence are the retention spine of the opening bundle** ("the cadenced mirror": review ritual + long-range history + the existing correlations; [§"First Pro build order"](../07-PRO-VALUE-IDEAS.md)). Spec 02 buys the recurring moment; this spec buys the depth behind it.

The funnel question that validates it: *does history depth get hit, and does hitting the 30-day edge convert?* (`history_range_changed` to `paywall_view{trigger:'history_depth'}` to `purchase`).

## 3. Where it lives

History depth touches three existing surfaces and adds one new screen.

1. **Extended trend chart** — the category-detail `TrendChart` (`src/features/category-detail/TrendChart.tsx`) gains a range selector. Free shows `Last 30 days` (today's fixed pill, now a live control locked to 30d). Pro can switch 30 / 90 / 365 / All.
2. **Season-over-season** — a new comparison card on the category-detail screen (and reused in the monthly review, spec 02) that places the current window next to the one before it.
3. **History archive** — a new full-screen route `src/app/(modals)/history.tsx`: the complete, scrollable list of every logged task, newest first, with a period selector. Free scrolls the recent window then meets a locked-teaser footer; Pro scrolls to the first log ever.
4. **Re-open past reviews** — the archive's "Reviews" segment lists every past weekly/monthly period; tapping one opens spec 02's review modal pinned to that historical period.

**Entry points:** the archive opens from a quiet `Your full history` row at the bottom of the Patterns tab (below the review ritual card), and from a `See all` affordance on the category-detail `RecentList`.

**Free vs Pro view:**
- **Free:** 30-day trend (range control present but the 90/365/All segments are locked); recent-window receipts in category-detail and in the archive, then a locked-teaser footer; no season-over-season; no past-review re-open.
- **Pro:** every range; full archive to the first log; season-over-season; every past review re-openable.

The core loop is untouched. The 30-day free window is wide enough that a casual user rarely feels a wall; the wall is the *depth*, and it is honest about being a view, not a vault.

## 4. User flow

**Happy path (Pro):**
1. On category-detail, the user taps the trend range pill and picks `1 year`. The chart redraws over 365 days; `history_range_changed` fires with `range:'365'`.
2. They tap `Compare` (or scroll to the season-over-season card): the card shows this month's accuracy and typical multiplier beside last month's, with a calm kind/neutral delta. No red, no verdict.
3. From Patterns they tap `Your full history`. The archive opens on the `Receipts` segment: a FlashList of every task ever logged, newest first, grouped by month header. They scroll back two years; rows keep loading (windowed).
4. They switch the archive to the `Reviews` segment: a list of past weeks and months. They tap `May` → spec 02's review modal opens pinned to that historical period (`?periodId=2026-M05`), reading exactly as it did then.

**Locked path (non-Pro):**
1. On category-detail the range pill shows `30 days`; tapping `90 days` / `1 year` / `All` routes to `/(modals)/paywall?trigger=history_depth` (the segments render with a small lock glyph; the active 30d segment is free and live).
2. The season-over-season card renders as `SeasonCompareLocked`: the *shape* (two side-by-side columns, this-period real, last-period fogged behind a scrim) with `Unlock with Pro`.
3. In the archive, receipts list the recent free window in full, then a `HistoryDepthLocked` footer card shows the count of older logs behind it ("214 more tasks, back to {first-log month}") and `Unlock with Pro`. Data is visibly *there*, just not scrolled into.
4. The `Reviews` segment lists past periods, but only the current period is tappable; older rows show a lock glyph and route to the paywall.
5. Any tap to the paywall fires `paywall_view{trigger:'history_depth'}` on the paywall route mount (single source of truth; teasers never double-fire).

## 5. Screens & states

All values are tokens from `src/theme/tokens.ts` via `useTheme()` (`t.*`) and roles from `src/theme/typography.ts` (`type.*`). No raw hex/number. Reuses `Screen`, `Card`, `AppButton`, `Chip`, `Ionicons`, the existing `TrendChart` SVG body, and `RecentList`'s dual-track row. The archive list uses **FlashList** (`@shopify/flash-list`), never `ScrollView`+`map` (see §perf).

### 5a. Extended trend chart — range selector

The existing `TrendChart` header pill becomes a 4-segment selector. Free: only `30d` is active; `90d / 1y / All` carry a lock glyph and route to the paywall. Pro: all four switch the queried window.

```
┌────────────────────────────────────────────┐
│  Calibration trend                           │  type.heading / ink
│  ┌──────┬──────┬──────┬──────┐               │
│  │ 30d  │ 90d 🔒│ 1y 🔒│ All 🔒│               │  segmented (free: 90/1y/All locked)
│  └──────┴──────┴──────┴──────┘               │
│  ┌──────────────────────────────────────┐   │
│  │      ·──·──·            1× ─ ─ ─       │   │  existing SVG polyline
│  └──────────────────────────────────────┘   │
│  {caption}                                   │  type.caption / inkSoft
└────────────────────────────────────────────┘
```

| Element | Token / role |
|---|---|
| Segment row | `flexDirection:'row'`, `gap: t.space[1]`, control height `t.size.control.xs` (32) |
| Segment pill | `t.colors.surfaceSunken`; active `t.colors.primarySoft`; `borderRadius: t.radii.full`; `paddingHorizontal: t.space[2]`, `paddingVertical: t.space[0.5]` |
| Segment label | `type.micro`; active `t.colors.primary`, idle `t.colors.inkSoft` |
| Lock glyph | `lock-closed`, `t.iconSize.xs`, `t.colors.inkFaint` (locked segments only) |
| Chart body | unchanged `TrendChart` SVG (`stroke: t.colors.primary`, target line `t.colors.hairline`) |

Range labels: `30 days` / `90 days` / `1 year` / `All time`, abbreviated `30d / 90d / 1y / All` in the pill.

### 5b. Season-over-season compare card

Two columns, identical vertical structure (per CLAUDE.md: sibling columns share element shape, gaps, zero per-column margins so baselines align). The current period is amber-tinted (the one focal element); the prior period is neutral. The delta is a kind, neutral line, never red.

```
┌────────────────────────────────────────────┐
│  THIS MONTH vs LAST                          │  type.eyebrow / amberText
│                                              │
│   This month          Last month            │  type.caption / inkSoft (column labels)
│      88                  82                  │  type.bigNumber / ink (accuracy 0–100)
│   1.6× typical        1.9× typical           │  type.bodySm / inkSoft (multiplier)
│                                              │
│  A little sharper than last month.           │  type.bodySm / ink (kind delta line)
└────────────────────────────────────────────┘
```

| Element | Token / role |
|---|---|
| Card | `Card tone="flat"`, inner `gap: t.space[3]` |
| Eyebrow | `type.eyebrow`, `t.colors.amberText` |
| Two-column row | `flexDirection:'row'`, each column `flex:1`, `gap: t.space[2]`, `alignItems:'flex-start'` |
| Column label | `type.caption`, `t.colors.inkSoft` |
| Big stat (accuracy) | `type.bigNumber`, current `t.colors.ink`; prior `t.colors.inkSoft` |
| Multiplier sub | `type.bodySm`, `t.colors.inkSoft`, `×` as a smaller `<small>`-style suffix (~0.6em, matching `multiplier` role tabular feel) |
| Delta line | `type.bodySm`, `t.colors.ink` |

### 5c. History archive screen (`/(modals)/history`)

`Screen` inside a presented modal. A pinned top bar: left `Done` (`AppButton` ghost), centered title `Your history`. Below it a 2-segment control (`Receipts` / `Reviews`). The footer adds `useSafeAreaInsets().bottom`.

**Receipts segment (FlashList):**

```
 ┌──────────────────────────────────────────┐
 │  Done           Your history              │  top bar (ghost Done, centered title)
 │  ┌────────────┬────────────┐              │
 │  │  Receipts  │  Reviews    │             │  2-segment control
 │  └────────────┴────────────┘              │
 ├──────────────────────────────────────────┤
 │  JUNE 2026                                │  sticky month header (type.eyebrow)
 │  Getting ready · guessed 15 · took 24  1.6×│  receipt row (reuses RecentList track)
 │  ▓▓▓▓▓▓▓▓▓▓░░░░░                          │
 │  Email · guessed 10 · took 22          2.2×│
 │  ▓▓▓▓▓░░░░░░░░░░                          │
 │  MAY 2026                                 │
 │  …                                        │
 │  ── recent free window ends here ──       │  (FREE ONLY)
 │  ┌──────────────────────────────────────┐ │
 │  │  📦  214 more tasks                   │ │  HistoryDepthLocked footer (FREE)
 │  │  back to October 2025                 │ │
 │  │  Unlock with Pro →                    │ │
 │  └──────────────────────────────────────┘ │
 └──────────────────────────────────────────┘
```

| Element | Token / role |
|---|---|
| Month header | `type.eyebrow`, `t.colors.inkSoft`, sticky; `paddingVertical: t.space[2]`, bg `t.colors.bg` |
| Receipt row | reuse `RecentList` row: label `type.bodySm`/`ink`, ratio `Inter-Bold` tabular in `t.colors.accent` (over) / `t.colors.primary` (on-or-under) |
| Track | dual-track bar, `t.colors.hairline` ground + ratio-color fill (existing) |
| Row gap | `gap: t.space[3]` between rows; `estimatedItemSize` ≈ row label + track + gap (~52) |
| Locked footer | `Card tone="flat"`, accent-edge via View-edge `t.borderWidth.share` in `t.colors.accent`; icon `archive-outline` `t.iconSize.md` `t.colors.accent` |

**Reviews segment:**

```
 │  Receipts  │ [Reviews]                     │
 ├──────────────────────────────────────────┤
 │  This week        Jun 15–21          →     │  current period (free, tappable)
 │  June             month               →     │
 │  Jun 8–14         week            🔒  →     │  past period (Pro; lock if free)
 │  May              month           🔒  →     │
 │  Jun 1–7          week            🔒  →     │
 └──────────────────────────────────────────┘
```

| Element | Token / role |
|---|---|
| Period row | `Card tone="flat"`, height `t.size.control.md`; `flexDirection:'row'`, `justifyContent:'space-between'`, `alignItems:'center'` |
| Period label | `type.bodySm`, `t.colors.ink` |
| Kind chip | `week` / `month` as `type.micro` `t.colors.inkSoft` |
| Lock glyph | `lock-closed` `t.iconSize.sm` `t.colors.inkFaint` (past periods, free) |
| Chevron | `chevron-forward` `t.iconSize.sm` `t.colors.inkSoft` |

### 5d. States

- **Loading:** archive opens with the top bar + segment control instant (no data needed); the FlashList shows a brief skeleton (3–4 `t.colors.surfaceSunken` placeholder rows) for the < ~150ms first page. No blocking spinner.
- **Empty (brand-new user, 0 completed logs):** archive shows a calm centered block: `archive-outline` icon `t.colors.inkFaint`, `Nothing logged yet.` (`type.bodyLg`/`ink`) + `Your history starts with your first finished task. It builds from here.` (`type.bodySm`/`inkSoft`). No locked footer (nothing is gated when nothing exists). The trend selector falls back to `TrendChart`'s existing "not enough logs yet" body.
- **Low-data (some logs, all inside the free window):** Pro range segments still switch but resolve to the same short series; the season-over-season card self-gates and is **omitted** when the prior period has 0 logs (never a fake column). The locked footer is omitted when there are 0 older logs (a Pro-or-not user with only recent data sees no wall, because there is no depth to gate yet).
- **Error:** if a range query rejects, the chart keeps the last good series and shows a quiet line `Couldn't load that range just now.` (`type.caption`/`inkSoft`); the archive shows `Couldn't pull your history just now. It'll be here when you come back.` Never a red surface (no-guilt extends to system tone).

## 6. Motion

Tokens from `tokens.motion`; Reanimated worklets; honor `ReduceMotion.System`; entering-only on conditionally-mounted views (no `exiting` layout anim — SIGABRTs on Fabric). Read/write shared values with `.get()/.set()`.

- **Modal present:** router modal slide-up, `tokens.motion.sheet` (340ms) feel.
- **Range switch:** the trend polyline cross-fades (opacity 0→1) over `tokens.motion.base` (220ms) eased `tokens.motion.easing.out` when the series changes. No morph/redraw animation of the path (cheap, jank-free, reduced-motion safe). Segment pill active-state color transitions over `tokens.motion.fast` (120ms).
- **Archive rows:** no per-row entrance animation (FlashList recycles; entrance anims on recycled cells thrash). The list simply appears; only the first skeleton→content swap fades over `tokens.motion.fast`.
- **Locked footer:** static. No pulse, no shimmer on the lock (no-guilt = no nagging).
- **Reduced motion:** range cross-fade and skeleton fade become instant opacity 0→1; everything else is already static.

## 7. Data model

**No new tables. No data migration.** Every receipt already lives in `task_events` (system of record, never deleted), indexed `idx_task_events_category_created` on `(category, created_at)`. History depth is a **query-range** feature on existing rows plus a small KV preference. This keeps the no-guilt + on-device invariants trivially true: nothing is created, nothing is purged, and the gate is on the *read window*, not the data.

**The free window is a single engine constant (display gate, not data gate):**

`src/engine/constants.ts`:
```ts
/** Free history VIEW window (days). The data is always logged on-device and never
 *  deleted; Pro only widens how far back the user can SEE. Generous on purpose so
 *  Pro reads as "your data, going further back", never "pay to see your own data". */
export const FREE_HISTORY_DAYS = 30;

/** Selectable trend/archive ranges (days). null = all time. 30 is the free floor. */
export const HISTORY_RANGES = [30, 90, 365, null] as const;
export type HistoryRangeDays = (typeof HISTORY_RANGES)[number];
```

**What is persisted (KV only, via `src/lib/kv.ts`):**

| Key | Type | Purpose |
|---|---|---|
| `whenbee.history.lastRange` | string (`'30'`/`'90'`/`'365'`/`'all'`) | remember the user's last picked trend range (Pro); free always coerces to `'30'` |
| `whenbee.history.archiveSegment` | string (`'receipts'`/`'reviews'`) | remember the archive's last segment |

**Domain types to add** (`src/domain/types.ts`, pure TS, contract-first):

```ts
/** A resolved history view window. null bounds = open-ended (all time / first log). */
export interface HistoryWindow {
  /** Inclusive lower bound, epoch ms; null = from the first log ever. */
  startMs: number | null;
  /** Exclusive upper bound, epoch ms (usually "now"). */
  endMs: number;
  /** Range key for analytics / KV ('30' | '90' | '365' | 'all'). */
  rangeKey: string;
  /** True when this window exceeds the free FREE_HISTORY_DAYS view. */
  proOnly: boolean;
}

/** Two comparable periods placed side by side (season-over-season). */
export interface SeasonCompare {
  currentLabel: string;          // 'This month' | 'These 90 days'
  priorLabel: string;            // 'Last month' | 'The 90 before'
  currentAccuracy: number;       // 0–100
  priorAccuracy: number | null;  // null ⇒ prior period had no logs ⇒ omit the card
  currentMultiplier: number;
  priorMultiplier: number | null;
  /** recent − prior accuracy; never framed as loss when negative. */
  delta: number;
}
```

`ReviewSummary` / `ReviewPeriod` from spec 02 are **reused verbatim** for re-opening past reviews — this spec adds no review type. (Open question 3 in spec 02 is resolved here: same shape, replayed over a historical window.)

## 8. Engine / logic (pure, TDD)

All new math is **pure, clock-free, dependency-free** in `src/engine/`, exported via `src/engine/index.ts`. The one clock read (now → window bounds) happens in the hook and is passed in as `nowMs`, exactly as `deriveBiggestSurprise` / `resolveWeekPeriod` already do.

**New file `src/engine/history.ts`:**

```ts
/** Resolve a view window from a range key + clock instant.
 *  '30'|'90'|'365' ⇒ [nowMs − days·DAY, nowMs); 'all' ⇒ [null, nowMs). */
export function resolveHistoryWindow(rangeKey: string, nowMs: number): HistoryWindow;

/** Coerce a requested range to what the entitlement allows.
 *  Non-Pro is always clamped to the free floor ('30'); Pro passes through. */
export function allowedRange(requested: string, isPro: boolean): string;

/** Count logs strictly older than the free window — the "N more tasks" teaser.
 *  createdAt < (nowMs − FREE_HISTORY_DAYS·DAY). O(n) over the scan. */
export function loggedBeyondFreeWindow(
  logs: { createdAt: number }[],
  nowMs: number,
): { count: number; oldestMs: number | null };

/** Filter completed logs to a window (half-open [start,end), null start = open). */
export function logsInWindow<T extends { createdAt: number }>(
  logs: T[], window: HistoryWindow,
): T[];

/** Build the side-by-side comparison for the current vs prior equal-length period.
 *  Reuses the same accuracy + geometric-mean-multiplier math usePatterns uses. */
export function deriveSeasonCompare(
  logs: { createdAt: number; estimateMin: number; actualMin: number }[],
  rangeKey: string,
  nowMs: number,
): SeasonCompare | null;
```

- `resolveHistoryWindow` is the single source of bounds; `proOnly = rangeKey !== '30'`.
- `allowedRange` is the gate's heart: a non-Pro caller can never widen past `'30'`, so even a stale KV value or deep-link cannot leak depth. The data layer still *has* every row; this function decides what the UI is allowed to request.
- `deriveSeasonCompare` splits into current `[start,end)` and an equal-length prior `[start−len, start)`; returns `null` (card omitted) when the prior half has 0 logs or the current half is below `SEASON_MIN_LOGS`. Accuracy reuses `accuracyFromRatios`, multiplier reuses `multiplierFromRatios` (lift both shared helpers from `usePatterns.ts` into the engine, or share via an engine helper, so the numbers read identically to the rest of the app).
- For the trend chart, the existing `buildTrendSeries` (engine/trend.ts) is unchanged; only the **window of steps** the store feeds it widens. The store queries `task_events` filtered by `created_at >= startMs` (or all) for the active category, capped by a generous scan limit (below).

**New constants (`src/engine/constants.ts`):**
```ts
export const FREE_HISTORY_DAYS = 30;                 // free VIEW floor (display gate)
export const HISTORY_RANGES = [30, 90, 365, null] as const;
export const SEASON_MIN_LOGS = 4;                    // min current-period logs for a compare
export const HISTORY_DAY_MS = 24 * 60 * 60 * 1000;   // reuse if not already present
```

**TDD cases (write first):**
- `resolveHistoryWindow`: '30'/'90'/'365' give the right `startMs` (nowMs − days·DAY) and `endMs===nowMs`; 'all' gives `startMs===null`; `proOnly` true for everything but '30'; DST-spanning 365 window stays days·DAY (wall-clock not asserted, ms math is exact).
- `allowedRange`: non-Pro + any request ⇒ '30'; Pro + '90' ⇒ '90'; Pro + garbage ⇒ '30' (safe default); non-Pro + 'all' ⇒ '30'.
- `loggedBeyondFreeWindow`: counts only logs older than the free edge; returns oldest ms among them; `{count:0, oldestMs:null}` when all logs are recent; boundary is strict `<`.
- `logsInWindow`: half-open (endMs excluded); null start includes everything below endMs; empty in ⇒ empty out.
- `deriveSeasonCompare`: equal-length split; prior with 0 logs ⇒ null; current below `SEASON_MIN_LOGS` ⇒ null; delta sign correct; deterministic for fixed input + nowMs; a *looser* current period returns a negative delta but never throws or flags it as bad (UI frames it kindly).

**Hook (`src/features/history/useHistory.ts`, layer-clean):** reads `isPro` from `useEntitlement`, the last range from KV, calls `allowedRange`, resolves the window, and asks the store for the windowed logs through a new `loadHistory(window)` store action (the store owns db access — features never import `src/db`). Exposes `{ window, setRange, receipts, seasonCompare, beyondFree, segment, setSegment }`. `setRange` writes KV and re-queries; a non-Pro `setRange('90')` instead routes to the paywall (does not widen).

**Store action (`src/stores/calibrationStore.ts`):** add `loadHistory(window: HistoryWindow): Promise<{ receipts: RecentLog[]; logs: PatternLog[] }>`. It queries `task_events` ordered `created_at DESC`. For the windowed read, prefer a new repo method `listEventsInWindow(startMs, endMs, limit)` (a `WHERE created_at >= ? AND created_at < ? ORDER BY created_at DESC LIMIT ?` over the existing `(category, created_at)` index — add a second index `idx_task_events_created` on `(created_at)` for the all-category window scan). 'all' uses a large cap (`HISTORY_SCAN_LIMIT = 2000`) with FlashList windowing so memory stays bounded even for multi-year users.

## 9. Gating

- **Range selector:** the `30d` segment is free and live. `90d / 1y / All` are wrapped so a non-Pro press calls `router.push('/(modals)/paywall?trigger=history_depth')` instead of switching. `allowedRange` is the defensive backstop: even if a segment leaked, the resolved window is clamped to '30' for non-Pro.
- **Season-over-season card:**
  ```tsx
  <ProGate fallback={seasonCompare ? <SeasonCompareLocked compare={seasonCompare} /> : null}>
    <SeasonCompareCard compare={seasonCompare} />
  </ProGate>
  ```
  (mirrors the `StealsYourTime` / `StealsYourTimeLocked` pairing). The locked card shows the current column real and the prior column fogged behind `t.colors.scrim` at low alpha, so the *shape* is honest and visible.
- **Archive route `src/app/(modals)/history.tsx`:** the route itself is **not** Pro-gated (free users browse their recent window). Depth inside it is gated: the receipts FlashList renders the free window then a `HistoryDepthLocked` footer; the Reviews segment makes only the current period tappable for free.
- **Paywall trigger name:** add `'history_depth'` to the `paywall_view.trigger` union in `src/services/analytics.ts`. (Its own trigger so depth→purchase conversion is measurable distinctly from `review_ritual` / `steals_your_time`.)
- **Locked teasers** (`HistoryDepthLocked`, `SeasonCompareLocked`): the `Pressable` is a bare touch wrapper; visuals live on the inner `Card` (RN reactCompiler + nativewind drop function-form `Pressable` styles). Copy + structure modeled on `StealsYourTimeLocked.tsx`. Neither teaser fires its own paywall event — the paywall route owns `paywall_view` (single source of truth).
- **Re-open past review:** spec 02's `src/app/(modals)/review.tsx` already checks `isPro`; this spec passes a `?periodId=` param. A non-Pro deep-link to a *past* period redirects to the paywall (`trigger:'history_depth'`); the *current* period stays the free-or-Pro behavior spec 02 defines.

## 10. Copy (exact strings, humanizer-checked, no-guilt)

Voice: one honest, calm person. No em-dash in shipped strings, no "unlock your potential", no rule-of-three, no guilt/streak language. Frame every gate as "your data, going further back", never "see your own data".

**Trend range selector:** pills `30d` / `90d` / `1y` / `All`; full labels (a11y + tooltips) `30 days` / `90 days` / `1 year` / `All time`.

**Season-over-season:**
- Eyebrow (monthly): `THIS MONTH vs LAST`
- Eyebrow (90-day): `THESE 90 DAYS vs THE 90 BEFORE`
- Column labels: `This month` / `Last month` (or `These 90 days` / `The 90 before`)
- Sub-line: `{m}× typical`
- Delta line (sharper): `A little sharper than last month.`
- Delta line (steady): `About the same as last month.`
- Delta line (looser): `Ran a bit looser this month. That is just data.`

**Archive — top bar / segments:**
- Title: `Your history`
- Segments: `Receipts` / `Reviews`
- Patterns entry row: `Your full history` (+ chevron)
- Category-detail entry: `See all` (+ chevron)

**Archive — month headers:** `JUNE 2026` (uppercase via `type.eyebrow` transform; the string itself stays `June 2026`).

**Archive — empty:**
- `Nothing logged yet.`
- `Your history starts with your first finished task. It builds from here.`

**History depth locked footer (non-Pro):**
- Lead: `{n} more tasks` (e.g. `214 more tasks`)
- Sub: `back to {Month Year}` (e.g. `back to October 2025`)
- Body: `Every task you have logged is still on your phone. Pro lets you look all the way back.`
- CTA: `Unlock with Pro`
- (When `n` is 1: `1 more task`. Never shown when `n` is 0.)

**Season compare locked (non-Pro):**
- Eyebrow: `THIS MONTH vs LAST` (real, shown)
- Current column: real (shown)
- Prior column: fogged; the line that *would* show beneath the scrim: `See how this month compares to the months before it.`
- CTA: `Unlock with Pro`

**Reviews segment — locked past row (non-Pro):** the row stays visible with its real label and a quiet lock glyph; tapping opens the paywall. No "locked" text on the row itself (the shape is honest; the glyph is enough).

**Range error / archive error:**
- `Couldn't load that range just now.`
- `Couldn't pull your history just now. It'll be here when you come back.`

Humanizer pass applied: no "seamless", "unlock your data", "comprehensive", no rule-of-three, no em-dash, plain `is`/`has`, one honest voice. The depth pitch leads with the felt truth ("every task is still on your phone") before the offer.

## 11. Edge cases & guardrails

- **Display gate, never a data gate (the core promise):** `task_events` rows are never deleted or hidden from the engine — calibration always trains on the full local history regardless of Pro. The gate is purely on the *view window* (`allowedRange` + `resolveHistoryWindow`). A user who never pays still benefits from years of learning in their honest numbers; Pro only changes how far back they can *look*. This is the explicit defense against the "pay to see my own data" backlash (truth #1).
- **No-guilt audit:** season-over-season never shows red and never frames a looser period as failure ("that is just data"); the locked footer counts tasks neutrally, never "you are missing out"; no streak, no "weeks logged in a row". The archive is a calm ledger, not a scoreboard.
- **Generous free floor:** `FREE_HISTORY_DAYS = 30` is wide enough that light users rarely hit the wall; the wall is depth, and it is honest. If churn/conversion data later argues for 14 or 45, it is one constant.
- **Brand-new / low-data:** 0 logs ⇒ calm empty archive, no locked footer (nothing to gate). All-recent logs ⇒ no footer, season card omitted (no prior period). The gate only appears once real depth exists.
- **Performance (vercel-react-native-skills):** archive is **FlashList** with `estimatedItemSize`, `keyExtractor` on the stable event id, memoized row component, and a bounded `HISTORY_SCAN_LIMIT` (2000) for 'all'. Month headers are list section headers (sticky), not nested maps. Range queries hit the `(created_at)` / `(category, created_at)` indexes, so even a 3-year user pages in O(window) not O(all). No row entrance animations on recycled cells.
- **Re-open correctness:** a past review is replayed over its historical window via spec 02's `buildReviewSummary` with the period's `nowMs`-equivalent bounds, so it reads as it did then. Because reviews are recomputed (not snapshotted, per spec 02 §7), re-opening is always consistent with the immutable logs.
- **Privacy / on-device:** zero network; every query is local SQLite + KV. No history leaves the device.
- **Color-mode + reduced-motion:** all surfaces use light/dark tokens; range cross-fade and skeleton have instant fallbacks.
- **Amber scarcity:** one amber focal element per surface — the current column in season-compare, the accent edge on the locked footer. The archive list itself is neutral ink; ratio colors (amber over / indigo under) are the existing receipt semantics, not new focal accents.

## 12. Analytics (`src/services/analytics.ts`, fire-and-forget)

Add to `AppEventProps`:

```ts
history_range_changed: { range: '30' | '90' | '365' | 'all'; surface: 'trend' | 'archive'; is_pro: boolean };
history_archive_opened: { source: 'patterns' | 'category_detail'; is_pro: boolean };
history_depth_locked_shown: { beyond_count: number; surface: 'archive' | 'trend' | 'season' };
season_compare_shown: { range: '30' | '90' | '365'; is_pro: boolean };
past_review_opened: { period_kind: 'week' | 'month'; is_pro: boolean };
```

And extend the existing union:
```ts
paywall_view: {
  trigger: 'make_day_honest' | 'settings_upgrade' | 'steals_your_time' | 'review_ritual' | 'history_depth';
  readiness?: 'pre' | 'honest';
};
```

- `history_range_changed` on every successful range switch (Pro) — the depth-engagement signal.
- `history_depth_locked_shown` when a locked teaser renders with a non-zero `beyond_count` — the **wall-hit** count; `history_depth_locked_shown` → `paywall_view{trigger:'history_depth'}` → `purchase` is THE conversion funnel that validates §2.
- `past_review_opened` distinguishes archive re-opens from spec 02's `review_opened` (which is the current-period ritual).
- Locked-teaser taps do not fire their own paywall event (the paywall route owns `paywall_view`).

## 13. Build manifest & effort

**Add:**
- `src/engine/history.ts` — pure window + season-compare math · **S**
- `src/engine/__tests__/history.test.ts` — TDD first · **M**
- `src/features/history/useHistory.ts` — store-backed hook (range, window, segment) · **S**
- `src/features/history/HistoryArchive.tsx` — FlashList receipts + Reviews segment · **M**
- `src/features/history/HistoryDepthLocked.tsx` — non-Pro footer teaser (model on `StealsYourTimeLocked`) · **S**
- `src/features/history/SeasonCompareCard.tsx` + `SeasonCompareLocked.tsx` · **S**
- `src/features/history/TrendRangeSelector.tsx` — 4-segment selector (gated) · **S**
- `src/app/(modals)/history.tsx` — archive modal route (free, depth-gated inside) · **S**

**Edit:**
- `src/domain/types.ts` — add `HistoryWindow`, `SeasonCompare` (reuse spec-02 review types) · **S**
- `src/engine/index.ts` + `src/engine/constants.ts` — export new fns + `FREE_HISTORY_DAYS`, `HISTORY_RANGES`, `SEASON_MIN_LOGS` · **S**
- `src/features/category-detail/TrendChart.tsx` — swap the static pill for `TrendRangeSelector`; widen the queried window · **S**
- `src/features/category-detail/RecentList.tsx` — add a `See all` row → archive · **XS**
- `src/features/category-detail/useCategoryDetail.ts` — accept a range, pass the wider window to the trend query · **S**
- `src/stores/calibrationStore.ts` — add `loadHistory(window)`; widen the category trend query window · **S**
- `src/db/Database.ts` + `sqliteDatabase.ts` + `memoryDatabase.ts` + `repositories/taskEventsRepo.ts` — add `listEventsInWindow(startMs, endMs, limit)` · **S**
- `src/db/migrations.ts` — append a migration adding `idx_task_events_created ON task_events(created_at)` (all-category window scan) · **XS**
- `src/app/(tabs)/patterns.tsx` — add the quiet `Your full history` row at the bottom · **XS**
- `src/app/(modals)/_layout.tsx` — register the `history` modal route · **XS**
- `src/app/(modals)/review.tsx` — accept `?periodId=` to replay a past period; gate past periods for non-Pro (coordinate with spec 02) · **S**
- `src/services/analytics.ts` — 5 new events + extend `paywall_view.trigger` · **S**

**Remove / supersede:** none. Purely additive over existing logs and the spec-02 review surface.

**Dependencies:** `@shopify/flash-list` (confirm it is already in the app; the patterns/category-detail lists are short and use plain views — the archive is the first long list, so FlashList may need `npx expo install @shopify/flash-list`). No network, no calendar, no new native module.

**Total effort:** **S–M** (≈ 1.5–2.5 focused days). The bulk is the FlashList archive screen and the season-compare card; the gating is `allowedRange` + existing `ProGate` patterns; the data side is one index + one windowed query over rows that already exist.

**Open questions:**
1. **Free floor value** — 30 days matches Bearable and reads as generous; confirm with the founder before shipping (one constant if it should be 14/45).
2. **FlashList availability** — verify `@shopify/flash-list` is installed; if not, `npx expo install` it (Expo SDK 54 compatible) rather than falling back to `FlatList` for a potentially multi-year list.
3. **Season-over-season scope** — ship monthly + 90-day compares first (the clearest reads), or also 365-vs-365? Recommend month + 90d for v1; year-over-year needs ~2 years of data to be meaningful for almost no one yet.
4. **'All time' cap** — `HISTORY_SCAN_LIMIT = 2000` covers ~5 years of daily logging; confirm the FlashList memory profile on-device for the heaviest realistic user before raising it.
5. **Archive entry placement** — confirm the `Your full history` row belongs at the bottom of Patterns (below the spec-02 ritual) versus a Settings entry; Patterns keeps it discoverable next to the other insight surfaces.
