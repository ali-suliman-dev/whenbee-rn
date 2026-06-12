# Whenbee MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Layer the Whenbee MVP (calibration engine → core logging loop → Honeycomb/Whenbee → Start-By planner → Patterns → Pro calendar paywall) onto the finished `rn-app-template` baseline, shipping an Expo-Go-testable iOS app whose core loop is fully on-device.

**Architecture:** Clean one-way layering — `src/engine` (pure TS calibration math, no RN/Expo imports) ← `src/db` (raw expo-sqlite repositories, single write path) ← `src/stores` (Zustand orchestrators) ← `src/features` + `src/app` (expo-router screens). Design is the Flat Tactical token system; the only hard logic is the engine, built TDD-first before any UI consumes it.

**Tech Stack:** Expo SDK 54 · RN 0.81.5 · React 19.1 · TS strict · expo-router 6 (typed routes) · gluestack-ui v3 · NativeWind 4.2 · Zustand 5 · expo-sqlite 16 (+ `expo-sqlite/kv-store` via `src/lib/kv.ts`) · react-native-svg · Reanimated 4 · react-native-purchases (Expo-Go-guarded) · PostHog · Sentry · Jest + RNTL.

---

## CRITICAL RECONCILIATION (read before any task)

The product docs (`01-FOUNDATION.md`, `05-BUILD-ROADMAP.md`) were written against **Expo SDK 56 + Drizzle ORM + react-native-mmkv**. **This build keeps the template's locked stack instead** (task HARD RULE). Apply these substitutions everywhere the docs say otherwise:

| Doc says | This build uses | Why |
|---|---|---|
| Expo SDK 56 / RN 0.85 | **SDK 54 / RN 0.81.5** (template) | locked stack, Expo-Go testable |
| Drizzle ORM + `drizzle-kit` migrations | **raw `expo-sqlite` async API** + a hand-written migration runner in `src/db/client.ts` | template ships expo-sqlite, no Drizzle |
| `react-native-mmkv` | **`src/lib/kv.ts`** (`expo-sqlite/kv-store`) | template KV; AGENTS.md forbids MMKV |
| `app/` routes | **`src/app/`** routes | template uses `src/app` |
| `src/domain/calibration/*` + `src/theme/colors.ts`,`typography.ts`… | **`src/engine/*`** (per `02-ENGINE.md`) + **`src/theme/tokens.ts`** (single file, reskinned) | follow `02-ENGINE.md` module layout; keep template's one-file token source |
| `react-native-mmkv` timer crash-resume | KV-backed timer anchor in `src/lib/kv.ts` | same behavior, template KV |

**The engine contract is `02-ENGINE.md` verbatim** — its exact function signatures, constants, and Jest tests are reproduced in Phase 1 below and are authoritative over the architecture-level sketches in `01-FOUNDATION.md` (which use slightly different signatures). When in doubt about engine math: `02-ENGINE.md` wins.

**Native-only surfaces** (WidgetKit/ActivityKit Live Activity, `@bacons/apple-targets`, real RevenueCat purchases, real calendar writes) require a dev build and a device — they are **guarded by `src/lib/isExpoGo.ts`** and **flagged for the user to smoke-test**, never blocking the Expo-Go UI.

**Whenbee invariants (enforce in every phase):** no guilt ever (amber `#EEAE4D` never red; no streaks/loss/decay); honey/sharpness is **monotonic** (only climbs); core loop is **on-device only** (no account, no network, no LLM); the honest number appears wherever a plan is made; Pro pricing is **read from RevenueCat**, never hardcoded; exactly **one Pro gate** = the Honest-Day calendar.

**Per-phase deep reads:** before each UI phase, the executing agent must read the relevant screen sections of `build-plan-final/04-DESIGN.md` (§2 screens) + `mvp/02-UX-SPEC.md` + `mvp/03-FEATURE-SPEC.md` for the exact copy, states, and microinteractions. This plan names files, signatures, gates, and design references; it does not transcribe every pixel.

**Verification gate after every phase (headless):** `npm run typecheck` clean · `npm run lint` clean · `npm test` green · `npx expo-doctor` 18/18. Plus `npx expo export --platform ios` at phase ends that touch native config. Commit per task (Conventional Commits, **no AI attribution**).

---

## File Structure

