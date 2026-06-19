# Regularized Affine Calibration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-scalar per-category multiplier with a recency-weighted ridge regression (`actual ≈ a + b·guess`) so the honest number captures fixed-cost + scale-dependence, start new categories from the user's own cross-category bias, and label the cold-start number honestly — all behind the existing `CalibrationSummary` contract.

**Architecture:** All math lives in pure `src/engine` modules (no RN/Expo/clock). The store (`calibrationStore`) reads rows, solves the fit, persists sufficient statistics, and feeds the UI through the unchanged `CalibrationSummary`. One additive SQLite migration plus lazy per-row seeding migrates existing users losslessly. The pre-estimate label is a quiet second line on two surfaces, gated on `basis === 'prior'`.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`), Expo SDK 54, expo-sqlite + `expo-sqlite/kv-store`, Zustand, Jest, React Native 0.81.

**Design spec:** `docs/superpowers/specs/2026-06-19-affine-calibration-design.md`

## Global Constraints

- **Worktree workflow.** Do ALL work in a dedicated git worktree (see Task 0). Never commit to the main checkout. Verify `git rev-parse --show-toplevel` points at the worktree before every commit.
- **Never merge.** Open a PR and stop. The founder reviews and merges by hand. Do not `git merge`, `gh pr merge`, or auto-merge by any path.
- **Clean up the worktree** when the PR is open and work is done (Task 12): remove it with `git worktree remove` and delete the branch only after the founder confirms merge — leave the branch intact while the PR is open.
- **No AI/co-author attribution** in any commit, PR title, or PR body. No `Co-Authored-By`, no "Generated with", no 🤖. Conventional Commits only.
- **Engine purity.** `src/engine/**` imports no React/RN/Expo and never reads the clock. Pure functions only.
- **TDD, no exceptions.** Write the failing test, watch it fail, write minimal code, watch it pass, commit. Logic-layer code (engine, db, store) is TDD-mandatory.
- **Theme tokens only** for any UI value (`useTheme()` / `src/theme/tokens.ts`). No raw hex/number in components.
- **Gate before PR:** `npm run lint` (0 warnings), `npm run typecheck`, `npm test` all green.
- **Layer rule:** `src/components/**` and `src/app/**` must not import `src/services/*` or `src/db/*`. Route through store/provider/feature hook.
- **Copy is locked:** the pre-estimate line is exactly `Starting estimate · sharpens as you log`. Do not reword.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/engine/affine.ts` | Sufficient-stats type, recency update, ridge solve, legacy seed | Create |
| `src/engine/globalPrior.ts` | Global cross-category bias EWMA + cold-start anchor blend | Create |
| `src/engine/constants.ts` | New ridge + global-prior constants | Modify |
| `src/engine/multiplier.ts` | `roundHonest`, affine `resolveSuggestion` | Modify |
| `src/engine/update.ts` | `applyLog` updates affine sums; returns fit + representative `mEffective` | Modify |
| `src/engine/index.ts` | Export new symbols | Modify |
| `src/domain/types.ts` | (no shape change to `CalibrationSummary`; add `AffineFit` re-export if needed) | Verify |
| `src/db/types.ts` | `CategoryStatRow` gains `sw, swx, swy, swxx, swxy` | Modify |
| `src/db/migrations.ts` | Append migration 0006 (additive columns) | Modify |
| `src/db/sqliteDatabase.ts` | Map new columns in get/upsert category stat | Modify |
| `src/db/memoryDatabase.ts` | Carry new fields in the in-memory row | Modify |
| `src/db/repositories/categoryStatsRepo.ts` | Seed cold rows + lazy-seed legacy rows | Modify |
| `src/stores/calibrationStore.ts` | kv global bias, anchor, fit in cache, persist sums + `mEffective`, recurring flat-fit | Modify |
| `src/features/add-task/useAddTask.ts` | Pass solved `fit` to `resolveSuggestion`; expose `preEstimate` | Modify |
| `src/features/planner/usePlanner.ts` | Pass solved `fit` to `resolveSuggestion` | Modify |
| `src/features/today/useToday.ts` | Pass solved `fit`; expose focus `preEstimate` | Modify |
| `src/features/shared/HonestSuggestionCard.tsx` | `preEstimate` second line | Modify |
| `src/features/today/FocusCard.tsx` | Thread `preEstimate` to the card | Modify |
| `src/app/(modals)/add-task.tsx` | Pass `preEstimate` to the card | Modify |

---

## Task 0: Create the worktree

- [ ] **Step 1: Create an isolated worktree on a new branch**

Run from the main checkout (`/Users/alisuliman/Business/income/Apps/Whenbee`):

```bash
git worktree add ../whenbee-affine-calibration -b feat/affine-calibration
cd ../whenbee-affine-calibration
git rev-parse --show-toplevel   # MUST print .../whenbee-affine-calibration
```

- [ ] **Step 2: Install deps in the worktree**

```bash
npm install
```

Expected: clean install. All subsequent tasks run inside this worktree.

---

## Task 1: Affine core (sufficient stats, solve, seed)

**Files:**
- Create: `src/engine/affine.ts`
- Modify: `src/engine/constants.ts`
- Test: `src/engine/__tests__/affine.test.ts`

**Interfaces:**
- Produces: `AffineStats` (`{ sw, swx, swy, swxx, swxy }`), `AffineFit` (`{ a, b }`), `emptyAffineStats()`, `updateAffineStats(prev, guess, actual, alpha)`, `solveAffine(stats, anchor)`, `affineHonestExact(fit, guess)`, `seedAffineFromMultiplier(multiplier, weight)`.

- [ ] **Step 1: Add constants**

In `src/engine/constants.ts`, append:

```typescript
// ── Regularized affine calibration (replaces the single-scalar multiplier) ───
/** Ridge shrink pulling the fixed-cost intercept toward 0 (higher = stays
 *  multiplicative longer). */
export const RIDGE_INTERCEPT_LAMBDA = 8;
/** Ridge anchor pulling the slope toward the prior multiplier (plays the role
 *  the old BLEND_PSEUDO_COUNT k=4 played). */
export const RIDGE_SLOPE_LAMBDA = 4;
```

- [ ] **Step 2: Write the failing tests**

Create `src/engine/__tests__/affine.test.ts`:

```typescript
import {
  emptyAffineStats,
  updateAffineStats,
  solveAffine,
  affineHonestExact,
  seedAffineFromMultiplier,
} from '../affine';

describe('solveAffine cold start', () => {
  it('returns a=0, b=anchor with empty stats', () => {
    const fit = solveAffine(emptyAffineStats(), 2.2);
    expect(fit.a).toBeCloseTo(0, 10);
    expect(fit.b).toBeCloseTo(2.2, 10);
  });

  it('cold-start honest equals guess × prior for many guesses/priors', () => {
    for (const prior of [1.3, 1.8, 2.2, 2.4]) {
      const fit = solveAffine(emptyAffineStats(), prior);
      for (const g of [5, 10, 15, 30, 45, 90]) {
        expect(affineHonestExact(fit, g)).toBeCloseTo(g * prior, 6);
      }
    }
  });
});

