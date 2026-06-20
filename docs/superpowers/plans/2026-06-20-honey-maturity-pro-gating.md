# Honey-as-Maturity + Pro-Readiness Logic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redefine the honey/sharpness signal so every counted log produces visible forward progress (never a dead 0%, never an instant seal), and add a pure Pro-readiness selector that gates Pro *presentation and pitch timing* off calibration maturity.

**Architecture:** A new pure engine module computes honey as an effort-floor (rises per log, caps at the Thickening threshold) plus an accuracy term weighted by a trust factor that grows with sample size; `applyLog` consumes it in place of the raw accuracy call, keeping the monotonic `max(prev, …)` guard. A second pure module derives Pro readiness from honey + confidence + log count. The store latches `pitchUnlocked` once true so it never re-locks. No RevenueCat entitlement logic changes — the selector only informs the UI.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`), pure engine modules under `src/engine/`, Zustand store, Jest.

## Global Constraints

- Engine is PURE TS — no React, RN, Expo, or `Date.now()` in `src/engine/**`. (one line each verbatim from project rules)
- Honey/sharpness is monotonic — tier never goes backward.
- No guilt, ever — amber never becomes red; no streaks, no shame mechanics.
- Core loop is on-device-only — no network call in guess → timer → learn.
- Pricing is read from RevenueCat, never hardcoded; this work gates presentation only, never entitlement.
- Tune behavior via `src/engine/constants.ts`, not scattered magic numbers.
- `src/app/**` and `src/components/**` must not import `@/src/services/*` or `@/src/db/*` directly — route through a store/provider/feature hook.
- Lint must pass with 0 warnings: `npm run lint`. Typecheck: `npm run typecheck`. Tests: `npx jest <path>`.
- Conventional Commits. NEVER add Co-Authored-By or any AI attribution trailer.

---

## File Structure

- `src/engine/constants.ts` (modify) — add honey-maturity + seal-gate constants.
- `src/engine/honeyMaturity.ts` (create) — `effortFloor(n)` + `honeyMaturity(...)`, pure.
- `src/engine/__tests__/honeyMaturity.test.ts` (create) — unit tests.
- `src/engine/update.ts` (modify) — swap the accuracy call for the maturity combine; compute seal-eligibility via `confidenceFor`.
- `src/engine/__tests__/update.test.ts` (modify/extend) — first-log + monotonic + seal-gate behavior through `applyLog`.
- `src/engine/index.ts` (modify) — export the new module.
- `src/engine/proReadiness.ts` (create) — `proReadiness(...)` pure selector + `ProFeatureId`.
- `src/engine/__tests__/proReadiness.test.ts` (create) — selector tests.
- `src/stores/calibrationStore.ts` (modify) — expose `proReadiness` view with a latched `pitchUnlocked` kv flag.

---

### Task 1: Honey-maturity constants

**Files:**
- Modify: `src/engine/constants.ts`

**Interfaces:**
- Produces: `HONEY_FLOOR_CAP: number`, `HONEY_FLOOR_K: number`, `HONEY_TRUST_K: number`, `HONEY_SEAL_GATE: number`.

- [ ] **Step 1: Add the constants**

Add to `src/engine/constants.ts` (after the `SHARPNESS_PER_LOG` line in the sharpness block):

```ts
// ── Honey as calibration maturity (replaces pure-accuracy sharpness) ─────────
/** Effort-floor asymptote — pure showing-up tops out at Thickening, never seals.
 *  Equals TIER_THRESHOLDS[3] (Thickening) on purpose. */
export const HONEY_FLOOR_CAP = 82;
/** Effort-floor curvature: floor(n) = HONEY_FLOOR_CAP · n/(n+HONEY_FLOOR_K).
 *  K=2 → floor(1)≈27, floor(2)≈41, floor(3)≈49, approaching 82. */
export const HONEY_FLOOR_K = 2;
/** Trust weight on the accuracy term: t(n) = n/(n+HONEY_TRUST_K). Small early so
 *  one lucky guess can't seal; →1 as data accumulates. Mirrors GLOBAL_PRIOR_K. */
export const HONEY_TRUST_K = 6;
/** Honey cannot reach this (the Honest threshold) unless the seal is EARNED
 *  (high accuracy AND confidence==='honest'). Equals TIER_THRESHOLDS[4]. */
export const HONEY_SEAL_GATE = 93;
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no usages yet, just new exports).

- [ ] **Step 3: Commit**