New directories layered onto the template (template's `src/components`, `src/services`, `src/providers`, `src/lib`, `src/stores`, `src/theme`, `src/app` are **reused, not rebuilt**):

```
src/
  engine/                 # ★ PURE TS — no RN/Expo imports ★  (Phase 1, TDD)
    constants.ts ratio.ts ewma.ts multiplier.ts sharpness.ts insight.ts trend.ts update.ts
    priors.ts             # CATEGORY_PRIORS day-1 table
    planner.ts            # Phase 2 — reverse Start-By backward pass + cut-one
    __tests__/*.test.ts
  domain/
    types.ts              # Tier, AdaptSpeed, LogSource, LogStatus, Category, CalibrationSummary, Insight, TrendSeries, CategoryStats, TaskEvent, Plan…
  db/
    client.ts             # expo-sqlite singleton + migration runner
    migrations.ts         # ordered SQL statements
    repositories/
      taskEventsRepo.ts  categoryStatsRepo.ts  recurringRepo.ts  contextTagRepo.ts  planRepo.ts
    __tests__/*.test.ts
  stores/
    calibrationStore.ts timerStore.ts categoriesStore.ts planStore.ts   # + template's onboardingStore, settingsStore, entitlement
  features/
    today/ timer/ reward/ retro/ add-task/ calibration/ category-detail/ planner/ patterns/ honeycomb/ whenbee/ calendar/
  components/             # add tactile Button/Card/Chip variants, HonestNumber, BottomSheet, Toast, TierTrail
  app/
    (onboarding)/ welcome.tsx categories.tsx ready.tsx        # rewrite template's 3 steps
    (tabs)/ _layout.tsx index.tsx plan.tsx whenbee.tsx patterns.tsx   # replace 4 demo tabs
    category/[category].tsx                                   # push screen
    (modals)/ timer.tsx reward.tsx retro.tsx add-task.tsx paywall.tsx
    settings.tsx                                              # header-gear push (template has it)
  services/
    calendar.ts           # Phase 4 — expo-calendar read + confirmed write (Expo-Go guarded)
    analytics.ts          # extend template's with typed Whenbee funnel events
  assets/fonts/           # Plus Jakarta Sans (5 weights) + Inter (3 weights)
```

---

# PHASE 0 — Foundations: reskin tokens, fonts, domain types, nav shell

**Goal:** Template reskinned to Flat Tactical, fonts loaded, domain types defined, the 4-tab IA + modal routes navigable, base tactile components in place. No engine, no data yet. Gate: typecheck/lint/test/doctor green; tabs + a placeholder modal navigate.

### Task 0.1: Reskin theme tokens to Flat Tactical

**Files:**
- Modify: `src/theme/tokens.ts`
- Test: `src/theme/__tests__/tokens.test.ts` (template test exists — update expectations)

- [ ] **Step 1: Update the failing token test** to assert the Flat Tactical palette is present.

```ts
// src/theme/__tests__/tokens.test.ts — add/adjust
import { tokens } from '../tokens';
it('uses the Flat Tactical warm-paper + indigo palette', () => {
  expect(tokens.colors.light.bg).toBe('#F4F1EA');        // warm paper
  expect(tokens.colors.light.primary).toBe('#6B5BE6');   // indigo workhorse
  expect(tokens.colors.light.accent).toBe('#EEAE4D');    // scarce amber
  expect(tokens.colors.light.success).toBe('#33B07C');   // grass
});
it('exposes the indigoDeep/amberDeep tactile edge colors', () => {
  expect(tokens.colors.light.primaryEdge).toBe('#463B9E');
  expect(tokens.colors.light.accentEdge).toBe('#C68A30');
});
```

- [ ] **Step 2: Run `npm test -- tokens` → FAIL.**

- [ ] **Step 3: Rewrite `src/theme/tokens.ts`** mapping `04-DESIGN.md` §1.2–§1.8 onto the template's token shape. Keep the existing keys the template's `useTheme`/components already consume (`bg, surface, text, textMuted, primary, primaryText, accent, success, danger, border`) and ADD Flat-Tactical extras (`paper, ink, inkSoft, hairline, indigoDeep→primaryEdge, indigoSoft→primaryTint, amberDeep→accentEdge, amberSoft→accentTint, amberText, grassSoft→successTint, night, nightSoft`). Set radii to the generous scale (`sm:10, md:14, card:16, lg:20, xl:22, '2xl':26, sheet:30, pill:9999`); set `shadow` to **solid offset** (radius 0, opacity 1, height 6); add `motion` durations `{press:110, reveal:600, sheet:340, bar:700, float:3800}`. Keep `fontSize`/`fontWeight` but add the type-role scale (`display, title, subtitle, heading, bodyLg, body, bodySm, caption, micro, eyebrow` + numeric `timerNumeral, honestNumberXl, bigNumber, multiplier`) — see Task 0.2 for font families. Dark mode → `night`/`nightSoft` solids.

- [ ] **Step 4: Run `npm test -- tokens` → PASS.** Run `npm run typecheck` (fix any component reading a removed key by mapping it to the new token).

- [ ] **Step 5: Commit** — `style: reskin design tokens to Flat Tactical palette`.

### Task 0.2: Load Plus Jakarta Sans + Inter fonts

**Files:**
- Create: `src/assets/fonts/` (8 `.ttf` files), `src/theme/typography.ts`
- Modify: `src/app/_layout.tsx` (font loading), `app.json` (expo-font already a plugin)

- [ ] **Step 1:** Download the 5 Plus Jakarta Sans weights (Regular/Medium/SemiBold/Bold/ExtraBold) + 3 Inter weights (Medium/SemiBold/Bold) into `src/assets/fonts/` (Google Fonts; OFL). **If network-restricted, FLAG for the user** and fall back to `System`/`Menlo` family names so the app still renders.
- [ ] **Step 2:** Create `src/theme/typography.ts` exporting the `type` object from `04-DESIGN.md` §1.3 verbatim (Jakarta faces for text roles, Inter tabular for numeric roles with `fontVariant:['tabular-nums']`).
- [ ] **Step 3:** In `src/app/_layout.tsx`, add `useFonts({...})` (the 8 faces) and hold the splash until loaded (template already gates splash — extend it).
- [ ] **Step 4:** `npm run typecheck` + `npx expo-doctor` → green/18.
- [ ] **Step 5: Commit** — `feat: load Plus Jakarta Sans + Inter font families`.

### Task 0.3: Define shared domain types

**Files:**
- Create: `src/domain/types.ts`, `src/domain/__tests__/types.test.ts` (type-level smoke)

- [ ] **Step 1:** Create `src/domain/types.ts` with the engine + data contracts the rest of the app imports:

```ts
export type Tier = 'Raw' | 'Setting' | 'Ripening' | 'Thickening' | 'Honest';
export type AdaptSpeed = 'steady' | 'balanced' | 'reactive';
export type LogSource = 'timed' | 'retro';
export type LogStatus = 'completed' | 'abandoned' | 'partial';
export type Category = string;                 // normalized category id

export interface CategoryStats { categoryId: string; n: number; logEwma: number; mEffective: number; sharpness: number; }
export interface CalibrationSummary { multiplier: number; honestMinutes: number; guessMinutes: number; basis: 'personal' | 'prior'; label: string; sampleSize: number; }
export interface Insight { categoryId: string; multiplier: number; honestForFifteen: number; headline: string; }
export interface TrendSeries { points: { loggedAt: number; multiplier: number }[]; caption: 'stabilizing' | 'steady'; }
export interface TaskEvent { id: string; category: Category; label: string | null; estimateMin: number; actualMin: number | null; status: LogStatus; source: LogSource; startedAt: number | null; endedAt: number | null; createdAt: number; }
// Plan types added in Phase 2.
```

- [ ] **Step 2:** Add a trivial test importing every type in a `const x: T = …` to lock shapes; `npm test` green.
- [ ] **Step 3: Commit** — `feat: add shared domain types`.

### Task 0.4: Replace the 4 demo tabs with Whenbee IA

**Files:**
- Modify: `src/app/(tabs)/_layout.tsx`
- Rename/replace: `(tabs)/index.tsx`(Today) ; create `plan.tsx`, `whenbee.tsx`, `patterns.tsx`; delete `explore.tsx`, `activity.tsx`, `profile.tsx`
- Keep: `src/app/settings.tsx` reached via a header gear

- [ ] **Step 1:** Read `04-DESIGN.md` §2.2 (navigation map + bottom tab structure). Rewrite `(tabs)/_layout.tsx` to four tabs **Today · Plan · Whenbee · Patterns** with the specified icons, **solid surface bar + 2px hairline top, no blur**, active=indigo / inactive=`inkSoft @0.55`, and a header **gear** button (right) that `router.push('/settings')`. Settings is **not** a tab.
- [ ] **Step 2:** Create each tab screen as a titled placeholder `<Screen>` (reuse template `Screen`/`AppText`) so navigation compiles. Delete the three demo tab files.
- [ ] **Step 3:** `npm run typecheck` + `npm run lint` (the layer-import ESLint rule must stay green) → fix imports.
- [ ] **Step 4: Commit** — `feat: replace demo tabs with Today/Plan/Whenbee/Patterns IA`.

### Task 0.5: Scaffold modal routes

**Files:**
- Modify: `src/app/(modals)/_layout.tsx`
- Create: `(modals)/timer.tsx`, `reward.tsx`, `retro.tsx`, `add-task.tsx`; keep template `paywall.tsx`; delete `example-sheet.tsx`

- [ ] **Step 1:** Per `04-DESIGN.md` §2.4, register routes with presentations: `timer`/`reward` = `fullScreenModal`, `retro`/`add-task` = `formSheet`, `paywall` = `modal`. Each new file is a placeholder screen with a close affordance.
- [ ] **Step 2:** From the Today placeholder, wire a temporary "Start" button → `router.push('/(modals)/timer')` to prove the edge; remove after Phase 1 builds the real card.
- [ ] **Step 3:** typecheck/lint green. **Commit** — `feat: scaffold timer/reward/retro/add-task modal routes`.

### Task 0.6: Tactile button + card + chip + HonestNumber primitives

**Files:**
- Modify: `src/components/AppButton.tsx` (add `indigo|amber|ghost` tactile variants), `src/components/Card.tsx` (border vs offset raised), `src/components/Chip.tsx` (selected/add)
- Create: `src/components/HonestNumber.tsx`, `src/components/Toast.tsx`, `src/components/TierTrail.tsx`
- Test: `src/components/__tests__/AppButton.test.tsx` (extend)

- [ ] **Step 1:** Read `04-DESIGN.md` §1.6–§1.10. Write a failing RNTL test asserting `AppButton variant="amber"` renders its label and fires `onPress`.
- [ ] **Step 2:** Implement the tactile pill (Reanimated `translateY 0→5` press + edge View `height 6→1`, durations from tokens.motion; reduce-motion → instant) for the three variants; `Card` raised→offset shadow / default→2px border (never both); `Chip` selected=indigoSoft+indigo border; `HonestNumber` (Inter tabular, sizes inline/big/xl, tone ink/indigo/amber). `Toast` = night pill. `TierTrail` = done/now/lock nodes (color **+** icon).
- [ ] **Step 3:** Tests + typecheck + lint green. **Commit** — `feat: add tactile Button/Card/Chip + HonestNumber/Toast/TierTrail primitives`.

**PHASE 0 GATE:** typecheck/lint/test/doctor green; `npx expo export --platform ios` builds; tabs + a placeholder modal navigate. Commit + push.

---

# PHASE 1 — Core loop: the engine (TDD) + data + the ≤2-tap log

**Goal:** guess → time → log in ≤2 taps, offline, persisted across cold start, with the honest number at the decision moment and no guilt. **Build the engine first, fully tested, before any UI consumes it.**

## 1A. The calibration engine (pure TS, TDD) — `02-ENGINE.md` verbatim

> Each function below is reproduced from `02-ENGINE.md`. Build in this order; every file gets its tests green before the next. No RN/Expo/`Date.now()` inside `src/engine`.

### Task 1.1: Engine constants + priors

**Files:** Create `src/engine/constants.ts`, `src/engine/priors.ts`, `src/engine/__tests__/constants.test.ts`

- [ ] **Step 1:** Write `src/engine/constants.ts` exactly as `02-ENGINE.md` §1 (RATIO_FLOOR 1/6, RATIO_CEIL 6, BLEND_PSEUDO_COUNT 4, GLOBAL_PRIOR 1.8, RECURRING_MIN_LOGS 3, PERSONAL_MIN_LOGS 3, ALPHA_BY_SPEED {steady .18, balanced .3, reactive .45}, RETRO_ALPHA_FACTOR .5, SHARPNESS_WINDOW 8, TIERS, TIER_THRESHOLDS [0,40,64,82,93], SHARPNESS_PER_LOG 4, INSIGHT_MIN_LOGS 5, INSIGHT_MIN_GAP 0.4, INSIGHT_VARIANCE_HALF 4, TREND_STABILIZING_DROP 0.2).
- [ ] **Step 2:** Write `src/engine/priors.ts` — `CATEGORY_PRIORS: Record<string, number>` for the canonical onboarding categories (getting-ready, cleaning, admin-email, errands, cooking, out-the-door) seeded from `03-FEATURE-SPEC.md`/`01-FOUNDATION.md`; `priorFor(category) → CATEGORY_PRIORS[category] ?? GLOBAL_PRIOR`. **Read `01-FOUNDATION.md` §3 / `03-FEATURE-SPEC.md` for the exact prior values before writing.**
- [ ] **Step 3:** Test: thresholds length 5, `priorFor('unknown') === 1.8`, every canonical category has a prior in (1, 6]. `npm test` green.
- [ ] **Step 4: Commit** — `feat(engine): calibration constants + day-1 category priors`.

### Task 1.2: ratio.ts — clampRatio

**Files:** Create `src/engine/ratio.ts`, `src/engine/__tests__/ratio.test.ts`

- [ ] **Step 1:** Write the failing tests from `02-ENGINE.md` §8 `describe('clampRatio')` (10→600 ⇒ 6; 60→5 ⇒ ≈1/6; 15→30 ⇒ 2) + an estimate≤0 throws case.
- [ ] **Step 2:** `npm test -- ratio` → FAIL.
- [ ] **Step 3:** Implement `clampRatio` exactly as §2.1.
- [ ] **Step 4:** `npm test -- ratio` → PASS.
- [ ] **Step 5: Commit** — `feat(engine): clampRatio with disaster clamp [1/6, 6]`.

### Task 1.3: ewma.ts — alphaFor + updateEwma

**Files:** Create `src/engine/ewma.ts`, `src/engine/__tests__/ewma.test.ts`

- [ ] **Step 1:** Failing tests from §8 `describe('updateEwma + alphaFor')` (seed at α·ln(r); retro halves α to 0.15).
- [ ] **Step 2:** FAIL. **Step 3:** Implement §2.2 (`alphaFor`, `updateEwma`). **Step 4:** PASS.
- [ ] **Step 5: Commit** — `feat(engine): EWMA of log-ratios with retro half-alpha`.

### Task 1.4: multiplier.ts — blend, honestNumber, resolveSuggestion

**Files:** Create `src/engine/multiplier.ts`, `src/engine/__tests__/multiplier.test.ts`

- [ ] **Step 1:** Failing tests from §8 `describe('blendWithPrior')`, `describe('honestNumber')`, `describe('resolveSuggestion fallback')` (n=0⇒prior; n=8 ln2.5 prior2 ⇒≈2.3205; 15×1.9⇒30; never <5; recurring fallback < 3 logs uses category; ≥3 uses recurring; cold category labelled "typical patterns").
- [ ] **Step 2:** FAIL. **Step 3:** Implement §2.3 (`blendWithPrior`, `honestNumber`, `recurringHasEnoughData`, `resolveSuggestion`). **Step 4:** PASS.
- [ ] **Step 5: Commit** — `feat(engine): Bayesian blend, honest number, recurring fallback`.

### Task 1.5: sharpness.ts — sharpnessFromWindow, tierFor, logsToNextTier

**Files:** Create `src/engine/sharpness.ts`, `src/engine/__tests__/sharpness.test.ts`

- [ ] **Step 1:** Failing tests from §8 `describe('sharpness + tiers')` (perfect window 100; tierFor 0→Raw,63→Setting,64→Ripening,93→Honest; logsToNextTier 78→1, 95→0).
- [ ] **Step 2:** FAIL. **Step 3:** Implement §4. **Step 4:** PASS.
- [ ] **Step 5: Commit** — `feat(engine): sharpness %, tiers, logs-to-next`.

### Task 1.6: insight.ts — detectInsight

**Files:** Create `src/engine/insight.ts`, `src/engine/__tests__/insight.test.ts`

- [ ] **Step 1:** Failing tests from §8 `describe('detectInsight')` (fires on the settling array, headline `~29m vs your 15m guess · runs 1.9×`; null when |M−1|<0.4).
- [ ] **Step 2:** FAIL. **Step 3:** Implement §5 (`variance`, `isStabilizing`, `detectInsight`). **Step 4:** PASS.
- [ ] **Step 5: Commit** — `feat(engine): aha/insight detector (n≥5 ∧ |M−1|≥0.4 ∧ var↓)`.

### Task 1.7: trend.ts — buildTrendSeries

**Files:** Create `src/engine/trend.ts`, `src/engine/__tests__/trend.test.ts`

- [ ] **Step 1:** Failing test from §8 `describe('buildTrendSeries')` (6 settling steps ⇒ 6 points, caption `stabilizing`).
- [ ] **Step 2:** FAIL. **Step 3:** Implement §6. **Step 4:** PASS.
- [ ] **Step 5: Commit** — `feat(engine): rolling-M trend series + stabilizing caption`.

### Task 1.8: update.ts — applyLog orchestrator

**Files:** Create `src/engine/update.ts`, `src/engine/index.ts` (barrel), `src/engine/__tests__/update.test.ts`

- [ ] **Step 1:** Failing tests from §8 `describe('applyLog monotonic sharpness')` (bad log holds stored 90, n→9; abandoned ⇒ counted:false) plus a recurring-path assertion.
- [ ] **Step 2:** FAIL. **Step 3:** Implement §3 `applyLog` exactly (steps 1–7, do not reorder; monotonic `Math.max`). Add `src/engine/index.ts` re-exporting the public API.
- [ ] **Step 4:** PASS. Run the **full** `npm test` — entire engine suite green.
- [ ] **Step 5: Commit** — `feat(engine): applyLog single mutation point, monotonic + abandoned-excluded`.

## 1B. Data layer (raw expo-sqlite) + stores

### Task 1.9: SQLite client + migration runner

**Files:** Create `src/db/client.ts`, `src/db/migrations.ts`, `src/db/__tests__/migrations.test.ts`

- [ ] **Step 1:** `migrations.ts` exports an ordered `MIGRATIONS: string[]` creating `task_events` and `category_stats` (+ `recurring_stats`, `log_tags`, `active_plan` placeholders) per `01-FOUNDATION.md` §2.6 schema (translated to `CREATE TABLE` SQL; `category_stats` PK = category, columns `ewma_logr REAL DEFAULT 0, n INTEGER DEFAULT 0, prior_mult REAL, sharpness REAL DEFAULT 0, updated_at INTEGER`).
- [ ] **Step 2:** `client.ts` opens `openDatabaseAsync('whenbee.db')` (expo-sqlite async), runs a `user_version`-tracked migration loop applying any unapplied `MIGRATIONS`. Provide a `getDb()` singleton + a `__resetForTests()` using an in-memory db.
- [ ] **Step 3:** Test the migration runner against `:memory:` (tables exist, runs idempotently). `npm test` green.
- [ ] **Step 4: Commit** — `feat(db): expo-sqlite client + versioned migration runner`.

### Task 1.10: Repositories (single write path)

**Files:** Create `src/db/repositories/{taskEventsRepo,categoryStatsRepo,recurringRepo}.ts` + tests

- [ ] **Step 1:** Failing repo tests (against `:memory:`): `categoryStatsRepo.get(unknown)` returns a prior-seeded `n:0` row; `insert`+`get` round-trips a `task_events` row; `categoryStatsRepo.upsert` is O(1) (one row in/out).
- [ ] **Step 2:** FAIL. **Step 3:** Implement repos returning plain DTOs (no engine math inside — repos persist what the store's `applyLog` computed; `categoryStatsRepo.get` seeds from `priorFor` on cold start). `recurringRepo` keyed by `normalizeTitle` hash.
- [ ] **Step 4:** PASS. **Commit** — `feat(db): taskEvents/categoryStats/recurring repositories`.

### Task 1.11: calibrationStore + timerStore

**Files:** Create `src/stores/calibrationStore.ts`, `src/stores/timerStore.ts`, `src/stores/categoriesStore.ts` + tests

- [ ] **Step 1:** Failing test: `calibrationStore.applyLog(input)` inserts an event, reads the prev stat, calls engine `applyLog`, upserts, patches the cache (sharpness monotonic), and returns `{ multiplier, sharpness, tierBefore, tierAfter, leveledUp }`. (Mock haptics/analytics services.)
- [ ] **Step 2:** FAIL. **Step 3:** Implement the orchestrator per `01-FOUNDATION.md` §2.5 (adapted: engine `applyLog` + repos + `src/lib/kv.ts` for the timer crash-resume anchor in `timerStore`; services fire-and-forget). `categoriesStore` seeds tracked categories from onboarding selection.
- [ ] **Step 4:** PASS + typecheck (ESLint layer rule: only stores touch domain+db+services). **Commit** — `feat(stores): calibration orchestrator + timer + categories stores`.

## 1C. Core-loop UI

### Task 1.12: Onboarding rewrite (3 steps, time-optimist)

**Files:** Modify `src/app/(onboarding)/{welcome,categories,ready}.tsx` (rename template's highlights→categories), `src/features/onboarding/*`, `src/stores/onboardingStore.ts`

- [ ] **Step 1:** Read `04-DESIGN.md` §2.3 (+§3 mastery preview) + `mvp/02-UX-SPEC.md`. Rebuild the 3 steps with exact copy: step 0 "You're not lazy. You're a time optimist." + privacy chip; step 1 multi-select category grid (3–5, `+ New` custom, gently gate ≥1); step 2 "One tap to start. One tap to ripen." + mastery preview (Raw→Honest). CTA chain Get started → Continue → Open my day → `router.replace('/(tabs)')`.
- [ ] **Step 2:** On finish, write `hasOnboarded=true` (kv) + seed `categoriesStore` + `category_stats` rows from picks. Test the store transition (RNTL + store test).
- [ ] **Step 3:** typecheck/lint/test green. **Commit** — `feat(onboarding): time-optimist 3-step flow + category seeding`.

### Task 1.13: Today screen (focus card + honest number)

**Files:** Create `src/features/today/{FocusCard,OptimismNudge,HoneycombStripPlaceholder}.tsx`, `src/features/today/useToday.ts`; modify `src/app/(tabs)/index.tsx`

- [ ] **Step 1:** Read `04-DESIGN.md` §2.4. Build Today: brand row + date, honeycomb-strip placeholder (real wiring Phase 3), focus card (NEXT tag · task title · `HonestNumber ~28 min` + "you guessed 15" · provenance "based on your last N times"/"typical patterns" from `resolveSuggestion` · optimism nudge amberSoft pill, suppressed when basis=prior · `Start →`), lead line, log chip → retro, FAB → add-task. Empty/quiet state: calm copy, never a scold.
- [ ] **Step 2:** `useToday` reads the next tracked task + `resolveSuggestion` (via calibrationStore-cached M). Start → `/(modals)/timer` with task params.
- [ ] **Step 3:** RNTL: renders honest number + provenance; nudge hidden on prior basis. typecheck/lint/test green. **Commit** — `feat(today): focus card with honest number + provenance + optimism nudge`.

### Task 1.14: Live Timer (ring + finish-time + pace) — Reanimated

**Files:** Create `src/features/timer/{TimerRing,PaceLabel,FinishTime}.tsx`, `src/features/timer/useTimer.ts`; modify `src/app/(modals)/timer.tsx`

- [ ] **Step 1:** Read `04-DESIGN.md` §2.5 + `03-FEATURE-SPEC.md` (finish-time amendment). Build the ring from a `useSharedValue` anchor (elapsed = now − startedAt on the UI thread, **not** JS setInterval driving layout): indigo ring fills toward estimate, flips **amber** on overrun; orbiting pace dot; single amber milestone ripple at the guess; center tabular numeral; `Started 9:14` + `Done ~9:42` finish-time, re-projects amber on overrun; dual readout w/ `timeDisplayMode` pref (default both). Pace line copy (under/approaching/over — amber never red). Pause/resume counts **active time only**. Cancel/✕ → confirm → abandoned (excluded). Reduce-motion → static ring, numbers still update.
- [ ] **Step 2:** Stop & log → `timerStore.stop()` returns actualMin → `calibrationStore.applyLog` → `router.replace('/(modals)/reward')`.
- [ ] **Step 3:** Test `useTimer` elapsed/finish-time math (pure helpers in `src/lib/time.ts`, unit-tested); RNTL smoke that Stop calls applyLog. typecheck/lint/test green. **Commit** — `feat(timer): finish-time ring, amber over-state, active-time pause, stop-&-log`.

### Task 1.15: Reward + Retro + Add-Task

**Files:** Create `src/features/reward/*`, `src/features/retro/*`, `src/features/add-task/*`; modify the matching `(modals)/*.tsx`

- [ ] **Step 1:** Read `04-DESIGN.md` §2.6 (Reward) + retro/add-task sections + UX spec. Reward: variable headline, `{actual} min` + "you guessed {guess}", honey row + animated cell-fill bar (placeholder honey until Phase 3 wires real sharpness — use `applyLog` result), ritual line "no streak to break", `See my Whenbee` / `Back to today`. Retro sheet (down-weighted `source:'retro'`) → Save & ripen → reward. Add-task sheet: title + category + rough-time chips + honest suggestion; `Add & start timer` → timer, `Add to today` → toast.
- [ ] **Step 2:** Wire the full edge graph (`04-DESIGN.md` §2.2 KEY EDGES). RNTL: retro log produces `counted` event with `source:'retro'`; reward shows actual+guess.
- [ ] **Step 3:** typecheck/lint/test green. **Commit** — `feat(loop): reward payoff + retro entry + add-task sheet — full ≤2-tap loop`.

**PHASE 1 GATE:** ≤2-tap offline loop persists across cold start (verify the migration + repo round-trip in a store test simulating relaunch); engine 100% covered (`npm test -- --coverage src/engine` ~100%); priors give day-1 value; retro weighted less; no red anywhere. typecheck/lint/test/doctor green; `expo export` builds. **FLAG the user to dogfood 3–5 days on device.** Commit + push; consider tag after Phase 3 when the loop is felt end-to-end.

---

# PHASE 2 — Calibration surfaced + Start-By planner

**Goal:** make the learning visible/trustworthy; ship the reverse planner differentiator (free).

### Task 2.1: Category Detail / Tune screen
**Files:** Create `src/features/category-detail/{HonestCard,AhaCard,AdaptSegment,TrendChart,RecentList}.tsx`, `useCategoryDetail.ts`; create `src/app/category/[category].tsx`.
- [ ] Read `04-DESIGN.md` §2 (category-detail/catdetail) + `03-FEATURE-SPEC.md`. Build: honest-number card, **aha card for ALL categories (free)** from `detectInsight`, Steady/Balanced/Reactive segmented control (writes per-category `adapt_speed`, maps to α only), `TrendChart` (react-native-svg plotting `buildTrendSeries().points`, caption), recent est-vs-actual list (`taskEventsRepo.listByCategory`), per-category reset. Wire Whenbee-hub blind-spot/category rows → this screen.
- [ ] TDD the read hooks via store/engine; RNTL renders aha headline on seeded data. Gate: aha fires on seeded realistic data. **Commit** — `feat(calibration): category detail — honest card, free aha, tune, trend, recent`.

### Task 2.2: planner.ts (pure engine, TDD)
**Files:** Create `src/engine/planner.ts`, `src/engine/__tests__/planner.test.ts`; add Plan types to `src/domain/types.ts`.
- [ ] Read `03-FEATURE-SPEC.md` (reverse day planner). TDD a pure backward pass: `planBackward({ deadline, tasks: {label, category, durationMin}[], buffer })` → `{ startBy, timeline: {label, startAt, endAt}[], verdict }`; deterministic **cut-one** feasibility (`fits` | single-cut | multi-cut | push-deadline | safe-trims), amber/kind. Durations pre-filled from learned M (caller supplies). Exhaustive tests: exact-fit, overflow→cut-one, multi-overflow→push, buffer chips (Off/+5/+10/+20). **Commit** — `feat(engine): reverse Start-By backward pass + cut-one verdict`.

### Task 2.3: Plan screen + persistence
**Files:** Create `src/features/planner/*`, `src/stores/planStore.ts`, `src/db/repositories/planRepo.ts`; modify `src/app/(tabs)/plan.tsx`.
- [ ] Build Plan UI: deadline + ordered list → headline `Start by 7:05 to finish by 8:00` + per-task timeline + buffer chips + cut-one verdict. Persist one `active_plan` (planRepo); one-tap re-project **shows diff + confirms** (never silently reshuffles). Timer day-status line reads the active plan (wire the amendment from Task 1.14). Plan tab is free in this MVP cut (no paywall here — the single gate is the calendar). 
- [ ] Test planStore re-projection diff; RNTL headline. Gate: backward plan + cut-one compute correctly. **Commit** — `feat(plan): Start-By screen, persisted active plan, confirm-on-reproject`.

**PHASE 2 GATE:** aha card fires on seeded data; trend/labels rule-correct; backward plan + cut-one correct. typecheck/lint/test/doctor green. Push.

---

# PHASE 3 — Honeycomb + Whenbee + native presence + retention instrumentation

**Goal:** turn each log into felt, loss-proof reward; instrument retention (the spine gate).

### Task 3.1: Honeycomb SVG (sharpness-driven, monotonic)
**Files:** Create `src/components/honeycomb/{Honeycomb,HoneycombStrip}.tsx` + tests.
- [ ] Read `04-DESIGN.md` §1.9. Animated react-native-svg packed hex cells; each cell amber **cell-fill** to its `sharpness%` (Reanimated, easing.out 700ms); flat hex outline for "not yet ripe" (never blur); wax cap at ≥93. 3 sizes. `accessibilityLabel="Cleaning cell — 78% honey, tier Ripening"`. Reduce-motion → fade, no spin. Wire the real strip into Today (replace Phase-1 placeholder). **Commit** — `feat(honeycomb): sharpness-driven hex cell-fill + wax cap, a11y labels`.

### Task 3.2: Whenbee hub + companion avatar
**Files:** Create `src/features/whenbee/{WhenbeeHub,WhenbeeAvatar,BlindSpotCard}.tsx`, `src/features/calibration/CategoryRow.tsx`; modify `src/app/(tabs)/whenbee.tsx`.
- [ ] Read `05b-HONEY-SYSTEM.md` + `05-RETENTION.md` + `04-DESIGN.md` §1.9. Build: Whenbee avatar (5-stage 1:1 with tiers + Keeper prestige, **default seed ships, no setup wall**, monotonic, identity-amber stripes), honeycomb hero, tier trail, biggest blind-spot card, "Make my whole day honest" CTA → paywall trigger (Phase 4). Optional one-word rename after first ripen. **Commit** — `feat(whenbee): companion hub — avatar, tier trail, blind-spot, day-honest CTA`.

### Task 3.3: Reward choreography + reason capture
**Files:** Modify `src/features/reward/*`; create `src/db/repositories/contextTagRepo.ts`.
- [ ] Full reward choreography (nectar float, count-up, honey bar to real sharpness, conditional **bloom** on cap/seal ≥93, ritual line, off-ramps; reduce-motion fade). **Reason capture (A14/A15):** optional over/under reason chip row (threshold-gated, symmetric, never-blocking, pause/late-start pre-fill) → `contextTagRepo.setReason` with `key:'reason'`+`source`. **Reason never touches multiplier/honey.** **Commit** — `feat(reward): full choreography + capture-only over/under reason chips`.

### Task 3.4: PostHog funnel + D7 retention
**Files:** Modify `src/services/analytics.ts`; add event calls across the loop.
- [ ] Read `06-RELEASE-AND-METRICS.md`. Type + emit the funnel `app_open → onboarding_complete → first_log → aha_shown → … → paywall_view` + `overrun_reason_shown/tagged/skipped` + `task_logged`/`cell_capped`. Define the **D7 retention** insight (PostHog). Verify events fire (analytics test asserts capture calls; never throws). **Commit** — `feat(analytics): typed Whenbee funnel + reason events + D7 retention`.

### Task 3.5: Native presence (FLAGGED)
**Files:** Config-only; `src/lib/isExpoGo.ts` guards.
- [ ] Static Home-screen widget + Live Activity / Dynamic-Island finish-time ring via `@bacons/apple-targets` reading an App Group, **all guarded by `isExpoGo`**. This needs a dev build + device → **scaffold the guard + config and FLAG the user to build/test on device**; do not block Expo Go. **Commit** — `chore(native): scaffold widget/Live-Activity targets behind Expo-Go guard (device smoke-test flagged)`.

**PHASE 3 HARD GATE:** D7 instrumented + funnel records first-log + aha (verify in tests/dogfood). typecheck/lint/test/doctor green; `expo export` builds. **Tag `v0.1.0` when the loop is end-to-end felt.** Push.

---

# PHASE 4 — Pro: Honest-Day calendar + paywall (the single gate)

**Goal:** ship the one reason to pay, gated, triggered at the CTA — never at install.

### Task 4.1: RevenueCat offerings + paywall (prices from store)
**Files:** Modify `src/services/purchases.ts`, `src/features/paywall/*`, `src/app/(modals)/paywall.tsx`; reuse template `ProGate`/`useEntitlement`.
- [ ] Read `06-MONETIZATION.md` + `mvp/06`. Paywall: before/after honest-day hero, 4 benefits, social proof, plan picker (Yearly hero / Lifetime / Monthly), 7-day trial, restore, manage — **prices from RevenueCat offerings, never hardcoded**. Guarded by `isExpoGo` (Expo Go → mock entitlement for UI). Trigger only from Whenbee CTA + Settings upgrade. **Commit** — `feat(paywall): RevenueCat-driven paywall, store prices, trial/restore`.

### Task 4.2: Honest-Day calendar (the Pro feature) behind ProGate
**Files:** Create `src/services/calendar.ts`, `src/features/calendar/*`; gate with `<ProGate>`.
- [ ] expo-calendar read → map events to categories → inflate each block by effective M → **before/after preview** ("planned crashes 5pm" vs "honest ends 7:10pm") → **write ONLY on explicit confirm**; realistic-day-capacity warning ("won't fit — cut one"). Guarded by `isExpoGo`; **flag device smoke-test** for real calendar writes. `purchase`/`trial_start`/`paywall_view` events. **Commit** — `feat(pro): Honest-Day calendar padding with confirmed-write-only`.

**PHASE 4 GATE:** sandbox purchase/trial/restore (FLAG device); calendar before/after with no un-consented writes; one Pro gate only. typecheck/lint/test/doctor green. Push.

---

# PHASE 5 — Patterns (lean, free) + polish

**Goal:** ship the free self-insight surface; make it kind, fast, accessible.

### Task 5.1: Patterns tab
**Files:** Create `src/features/patterns/*`; modify `src/app/(tabs)/patterns.tsx`.
- [ ] Read `03-FEATURE-SPEC.md` (Patterns S1/S2/S5/S6/S7/S9/S10) + `05-RETENTION.md`. Build: archetype (S1), with-vs-without-plan experiment (S2, honest verdict), you-vs-past (S5), biggest surprise (S6), prediction cards on Today/Timer (S7), drift alert (S9), calibration map (S10). Min-sample gates; dismissible; no-jargon, no-guilt copy. Correlations/tags deferred. **Commit** — `feat(patterns): lean free self-insight surface`.

### Task 5.2: Accessibility + performance + copy audit
- [ ] Reduce-motion equivalents, Dynamic Type (no clipping), 44pt targets, VoiceOver completes the loop, AA contrast; empty/error states everywhere; 60fps ring, FlashList where lists exist, cold start <2s. **Copy audit** against the no-guilt system; grep/lint for banned mechanics (streaks/red/loss). **Commit** — `chore(a11y): reduce-motion, Dynamic Type, VoiceOver, contrast + no-guilt copy audit`.

**PHASE 5 GATE:** VoiceOver loop; reduce-motion parity; Dynamic Type no clipping; 60fps; every empty/error path; no-guilt audit passes; ESLint + tests green. Push.

---

# PHASE 6 — Beta + launch (mostly FLAGGED — device/store/external)

**Goal:** real ADHD hands; validate metrics; ship.

### Task 6.1: Feedback board (Supabase, separate data class)
- [ ] `feature_requests`/`feature_votes` + RLS in Supabase; Settings entry; anonymous-default, optional email. Never task/calibration data. (Network feature — keep off the core-loop path.) **Commit** — `feat(feedback): anonymous feature-request board (Supabase, RLS)`.

### Task 6.2: Release prep — FLAG for user
- [ ] EAS preview → TestFlight, QA across iOS, Dynamic Island on hardware, App Store assets + privacy labels, App Review prep, `eas submit`, Product Hunt/Reddit. **These require Apple Developer account + device + store access → FLAG all for the user; the agent prepares assets/config only.**

**VALIDATION GATE (the real one):** D7 retention ≥ 25% on real users. If weak, fix friction/guilt before any new feature.

---

## Self-review notes
- **Spec coverage:** every "IN" item from `00-MVP-DEFINITION.md` §3 maps to a task — core loop (1.13–1.15), calibration surfaced (2.1), finish-time (1.14), Honeycomb+Whenbee (3.1–3.2), Start-By (2.2–2.3), Patterns (5.1), Pro calendar (4.2), native presence (3.5), reason capture (3.3), funnel/D7 (3.4). "OUT" items (Pro correlations, breathers, watch, LLM) are excluded.
- **Engine consistency:** all engine signatures/tests are copied from `02-ENGINE.md` §8 (the canonical contract), not the `01-FOUNDATION.md` sketch — names (`updateEwma(prevEwma, clampedRatio, alpha)`, `blendWithPrior`, `resolveSuggestion`, `applyLog`) match across Tasks 1.1–1.8 and their consumers.
- **Stack:** every task respects the SDK-54/expo-sqlite/kv/Zustand reconciliation; no Drizzle/MMKV/SDK-56.
- **Invariants:** monotonic sharpness (1.5/1.8/3.1), amber-never-red (0.6/1.14/3.3/5.2), one Pro gate (4.1/4.2), prices-from-RC (4.1), on-device loop (1.9–1.15) are each pinned to tasks.
```