describe('solveAffine learning', () => {
  it('recovers a real fixed cost + slope from varied data', () => {
    // y = 10 + 1.3x, guesses spread 5..90, recency off (alpha small)
    let s = emptyAffineStats();
    const alpha = 0.2;
    for (let i = 0; i < 200; i++) {
      const x = [5, 10, 15, 20, 30, 45, 60, 90][i % 8] as number;
      s = updateAffineStats(s, x, 10 + 1.3 * x, alpha);
    }
    const fit = solveAffine(s, 1.8);
    expect(fit.a).toBeGreaterThan(6);
    expect(fit.b).toBeCloseTo(1.3, 1);
  });

  it('with no spread (all same guess) stays ~pure multiplier (a≈0)', () => {
    let s = emptyAffineStats();
    for (let i = 0; i < 100; i++) s = updateAffineStats(s, 15, 27, 0.2); // ratio 1.8
    const fit = solveAffine(s, 1.8);
    expect(Math.abs(fit.a)).toBeLessThan(2);
    expect(affineHonestExact(fit, 15)).toBeCloseTo(27, 0);
  });

  it('stays sane on two noisy nearby points that break raw OLS', () => {
    let s = emptyAffineStats();
    s = updateAffineStats(s, 10, 20, 0.3);
    s = updateAffineStats(s, 11, 18, 0.3);
    const fit = solveAffine(s, 1.8);
    expect(fit.b).toBeGreaterThan(0); // raw OLS would give b=-2
    expect(affineHonestExact(fit, 30)).toBeGreaterThan(0);
  });
});

describe('seedAffineFromMultiplier', () => {
  it('seeds stats that solve back to a=0, b=multiplier for any weight', () => {
    for (const m of [1.2, 1.8, 2.4]) {
      for (const w of [1, 3, 8]) {
        const fit = solveAffine(seedAffineFromMultiplier(m, w), 1.8);
        expect(fit.a).toBeCloseTo(0, 6);
        expect(fit.b).toBeCloseTo(m, 6);
      }
    }
  });
});
```

- [ ] **Step 3: Run tests, verify they fail**

Run: `npx jest src/engine/__tests__/affine.test.ts`
Expected: FAIL — `Cannot find module '../affine'`.

- [ ] **Step 4: Implement `src/engine/affine.ts`**

```typescript
// Recency-weighted ridge regression of actual ≈ a + b·guess, anchored to a
// multiplicative prior. PURE TS — no RN/Expo/clock. The calibration core that
// replaces the single-scalar multiplier.
// See docs/superpowers/specs/2026-06-19-affine-calibration-design.md.
import { RIDGE_INTERCEPT_LAMBDA, RIDGE_SLOPE_LAMBDA } from './constants';

/** Recency-weighted sufficient statistics for the affine fit. */
export interface AffineStats {
  sw: number; // Σ wᵢ
  swx: number; // Σ wᵢ·xᵢ
  swy: number; // Σ wᵢ·yᵢ
  swxx: number; // Σ wᵢ·xᵢ²
  swxy: number; // Σ wᵢ·xᵢ·yᵢ
}

/** A solved line: actual ≈ a + b·guess. */
export interface AffineFit {
  a: number;
  b: number;
}

/** The canonical guess (minutes) used as the representative point everywhere a
 *  single scalar multiplier is still needed (displays, legacy seed). */
export const CANONICAL_GUESS_MIN = 15;

export const emptyAffineStats = (): AffineStats => ({ sw: 0, swx: 0, swy: 0, swxx: 0, swxy: 0 });

/**
 * Decay existing mass by (1 − alpha), then add the new (guess, actual) point at
 * weight 1. `alpha` is the recency rate (alphaFor: adapt_speed, halved for retro).
 */
export const updateAffineStats = (
  prev: AffineStats,
  guess: number,
  actual: number,
  alpha: number,
): AffineStats => {
  const d = 1 - alpha;
  return {
    sw: d * prev.sw + 1,
    swx: d * prev.swx + guess,
    swy: d * prev.swy + actual,
    swxx: d * prev.swxx + guess * guess,
    swxy: d * prev.swxy + guess * actual,
  };
};

/**
 * Closed-form ridge solve. `anchor` is the prior multiplier m0; with empty stats
 * the fit is exactly { a: 0, b: anchor } — cold start equals today's guess×prior.
 * det ≥ λ_a·λ_b > 0 for non-negative stats, so the division is always safe.
 */
export const solveAffine = (s: AffineStats, anchor: number): AffineFit => {
  const A = s.sw + RIDGE_INTERCEPT_LAMBDA;
  const B = s.swx;
  const C = s.swxx + RIDGE_SLOPE_LAMBDA;
  const P = s.swxy + RIDGE_SLOPE_LAMBDA * anchor;
  const det = A * C - B * B;
  return {
    a: (C * s.swy - B * P) / det,
    b: (A * P - B * s.swy) / det,
  };
};

/** Exact (unrounded) honest minutes for a fit at a guess. Rounding/flooring is
 *  the caller's job (see roundHonest in multiplier.ts). */
export const affineHonestExact = (fit: AffineFit, guess: number): number => fit.a + fit.b * guess;

/**
 * Seed stats that make solveAffine return exactly { a: 0, b: multiplier } for
 * any weight w — used to migrate legacy rows that only stored a scalar. A single
 * point of weight w on the line y = m·x at x0 solves to (0, m) under the ridge.
 */
export const seedAffineFromMultiplier = (multiplier: number, weight: number): AffineStats => {
  const x0 = CANONICAL_GUESS_MIN;
  const w = Math.max(0, weight);
  const y0 = multiplier * x0;
  return { sw: w, swx: w * x0, swy: w * y0, swxx: w * x0 * x0, swxy: w * x0 * y0 };
};
```

- [ ] **Step 5: Run tests, verify pass**

Run: `npx jest src/engine/__tests__/affine.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/affine.ts src/engine/constants.ts src/engine/__tests__/affine.test.ts
git commit -m "feat(engine): regularized affine calibration core"
```

---

## Task 2: `roundHonest` + affine `resolveSuggestion`

**Files:**
- Modify: `src/engine/multiplier.ts`
- Modify: `src/engine/index.ts`
- Test: `src/engine/__tests__/resolveSuggestion.test.ts`

**Interfaces:**
- Consumes: `AffineFit`, `affineHonestExact` (Task 1).
- Produces: `roundHonest(exactMinutes): number`; `resolveSuggestion({ guessMinutes, category: { fit: AffineFit; n: number }, recurring: { fit: AffineFit; n: number } | null }): CalibrationSummary`.

- [ ] **Step 1: Write failing tests**

Create `src/engine/__tests__/resolveSuggestion.test.ts`:

```typescript
import { roundHonest, resolveSuggestion } from '../multiplier';

describe('roundHonest', () => {
  it('rounds to nearest 5 and floors at 5', () => {
    expect(roundHonest(33)).toBe(35);
    expect(roundHonest(2)).toBe(5);
    expect(roundHonest(77)).toBe(75);
  });
});

