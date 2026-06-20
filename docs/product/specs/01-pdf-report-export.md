# 01 — PDF report export  ·  Pro

**Status:** spec · **Tier:** Pro (`pro` entitlement) · **Skills applied:** react-native-expert, ui-design:react-native-design, ui-design:visual-design-foundations, conversion-psychology, humanizer, clean-code

## 1. What it is (one paragraph a non-engineer understands)

A one-tap "Export report" button that turns the time data Whenbee already learned about you into a clean, printable PDF you can hand to an ADHD coach, a therapist, or a psychiatrist (or just keep). It shows how your guesses compare to reality over a chosen window, your per-category bias multipliers (how much longer each kind of task actually takes you), the tasks that surprised you most, and the time the honest numbers saved you. It is generated entirely on your phone from your own logs. Nothing uploads, no account, no network. The file lands in the normal iOS share sheet, so you can AirDrop it, save it to Files, or attach it to an email to your clinician.

## 2. The user problem + evidence

People in this audience walk into appointments and get asked "how's your time management been?" and have nothing but a vague, shame-tinged guess to offer. Whenbee already holds the honest answer. The gap is getting it out of the app in a form a clinician will actually read.

- Bearable's **#1 roadmap request: 228 votes, and the Bearable team itself flagged it as "likely a premium feature"** ([changemap](https://changemap.co/bearable-/bearable-roadmap/task/4070-pdf-export)). See [07-PRO-VALUE-IDEAS §1.1](../07-PRO-VALUE-IDEAS.md).
- Daylio gates a therapy PDF, and the segment that found Premium worth paying for were the ones "using it in tandem with therapy" ([Choosing Therapy](https://www.choosingtherapy.com/daylio-app-review/)).
- eMoods leads its marketing with clinician export.

Why it earns recurring payment (the part that matters for a subscription, per [07 §1.1](../07-PRO-VALUE-IDEAS.md) and truth #5d): a report is needed at *every* appointment, not once. It pulls in a second reader (the clinician) who re-justifies the subscription on a cadence the user doesn't control. Each new month of data makes the next export more useful, so the value compounds rather than resolving.

## 3. Where it lives

- **Primary entry:** Settings → a row labeled **"Export a report"** (see §10 for exact copy). Settings is the calm, non-loop surface where a Pro deliverable belongs, and it sits next to "Manage subscription" / data controls.
- **Secondary entry (Pro only, fast-follow, not v1):** a small "Export this view" action on the existing Patterns/insights surface. Out of scope for the first build; noted so the route name is reserved.
- **Route:** a full-screen modal `src/app/(modals)/report.tsx` (thin route; logic in the feature hook). The modal is where the user picks the window and previews before exporting.
- **Free vs Pro:** the Settings row is visible to everyone. Tapping it when not Pro opens the **locked teaser** (§9) inside the same modal, showing the report's shape with a paywall CTA. Tapping it when Pro opens the live builder. Never gate the core loop; this is a payoff surface only.

## 4. User flow

**Happy path (Pro):**
1. Settings → tap **"Export a report"**.
2. Modal opens on the **Builder** screen: a window picker (Last 30 days / Last 90 days / All time), a one-line plain-English summary of what's included, and a live **Preview** of page 1 rendered small.
3. User picks a window. The preview updates.
4. User taps **"Create PDF"**. A brief inline progress state shows while `expo-print` renders the HTML to a PDF file on-device.
5. The iOS share sheet opens with the finished PDF. User AirDrops it, saves to Files, or emails it.
6. Sheet dismisses back to the modal (still on Builder, so they can make a second window export without re-navigating). A quiet confirmation line appears: "Saved. Your report is ready to share."

**Locked path (not Pro):**
1. Settings → tap **"Export a report"**.
2. Modal opens on the **locked teaser** (§9): the same page-1 layout, rendered with the user's *real* data but visually softened (reduced contrast wash over the body, the export button replaced by a Pro CTA). The headline numbers stay legible so they see their own value.
3. User taps **"Unlock report export"** → `router.push('/(modals)/paywall', { trigger: 'pdf_export' })`.
4. On successful purchase the entitlement flips, the teaser swaps to the live Builder in place (no re-navigation), and they continue from step 2 of the happy path.

**Not-enough-data path (Pro, thin history):** if the chosen window has fewer than the minimum counted logs (§11), the Builder shows the calm not-enough-data state instead of the preview, and "Create PDF" is disabled with a soft helper line. Widening the window to "All time" is offered as the one-tap fix.

## 5. Screens & states

All values are tokens from `src/theme/tokens.ts` via `useTheme()` and roles from `src/theme/typography.ts`. No raw numbers/hex. Reuse existing primitives: `Screen`, `AppText`, `AppButton`, `Card`, `Chip`, `HonestNumber`. The page itself is rendered as **HTML** (for `expo-print`), so the PDF's "tokens" are injected as CSS custom properties generated from the same `tokens` object (see §8 `buildReportHtml`) — one source of truth, no second palette.

### 5a. Builder screen (Pro)

Layout, top to bottom, inside `Screen` (modal):
- **Header row:** title `type.title` "Export a report"; a close `✕` (bare `Pressable`, inner `View`, `t.iconSize.lg`) top-right. Header bottom padding `t.space[5]`.
- **Window picker:** a segmented control of three `Chip`s (Last 30 days / Last 90 days / All time), `gap: t.space[2]`, the selected chip filled `t.colors.primarySoft` with `t.colors.ink` text, unselected `t.colors.surface` with `t.colors.inkSoft`. Exactly one selected. Eyebrow above it `type.eyebrow` `t.colors.inkSoft`: "TIME WINDOW".
- **What's included line:** `type.bodySm` `t.colors.inkSoft`, one sentence (§10).
- **Preview card:** a `Card` (`t.radii.card`, `t.colors.surface`, `borderWidth: t.borderWidth.share`, `t.colors.border`) containing a scaled-down render of report page 1. On native this is a `WebView`-free approach: render the same React preview component (`ReportPagePreview`) using app primitives at `0.62` scale inside a fixed-aspect frame, so the user sees the real layout without spinning up print. Gap above `t.space[5]`.
- **Footer (pinned, adds `useSafeAreaInsets().bottom`):** primary `AppButton` "Create PDF" (filled indigo coin-edge — the single filled indigo element on this screen). Below it, `type.micro` `t.colors.inkSoft`: "Made on your phone. Nothing leaves your device unless you share it." (the privacy reassurance, conversion-relevant for this audience).

ASCII wireframe:
```
┌──────────────────────────────────────┐
│ Export a report                    ✕  │
│                                        │
│ TIME WINDOW                            │
│ [ 30 days ] [ 90 days ] [ All time ]   │
│ Includes your accuracy, per-category   │
│ bias, biggest surprises, time saved.   │
│                                        │
│ ┌────────────────────────────────┐    │
│ │   ▒ scaled page-1 preview ▒     │    │
│ │   Whenbee · time report         │    │
│ │   Window: last 30 days          │    │
│ │   Estimation accuracy   72%     │    │
│ │   ▁▃▅▆ tightening over time      │    │
│ │   Per-category bias  (table)    │    │
│ └────────────────────────────────┘    │
│                                        │
│         [   Create PDF   ]             │
│ Made on your phone. Nothing leaves …   │
└──────────────────────────────────────┘
```

### 5b. The PDF document (the deliverable)

Page size **US Letter** (8.5×11in) — clinicians in the primary market print Letter; `expo-print` defaults to it. Margins `0.6in`. One accent color (indigo `--c-primary`), neutrals carry the rest (60/30/10). Body type maps to the app's type scale converted to pt for print: page title ≈ 22pt, section heading ≈ 14pt, body ≈ 11pt, caption/label ≈ 9pt, the hero accuracy figure ≈ 40pt. Tabular numbers everywhere a number sits in a column (CSS `font-variant-numeric: tabular-nums`, mirroring `type.honestNumber*`). Each page has a footer: left "Whenbee · personal time report", right "Page N of M" and the generation date.

**Page 1 — Summary (always present):**
1. **Title block:** "Time report" (title) + a quiet subline "Generated <date> · <window label>". Optional companion name if the user set one (`Companion.name`) reads as a person, e.g. "Prepared by Whenbee for <name's> data" — only if name exists, else omit. No logo art; clinicians want signal, not branding.
2. **Estimation accuracy hero:** one big figure (e.g. "72%") + a one-line plain definition under it: "How close your time guesses landed to reality, on average." Plus a small sparkline of accuracy over the window (so a "tightening" trend reads at a glance — the compounding-value proof). Pulled from clamped ratios (§8).
3. **Time saved by honest numbers:** the reclaim figure for the window, formatted via `formatReclaim` (e.g. "8h 40m"), with the no-guilt framing line (§10). This is the felt-good anchor near the top.
4. **At a glance row:** three quiet stats — tasks logged, categories tracked, your steadiest category — as a single hairline-separated row (no boxes; flat over heavy).

**Page 1 (continued) / Page 2 — Per-category bias table (always present):**
A table, one row per category with enough data:
| Category | Logs | You guess | It really takes | Bias |
|---|---|---|---|---|
| Getting ready | 14 | 15m | 24m | ×1.6 |
| Admin | 9 | 30m | 38m | ×1.3 |

- "Bias" is the effective multiplier (`CategoryStats.mEffective`), rendered `×1.6` with the `×` as a smaller muted suffix (optical alignment rule). Right-aligned, tabular.
- "It really takes" uses a representative example so a clinician reads minutes, not a coefficient: honest minutes for the user's typical guess in that category (engine `honestNumber`). If a confidence range exists (`honestRangeFor`), show it as "20–26m" under the point value in caption type.
- Rows sorted by bias descending (the most over-optimistic category first — the most clinically interesting, never framed as a failing).
- Categories below the per-category minimum are omitted from the table and summarized in one line: "<n> more categories are still settling and were left out."

**Page 2 / 3 — Biggest surprises (present if any qualify):**
The handful of individual logs where reality diverged most from the guess, as a short list (max 5). Each line: category + label (if any) + "guessed Xm, took Ym". This is the concrete, story-level evidence a clinician can talk about. Pulled from `listRecentEvents` filtered to the window, ranked by `|actual − estimate|`, completed only. No red, no "fail" word — these are "surprises", framed neutrally.

**Page 3 / last — When you're sharpest (present if a correlation clears the gate):**
If `correlateAccuracy` returns anything, one short paragraph: "Your estimates land closest in the <betterLabel> and drift most in the <worseLabel>." Deterministic, no LLM. Omitted entirely if no pattern clears the gate (never pad with a "no pattern yet" line on the clinician doc — silence is cleaner).

**Footer note on every page:** "These are personal estimates, not a clinical measure." (Keeps the doc honest and avoids implying diagnostic authority.)

### 5c. States

- **Loading (generating):** "Create PDF" swaps to a disabled state with an inline `ActivityIndicator` and label "Building your report…". `expo-print` is fast (sub-second to ~2s for this content), so no full-screen blocker; keep it inline. Motion per §6.
- **Empty / not-enough-data (Builder, chosen window thin):** preview card replaced by a calm centered block: a small honeycomb/calm glyph (reuse an existing quiet illustration, no new art), `type.heading` "Not enough logged time here yet", `type.bodySm` `t.colors.inkSoft` "A report gets useful after about <N> finished tasks in this window. Try 'All time', or come back after a few more." "Create PDF" disabled (`t.opacity.disabled`). A `Chip` shortcut "Use all time" switches the window. Amber/neutral only, never a deficit tone.
- **Error (print/share failed):** never throws into the user. The flow swallows to a quiet inline toast "Couldn't build the report just now. Try again?" with a retry. No stack, no red banner. (Mirrors the share service's `'error'` fold.)
- **Locked teaser:** see §9.

## 6. Motion

Durations/easing from `tokens.motion`; honor `ReduceMotion.System`.
- **Window chip select:** the selected chip's fill cross-fades and the chip scales `tokens.scale.pressIn` on press-in (reuse `Chip`'s existing feedback). No custom motion needed.
- **Preview update on window change:** the preview content fades via `withTiming(opacity, { duration: t.motion.base })` (220ms, `easing.standard`) so numbers don't snap. Entering-only (the preview view stays mounted, only its contents change) — no `exiting` layout animation (Fabric SIGABRT rule).
- **Create → generating:** the button label cross-fades to "Building your report…" over `t.motion.fast` (120ms); the inline spinner uses the platform indicator.
- **Confirmation line** after share: fades in `t.motion.toast` (300ms) and holds, no slide.
- **Reduced motion:** all fades collapse to instant; the spinner remains (it communicates state, not decoration).
- No celebratory/reward motion here — a clinician export is a calm utility, not a honey moment. (Keeps honey/tier semantics untouched.)

## 7. Data model

No new domain types are required — the report is a **read-only projection** of existing data. It introduces one small view-model type, kept in the feature folder (not `domain/types.ts`, since it's a presentation DTO, not an engine contract):

```ts
// src/features/report/reportModel.ts
export interface ReportWindow { kind: '30d' | '90d' | 'all'; sinceMs: number | null; label: string; }

export interface ReportCategoryRow {
  categoryId: string; categoryName: string; logs: number;
  typicalGuessMin: number; honestMin: number; range: HonestRange | null; multiplier: number;
}

export interface ReportSurprise { categoryName: string; label: string | null; estimateMin: number; actualMin: number; }

export interface ReportModel {
  window: ReportWindow;
  generatedAtMs: number;
  companionName: string | null;
  accuracyPct: number;
  accuracySpark: number[];        // accuracy per sub-bucket across the window, for the sparkline
  reclaimedMinutes: number;
  totalLogs: number; categoryCount: number; steadiestCategoryName: string | null;
  categories: ReportCategoryRow[];
  surprises: ReportSurprise[];    // max 5
  sharpestNote: string | null;    // from correlateAccuracy, or null
  omittedCategoryCount: number;
}
```

- **Persisted?** Nothing new is persisted. The model is built on demand and discarded. The generated PDF lives in a temp file (`expo-file-system` cache / `expo-print` tmp output) and is handed to the share sheet; we do not keep a copy or index of exports (privacy + no new table). Re-openable archive of past reports is a separate spec ([07 §2.2 / spec 07 long-range history](07-long-range-history.md)) and is explicitly out of scope here.
- **Data sources (all existing repos, read-only):** `taskEventsRepo.listRecentEvents` (window-filtered, completed only) for accuracy/surprises/counts; `categoryStatsRepo` for `n` and `mEffective` per category; `companionRepo.getCompanion` for `reclaimedMinutesLifetime` (window reclaim is summed from events' `reclaimDividendMin`, see §8) and `name`.

## 8. Engine / logic

The math is a **pure projection** over already-clamped data; no change to the calibration core, no new training. New pure module + a thin native render seam. **TDD required** for the pure parts (write engine/projection tests first).

### Pure projection — `src/engine/report.ts` (new, pure, clock-free, exported via `src/engine/index.ts`)

Engine stays clock-free, so the *caller* passes `nowMs` and the windowed events; these functions never read `Date.now()`.

```ts
// All inputs pre-filtered to status === 'completed' by the caller.
export interface ReportEventInput {
  category: string; label: string | null;
  estimateMin: number; actualMin: number; reclaimDividendMin: number;
  endedAt: number;           // epoch ms, for window bucketing + sparkline
}

/** Overall accuracy 0–100 from clamped ratios — reuses the accuracy.ts formula
 *  so the PDF figure matches the in-app sharpness math exactly. */
export function reportAccuracy(clampedRatios: number[]): number;

/** Accuracy per chronological bucket (e.g. 6 buckets across the window) for the
 *  tightening sparkline. Empty buckets carry forward the last value (monotone-
 *  friendly display; never invents a dip). */
export function reportAccuracySpark(events: ReportEventInput[], buckets: number): number[];

/** Sum of reclaimDividendMin over the window (never negative — mirrors reclaim.ts). */
export function reportReclaimedMinutes(events: ReportEventInput[]): number;

/** Top-K logs by |actual − estimate|, ties broken by larger actual then endedAt
 *  desc for determinism. */
export function topSurprises(events: ReportEventInput[], k: number): ReportSurprise[];

/** Steadiest category = lowest CV of clamped ratios among categories that clear
 *  the per-category minimum; null if none qualify. */
export function steadiestCategory(byCategory: Map<string, number[]>): string | null;
```

- **Ratio clamping:** reuse `clampRatio` from `src/engine/ratio.ts` on every `actualMin/estimateMin` before it touches accuracy/CV — identical to the calibration path, so the report can never show a number the app itself wouldn't trust.
- **Accuracy formula:** reuse the exact `accuracyOf` logic that already lives in `src/engine/accuracy.ts` (factor it out / re-export rather than re-implement — clean-code: single source). The PDF accuracy and the in-app "when you're sharpest" numbers must agree.
- **Per-category honest minutes & range:** call existing `honestNumber` and `honestRangeFor` from `src/engine/index.ts` with the category's `mEffective` and the category's typical guess (median estimate over the window). `confidenceFor` decides whether to print the range.
- **Sharpest note:** call existing `correlateAccuracy(samples)` (engine) and phrase with the existing label strings; if empty → `sharpestNote = null`.
- **Constants:** add to `src/engine/constants.ts`: `REPORT_MIN_LOGS` (window minimum to allow export, propose 6, matching `CONFIDENCE_SETTING_MIN_LOGS` territory), `REPORT_CATEGORY_MIN_LOGS` (per-row minimum, propose 4), `REPORT_SPARK_BUCKETS` (propose 6), `REPORT_MAX_SURPRISES` (5). No magic numbers in `report.ts`.

### Model assembly — `src/features/report/useReportModel.ts` (hook, allowed to touch repos via the store/provider rule)

Per the layer rule, the *feature hook* (not a component) loads data. It:
1. Resolves the window → `sinceMs` (using `Date.now()` here, where clock access is allowed — UI layer).
2. Reads windowed completed events + category stats + companion.
3. Calls the pure `src/engine/report.ts` projections.
4. Returns `ReportModel` (memoized) + `{ status: 'ready' | 'thin' | 'loading' | 'error' }`.

### HTML render — `src/features/report/buildReportHtml.ts` (pure: model → HTML string)

```ts
export function buildReportHtml(model: ReportModel, css: ReportCss): string;
```
- Pure string builder, fully unit-testable (assert sections present/omitted, numbers formatted, no category leaks under the minimum). No React, no native.
- `ReportCss` is generated once from `tokens` (`src/features/report/reportCss.ts`) so colors/sizes come from the token file — `--c-primary: ${tokens.colors.light.primary}` etc. The PDF is always rendered in the **light** palette regardless of app color mode (a printed page is white paper; dark-mode ink on paper is wrong). Use tabular-nums, the type-scale pt sizes from §5b, and one accent.
- Escape all user-controlled strings (category labels, companion name) — clinician docs must not break on a `<` in a task label.

### PDF generation + share — `src/features/report/useReportExport.ts` (hook)

Mirrors `useShareCard.ts` exactly (same guarded, injectable, never-throws shape):
```ts
export async function runExportFlow(deps: ExportFlowDeps): Promise<void>;
// non-Pro  → capture 'report_export' { result: 'gated' } + open paywall; never print.
// thin     → no-op (button is disabled, but guard anyway).
// Pro      → printToFileAsync(html) → share(uri) → capture outcome. Swallow to 'error'.
```
- **`expo-print`** is the real-PDF path. **It is NOT currently in `package.json`** — add it with `npx expo install expo-print` (do not `npm install`; matches the project's Expo-dep rule). It must be wrapped in a guarded service `src/services/print.ts` following the `share.ts` pattern (pure `resolvePrintModule(expoGo, loadNative)` returning a stub in Expo Go/tests, exposing `isStub`), because native modules spin forever in Expo Go.
- **Reuse `src/services/share.ts`** verbatim for the share-sheet hand-off (it already does `expo-sharing`, on-device, never-throws). The print service produces the file URI; the existing share service hands it to iOS.
- **Why `expo-print`, not `react-native-view-shot`:** view-shot makes a single raster PNG, which is fine for a one-screen share card but wrong for a multi-page, text-selectable, printable clinician document. `expo-print` renders real HTML to a paginated, vector-text PDF the clinician can print crisply. View-shot stays the right tool for spec's share card; it is not used here.

## 9. Gating

- **Placement:** the Settings row is always visible. Inside `src/app/(modals)/report.tsx`, branch on `useEntitlement((s) => s.isPro)` (the modal owns one screen, so a branch reads cleaner than wrapping; `ProGate` is fine too if a sub-tree split is preferred). Pro → `<ReportBuilder/>`; non-Pro → `<ReportLockedTeaser/>`.
- **Paywall trigger name:** `pdf_export`. Add it to the `paywall_view.trigger` union in `src/services/analytics.ts` (currently `'make_day_honest' | 'settings_upgrade' | 'steals_your_time'`) → add `'pdf_export'`. CTA does `router.push({ pathname: '/(modals)/paywall', params: { trigger: 'pdf_export' } })`.
- **Locked-teaser design (`ReportLockedTeaser`):** show the *real* page-1 preview built from the user's own data (this is the conversion lever — they see their actual 72% and their actual time saved), then apply a soft legibility wash over the lower body (a `t.colors.bg`-tinted overlay at partial opacity, NOT a blur of the headline numbers — keep the accuracy figure and the time-saved figure fully readable; fog only the table rows below). Below the preview: `type.heading` "Take your honest numbers to your next appointment", `type.bodySm` `t.colors.inkSoft` one line (§10), then the primary CTA `AppButton` "Unlock report export". A `type.micro` reassurance under it: "On your phone. Nothing uploads." Calm, no countdown, no fake scarcity (this audience punishes that — [07 Pricing landmines](../07-PRO-VALUE-IDEAS.md)).
- Never fog calibration or the loop; this teaser lives only in the report modal.

## 10. Copy

Every string below is humanizer-checked (no em dash, no AI vocab, no rule-of-three, no fake urgency) and no-guilt.

- **Settings row label:** `Export a report`
- **Settings row sublabel:** `A clean PDF of your real time data to keep or share with a coach or doctor.`
- **Modal title:** `Export a report`
- **Time-window eyebrow:** `TIME WINDOW`
- **Window chips:** `Last 30 days` · `Last 90 days` · `All time`
- **What's included line:** `Includes your accuracy, how long things really take you per category, your biggest surprises, and the time you saved.`
- **Primary button (idle):** `Create PDF`
- **Primary button (working):** `Building your report…`
- **Privacy line (footer):** `Made on your phone. Nothing leaves your device unless you share it.`
- **Post-share confirmation:** `Saved. Your report is ready to share.`
- **Not-enough-data heading:** `Not enough logged time here yet`
- **Not-enough-data body:** `A report gets useful after about six finished tasks in this window. Try "All time", or come back after a few more.`
- **Not-enough-data shortcut chip:** `Use all time`
- **Error toast:** `Couldn't build the report just now. Try again?`
- **Locked-teaser heading:** `Take your honest numbers to your next appointment`
- **Locked-teaser body:** `Turn what Whenbee learned about your time into a clean PDF you can hand to a coach, therapist, or doctor.`
- **Locked-teaser CTA:** `Unlock report export`
- **Locked-teaser reassurance:** `On your phone. Nothing uploads.`

**Strings printed inside the PDF:**
- **Doc title:** `Time report`
- **Doc subline:** `Generated {date} · {windowLabel}`
- **Accuracy label:** `Estimation accuracy`
- **Accuracy definition:** `How close your time guesses landed to reality, on average.`
- **Time-saved label:** `Time the honest numbers saved you`
- **Time-saved framing (no-guilt):** `This is how much closer to reality your planning got. It only goes up.`
- **At-a-glance labels:** `Tasks logged` · `Categories tracked` · `Steadiest category`
- **Per-category table headers:** `Category` · `Logs` · `You guess` · `It really takes` · `Bias`
- **Omitted-categories line:** `{n} more categories are still settling and were left out.`
- **Surprises section heading:** `Biggest surprises`
- **Surprise row format:** `{category}{label?} — guessed {x}m, took {y}m`
- **Sharpest section heading:** `When your estimates land closest`
- **Sharpest note format:** `Your estimates land closest in the {betterLabel} and drift most in the {worseLabel}.`
- **Per-page footer left:** `Whenbee · personal time report`
- **Per-page disclaimer:** `These are personal estimates, not a clinical measure.`

Copy notes: "Bias" is used in the table because it is the clinician-legible word for the multiplier; it is never aimed at the user as judgment (the in-app surfaces keep the gentler framing). "Surprises", not "errors" or "fails". Time saved is framed as monotonic and positive, consistent with the Reclaim invariant.

## 11. Edge cases & guardrails

- **Low-n window:** if window has `< REPORT_MIN_LOGS` (6) completed logs → not-enough-data state; export disabled. Guard again in `runExportFlow` (defense in depth).
- **Zero data at all:** same not-enough-data state; the "Use all time" chip will also be empty, so when even all-time is below the minimum, swap the body to `A report gets useful after you finish a few tasks. Whenbee is still learning your time.` (still no guilt).
- **Per-category thinness:** categories below `REPORT_CATEGORY_MIN_LOGS` (4) never appear as rows (a 1-log "×3.0" would mislead a clinician); they roll into the omitted-count line.
- **No qualifying surprises / no accuracy pattern:** those sections are omitted entirely rather than printed empty (clean doc).
- **Window rollover / timezone:** windowing uses local-day boundaries computed in the hook (UI layer, clock allowed); the engine stays clock-free. "Last 30 days" = now − 30×24h, simple and explainable on the doc.
- **Companion name escaping:** if the user set a companion name, it is HTML-escaped before going into the PDF; if unset, the "Prepared by" line is omitted, not left blank.
- **Privacy (core invariant):** zero network. `expo-print` renders locally; `expo-sharing` hands a local file URI to iOS. No upload, no account, no analytics payload containing task labels or the file. Assert in tests that `buildReportHtml` and the export flow make no fetch.
- **No-guilt checks:** no red anywhere in the PDF or the modal (accent stays indigo/amber); no streaks, no "you were wrong" language; time-saved framed as monotonic; the most-biased category is "first in the table", never "your worst".
- **Expo Go:** print + share services stub out (Expo Go can't run native print). The Builder still renders; "Create PDF" in Expo Go resolves to the inline error toast via the stub's `unavailable → error` fold. Real testing is on the dev build (`npm run ios`), per project gotchas.
- **Large all-time history:** cap the events query at a sane upper bound for the projection (e.g. last N completed events for accuracy/surprises) so an enormous history doesn't stall the main thread; the per-category table uses `categoryStatsRepo` aggregates, not a full scan. Tune the cap in constants.

## 12. Analytics

Add to `AppEventProps` in `src/services/analytics.ts` (fire-and-forget, no PII, never the file or task labels):

- `report_opened: { is_pro: boolean }` — modal opened (fires for both gated and live).
- `report_paywall: { trigger: 'pdf_export' }` — locked teaser CTA tapped (pairs with the existing `paywall_view` which the paywall screen fires).
- `report_export: { window: '30d' | '90d' | 'all'; category_count: number; total_logs: number; result: 'shared' | 'gated' | 'thin' | 'error' }` — the export attempt outcome. Counts only, never content.
- Extend `paywall_view.trigger` union with `'pdf_export'` (the paywall screen already emits `paywall_view`).

Funnel: `report_opened` (is_pro=false) → `report_paywall` → `paywall_view{trigger:'pdf_export'}` → `purchase` → `report_opened` (is_pro=true) → `report_export{result:'shared'}`. The return-to-export rate after purchase is the signal that the clinician second-audience thesis ([07 §1.1](../07-PRO-VALUE-IDEAS.md)) is real.

## 13. Build manifest & effort

**Add (new files):**
- `src/engine/report.ts` — pure projections (S; TDD).
- `src/engine/__tests__/report.test.ts` — projection tests (S).
- `src/features/report/reportModel.ts` — view-model types (S).
- `src/features/report/useReportModel.ts` — repo reads → model (M).
- `src/features/report/reportCss.ts` — tokens → print CSS (S).
- `src/features/report/buildReportHtml.ts` — model → HTML, pure (M; TDD).
- `src/features/report/__tests__/buildReportHtml.test.ts` — section/omission/escaping tests (S).
- `src/features/report/useReportExport.ts` — print + share flow, guarded, never-throws (M; test `runExportFlow` like `runShareFlow`).
- `src/features/report/ReportBuilder.tsx` — Builder screen (M).
- `src/features/report/ReportLockedTeaser.tsx` — locked teaser (S).
- `src/features/report/ReportPagePreview.tsx` — scaled in-app preview of page 1 (M).
- `src/services/print.ts` — guarded `expo-print` seam, mirrors `share.ts` (S; test `resolvePrintModule`).
- `src/app/(modals)/report.tsx` — thin modal route, entitlement branch (S).

**Edit:**
- `src/engine/index.ts` — export the new `report.ts` functions (+ re-export the shared `accuracyOf`).
- `src/engine/constants.ts` — add `REPORT_MIN_LOGS`, `REPORT_CATEGORY_MIN_LOGS`, `REPORT_SPARK_BUCKETS`, `REPORT_MAX_SURPRISES`, the all-time query cap (S).
- `src/engine/accuracy.ts` — extract `accuracyOf` to a shared export so the report reuses it (S).
- `src/services/analytics.ts` — add the 3 events + `'pdf_export'` to the trigger union (S).
- Settings screen (`src/app/.../settings` — confirm exact path during build) — add the "Export a report" row that pushes `/(modals)/report` (S).
- `package.json` / lockfile — via `npx expo install expo-print` (S).

**Dependencies:**
- **New native dep: `expo-print`** — add with `npx expo install expo-print`, then `npx expo-doctor` (expect 18/18) and a `npx expo prebuild --clean` is NOT needed (config plugin auto-links; verify it builds on the dev client). Reuses already-installed `expo-sharing` and `expo-file-system`.

**Effort:** **M** overall. The math is a thin pure projection over existing engine output; the genuinely new surface is the HTML/CSS print template and one guarded native service. Largest single risk is print fidelity (fonts/pagination), addressed below.

**Open questions:**
1. **Print fonts:** does the PDF use the app's Plus Jakarta / Inter (need to embed/`@font-face` in the HTML from `src/assets/fonts`) or fall back to print-safe system serif/sans? Embedding gives brand consistency but adds weight and a font-loading path in `expo-print`. Proposal: system-sans for the clinician doc (legibility > brand), revisit after first render review.
2. **Letter vs A4:** default Letter for the primary market; should the window picker also expose a page-size toggle for non-US clinicians, or auto-pick by locale? Proposal: auto-pick A4 when `expo-localization` region is non-US, no visible toggle.
3. **Companion name on a clinical doc:** include the "Prepared by Whenbee" line at all, or keep the doc strictly neutral? Founder call.
4. **Filename:** propose `whenbee-time-report-{YYYY-MM-DD}.pdf` so it sorts well in Files/email; confirm no PII beyond the date is acceptable.
5. **Sparkline rendering in PDF:** inline SVG in the HTML (clean, vector) vs a tiny rendered series — proposal inline SVG bars from `accuracySpark`, no chart lib.
6. **Re-openable archive** (past exports) is deferred to [spec 07 long-range history](07-long-range-history.md); confirm it stays out of this build.