```bash
git add src/engine/constants.ts
git commit -m "feat(engine): add honey-maturity constants"
```

---

### Task 2: `effortFloor` + `honeyMaturity` pure functions

**Files:**
- Create: `src/engine/honeyMaturity.ts`
- Test: `src/engine/__tests__/honeyMaturity.test.ts`

**Interfaces:**
- Consumes: `HONEY_FLOOR_CAP`, `HONEY_FLOOR_K`, `HONEY_TRUST_K`, `HONEY_SEAL_GATE` from `./constants`.
- Produces:
  - `effortFloor(n: number): number`
  - `honeyMaturity(input: { n: number; accuracy: number; prevHoney: number; sealEligible: boolean }): number`

- [ ] **Step 1: Write the failing test**

Create `src/engine/__tests__/honeyMaturity.test.ts`:

```ts
import { effortFloor, honeyMaturity } from '../honeyMaturity';
import { HONEY_FLOOR_CAP, HONEY_SEAL_GATE } from '../constants';

describe('effortFloor', () => {
  it('is positive on the first log (no dead 0%)', () => {
    expect(effortFloor(1)).toBeGreaterThan(20);
  });
  it('strictly increases with n', () => {
    for (let n = 1; n < 30; n++) {
      expect(effortFloor(n + 1)).toBeGreaterThan(effortFloor(n));
    }
  });
  it('never reaches the cap (caps below Thickening asymptotically)', () => {
    expect(effortFloor(1000)).toBeLessThan(HONEY_FLOOR_CAP);
    expect(effortFloor(1000)).toBeGreaterThan(HONEY_FLOOR_CAP - 1);
  });
});

describe('honeyMaturity', () => {
  it('a perfect first guess does NOT seal (accuracy gated by low trust)', () => {
    const honey = honeyMaturity({ n: 1, accuracy: 100, prevHoney: 0, sealEligible: false });
    expect(honey).toBeGreaterThan(0);
    expect(honey).toBeLessThan(50);
  });
  it('never returns 0 for a counted log', () => {
    const honey = honeyMaturity({ n: 1, accuracy: 0, prevHoney: 0, sealEligible: false });
    expect(honey).toBeGreaterThan(0);
  });
  it('is monotonic — never drops below prevHoney', () => {
    const honey = honeyMaturity({ n: 5, accuracy: 0, prevHoney: 60, sealEligible: false });
    expect(honey).toBe(60);
  });
  it('cannot reach the seal gate when not seal-eligible', () => {
    const honey = honeyMaturity({ n: 100, accuracy: 100, prevHoney: 0, sealEligible: false });
    expect(honey).toBeLessThan(HONEY_SEAL_GATE);
  });
  it('can reach the seal gate only with high accuracy + eligibility + enough data', () => {
    const honey = honeyMaturity({ n: 25, accuracy: 100, prevHoney: 0, sealEligible: true });
    expect(honey).toBeGreaterThanOrEqual(HONEY_SEAL_GATE);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/engine/__tests__/honeyMaturity.test.ts`
Expected: FAIL — "Cannot find module '../honeyMaturity'".

- [ ] **Step 3: Write minimal implementation**

Create `src/engine/honeyMaturity.ts`:

```ts
import { HONEY_FLOOR_CAP, HONEY_FLOOR_K, HONEY_TRUST_K, HONEY_SEAL_GATE } from './constants';

/**
 * Effort floor — the guaranteed honey from showing up. Concave and strictly
 * increasing in n, asymptotically approaching HONEY_FLOOR_CAP (Thickening) but
 * never reaching it. Pure effort therefore never seals.
 */
export function effortFloor(n: number): number {
  if (n <= 0) return 0;
  return (HONEY_FLOOR_CAP * n) / (n + HONEY_FLOOR_K);
}

/**
 * Honey as calibration maturity:
 *   floor(n) + max(0, accuracy − floor(n)) · t(n),  t(n) = n/(n+HONEY_TRUST_K)
 * capped below the seal gate unless the seal is earned, then floored monotonically
 * at prevHoney. Returns a 0–100 number (not rounded — caller may round for display).
 */
export function honeyMaturity(input: {
  n: number;
  accuracy: number;
  prevHoney: number;
  sealEligible: boolean;
}): number {
  const { n, accuracy, prevHoney, sealEligible } = input;
  const floor = effortFloor(n);
  const trust = n <= 0 ? 0 : n / (n + HONEY_TRUST_K);
  let raw = floor + Math.max(0, accuracy - floor) * trust;
  const cap = sealEligible ? 100 : HONEY_SEAL_GATE - 1;
  raw = Math.min(raw, cap);
  return Math.max(prevHoney, raw);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/engine/__tests__/honeyMaturity.test.ts`