describe('resolveSuggestion (affine)', () => {
  const flat = (b: number) => ({ a: 0, b });

  it('uses the category fit when no recurring data', () => {
    const s = resolveSuggestion({
      guessMinutes: 15,
      category: { fit: flat(2.2), n: 0 },
      recurring: null,
    });
    expect(s.honestMinutes).toBe(35); // round5(33)
    expect(s.basis).toBe('prior');
    expect(s.multiplier).toBeCloseTo(2.2, 6);
  });

  it('marks personal once n ≥ 3', () => {
    const s = resolveSuggestion({
      guessMinutes: 15,
      category: { fit: flat(1.6), n: 5 },
      recurring: null,
    });
    expect(s.basis).toBe('personal');
    expect(s.label).toBe('based on your last 5 times');
  });

  it('prefers a recurring fit once it has ≥3 logs', () => {
    const s = resolveSuggestion({
      guessMinutes: 20,
      category: { fit: flat(2.0), n: 10 },
      recurring: { fit: flat(1.2), n: 3 },
    });
    expect(s.multiplier).toBeCloseTo(1.2, 6);
    expect(s.sampleSize).toBe(3);
  });

  it('effective multiplier reflects a non-zero intercept', () => {
    const s = resolveSuggestion({
      guessMinutes: 30,
      category: { fit: { a: 10, b: 1.3 }, n: 8 },
      recurring: null,
    });
    // exact = 10 + 1.3*30 = 49 → round 50; effective mult = 49/30
    expect(s.honestMinutes).toBe(50);
    expect(s.multiplier).toBeCloseTo(49 / 30, 6);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx jest src/engine/__tests__/resolveSuggestion.test.ts`
Expected: FAIL — `roundHonest` not exported / signature mismatch.

- [ ] **Step 3: Rewrite `resolveSuggestion` in `src/engine/multiplier.ts`**

Replace the `honestNumber` + `resolveSuggestion` section. Keep `blendWithPrior` and `recurringHasEnoughData` (still referenced by tests/legacy until removed in Task 4 cleanup):

```typescript
import { PERSONAL_MIN_LOGS, RECURRING_MIN_LOGS } from './constants';
import { affineHonestExact, type AffineFit } from './affine';
import type { CalibrationSummary } from '../domain/types';

/** round_to_5, floored at 5 so a suggestion is never zero. */
export const roundHonest = (exactMinutes: number): number =>
  Math.max(5, Math.round(exactMinutes / 5) * 5);

/** True when a recurring task has earned its own fit. */
export const recurringHasEnoughData = (recurringN: number): boolean => recurringN >= RECURRING_MIN_LOGS;

interface SourceFit {
  fit: AffineFit;
  n: number;
}

interface ResolveInput {
  guessMinutes: number;
  category: SourceFit;
  recurring: SourceFit | null;
}

/**
 * Resolution + fallback: a recurring task with ≥3 of its own logs uses its own
 * fit; otherwise it inherits the category's fit. `multiplier` is the EFFECTIVE
 * multiplier at this guess (honest/guess) so every existing "×M" display keeps
 * working under the affine model.
 */
export const resolveSuggestion = ({ guessMinutes, category, recurring }: ResolveInput): CalibrationSummary => {
  const useRecurring = recurring !== null && recurringHasEnoughData(recurring.n);
  const source = useRecurring ? recurring : category;

  const exact = affineHonestExact(source.fit, guessMinutes);
  const honestMinutes = roundHonest(exact);
  const multiplier = guessMinutes > 0 ? exact / guessMinutes : source.fit.b;
  const basis = source.n >= PERSONAL_MIN_LOGS ? 'personal' : 'prior';
  const label =
    basis === 'personal' ? `based on your last ${source.n} times` : 'based on typical patterns';

  return { multiplier, honestMinutes, guessMinutes, basis, label, sampleSize: source.n };
};
```

Remove the old `honestNumber(guessMinutes, multiplier)` export ONLY if no other file imports it; otherwise keep it. Check: `grep -rn "honestNumber" src --include="*.ts" | grep -v __tests__`. If `update.ts` still imports it, leave it until Task 4.

In `src/engine/index.ts`, export the new affine module and `roundHonest`:

```typescript
export * from './affine';
export { roundHonest, resolveSuggestion, recurringHasEnoughData, blendWithPrior } from './multiplier';
```

(Adjust to match the existing export style in `index.ts` — keep `blendWithPrior` exported only if still defined.)

- [ ] **Step 4: Run, verify pass**

Run: `npx jest src/engine/__tests__/resolveSuggestion.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/multiplier.ts src/engine/index.ts src/engine/__tests__/resolveSuggestion.test.ts
git commit -m "feat(engine): affine resolveSuggestion with effective multiplier"
```

---

## Task 3: Global cross-category prior

**Files:**
- Create: `src/engine/globalPrior.ts`
- Modify: `src/engine/constants.ts`
- Modify: `src/engine/index.ts`
- Test: `src/engine/__tests__/globalPrior.test.ts`

**Interfaces:**
- Produces: `GlobalBias` (`{ lnEwma: number; n: number }`), `emptyGlobalBias()`, `updateGlobalBias(prev, clampedRatio, alpha): GlobalBias`, `coldStartAnchor(populationPrior, global): number`.

- [ ] **Step 1: Add constants**

In `src/engine/constants.ts`, append:

```typescript
// ── Cold-start global-personal prior (new/thin categories start from YOUR bias) ─
export const GLOBAL_PRIOR_MIN_LOGS = 4; // below this, use the population prior unchanged
export const GLOBAL_PRIOR_K = 6; // pseudo-count: personal weight = n/(n+k)
export const GLOBAL_PRIOR_MAX_WEIGHT = 0.6; // cap so a new category keeps its own identity
```

- [ ] **Step 2: Write failing tests**

Create `src/engine/__tests__/globalPrior.test.ts`:

```typescript
import { emptyGlobalBias, updateGlobalBias, coldStartAnchor } from '../globalPrior';

describe('updateGlobalBias', () => {
  it('seeds at alpha·ln(r) from empty and counts up', () => {
    const g = updateGlobalBias(emptyGlobalBias(), Math.E, 0.3); // ln(e)=1
    expect(g.lnEwma).toBeCloseTo(0.3, 6);
    expect(g.n).toBe(1);
  });
});

describe('coldStartAnchor', () => {
  it('returns the population prior when global data is too thin', () => {
    const anchor = coldStartAnchor(1.3, { lnEwma: Math.log(2.0), n: 2 });
    expect(anchor).toBeCloseTo(1.3, 6);
  });

  it('blends toward the personal global once past the gate, capped', () => {
    // user runs ~2.0× everywhere; new category population prior 1.3
    const anchor = coldStartAnchor(1.3, { lnEwma: Math.log(2.0), n: 50 });
    // capped personal weight 0.6 → geo blend exp(0.4·ln1.3 + 0.6·ln2.0)
    const expected = Math.exp(0.4 * Math.log(1.3) + 0.6 * Math.log(2.0));
    expect(anchor).toBeCloseTo(expected, 6);
    expect(anchor).toBeGreaterThan(1.3);
    expect(anchor).toBeLessThan(2.0);
  });
});
```

- [ ] **Step 3: Run, verify fail**

Run: `npx jest src/engine/__tests__/globalPrior.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 4: Implement `src/engine/globalPrior.ts`**

```typescript
// Global cross-category bias: a single EWMA of ln(actual/guess) across ALL
// counted logs, used only to make a brand-new/thin category start near the
// user's own pace instead of a generic population number. PURE TS.
import { GLOBAL_PRIOR_K, GLOBAL_PRIOR_MAX_WEIGHT, GLOBAL_PRIOR_MIN_LOGS } from './constants';

export interface GlobalBias {
  lnEwma: number;
  n: number;
}

export const emptyGlobalBias = (): GlobalBias => ({ lnEwma: 0, n: 0 });

/** One EWMA step over ln(clampedRatio), mirroring the category EWMA. */
export const updateGlobalBias = (prev: GlobalBias, clampedRatio: number, alpha: number): GlobalBias => ({
  lnEwma: alpha * Math.log(clampedRatio) + (1 - alpha) * prev.lnEwma,
  n: prev.n + 1,
});

/**
 * Cold-start anchor for a category: its population prior, geometrically nudged
 * toward the user's global bias once there's enough global data. Personal weight
 * grows with n and is capped so a new category never fully loses its identity.
 */
export const coldStartAnchor = (populationPrior: number, global: GlobalBias): number => {
  if (global.n < GLOBAL_PRIOR_MIN_LOGS) return populationPrior;
  const wPers = Math.min(global.n / (global.n + GLOBAL_PRIOR_K), GLOBAL_PRIOR_MAX_WEIGHT);
  return Math.exp((1 - wPers) * Math.log(populationPrior) + wPers * global.lnEwma);
};
```

Add to `src/engine/index.ts`: `export * from './globalPrior';`

- [ ] **Step 5: Run, verify pass**

Run: `npx jest src/engine/__tests__/globalPrior.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/globalPrior.ts src/engine/constants.ts src/engine/index.ts src/engine/__tests__/globalPrior.test.ts
git commit -m "feat(engine): global cross-category cold-start prior"
```

---

## Task 4: `applyLog` updates affine sums

**Files:**
- Modify: `src/engine/update.ts`
- Test: `src/engine/__tests__/engine.test.ts` (extend; existing `applyLog` tests must be updated to the new shape)

**Interfaces:**
- Consumes: `AffineStats`, `updateAffineStats`, `solveAffine`, `affineHonestExact`, `CANONICAL_GUESS_MIN` (Task 1); `roundHonest` (Task 2).
- Produces: new `ApplyLogInput`/`ApplyLogResult` carrying affine sums. `category` input becomes `{ stats: AffineStats; n: number; anchor: number; sharpness: number; reclaimedMinutes: number }`; result `category` carries `{ stats: AffineStats; n; mEffective; sharpness; reclaimedMinutes }` plus `fit: AffineFit`.

- [ ] **Step 1: Write the failing test (new shape + adaptation behavior)**

Add to `src/engine/__tests__/engine.test.ts` a new describe block:

```typescript
import { emptyAffineStats, solveAffine } from '../affine';
// ... existing imports, plus applyLog already imported

describe('applyLog affine adaptation', () => {
  const base = {
    status: 'completed' as const,
    source: 'live' as const,
    adaptSpeed: 'balanced' as const,
    prior: 1.8,
    recurring: null,
    recentClampedRatios: [],
    suggestedHonestMin: null,
  };

  it('moves the fit toward the observed ratio over many logs', () => {
    let stats = emptyAffineStats();
    let n = 0;
    for (let i = 0; i < 30; i++) {
      const res = applyLog({
        ...base,
        estimateMin: 15,
        actualMin: 18, // ratio 1.2, below the 1.8 prior
        category: { stats, n, anchor: 1.8, sharpness: 0, reclaimedMinutes: 0 },
      });
      stats = res.category.stats;
      n = res.category.n;
    }
    const fit = solveAffine(stats, 1.8);
    expect(fit.b).toBeLessThan(1.5); // pulled down from 1.8 toward 1.2
    expect(fit.b).toBeGreaterThan(1.15);
  });

  it('does not train on abandoned logs', () => {
    const res = applyLog({
      ...base,
      status: 'abandoned',
      estimateMin: 15,
      actualMin: 60,
      category: { stats: emptyAffineStats(), n: 0, anchor: 1.8, sharpness: 0, reclaimedMinutes: 0 },
    });
    expect(res.counted).toBe(false);
  });
});
```

Update the EXISTING `applyLog monotonic sharpness` tests in this file to pass `category: { stats: emptyAffineStats(), n: 0, anchor: <prior>, sharpness: <prev>, reclaimedMinutes: 0 }` instead of the old `{ n, logEwma, mEffective, ... }` shape, and read `res.category.stats` where they previously read `logEwma`/`mEffective`. (Sharpness logic is unchanged — only the carrier shape changes.)

- [ ] **Step 2: Run, verify fail**

Run: `npx jest src/engine/__tests__/engine.test.ts`
Expected: FAIL — `ApplyLogInput` shape mismatch.

- [ ] **Step 3: Rewrite `src/engine/update.ts`**

Replace the rolling-stat machinery with affine. Keep the update order comment, the abandoned/partial guard, the ratio clamp, the sharpness monotonic guard, and the reclaim computation exactly as-is — only the multiplier math changes.

```typescript
import { clampRatio } from './ratio';
import { alphaFor } from './ewma';
import { roundHonest } from './multiplier';
import {
  affineHonestExact,
  solveAffine,
  updateAffineStats,
  CANONICAL_GUESS_MIN,
  type AffineStats,
  type AffineFit,
} from './affine';
import { reclaimDividendMinutes } from './reclaim';
import { sharpnessFromWindow } from './sharpness';
import type { AdaptSpeed, CategoryStats, LogSource, LogStatus } from '../domain/types';

interface RollingStat {
  stats: AffineStats;
  n: number;
}

export interface ApplyLogInput {
  estimateMin: number;
  actualMin: number;
  status: LogStatus;
  source: LogSource;
  adaptSpeed: AdaptSpeed;
  /** Cold-start anchor (population prior, optionally nudged by global bias). */
  prior: number;
  category: RollingStat & { anchor: number; sharpness: number; reclaimedMinutes: number };
  recurring: (RollingStat & { anchor: number }) | null;
  recentClampedRatios: number[];
  suggestedHonestMin: number | null;
}

export interface ApplyLogResult {
  ratioClamped: number;
  counted: boolean;
  category: { stats: AffineStats; n: number; mEffective: number; sharpness: number; reclaimedMinutes: number };
  categoryFit: AffineFit;
  recurring: (RollingStat & { mEffective: number }) | null;
  sharpnessDelta: number;
  reclaimDeltaMin: number;
}

/** Representative scalar multiplier at the canonical guess (for displays). */
const effectiveMultiplier = (fit: AffineFit): number =>
  affineHonestExact(fit, CANONICAL_GUESS_MIN) / CANONICAL_GUESS_MIN;

export function applyLog(input: ApplyLogInput): ApplyLogResult {
  const ratioClamped = clampRatio(input.estimateMin, input.actualMin);

  if (input.status !== 'completed') {
    const fit = solveAffine(input.category.stats, input.category.anchor);
    return {
      ratioClamped,
      counted: false,
      category: {
        stats: input.category.stats,
        n: input.category.n,
        mEffective: effectiveMultiplier(fit),
        sharpness: input.category.sharpness,
        reclaimedMinutes: input.category.reclaimedMinutes,
      },
      categoryFit: fit,
      recurring: input.recurring
        ? { stats: input.recurring.stats, n: input.recurring.n, mEffective: effectiveMultiplier(solveAffine(input.recurring.stats, input.recurring.anchor)) }
        : null,
      sharpnessDelta: 0,
      reclaimDeltaMin: 0,
    };
  }

  const alpha = alphaFor(input.adaptSpeed, input.source);
  // Clamp the trained point's actual to the clamped ratio so one disaster can't
  // tilt the line (same robustness the EWMA had via clampRatio).
  const trainedActual = ratioClamped * input.estimateMin;

  const catStats = updateAffineStats(input.category.stats, input.estimateMin, trainedActual, alpha);
  const catN = input.category.n + 1;
  const catFit = solveAffine(catStats, input.category.anchor);

  let recurring = null as ApplyLogResult['recurring'];
  if (input.recurring) {
    const recStats = updateAffineStats(input.recurring.stats, input.estimateMin, trainedActual, alpha);
    const recFit = solveAffine(recStats, input.recurring.anchor);
    recurring = { stats: recStats, n: input.recurring.n + 1, mEffective: effectiveMultiplier(recFit) };
  }

  const window = [...input.recentClampedRatios, ratioClamped];
  const rawSharpness = sharpnessFromWindow(window);
  const sharpness = Math.max(input.category.sharpness, rawSharpness);

  const honestShownMin =
    input.suggestedHonestMin ?? roundHonest(affineHonestExact(catFit, input.estimateMin));
  const reclaimDeltaMin = reclaimDividendMinutes(input.estimateMin, input.actualMin, honestShownMin);

  return {
    ratioClamped,
    counted: true,
    category: {
      stats: catStats,
      n: catN,
      mEffective: effectiveMultiplier(catFit),
      sharpness,
      reclaimedMinutes: input.category.reclaimedMinutes,
    },
    categoryFit: catFit,
    recurring,
    sharpnessDelta: sharpness - input.category.sharpness,
    reclaimDeltaMin,
  };
}
```

> Note: the old fallback used `honestNumber(estimate, mEffective_before)`. The new fallback uses the post-log fit, which is acceptable because the store always passes `suggestedHonestMin` from what the user actually saw; the fallback only fires in tests/edge paths. Keep `CategoryStats` import only if still referenced; otherwise drop it to satisfy lint.

- [ ] **Step 4: Run, verify pass**

Run: `npx jest src/engine/__tests__/engine.test.ts`
Expected: PASS (including updated legacy applyLog tests).

- [ ] **Step 5: Remove now-dead `blendWithPrior`/`honestNumber` if unreferenced**

Run: `grep -rn "blendWithPrior\|honestNumber" src --include="*.ts" | grep -v __tests__`. If only definitions remain, delete them from `multiplier.ts` and their `index.ts` exports and remove any tests that only covered them. Re-run `npx jest src/engine`.

- [ ] **Step 6: Commit**

```bash
git add src/engine
git commit -m "feat(engine): applyLog trains the affine fit; drop scalar blend"
```

---

## Task 5: DB schema + migration + adapters

**Files:**
- Modify: `src/db/types.ts`
- Modify: `src/db/migrations.ts`
- Modify: `src/db/sqliteDatabase.ts`
- Modify: `src/db/memoryDatabase.ts`
- Test: `src/db/__tests__/` (add a category-stat round-trip test for the new fields)

**Interfaces:**
- Produces: `CategoryStatRow` with `sw, swx, swy, swxx, swxy: number`.

- [ ] **Step 1: Write failing round-trip test**

In the existing db test suite (match the file that already tests `upsertCategoryStat`/`getCategoryStat`; create `src/db/__tests__/categoryStatsAffine.test.ts` if none), using the memory database:

```typescript
import { createMemoryDatabase } from '../memoryDatabase';

it('round-trips affine sufficient stats', async () => {
  const db = createMemoryDatabase();
  await db.upsertCategoryStat({
    categoryId: 'admin', n: 3, logEwma: 0, mEffective: 1.8, sharpness: 10,
    priorMult: 2.2, adaptSpeed: 'balanced', updatedAt: 1, reclaimedMinutes: 0,
    sw: 2.5, swx: 37.5, swy: 67.5, swxx: 562.5, swxy: 1012.5,
  });
  const row = await db.getCategoryStat('admin');
  expect(row?.swxy).toBeCloseTo(1012.5, 6);
  expect(row?.sw).toBeCloseTo(2.5, 6);
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx jest src/db/__tests__/categoryStatsAffine.test.ts`
Expected: FAIL — type error / missing fields.

- [ ] **Step 3: Extend `CategoryStatRow`**

In `src/db/types.ts`, add to the interface (keep `logEwma`, `mEffective` for back-compat and the representative display value):

```typescript
  /** Affine sufficient statistics (recency-weighted). */
  sw: number;
  swx: number;
  swy: number;
  swxx: number;
  swxy: number;
```

- [ ] **Step 4: Append migration 0006**

In `src/db/migrations.ts`, append a new entry to the `MIGRATIONS` array (append-only — never edit prior entries):

```typescript
  // 0006 — affine calibration sufficient statistics (additive). Legacy rows are
  // lazily seeded from m_effective in the repository (see categoryStatsRepo).
  `
  ALTER TABLE category_stats ADD COLUMN sw REAL NOT NULL DEFAULT 0;
  ALTER TABLE category_stats ADD COLUMN swx REAL NOT NULL DEFAULT 0;
  ALTER TABLE category_stats ADD COLUMN swy REAL NOT NULL DEFAULT 0;
  ALTER TABLE category_stats ADD COLUMN swxx REAL NOT NULL DEFAULT 0;
  ALTER TABLE category_stats ADD COLUMN swxy REAL NOT NULL DEFAULT 0;
  `,
```

- [ ] **Step 5: Map columns in `sqliteDatabase.ts`**

In `mapCategoryStat`, add the five fields (snake = camel here): `sw: r.sw, swx: r.swx, swy: r.swy, swxx: r.swxx, swxy: r.swxy`. Extend the `CategoryStatDbRow` type with `sw, swx, swy, swxx, swxy: number`. In `upsertCategoryStat`, add the columns to the INSERT column list, the `VALUES (...)` placeholders, and the `ON CONFLICT ... DO UPDATE SET` list:

```sql
INSERT INTO category_stats
  (category_id, ewma_logr, n, m_effective, sharpness, prior_mult, adapt_speed, updated_at, reclaimed_minutes, sw, swx, swy, swxx, swxy)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(category_id) DO UPDATE SET
  ... existing sets ...,
  sw = excluded.sw, swx = excluded.swx, swy = excluded.swy, swxx = excluded.swxx, swxy = excluded.swxy
```

Bind `row.sw, row.swx, row.swy, row.swxx, row.swxy` in order. Keep writing `ewma_logr` from `row.logEwma` (now always 0) for column compatibility.

- [ ] **Step 6: Carry fields in `memoryDatabase.ts`**

The in-memory adapter stores `CategoryStatRow` objects directly. Ensure `upsertCategoryStat` persists the whole row (including the five new fields) and `getCategoryStat` returns them. If it spreads a fixed field list, add the five fields.

- [ ] **Step 7: Run, verify pass**

Run: `npx jest src/db`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/db
git commit -m "feat(db): persist affine sufficient stats (migration 0006)"
```

---

## Task 6: Repository cold-start + legacy lazy seed

**Files:**
- Modify: `src/db/repositories/categoryStatsRepo.ts`
- Test: `src/db/repositories/__tests__/categoryStatsRepo.test.ts` (create or extend)

**Interfaces:**
- Consumes: `seedAffineFromMultiplier`, `emptyAffineStats` (Task 1).
- Produces: `categoryStatsRepo.get` returns a row whose affine sums are populated — empty for cold (`n=0`), seeded from `mEffective` for legacy rows (`n>0 && sw===0`).

- [ ] **Step 1: Write failing tests**

```typescript
import { createMemoryDatabase } from '../../memoryDatabase';
import { makeCategoryStatsRepo } from '../categoryStatsRepo';
import { solveAffine } from '@/src/engine';

it('cold get returns empty affine stats at the population prior', async () => {
  const repo = makeCategoryStatsRepo(createMemoryDatabase());
  const row = await repo.get('admin');
  expect(row.n).toBe(0);
  expect(row.sw).toBe(0);
  const fit = solveAffine({ sw: row.sw, swx: row.swx, swy: row.swy, swxx: row.swxx, swxy: row.swxy }, row.priorMult);
  expect(fit.b).toBeCloseTo(row.priorMult, 6);
});

it('lazily seeds a legacy row (n>0, sw=0) from m_effective', async () => {
  const db = createMemoryDatabase();
  await db.upsertCategoryStat({
    categoryId: 'admin', n: 7, logEwma: 0, mEffective: 1.4, sharpness: 20,
    priorMult: 2.2, adaptSpeed: 'balanced', updatedAt: 1, reclaimedMinutes: 0,
    sw: 0, swx: 0, swy: 0, swxx: 0, swxy: 0,
  });
  const row = await makeCategoryStatsRepo(db).get('admin');
  expect(row.sw).toBeGreaterThan(0);
  const fit = solveAffine({ sw: row.sw, swx: row.swx, swy: row.swy, swxx: row.swxx, swxy: row.swxy }, row.priorMult);
  expect(fit.b).toBeCloseTo(1.4, 4); // honest unchanged immediately after migration
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx jest src/db/repositories/__tests__/categoryStatsRepo.test.ts`
Expected: FAIL.

- [ ] **Step 3: Update `categoryStatsRepo.ts`**

```typescript
import { priorFor } from '@/src/engine/priors';
import { emptyAffineStats, seedAffineFromMultiplier } from '@/src/engine';
import type { Database } from '../Database';
import type { CategoryStatRow } from '../types';

function seedRow(categoryId: string): CategoryStatRow {
  const prior = priorFor(categoryId);
  return {
    categoryId, n: 0, logEwma: 0, mEffective: prior, sharpness: 0, priorMult: prior,
    adaptSpeed: 'balanced', updatedAt: 0, reclaimedMinutes: 0,
    ...emptyAffineStats(),
  };
}

/** Legacy rows (n>0) predate the affine columns: their sums are 0. Seed them
 *  from the stored scalar so the honest number is identical right after migration. */
function withAffineSeed(row: CategoryStatRow): CategoryStatRow {
  if (row.n > 0 && row.sw === 0 && row.swxx === 0) {
    return { ...row, ...seedAffineFromMultiplier(row.mEffective, Math.min(row.n, 8)) };
  }
  return row;
}

export function makeCategoryStatsRepo(db: Database): CategoryStatsRepo {
  return {
    async get(categoryId: string): Promise<CategoryStatRow> {
      const row = await db.getCategoryStat(categoryId);
      return row ? withAffineSeed(row) : seedRow(categoryId);
    },
    async upsert(row: CategoryStatRow): Promise<void> {
      await db.upsertCategoryStat(row);
    },
  };
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npx jest src/db/repositories/__tests__/categoryStatsRepo.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/db/repositories/categoryStatsRepo.ts src/db/repositories/__tests__/categoryStatsRepo.test.ts
git commit -m "feat(db): cold + lazy-seed legacy affine stats in repo"
```

---

## Task 7: Wire the store (global bias, anchor, fit, persistence)

**Files:**
- Modify: `src/stores/calibrationStore.ts`
- Test: `src/stores/__tests__/calibrationStore.test.ts` (extend the existing store suite)

**Interfaces:**
- Consumes: `solveAffine`, `emptyGlobalBias`, `updateGlobalBias`, `coldStartAnchor`, `AffineFit`, `AffineStats` (engine); `kv` (`src/lib/kv`).
- Produces: `CachedStat` gains `fit: AffineFit`; `applyLog` persists affine sums + representative `mEffective` and updates the global bias; `resolveSuggestion` callers receive a solved `fit`.

- [ ] **Step 1: Write failing test (adaptation through the store)**

Extend the store suite (use the memory DB the suite already wires):

```typescript
it('honest number drops as logged actuals beat the prior', async () => {
  const store = makeFreshStore(); // however the suite constructs it
  const before = store.getState().statsByCategory['admin']?.fit
    ?? { a: 0, b: 2.2 };
  for (let i = 0; i < 12; i++) {
    await store.getState().applyLog({
      category: 'admin', estimateMin: 15, actualMin: 18,
      status: 'completed', source: 'live', adaptSpeed: 'balanced',
    });
  }
  const after = store.getState().statsByCategory['admin'].fit;
  expect(after.b).toBeLessThan(before.b);
});
```

(Adapt to the suite's actual store-construction helper and `applyLog` param shape.)

- [ ] **Step 2: Run, verify fail**

Run: `npx jest src/stores/__tests__/calibrationStore.test.ts`
Expected: FAIL — `fit` undefined on `CachedStat`.

- [ ] **Step 3: Add global-bias kv helpers (top of `calibrationStore.ts`)**

```typescript
import { kv } from '@/src/lib/kv';
import {
  solveAffine, emptyGlobalBias, updateGlobalBias, coldStartAnchor,
  type AffineFit, type AffineStats, type GlobalBias,
} from '@/src/engine';

const GLOBAL_BIAS_KEY = 'calib.global.bias';

const readGlobalBias = (): GlobalBias => {
  const raw = kv.getString(GLOBAL_BIAS_KEY);
  if (!raw) return emptyGlobalBias();
  try {
    const parsed = JSON.parse(raw) as GlobalBias;
    return typeof parsed.lnEwma === 'number' && typeof parsed.n === 'number' ? parsed : emptyGlobalBias();
  } catch {
    return emptyGlobalBias();
  }
};

const writeGlobalBias = (g: GlobalBias): void => kv.set(GLOBAL_BIAS_KEY, JSON.stringify(g));

const statsOf = (row: { sw: number; swx: number; swy: number; swxx: number; swxy: number }): AffineStats =>
  ({ sw: row.sw, swx: row.swx, swy: row.swy, swxx: row.swxx, swxy: row.swxy });
```

- [ ] **Step 4: Add `fit` to `CachedStat` and both build sites**

In the `CachedStat` interface (line ~115) add `fit: AffineFit;`.

In the hydrate loop (line ~361), compute the anchor with the global bias and solve:

```typescript
const global = readGlobalBias();
const next: Record<string, CachedStat> = {};
for (const cat of tracked) {
  const row = await statsRepo.get(cat.id);
  const anchor = row.n > 0 ? row.priorMult : coldStartAnchor(row.priorMult, global);
  next[cat.id] = {
    mEffective: row.mEffective,
    n: row.n,
    sharpness: row.sharpness,
    tier: tierFor(row.sharpness),
    fit: solveAffine(statsOf(row), anchor),
  };
}
```

In the `applyLog` cache patch (line ~517) add `fit: result.categoryFit` to the patched entry.

- [ ] **Step 5: Rewrite the engine call + persistence inside `applyLog` (lines ~402–490)**

Read the previous row, compute the anchor (global-personal for cold categories), pass affine `stats`+`anchor` into the engine, and persist the new sums + representative `mEffective`:

```typescript
const prev = await categoryStatsRepo.get(input.category);
const global = readGlobalBias();
const anchor = prev.n > 0 ? prev.priorMult : coldStartAnchor(prev.priorMult, global);

// recurring anchor inherits the category's prior (its population basis).
let recurring: { stats: AffineStats; n: number; anchor: number } | null = null;
if (recurringKey) {
  const recRow = await recurringRepo.get(recurringKey);
  recurring = recRow
    ? { stats: { sw: recRow.sw ?? 0, swx: recRow.swx ?? 0, swy: recRow.swy ?? 0, swxx: recRow.swxx ?? 0, swxy: recRow.swxy ?? 0 }, n: recRow.n, anchor: prev.priorMult }
    : { stats: emptyAffineStats(), n: 0, anchor: coldStartAnchor(prev.priorMult, global) };
}

const result = engineApplyLog({
  estimateMin: input.estimateMin,
  actualMin: input.actualMin,
  status: input.status,
  source: input.source,
  adaptSpeed: input.adaptSpeed,
  prior: prev.priorMult,
  category: { stats: statsOf(prev), n: prev.n, anchor, sharpness: prev.sharpness, reclaimedMinutes: prev.reclaimedMinutes },
  recurring,
  recentClampedRatios,
  suggestedHonestMin: input.suggestedHonestMin ?? null,
});
```

> RecurringStatRow does not yet have affine columns. Scope decision (per spec): recurring keeps its scalar model. Simplest path that satisfies types: do NOT convert recurring to affine in this PR — instead build the recurring source for `resolveSuggestion`/engine from its existing `mEffective` as a flat fit `{ a: 0, b: recRow.mEffective }`, and skip affine training for recurring (leave `recurring` engine input `null`, continue updating the recurring row via its existing path if present). If the existing recurring path was removed in Task 4, keep recurring training out of scope and add a follow-up note. Choose the smaller diff; the category path is the deliverable.

In the persist block (line ~466), write the new sums and the representative scalar:

```typescript
await categoryStatsRepo.upsert({
  categoryId: input.category,
  n: result.category.n,
  logEwma: 0,
  mEffective: result.category.mEffective,
  sharpness: result.category.sharpness,
  priorMult: prev.priorMult,
  adaptSpeed: input.adaptSpeed,
  updatedAt: nowMs,
  reclaimedMinutes: prev.reclaimedMinutes,
  ...result.category.stats,
});
```

After a counted log, update the global bias:

```typescript
if (result.counted) {
  writeGlobalBias(updateGlobalBias(global, result.ratioClamped, alphaForGlobal(input.adaptSpeed)));
}
```

where `alphaForGlobal` reuses `alphaFor(input.adaptSpeed, 'live')` (import `alphaFor` from engine) — the global bias is not retro-discounted.

- [ ] **Step 6: Update the in-store `resolveSuggestion` call (line ~692)**

```typescript
const baseSummary = resolveSuggestion({
  guessMinutes: 15,
  category: { fit: solveAffine(statsOf(stat), stat.n > 0 ? stat.priorMult : coldStartAnchor(stat.priorMult, readGlobalBias())), n: stat.n },
  recurring: null,
});
```

- [ ] **Step 7: Clear the global-bias kv key on factory reset**

In the store `reset` (line ~938) and/or wherever `wipeAll` is invoked, add `kv.delete(GLOBAL_BIAS_KEY);` so factory reset clears the cross-category bias too.

- [ ] **Step 8: Run, verify pass + full engine/store suite**

Run: `npx jest src/stores src/engine`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/stores/calibrationStore.ts src/stores/__tests__/calibrationStore.test.ts
git commit -m "feat(store): wire affine fit, global bias, and persistence"
```

---

## Task 8: Update `resolveSuggestion` callers in hooks

**Files:**
- Modify: `src/features/add-task/useAddTask.ts`
- Modify: `src/features/planner/usePlanner.ts`
- Modify: `src/features/today/useToday.ts`
- Test: existing hook tests if present (`src/features/**/__tests__`); otherwise rely on typecheck + the screen test in Task 9.

**Interfaces:**
- Consumes: `CachedStat.fit` (Task 7); `priorFor` (engine).
- Produces: `useAddTask` returns `preEstimate: boolean` (`suggestion?.basis === 'prior'`).

- [ ] **Step 1: Update `useAddTask.ts` (lines ~100–112)**

```typescript
const suggestion = useMemo<CalibrationSummary | null>(() => {
  if (category === null) return null;
  const cached = statsByCategory[category];
  const cat = cached
    ? { fit: cached.fit, n: cached.n }
    : { fit: { a: 0, b: priorFor(category) }, n: 0 };
  return resolveSuggestion({ guessMinutes: guessMin, category: cat, recurring: null });
}, [category, guessMin, statsByCategory]);
```

Add to the hook's returned object: `preEstimate: suggestion?.basis === 'prior'`.

- [ ] **Step 2: Update `usePlanner.ts` (lines ~98–105)**

```typescript
const cached = statsByCategory[category];
const cat = cached
  ? { fit: cached.fit, n: cached.n }
  : { fit: { a: 0, b: priorFor(category) }, n: 0 };
return resolveSuggestion({ guessMinutes, category: cat, recurring: null }).honestMinutes;
```

- [ ] **Step 3: Update `useToday.ts` honest resolution**

Wherever `useToday` resolves the honest number for the focus/rows (the `honestFor` helper feeding `honestMin`), swap the `{ mEffective, n }` build for `{ fit, n }` exactly as above. Expose `focusPreEstimate: <focus summary>.basis === 'prior'` for the focus task so `FocusCard` can show the label.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors. Fix any remaining `{ mEffective, n }` call shapes the grep below finds:

```bash
grep -rn "resolveSuggestion(" src --include="*.ts" --include="*.tsx" | grep -v __tests__
```

- [ ] **Step 5: Commit**

```bash
git add src/features/add-task/useAddTask.ts src/features/planner/usePlanner.ts src/features/today/useToday.ts
git commit -m "refactor(features): pass affine fit to resolveSuggestion"
```

---

## Task 9: Pre-estimate label on the honest chip

**Files:**
- Modify: `src/features/shared/HonestSuggestionCard.tsx`
- Test: `src/features/shared/__tests__/HonestSuggestionCard.test.tsx` (extend)

**Interfaces:**
- Consumes: nothing new.
- Produces: `HonestSuggestionCard` accepts `preEstimate?: boolean`; renders the locked second line when `preEstimate && !reasonNote`.

- [ ] **Step 1: Write the failing test**

```typescript
import { render } from '@testing-library/react-native';
import { HonestSuggestionCard } from '../HonestSuggestionCard';

it('shows the pre-estimate line when preEstimate and no reasonNote', () => {
  const { queryByText } = render(
    <HonestSuggestionCard honestMinutes={35} guessMinutes={15} preEstimate />,
  );
  expect(queryByText('Starting estimate · sharpens as you log')).toBeTruthy();
});

it('hides it once calibrated (preEstimate false)', () => {
  const { queryByText } = render(
    <HonestSuggestionCard honestMinutes={35} guessMinutes={15} preEstimate={false} />,
  );
  expect(queryByText('Starting estimate · sharpens as you log')).toBeNull();
});

it('reasonNote takes priority over the pre-estimate line', () => {
  const { queryByText } = render(
    <HonestSuggestionCard honestMinutes={35} guessMinutes={15} preEstimate reasonNote="Afternoons run long" />,
  );
  expect(queryByText('Starting estimate · sharpens as you log')).toBeNull();
  expect(queryByText('Afternoons run long')).toBeTruthy();
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx jest src/features/shared/__tests__/HonestSuggestionCard.test.tsx`
Expected: FAIL — prop not handled.

- [ ] **Step 3: Implement**

Add `preEstimate?: boolean` to the prop type. Replace the existing second-line render (line ~136) so the pre-estimate line shows when there's no `reasonNote`:

```tsx
{reasonNote ? (
  <AppText style={noteText}>{reasonNote}</AppText>
) : preEstimate ? (
  <AppText style={noteText}>Starting estimate · sharpens as you log</AppText>
) : null}
```

Extend the `a11yLabel` so when `preEstimate` (and not range) it appends `, starting estimate, sharpens as you log`. Reuse the existing `noteText` style (`fontSize.sm`, `colors.inkSoft`) — no new tokens.

- [ ] **Step 4: Run, verify pass**

Run: `npx jest src/features/shared/__tests__/HonestSuggestionCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/shared/HonestSuggestionCard.tsx src/features/shared/__tests__/HonestSuggestionCard.test.tsx
git commit -m "feat(ui): pre-estimate label on the honest chip"
```

---

## Task 10: Thread `preEstimate` to the two surfaces

**Files:**
- Modify: `src/app/(modals)/add-task.tsx`
- Modify: `src/features/today/FocusCard.tsx`
- Test: extend `src/features/today/__tests__/FocusCard.test.tsx`

- [ ] **Step 1: Add-task screen**

Where the screen renders `<HonestSuggestionCard ... />` from `useAddTask`'s `suggestion`, pass `preEstimate={preEstimate}` (the new field from Task 8).

- [ ] **Step 2: FocusCard**

`FocusCard` (line ~120 passes `multiplier={summary.multiplier}`). Add a `preEstimate?: boolean` prop to `FocusCard`, pass it from `useToday`'s `focusPreEstimate`, and forward it to the `HonestSuggestionCard` it renders.

- [ ] **Step 3: Write/extend FocusCard test**

```typescript
it('renders the pre-estimate line for an uncalibrated focus task', () => {
  // render FocusCard with preEstimate and assert the locked copy appears
});
```

(Match the existing FocusCard test's render harness.)

- [ ] **Step 4: Run, verify pass**

Run: `npx jest src/features/today/__tests__/FocusCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(modals)/add-task.tsx" src/features/today/FocusCard.tsx src/features/today/__tests__/FocusCard.test.tsx
git commit -m "feat(ui): show pre-estimate label on add-task and Today focus"
```

---

## Task 11: Full gate

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: 0 warnings, 0 errors. Fix any (unused `CategoryStats`/`logEwma` imports, etc.).

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 3: Full test suite**

Run: `npm test`
Expected: all green. Pay attention to any older engine/store snapshot tests that asserted the scalar model — update them to the affine equivalents (do not delete coverage; port it).

- [ ] **Step 4: Commit any fixups**

```bash
git add -A
git commit -m "test: port remaining suites to the affine model"
```

---

## Task 12: PR + worktree cleanup

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feat/affine-calibration
```

- [ ] **Step 2: Open the PR (do NOT merge)**

```bash
gh pr create --title "feat: regularized affine calibration + cold-start prior + pre-estimate label" --body "$(cat <<'EOF'
## What

Replaces the single-scalar per-category multiplier with a recency-weighted ridge
regression (actual ≈ a + b·guess), adds a cold-start global-personal prior, and
labels the pre-estimate state honestly. Spec:
docs/superpowers/specs/2026-06-19-affine-calibration-design.md.

## Why

The old model used one multiplier for every task size and showed the population
prior as if it were the user's own calibration on day 1. This captures fixed cost
+ scale-dependence, starts new categories from the user's own cross-category bias,
and tells the user when the number is still a starting estimate.

## Behavior guarantees

- Cold start is byte-identical to the old guess×prior (unit-pinned).
- Existing users migrate losslessly (legacy rows lazily seeded from m_effective;
  honest number unchanged immediately after migration).
- Same CalibrationSummary contract — core UI flows unchanged; "×M" displays now
  show the effective multiplier at the guess.

## Tests

Engine (cold-start identity, learning, no-spread→multiplier, stability, recency,
global-prior blend, migration seed), db round-trip + lazy seed, store adaptation,
chip + FocusCard label. lint + typecheck + full jest green.
EOF
)"
```

- [ ] **Step 2.5: Verify no merge happens.** Do not run `gh pr merge`. Stop here for founder review.

- [ ] **Step 3: Remove the worktree (branch stays for the PR)**

After the PR is open and CI is green, return to the main checkout and remove the worktree. Do NOT delete the branch — the open PR needs it.

```bash
cd /Users/alisuliman/Business/income/Apps/Whenbee
git worktree remove ../whenbee-affine-calibration
git worktree list   # confirm the affine worktree is gone
```

- [ ] **Step 4: After the founder merges, delete the branch**

Only once the founder confirms the merge:

```bash
git branch -D feat/affine-calibration 2>/dev/null || true
git push origin --delete feat/affine-calibration 2>/dev/null || true
```

---

## Self-Review (completed)

**Spec coverage:** Part 1 affine → Tasks 1,2,4. Part 2 global prior → Tasks 3,7. Part 3 persistence/migration → Tasks 5,6,7. Part 4 label → Tasks 9,10. Backward-compat multiplier displays → effective-multiplier in Tasks 2,4 + representative `mEffective` in Tasks 4,7. Testing → every task is TDD; Task 11 ports legacy suites. Invariants (no guilt, monotonic sharpness untouched, on-device) → sharpness path unchanged in Task 4; copy is encouraging; all pure/local.

**Known scope edge:** recurring tasks keep the scalar model this PR (Task 7 note) — flagged as a follow-up, not a regression (recurring still resolves via a flat fit). If the team wants recurring on affine, it's a mirror of Tasks 5–7 on `recurring_stats`.

**Type consistency:** `AffineStats`/`AffineFit` names, `solveAffine(stats, anchor)`, `resolveSuggestion({ category: { fit, n }, recurring })`, `CachedStat.fit`, `result.categoryFit` / `result.category.stats` are used consistently across tasks.
