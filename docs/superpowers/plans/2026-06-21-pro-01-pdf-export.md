# PDF Report Export (Pro) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** A one-tap "Export a report" that turns the time data Whenbee already learned into a clean, printable on-device PDF a user can hand to a coach/therapist/doctor — accuracy, per-category bias, biggest surprises, when they're sharpest. Generated locally, no network, into the iOS share sheet.

**Architecture:** Pure projections in `src/engine/report.ts` (reuse the shipped accuracy formula, TDD). A presentation view-model + a pure `buildReportHtml` (model → HTML string, fully unit-testable). A guarded `src/services/print.ts` (mirrors `share.ts`'s `resolve…(expoGo, loadNative)` + `isStub` seam) using the new `expo-print` dep. A Settings entry → a modal that previews + exports; `ProGate`-branched. Full spec: `docs/product/specs/01-pdf-report-export.md` — **but two overrides below.**

> **AUDIT OVERRIDES (2026-06-21) — these win over the spec:**
> 1. **NO "Time saved / reclaim" section.** Reclaim was removed from the product (PR #25, decision C) and is off-thesis; it's neutered to 0 in the app. Do NOT add `reportReclaimedMinutes`, the "Time the honest numbers saved you" PDF section, or any reclaim string. The PDF leads with calibration: accuracy + bias table + surprises + sharpest-window.
> 2. **Accuracy = `sharpnessFromWindow(clampedRatios)`** (the shipped 0–100 formula in `src/engine/sharpness.ts`) — reuse it; do NOT invent `accuracyOf`. The PDF figure and the in-app sharpness must agree.

**Tech Stack:** Expo SDK 54 (use `npx expo install`, not npm), RN 0.81, TS strict + `noUncheckedIndexedAccess`, expo-print (NEW), expo-sharing (installed), Jest.

## Global Constraints

- **Privacy invariant (load-bearing for this audience):** zero network. `expo-print` renders locally; the file URI goes to the OS share sheet. No upload, no account, no analytics payload containing task labels or the file. Assert in tests that `buildReportHtml` makes no fetch.
- **Guarded native:** `print.ts` returns a no-op stub in Expo Go / tests (`isStub`), mirroring `share.ts` exactly. Native modules spin forever in Expo Go.
- **Print design (from visual-design-foundations):** US Letter (A4 when `expo-localization` region is non-US), margins 0.6in. ONE accent = indigo `--c-primary`; neutrals carry 60/30/10. Type scale in pt: page title 22 / section heading 14 / body 11 / caption-label 9 / hero accuracy 40; line-height headings ~1.2, body ~1.5. `font-variant-numeric: tabular-nums` on every column number. **Always the light palette** (white paper; dark-mode ink on paper is wrong) — generate CSS vars from `tokens.colors.light`. WCAG AA contrast on body text.
- **Copy (humanizer + conversion-psychology):** felt clinician-appointment problem, privacy reassurance, NO fake urgency (this audience punishes it), "Surprises" never "errors/fails", no em-dash, no rule-of-three, no AI-vocab. Exact strings in each task. Escape all user-controlled strings (labels, companion name) before they enter HTML.
- **Theming (in-app modal):** tokens via `useTheme()` only; reuse `Screen`/`AppText`/`AppButton`/`Card`/`Chip`. No raw numbers/hex.
- **Layer rule:** the feature hook (`useReportModel`) may read repos; components go through the hook. Route is thin.
- **No-guilt:** no red anywhere; the most-biased category is "first in the table", never "your worst".
- **Commits:** Conventional Commits, **no AI/co-author trailers** (HARD RULE), plain `git`, no `init-cmt`.
- **Never merge.** Open a PR and stop.

---

### Task 1: Add `expo-print` + guarded `print.ts` service (TDD the seam)

**Files:**
- Modify: `package.json` (+ lockfile) via `npx expo install expo-print`
- Create: `src/services/print.ts`
- Create: `src/services/__tests__/print.test.ts`

**Interfaces:**
- Produces: `resolvePrintModule(expoGo, loadNative)`, `getPrint(): PrintModule` with `{ isStub: boolean; printAndShare(html: string): Promise<PrintResult> }`, `PrintResult = 'shared' | 'unavailable' | 'error'`.

- [ ] **Step 1: Install the dep**

Run: `npx expo install expo-print` then `npx expo-doctor` (expect a clean result; expo-print is config-plugin auto-linked, no prebuild needed for JS/tests).

- [ ] **Step 2: Write the failing test** — `src/services/__tests__/print.test.ts` (mirror `share.test.ts` if present):

```ts
import { resolvePrintModule } from '../print';

describe('resolvePrintModule', () => {
  it('returns a no-op stub in Expo Go', async () => {
    const mod = resolvePrintModule(true, () => { throw new Error('should not load native'); });
    expect(mod.isStub).toBe(true);
    expect(await mod.printAndShare('<html></html>')).toBe('unavailable');
  });
  it('wraps the native loader on a dev build and never rejects', async () => {
    const native = {
      printToFileAsync: async () => ({ uri: 'file:///tmp/report.pdf' }),
      shareAsync: async () => {},
      isAvailableAsync: async () => true,
    };
    const mod = resolvePrintModule(false, () => native);
    expect(mod.isStub).toBe(false);
    expect(await mod.printAndShare('<html></html>')).toBe('shared');
  });
  it('maps a native failure to error, never throws', async () => {
    const native = {
      printToFileAsync: async () => { throw new Error('boom'); },
      shareAsync: async () => {}, isAvailableAsync: async () => true,
    };
    const mod = resolvePrintModule(false, () => native);
    expect(await mod.printAndShare('<html></html>')).toBe('error');
  });
});
```

- [ ] **Step 3: Run → fail.**

- [ ] **Step 4: Implement `src/services/print.ts`** (mirror `share.ts`; render to file then share as PDF):

```ts
// Guarded on-device PDF print + share. Mirrors share.ts: pure resolve…() seam,
// no-op stub in Expo Go / tests. PRIVACY: renders locally, hands a file URI to the
// OS share sheet — no upload, no account, no network. Never rejects into a caller.
import { isExpoGo } from '@/src/lib/isExpoGo';

export type PrintResult = 'shared' | 'unavailable' | 'error';

export interface PrintNativeModule {
  printToFileAsync: (options: { html: string }) => Promise<{ uri: string }>;
  shareAsync: (url: string, options?: Record<string, unknown>) => Promise<void>;
  isAvailableAsync: () => Promise<boolean>;
}

export interface PrintModule {
  isStub: boolean;
  printAndShare: (html: string) => Promise<PrintResult>;
}

const stub: PrintModule = { isStub: true, printAndShare: async () => 'unavailable' };

function createNative(native: PrintNativeModule): PrintModule {
  return {
    isStub: false,
    printAndShare: async (html: string): Promise<PrintResult> => {
      try {
        const { uri } = await native.printToFileAsync({ html });
        if (!(await native.isAvailableAsync())) return 'unavailable';
        await native.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share your time report',
          UTI: 'com.adobe.pdf',
        });
        return 'shared';
      } catch {
        return 'error';
      }
    },
  };
}

export function resolvePrintModule(expoGo: boolean, loadNative: () => PrintNativeModule): PrintModule {
  return expoGo ? stub : createNative(loadNative());
}

const loadNativePrint = (): PrintNativeModule => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const print = require('expo-print') as { printToFileAsync: PrintNativeModule['printToFileAsync'] };
  const sharing = require('expo-sharing') as Pick<PrintNativeModule, 'shareAsync' | 'isAvailableAsync'>;
  /* eslint-enable @typescript-eslint/no-require-imports */
  return { printToFileAsync: print.printToFileAsync, shareAsync: sharing.shareAsync, isAvailableAsync: sharing.isAvailableAsync };
};

let cached: PrintModule | null = null;
export function getPrint(): PrintModule {
  if (!cached) cached = resolvePrintModule(isExpoGo, loadNativePrint);
  return cached;
}
```

- [ ] **Step 5: Run → pass. Commit.**

```bash
git add package.json package-lock.json src/services/print.ts src/services/__tests__/print.test.ts
git commit -m "feat(services): add guarded expo-print PDF service"
```

---

### Task 2: Engine — `report.ts` pure projections (TDD, NO reclaim)

**Files:**
- Modify: `src/engine/constants.ts`, `src/engine/index.ts`
- Create: `src/engine/report.ts`, `src/engine/__tests__/report.test.ts`

**Interfaces:**
- Produces: `ReportEventInput` type; `reportAccuracy(clampedRatios): number` (reuse `sharpnessFromWindow`), `reportAccuracySpark(events, buckets): number[]`, `topSurprises(events, k): ReportSurprise[]`, `steadiestCategory(byCategory): string | null`; constants `REPORT_MIN_LOGS=6`, `REPORT_CATEGORY_MIN_LOGS=4`, `REPORT_SPARK_BUCKETS=6`, `REPORT_MAX_SURPRISES=5`.

- [ ] **Step 1: Constants** in `src/engine/constants.ts`:

```ts
// ── PDF report (Pro) ─────────────────────────────────────────────────────────
export const REPORT_MIN_LOGS = 6;          // window minimum to allow export
export const REPORT_CATEGORY_MIN_LOGS = 4;  // per-row minimum in the bias table
export const REPORT_SPARK_BUCKETS = 6;      // accuracy sparkline buckets
export const REPORT_MAX_SURPRISES = 5;
```

- [ ] **Step 2: Failing tests** — `src/engine/__tests__/report.test.ts` (write first). Cover: `reportAccuracy` equals `sharpnessFromWindow` for the same ratios (delegation); `reportAccuracySpark` returns `buckets` values, empty buckets carry forward the previous value (never invents a dip), monotone-friendly; `topSurprises` ranks by `|actual − estimate|`, ties → larger actual then `endedAt` desc, caps at k, ignores non-completed (actualMin null); `steadiestCategory` = lowest CV of clamped ratios among categories clearing `REPORT_CATEGORY_MIN_LOGS`, null if none. Use small hand-computed fixtures.

- [ ] **Step 3: Run → fail.**

- [ ] **Step 4: Implement `src/engine/report.ts`** — pure, clock-free (caller passes events with `endedAt`). `reportAccuracy` delegates to `sharpnessFromWindow` (import from `./sharpness`). Clamp every `actual/estimate` via `clampRatio` (import from `./ratio`) before accuracy/CV. `ReportEventInput = { category; label: string | null; estimateMin; actualMin; endedAt }` (NO reclaim field). Implement the four functions + a `ReportSurprise = { categoryName: string; label: string | null; estimateMin: number; actualMin: number }` type (or import from the feature model — keep the engine's input/output minimal).

- [ ] **Step 5: Export** the functions + constants from `src/engine/index.ts`.

- [ ] **Step 6: Run → pass. Commit.**

```bash
git add src/engine/report.ts src/engine/constants.ts src/engine/index.ts src/engine/__tests__/report.test.ts
git commit -m "feat(engine): add pure report projections (accuracy, surprises, steadiest)"
```

---

### Task 3: View-model types + `useReportModel` hook

**Files:**
- Create: `src/features/report/reportModel.ts` (types), `src/features/report/useReportModel.ts` (hook), `src/features/report/__tests__/useReportModel.test.ts` (light)

**Interfaces:**
- `ReportWindow = { kind: '30d' | '90d' | 'all'; sinceMs: number | null; label: string }`.
- `ReportCategoryRow = { categoryId; categoryName; logs; typicalGuessMin; honestMin; range: HonestRange | null; multiplier }`.
- `ReportSurprise = { categoryName; label: string | null; estimateMin; actualMin }`.
- `ReportModel = { window; generatedAtMs; companionName: string | null; accuracyPct; accuracySpark: number[]; totalLogs; categoryCount; steadiestCategoryName: string | null; categories: ReportCategoryRow[]; surprises: ReportSurprise[]; sharpestNote: string | null; omittedCategoryCount }`. **NO `reclaimedMinutes`.**
- `useReportModel(windowKind)` → `{ model: ReportModel | null; status: 'ready' | 'thin' | 'loading' | 'error' }`.

- [ ] **Step 1:** Define the types in `reportModel.ts` (presentation DTOs — NOT in `domain/types.ts`).
- [ ] **Step 2:** Implement the hook: resolve window → `sinceMs` (clock allowed in UI layer); read windowed completed events (`taskEventsRepo.listRecent` filtered to the window + `status==='completed'`), `categoryStatsRepo` per-category (`n`, `mEffective`), `companionRepo.get()` for `name`; call the engine projections; per-category honest minutes via `honestNumber(typicalGuess, mEffective)` + `honestRangeFor` (range when it clears confidence); `sharpestNote` from `correlateAccuracy` (null when none); omit categories below `REPORT_CATEGORY_MIN_LOGS` into `omittedCategoryCount`. `status='thin'` when window has `< REPORT_MIN_LOGS` completed logs. Memoize.
- [ ] **Step 3:** Light test: thin window → `status:'thin'`; a seeded window → `model.accuracyPct` matches `sharpnessFromWindow`, omitted categories counted, no reclaim field present.
- [ ] **Step 4: Commit.** `git commit -m "feat(report): add report view-model + useReportModel hook"`

---

### Task 4: `reportCss.ts` + `buildReportHtml.ts` (pure, TDD)

**Files:**
- Create: `src/features/report/reportCss.ts`, `src/features/report/buildReportHtml.ts`, `src/features/report/__tests__/buildReportHtml.test.ts`

**Interfaces:**
- `buildReportCss(tokensLight): string` — CSS vars + print rules from `tokens.colors.light` (one accent = `--c-primary`, tabular-nums, the pt type scale above, US-Letter `@page` 0.6in margins).
- `buildReportHtml(model: ReportModel, css: string): string` — pure string builder.

- [ ] **Step 1: Failing tests** — `buildReportHtml.test.ts`: page title + window label present; accuracy hero present; bias table has one row per category ≥ min and headers `Category / Logs / You guess / It really takes / Bias`; surprises section present only when surprises exist, omitted entirely when empty; sharpest section omitted when `sharpestNote` null; **no reclaim/"time saved" string anywhere** (assert absence); a category label containing `<script>` is HTML-escaped; footer disclaimer present on output; `buildReportHtml` calls no `fetch` (assert `global.fetch` not invoked).

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement** both files. `reportCss.ts` emits the print CSS from the light tokens (pass `tokens.colors.light` in; do not read theme at runtime). `buildReportHtml.ts` assembles, in order: **Page 1** — title `Time report`, subline `Generated {date} · {windowLabel}`, optional `Prepared by Whenbee for {companionName}'s data` only if name set (escaped); **accuracy hero** (big `{accuracyPct}%` + definition + an inline-SVG sparkline from `accuracySpark`, no chart lib); **at-a-glance** hairline row `Tasks logged / Categories tracked / Steadiest category`; **per-category bias table** (rows sorted by multiplier desc, `×{m}` with the `×` a smaller muted suffix, `It really takes` = honest minutes, optional range caption); omitted-categories line; **Biggest surprises** (max 5, `{category}{label?} — guessed {x}m, took {y}m`); **When your estimates land closest** (only if `sharpestNote`); per-page footer `Whenbee · personal time report` + `These are personal estimates, not a clinical measure.` Escape every user string. **No reclaim section.**

- [ ] **Step 4: Run → pass. Commit.**

```bash
git add src/features/report/reportCss.ts src/features/report/buildReportHtml.ts src/features/report/__tests__/buildReportHtml.test.ts
git commit -m "feat(report): add pure report CSS + HTML builder"
```

---

### Task 5: `useReportExport` flow (TDD, mirrors runShareFlow)

**Files:** Create `src/features/report/useReportExport.ts` + test.

**Interfaces:** `runExportFlow(deps): Promise<ExportOutcome>` where `ExportOutcome = 'shared' | 'gated' | 'thin' | 'error'`. Deps injected (isPro, status, buildHtml, print, capture, openPaywall) so it's pure-testable like `runShareFlow`. Non-Pro → capture `report_export {result:'gated'}` + open paywall, never print. `thin` → no-op 'thin'. Pro+ready → `print.printAndShare(html)` → map result → capture outcome. Never throws.

- [ ] **Step 1: Failing tests** — non-Pro → 'gated' + paywall opened + print NOT called; thin → 'thin'; Pro ready + print 'shared' → 'shared'; print 'error' → 'error' (swallowed).
- [ ] **Step 2: Run → fail. Step 3: Implement. Step 4: Run → pass. Commit.**

```bash
git add src/features/report/useReportExport.ts src/features/report/__tests__/useReportExport.test.ts
git commit -m "feat(report): add guarded export flow"
```

---

### Task 6: UI — Builder modal, locked teaser, page preview, route, Settings row

**Files:**
- Create: `src/features/report/ReportBuilder.tsx`, `ReportLockedTeaser.tsx`, `ReportPagePreview.tsx`
- Create: `src/app/(modals)/report.tsx`
- Modify: `src/app/settings.tsx`, `src/app/(modals)/_layout.tsx` (register the route if needed)

UI — no unit tests; typecheck + lint + (sim pending founder). Build per spec §5 + the design constraints. Pin:
- **Builder** (`Screen` modal): header "Export a report" + close ✕; eyebrow `TIME WINDOW`; three `Chip`s `Last 30 days · Last 90 days · All time` (exactly one selected, selected `primarySoft`+`ink`); what's-included line `Includes your accuracy, how long things really take you per category, and your biggest surprises.` (NO "time you saved"); a `Card` preview rendering `ReportPagePreview` at ~0.62 scale; pinned footer (`+ insets.bottom`) primary `AppButton` `Create PDF` (the one filled indigo) → `useReportExport`; micro line `Made on your phone. Nothing leaves your device unless you share it.`
- **States:** working → button `Building your report…` + inline spinner; thin → calm not-enough-data block ("Not enough logged time here yet" + body "A report gets useful after about six finished tasks in this window. Try \"All time\", or come back after a few more." + a `Use all time` chip; `Create PDF` disabled); error → quiet inline toast `Couldn't build the report just now. Try again?`.
- **ReportPagePreview:** an in-app React render (app primitives) of page-1's shape (title, accuracy figure, sparkline, a couple bias rows) — NOT a WebView, NOT the print HTML. Calm, light.
- **Route `report.tsx`:** thin; branch `useEntitlement((s) => s.isPro)` → `<ReportBuilder/>` else `<ReportLockedTeaser/>`. Fire `report_opened {is_pro}` on mount.
- **ReportLockedTeaser:** show the real page-1 preview from the user's data with a soft legibility wash over the lower body (keep the accuracy figure legible — it's the conversion lever); heading `Take your honest numbers to your next appointment`; body `Turn what Whenbee learned about your time into a clean PDF you can hand to a coach, therapist, or doctor.`; primary `AppButton` `Unlock report export` → `router.push({ pathname: '/(modals)/paywall', params: { trigger: 'pdf_export' } })` + fire `report_paywall`; reassurance `On your phone. Nothing uploads.` No countdown, no fake scarcity.
- **Settings row** (`src/app/settings.tsx`, reuse `SettingRow`): title `Export a report`, sub `A clean PDF of your real time data to keep or share with a coach or doctor.`, `onPress` → `router.push('/(modals)/report')`. Place near the data/subscription rows.

- [ ] **Step 1:** Build the three components.
- [ ] **Step 2:** Add the route + register in `_layout`; add the Settings row.
- [ ] **Step 3:** typecheck + lint on all new/edited files.
- [ ] **Step 4: Commit.** `git commit -m "feat(report): add export modal, locked teaser, preview, settings entry"`

---

### Task 7: Analytics + `pdf_export` trigger

**Files:** Modify `src/services/analytics.ts`, `src/features/paywall/Paywall.tsx`.

- [ ] **Step 1:** Add to `AppEventProps`:

```ts
report_opened: { is_pro: boolean };
report_paywall: { trigger: 'pdf_export' };
report_export: { window: '30d' | '90d' | 'all'; category_count: number; total_logs: number; result: 'shared' | 'gated' | 'thin' | 'error' };
```

Add `| 'pdf_export'` to the `paywall_view.trigger` union. Add `'pdf_export'` to `Paywall.tsx`'s `Trigger` union + `isTrigger`.

- [ ] **Step 2:** typecheck + lint + commit.

```bash
git add src/services/analytics.ts src/features/paywall/Paywall.tsx
git commit -m "feat(analytics): add report events and pdf_export trigger"
```

---

### Task 8: Full gate + PR (do NOT merge)

- [ ] **Step 1:** `npm run lint && npm run typecheck && npm test` → all green. (`npx expo-doctor` clean for the new dep.)
- [ ] **Step 2:**

```bash
git push -u origin feat/pro-01-pdf-export
gh pr create --title "feat: PDF report export (Pro)" \
  --body "On-device clinician/coach PDF of real durations, per-category bias, biggest surprises, and when you're sharpest. Pure engine projections + pure HTML builder, guarded expo-print service (mirrors share.ts), ProGate-branched Settings→modal. NEW dep: expo-print. NO reclaim/time-saved section (reclaim removed, PR #25 / decision C). Accuracy reuses sharpnessFromWindow. Privacy: zero network, local render → OS share sheet. Spec: docs/product/specs/01-pdf-report-export.md. Plan: docs/superpowers/plans/2026-06-21-pro-01-pdf-export.md. Sim + on-device print fidelity pending (founder)."
```

Do NOT merge. Report PR URL, commits, gate output, deviations, main HEAD unchanged.

---

## Self-Review

**Spec coverage (with overrides):** guarded print service + dep ✔ (T1), pure projections reusing `sharpnessFromWindow` ✔ (T2), view-model + repo hook ✔ (T3), pure CSS+HTML builder with escaping + no-fetch assertion ✔ (T4), guarded export flow mirroring `runShareFlow` ✔ (T5), Builder/locked/preview/route/settings ✔ (T6), analytics + `pdf_export` trigger ✔ (T7). **Reclaim section dropped** (override 1) consistently — engine has no reclaim fn, model has no reclaim field, HTML test asserts its absence, copy omits "time saved". Accuracy = `sharpnessFromWindow` (override 2) in engine + hook + builder.

**Placeholder scan:** print service + engine carry full code/tests. T3–T6 give every type, the section order, exact copy strings, the design pins (pt scale, one accent, tabular-nums, light palette), and the escaping/no-fetch tests. UI references spec §5 for layout with tokens/copy pinned.

**Type consistency:** `PrintModule`/`PrintResult`/`resolvePrintModule`/`getPrint`, `ReportModel`/`ReportWindow`/`ReportCategoryRow`/`ReportSurprise` (no reclaim), `reportAccuracy`/`reportAccuracySpark`/`topSurprises`/`steadiestCategory`, `runExportFlow`/`ExportOutcome`, and the three `report_*` events are consistent T1–T7.