Expected: PASS (all cases). If the seal-eligible case fails to reach 93 at n=25, raise the test's n or confirm constants — the curve reaches ~93 around n≈18–22 with accuracy=100.

- [ ] **Step 5: Lint**

Run: `npx eslint src/engine/honeyMaturity.ts src/engine/__tests__/honeyMaturity.test.ts`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/engine/honeyMaturity.ts src/engine/__tests__/honeyMaturity.test.ts
git commit -m "feat(engine): honey-maturity effort-floor + accuracy combine"
```

---

### Task 3: Export the module

**Files:**
- Modify: `src/engine/index.ts:9-10`

**Interfaces:**
- Produces: `effortFloor`, `honeyMaturity` re-exported from `@/src/engine`.

- [ ] **Step 1: Add the export**

In `src/engine/index.ts`, after line 10 (the `TierBandProgress` type export), add:

```ts
export { effortFloor, honeyMaturity } from './honeyMaturity';
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/engine/index.ts
git commit -m "feat(engine): export honey-maturity module"
```

---

### Task 4: Wire `applyLog` to the maturity combine

**Files:**
- Modify: `src/engine/update.ts`
- Test: `src/engine/__tests__/update.test.ts`

**Interfaces:**
- Consumes: `honeyMaturity` from `./honeyMaturity`; `confidenceFor` from `./confidence`; `sharpnessFromWindow` from `./sharpness`.
- Produces: `applyLog` returns the same `ApplyLogResult` shape; `result.category.sharpness` now holds honey-maturity.

- [ ] **Step 1: Write the failing test**

Add to `src/engine/__tests__/update.test.ts` (create the file if it does not exist; if it exists, append this `describe`):

```ts
import { applyLog } from '../update';
import type { ApplyLogInput } from '../update';

function baseInput(overrides: Partial<ApplyLogInput> = {}): ApplyLogInput {
  return {
    estimateMin: 20,
    actualMin: 20,
    status: 'completed',
    source: 'timed',
    adaptSpeed: 'balanced',
    prior: 1.8,
    category: {
      stats: { sw: 0, swx: 0, swy: 0, swxx: 0, swxy: 0 } as ApplyLogInput['category']['stats'],
      n: 0,
      anchor: 1.8,
      sharpness: 0,
      reclaimedMinutes: 0,
    },
    recurring: null,
    recentClampedRatios: [],
    suggestedHonestMin: null,
    ...overrides,
  };
}

describe('applyLog honey-maturity', () => {
  it('first perfect log does NOT seal', () => {
    const r = applyLog(baseInput({ estimateMin: 20, actualMin: 20 }));
    expect(r.category.sharpness).toBeGreaterThan(0);
    expect(r.category.sharpness).toBeLessThan(93);
  });
  it('first wildly-early log is NOT 0 (showing up moves it)', () => {
    const r = applyLog(baseInput({ estimateMin: 20, actualMin: 8 }));
    expect(r.category.sharpness).toBeGreaterThan(0);
  });
  it('honey never drops below the previous value', () => {
    const r = applyLog(
      baseInput({ estimateMin: 20, actualMin: 8, category: { ...baseInput().category, n: 5, sharpness: 70 } }),
    );
    expect(r.category.sharpness).toBeGreaterThanOrEqual(70);
  });
});
```

NOTE: the `stats` object literal must match the real `AffineStats` field names. Open `src/engine/affine.ts`, read the `AffineStats` interface, and replace the `{ sw: 0, ... }` placeholder with a zero-initialized instance of the actual type (e.g. use the exported empty-stats constructor if one exists, else zero every field).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/engine/__tests__/update.test.ts -t "honey-maturity"`
Expected: FAIL — first perfect log currently returns `sharpness: 100` (instant seal), so "toBeLessThan(93)" fails.

- [ ] **Step 3: Implement the combine**

In `src/engine/update.ts`:

1. Add imports at the top (alongside the existing `sharpnessFromWindow` import):

```ts
import { honeyMaturity } from './honeyMaturity';
import { confidenceFor } from './confidence';
```

2. Replace the three lines in the counted-log path:

```ts
  const window = [...input.recentClampedRatios, ratioClamped];
  const rawSharpness = sharpnessFromWindow(window);
  const sharpness = Math.max(input.category.sharpness, rawSharpness);
```

with:

```ts
  const window = [...input.recentClampedRatios, ratioClamped];
  const accuracy = sharpnessFromWindow(window);
  // Seal is earned: needs enough low-variance data, not just one accurate log.
  const sealEligible = confidenceFor({ n: catN, clampedRatios: window }) === 'honest';
  const sharpness = honeyMaturity({
    n: catN,
    accuracy,
    prevHoney: input.category.sharpness,
    sealEligible,
  });
```

(`catN` is already declared above as `input.category.n + 1`. The `sharpnessDelta` line below — `sharpness - input.category.sharpness` — is unchanged and still correct.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/engine/__tests__/update.test.ts -t "honey-maturity"`
Expected: PASS.

- [ ] **Step 5: Run the full engine suite (catch regressions in existing sharpness tests)**

Run: `npx jest src/engine`
Expected: PASS. Existing tests that asserted exact old sharpness values (e.g. a single log → specific accuracy number) WILL need updating to the new maturity values — update those expectations to match the maturity output, not the old raw accuracy. Do not weaken assertions; recompute the expected number from the new formula.

- [ ] **Step 6: Lint + typecheck**

Run: `npx eslint src/engine/update.ts src/engine/__tests__/update.test.ts && npm run typecheck`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/engine/update.ts src/engine/__tests__/update.test.ts
git commit -m "feat(engine): honey ripens from maturity, earned seal"
```

---

### Task 5: `proReadiness` pure selector

**Files:**
- Create: `src/engine/proReadiness.ts`
- Test: `src/engine/__tests__/proReadiness.test.ts`

**Interfaces:**
- Consumes: `CalibrationConfidence` from `../domain/types`.
- Produces:
  - `type ProFeatureId = 'confidence-band' | 'day-capacity' | 'honest-week' | 'honest-month' | 'steals-your-time' | 'accuracy-correlations' | 'context-correlations'`
  - `proReadiness(input: { leadConfidence: CalibrationConfidence; totalCompletedLogs: number }): { pitchUnlocked: boolean; perFeatureReady: Record<ProFeatureId, boolean> }`

- [ ] **Step 1: Write the failing test**

Create `src/engine/__tests__/proReadiness.test.ts`:

```ts
import { proReadiness } from '../proReadiness';

describe('proReadiness', () => {
  it('pitch stays locked while confidence is raw', () => {
    const r = proReadiness({ leadConfidence: 'raw', totalCompletedLogs: 1 });
    expect(r.pitchUnlocked).toBe(false);
    expect(r.perFeatureReady['confidence-band']).toBe(false);
  });
  it('pitch unlocks the moment confidence reaches setting', () => {
    const r = proReadiness({ leadConfidence: 'setting', totalCompletedLogs: 3 });
    expect(r.pitchUnlocked).toBe(true);
    expect(r.perFeatureReady['confidence-band']).toBe(true);
  });
  it('day-capacity / honest-week need their log thresholds', () => {
    const few = proReadiness({ leadConfidence: 'setting', totalCompletedLogs: 3 });
    expect(few.perFeatureReady['day-capacity']).toBe(false);
    const many = proReadiness({ leadConfidence: 'honest', totalCompletedLogs: 14 });
    expect(many.perFeatureReady['day-capacity']).toBe(true);
    expect(many.perFeatureReady['honest-week']).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/engine/__tests__/proReadiness.test.ts`
Expected: FAIL — "Cannot find module '../proReadiness'".

- [ ] **Step 3: Write minimal implementation**

Create `src/engine/proReadiness.ts`:

```ts
import type { CalibrationConfidence } from '../domain/types';

export type ProFeatureId =
  | 'confidence-band'
  | 'day-capacity'
  | 'honest-week'
  | 'honest-month'
  | 'steals-your-time'
  | 'accuracy-correlations'
  | 'context-correlations';

/** Log-count thresholds at which each data-dependent Pro feature becomes
 *  meaningful (would show garbage earlier). Confidence-gated features use the
 *  confidence axis instead and are handled below. */
const FEATURE_MIN_LOGS: Record<ProFeatureId, number> = {
  'confidence-band': 0, // gated by confidence, not log count
  'day-capacity': 8,
  'honest-week': 7,
  'honest-month': 20,
  'steals-your-time': 4,
  'accuracy-correlations': 8,
  'context-correlations': 8,
};

/**
 * Pure Pro-readiness selector. `pitchUnlocked` is true once the lead category's
 * confidence has reached at least 'setting' (the band has first narrowed — the
 * aha beat). Per-feature readiness combines that with each feature's data need.
 * NOTE: monotonic latching of `pitchUnlocked` is the caller's responsibility
 * (confidence can fall); this function is a pure snapshot.
 */
export function proReadiness(input: {
  leadConfidence: CalibrationConfidence;
  totalCompletedLogs: number;
}): { pitchUnlocked: boolean; perFeatureReady: Record<ProFeatureId, boolean> } {
  const { leadConfidence, totalCompletedLogs } = input;
  const pitchUnlocked = leadConfidence !== 'raw';
  const bandReady = leadConfidence !== 'raw';

  const ids = Object.keys(FEATURE_MIN_LOGS) as ProFeatureId[];
  const perFeatureReady = ids.reduce(
    (acc, id) => {
      acc[id] =
        id === 'confidence-band'
          ? bandReady
          : totalCompletedLogs >= FEATURE_MIN_LOGS[id];
      return acc;
    },
    {} as Record<ProFeatureId, boolean>,
  );

  return { pitchUnlocked, perFeatureReady };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/engine/__tests__/proReadiness.test.ts`
Expected: PASS.

- [ ] **Step 5: Export + lint + typecheck**

In `src/engine/index.ts`, after the honey-maturity export added in Task 3, add:

```ts
export { proReadiness } from './proReadiness';
export type { ProFeatureId } from './proReadiness';
```

Run: `npx eslint src/engine/proReadiness.ts src/engine/__tests__/proReadiness.test.ts src/engine/index.ts && npm run typecheck`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/engine/proReadiness.ts src/engine/__tests__/proReadiness.test.ts src/engine/index.ts
git commit -m "feat(engine): pro-readiness selector (honey-gated pitch)"
```

---

### Task 6: Expose latched Pro-readiness in the calibration store

**Files:**
- Modify: `src/stores/calibrationStore.ts`
- Test: add to `src/stores/__tests__/calibrationStore.test.ts` (create if absent)

**Interfaces:**
- Consumes: `proReadiness`, `ProFeatureId` from `@/src/engine`; `confidenceFor` (already imported in store); `kv` from `@/src/lib/kv` (already imported pattern — see `DRIFT_DISMISS_KEY` usage in `useWhenbeeHub`).
- Produces: store selector `getProReadiness(): { pitchUnlocked: boolean; perFeatureReady: Record<ProFeatureId, boolean> }`, with `pitchUnlocked` latched true once reached.

- [ ] **Step 1: Write the failing test**

Add to the store test file:

```ts
import { useCalibrationStore } from '../calibrationStore';

describe('calibrationStore pro readiness', () => {
  it('latches pitchUnlocked once any category reaches setting confidence', async () => {
    // Arrange: drive enough completed logs into one category to reach 'setting'
    // (n >= CONFIDENCE_SETTING_MIN_LOGS) via store.applyLog, then read readiness.
    // (Use the store's existing test helpers / memory db setup already used by
    //  other store tests in this file.)
    const store = useCalibrationStore.getState();
    // ...apply 3 completed logs to 'focus'...
    const r = store.getProReadiness();
    expect(r.pitchUnlocked).toBe(true);
  });
});
```

NOTE: this file uses the in-memory db harness. Mirror the setup already present in the existing store tests (look for how other `applyLog` store tests seed the db and reset between cases). Replace the `// ...apply...` comment with three `await store.applyLog({ category: 'focus', estimateMin: 20, actualMin: 22, status: 'completed', source: 'timed', adaptSpeed: 'balanced' })` calls.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/stores/__tests__/calibrationStore.test.ts -t "pro readiness"`
Expected: FAIL — `store.getProReadiness is not a function`.

- [ ] **Step 3: Implement the latched selector**

In `src/stores/calibrationStore.ts`:

1. Add imports (with the existing engine import group):

```ts
import { proReadiness, type ProFeatureId } from '@/src/engine';
```

2. Add a kv latch key near the top-level constants:

```ts
/** kv flag: set once the Pro pitch has been unlocked; never cleared (monotonic). */
const PRO_PITCH_LATCH_KEY = 'whenbee.proPitchUnlocked';
```

3. Add `getProReadiness` to the store interface (the type with `applyLog: (...)`) :

```ts
  getProReadiness: () => { pitchUnlocked: boolean; perFeatureReady: Record<ProFeatureId, boolean> };
```

4. Implement it in the `create(...)` body:

```ts
  getProReadiness: () => {
    const stats = Object.values(get().statsByCategory);
    // Lead confidence = the most-advanced category's confidence axis.
    const order = { raw: 0, setting: 1, honest: 2 } as const;
    const leadConfidence = stats.reduce<'raw' | 'setting' | 'honest'>((best, s) => {
      const c = confidenceFor({ n: s.n, clampedRatios: s.clampedRatios });
      return order[c] > order[best] ? c : best;
    }, 'raw');
    const totalCompletedLogs = stats.reduce((sum, s) => sum + s.n, 0);
    const snapshot = proReadiness({ leadConfidence, totalCompletedLogs });
    // Latch: once unlocked, stay unlocked (confidence can fall, the pitch can't relock).
    const latched = kv.getString(PRO_PITCH_LATCH_KEY) === '1';
    const pitchUnlocked = snapshot.pitchUnlocked || latched;
    if (pitchUnlocked && !latched) kv.set(PRO_PITCH_LATCH_KEY, '1');
    return { pitchUnlocked, perFeatureReady: snapshot.perFeatureReady };
  },
```

(Confirm `confidenceFor` and `kv` are already imported in this file — they are used elsewhere in it / its neighbors. If `kv` is not yet imported, add `import { kv } from '@/src/lib/kv';`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/stores/__tests__/calibrationStore.test.ts -t "pro readiness"`
Expected: PASS.

- [ ] **Step 5: Reset hook for tests + the data-reset path**

Find the store's existing reset action (the one that does `set({ logs: 0, statsByCategory: {}, ... })` around the data-reset feature). Add `kv.delete(PRO_PITCH_LATCH_KEY);` inside it so a full data reset also relocks the pitch. Add one assertion to the reset test (if present) that `getProReadiness().pitchUnlocked === false` after reset.

- [ ] **Step 6: Lint + typecheck + full store suite**

Run: `npx eslint src/stores/calibrationStore.ts && npm run typecheck && npx jest src/stores`
Expected: clean + PASS.

- [ ] **Step 7: Commit**

```bash
git add src/stores/calibrationStore.ts src/stores/__tests__/calibrationStore.test.ts
git commit -m "feat(store): latched honey-gated pro-readiness selector"
```

---

### Task 7: Full verification gate

**Files:** none (verification only).

- [ ] **Step 1: Run the whole suite**

Run: `npm run lint && npm run typecheck && npm test`
Expected: lint 0 warnings, typecheck clean, all tests PASS. Fix any cross-file regression surfaced by the honey change (most likely older engine tests asserting raw-accuracy numbers — recompute their expectations from the maturity formula, never weaken them).

- [ ] **Step 2: Commit any test-expectation fixups**

```bash
git add -A
git commit -m "test: align expectations with honey-maturity curve"
```

---

## Follow-up (separate plan, NOT this one)

The UI presentation — the ripening-Pro preview card with the live honey bar, the
reveal-pitch trigger on first `pitchUnlocked`, and the "buy early → watch it
bloom" behavior — is a **design-skill-driven** plan. It requires
`ui-design:react-native-design` + `visual-design-foundations` + `emil-design-eng`,
`creating-reanimated-animations` + `motion-design` for any motion, and
`conversion-psychology` + `humanizer` for every string. Do NOT implement UI in
this plan. This plan ends with the logic layer fully tested and the
`getProReadiness` selector ready to consume.

## Self-Review

- **Spec coverage:** Section 1 (honey curve) → Tasks 1–4. Section 3 engine/applyLog/testing → Tasks 1–4, 7. Pro readiness selector (Section 3) → Task 5. Store wiring + latch (Section 2 monotonic pitch + Section 3 layer rule) → Task 6. Per-feature thresholds (Section 2) → Task 5. UI presentation (Section 2 ripening preview / reveal pitch) → explicitly deferred to a follow-up design plan (noted). No engine gap.
- **Placeholder scan:** the only deferred items are the two `NOTE:` callouts (AffineStats field names, store test harness) that direct the engineer to read a specific existing file rather than guess — acceptable because the exact shape lives in the codebase and must not be invented. No "TBD/handle edge cases" steps.
- **Type consistency:** `honeyMaturity`/`effortFloor` signatures match between Task 2 (definition), Task 3 (export), Task 4 (usage). `proReadiness` + `ProFeatureId` match between Task 5 (definition/export) and Task 6 (store usage). `getProReadiness` return type identical in interface and implementation in Task 6.
