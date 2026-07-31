# Focus Window Reveal-Early (A+B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 3-gate focus-window lock (whose "clear peak · 2/6" gate dead-ends light users) with a 2-gate unlock that reveals a coarse window early and sharpens it via a confidence meter.

**Architecture:** Pure-engine change first (`learnFocusWindow`: 2 gates, coarser 60-min bins, a `revealed` basis that returns a window as soon as the 2 gates clear, plus a `confidenceTier` that grades precision instead of gating it). Then copy, then UI (header cleanup, 2-rung ladder, coarse-block reveal, honey-fill confidence meter). TDD throughout: engine + copy are logic-layer (test-first mandatory); UI gets render tests.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`), pure engine in `src/engine/`, Zustand feature hooks, React Native + Expo, Reanimated 3, react-native-svg, Jest.

**Spec:** `docs/product/specs/2026-07-12-focus-window-reveal-early.md`
**Mock:** `docs/product/specs/mocks/focus-window-reveal-early.html`

## Global Constraints

- **Invariants (never violate):** no guilt/no streaks; honey/sharpness monotonic (confidence meter only rises within a session, window held by hysteresis); core loop on-device only (this is a pure engine change — zero network); pricing read from RevenueCat (Pro gate untouched — reveal-early changes *when* value shows, not *what* is free).
- **Engine purity:** `src/engine/**` is pure TS — no React/RN/Expo, no `Date.now()`/`Math.random()`. Randomness is seeded via `mulberry32`. Tune via `src/engine/constants.ts`, never inline magic numbers.
- **Bin-count constraint:** `FW_BIN_COUNT = (FW_WAKING_END_MIN − FW_WAKING_START_MIN) / FW_BIN_MIN` MUST be an integer. Span = `1140`. `FW_BIN_MIN = 60 → 19` ✓ (do not use 90 → 12.67).
- **Tokens only:** every spacing/size/font/color comes from `src/theme/tokens.ts` via `useTheme()`. No inline hex/number. Add a token if missing.
- **TypeScript strictness:** indexed access returns `T | undefined` — handle it; no `!` unless provably safe.
- **Modal/animation HARD RULES:** no spring/bounce/overshoot/translate-in on content entrances — opacity/scale/SVG-path only; reduced-motion → final state.
- **Copy:** every user-facing string passes `conversion-psychology` + `humanizer`; no guilt/shame language.
- **Commits:** Conventional Commits, **no** `Co-Authored-By`/AI-attribution trailers. Never merge; open a PR and stop. Ask before creating a branch.
- **Verify before done:** `npm run lint`, `npm run typecheck`, and the affected `npx jest <path>` + full `npm test` all green before each commit.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/engine/constants.ts` | `FW_BIN_MIN 30→60`; confidence thresholds reused | Modify |
| `src/domain/types.ts` | `FocusGates` (2 gates); `basis` rename; `confidenceTier`, `coarseBlockLabel` | Modify |
| `src/engine/focusWindowLearn.ts` | 2-gate `buildGates`, reveal-early basis, `confidenceTier`, coarse label | Modify |
| `src/engine/__tests__/focusWindowLearn.test.ts` | engine tests | Modify |
| `src/features/patterns/focusCopy.ts` | drop peak copy; add `coarseBlockLabel`, `confidenceLabel`, `coarseHintCopy`; `of 2` | Modify |
| `src/features/patterns/__tests__/focusCopy.test.ts` | copy tests | Modify |
| `src/features/planner/FocusConfidenceMeter.tsx` | honey-fill confidence bar | Create |
| `src/features/planner/FocusCurve.tsx` | `bandVariant: 'coarse' \| 'precise'` | Modify |
| `src/features/patterns/FocusPeakCard.tsx` | header cleanup, ladderHead tag, revealed states, meter | Modify |
| `src/features/planner/useLearnedFocusWindow.ts` | basis-rename pass-through | Modify |

Task order follows the data flow: engine → types → copy → UI atoms → card → hook.

---

### Task 1: Coarsen the learning bins

**Files:**
- Modify: `src/engine/constants.ts:156`
- Test: `src/engine/__tests__/focusWindowLearn.test.ts`

**Interfaces:**
- Produces: `FW_BIN_MIN = 60`, `FW_BIN_COUNT = 19` (consumed by `scoreBins`, `buildSignals`).

- [ ] **Step 1: Write the failing test**

Add to `src/engine/__tests__/focusWindowLearn.test.ts`:

```ts
import * as C from '../constants';

describe('bin geometry (reveal-early: coarser 60-min bins)', () => {
  it('keeps FW_BIN_COUNT an integer at the coarser bin width', () => {
    expect(C.FW_BIN_MIN).toBe(60);
    expect((C.FW_WAKING_END_MIN - C.FW_WAKING_START_MIN) / C.FW_BIN_MIN).toBe(19);
    expect(Number.isInteger(C.FW_BIN_COUNT)).toBe(true);
    expect(C.FW_BIN_COUNT).toBe(19);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/engine/__tests__/focusWindowLearn.test.ts -t "coarser 60-min bins"`
Expected: FAIL — `FW_BIN_MIN` is still `30`, `FW_BIN_COUNT` is `38`.

- [ ] **Step 3: Change the constant**

In `src/engine/constants.ts`, line 156:

```ts
export const FW_BIN_MIN = 60;
```

(Leave `FW_BIN_COUNT` — it derives: `(1440 - 300) / 60 = 19`.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/engine/__tests__/focusWindowLearn.test.ts -t "coarser 60-min bins"`
Expected: PASS.

- [ ] **Step 5: Run the whole focus engine suite to catch bin-count fallout**

Run: `npx jest src/engine/__tests__/focusWindowLearn.test.ts`
Expected: some existing tests that assert `scoreByBin.length === 38` or specific bin indices FAIL. Update each to the new geometry (`length === 19`; recompute expected peak bin index as `(peakStartMin - 300) / 60`). Fix them, re-run until green. Do NOT weaken an assertion to pass — recompute the correct expected value.

- [ ] **Step 6: Commit**

```bash
git add src/engine/constants.ts src/engine/__tests__/focusWindowLearn.test.ts
git commit -m "refactor(focus): coarsen learning bins to 60min (19 bins)"
```

---

### Task 2: Domain types — 2 gates, revealed basis, confidence tier

**Files:**
- Modify: `src/domain/types.ts:307-331`

**Interfaces:**
- Produces:
  - `FocusGates = { sessions: FocusGate; days: FocusGate }` (no `peak`).
  - `type FocusConfidenceTier = 'low' | 'building' | 'steady'`.
  - `LearnedFocusWindow.basis: 'forming' | 'revealed'` (renamed from `'prior' | 'personal'`).
  - `LearnedFocusWindow.confidenceTier: FocusConfidenceTier`.
  - `LearnedFocusWindow.coarseBlockLabel: string`.

This task only edits types; the engine (Task 3) makes them compile. It is committed together with Task 3 — do Task 2 then Task 3 before running `typecheck`.

- [ ] **Step 1: Replace the gate + window types**

In `src/domain/types.ts`, replace lines 307-331 with:

```ts
/** One milestone in the 2-gate focus-unlock ladder: `have` vs `need`. */
export interface FocusGate {
  have: number;
  need: number;
}

/** The 2-gate focus-unlock ladder — enough timed sessions, spread over enough days.
 *  (The old "clear peak" gate is gone: precision is now graded by `confidenceTier`,
 *  never gated.) */
export interface FocusGates {
  sessions: FocusGate;
  days: FocusGate;
}

/** How sharp the revealed window is. Grades precision; never a lock. */
export type FocusConfidenceTier = 'low' | 'building' | 'steady';

export interface LearnedFocusWindow {
  startMin: number;
  endMin: number;
  /** `forming` = 2 gates not yet met (the ladder). `revealed` = a window is shown,
   *  precision graded by `confidenceTier`. */
  basis: 'forming' | 'revealed';
  confidence: number;                 // 0–1, meter fill + wording (never shown as %)
  confidenceTier: FocusConfidenceTier;
  /** Coarse time-of-day bucket ("Mornings" etc.) for the low-confidence reveal and
   *  the forming hint. Empty string when no peak bucket is known yet. */
  coarseBlockLabel: string;
  scoreByBin: number[];               // 19 bins, normalised [0,1] for the curve
  sampleCount: number;
  distinctDays: number;
  held: boolean;                      // true → hysteresis kept the shown window
  gates: FocusGates;
}
```

- [ ] **Step 2: Do NOT typecheck yet**

The engine and consumers still reference the old shape; `typecheck` will fail until Task 3 (engine) and Task 6/7 (UI/hook). Proceed to Task 3.

---

### Task 3: Engine — reveal-early, 2-gate ladder, confidence tier, coarse label

**Files:**
- Modify: `src/engine/focusWindowLearn.ts:197-254`
- Test: `src/engine/__tests__/focusWindowLearn.test.ts`

**Interfaces:**
- Consumes: `FocusGates`, `FocusConfidenceTier`, `LearnedFocusWindow` (Task 2); `FW_CONF_BUILDING`, `FW_CONF_HIGH`, `FW_GATE_MIN_COMPLETED`, `FW_GATE_MIN_DISTINCT_DAYS`, `FW_BIN_MIN` (constants).
- Produces: `learnFocusWindow(input): LearnedFocusWindow` returning `basis:'revealed'` + `confidenceTier` + `coarseBlockLabel` once both gates clear and a window is selectable; `basis:'forming'` otherwise. `peakBucketLabel(peakMin): string` helper (exported for copy reuse).

- [ ] **Step 1: Write the failing tests**

Add to `src/engine/__tests__/focusWindowLearn.test.ts`. Reuse the file's existing signal/event builders if present; otherwise this fixture makes a clustered morning dataset. Adjust imports to match the file.

```ts
import { learnFocusWindow, peakBucketLabel } from '../focusWindowLearn';
import type { FocusEventInput } from '@/src/domain/types';
import * as C from '../constants';

// Build N completed morning events (~09:30 start) across `days` distinct days,
// with a category whose fit.b sits in-range so signals survive.
function morningEvents(count: number, days: number): FocusEventInput[] {
  const out: FocusEventInput[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      category: 'work',
      estimateMin: 30,
      actualMin: 36,                    // honest > actual → a real signal
      status: 'completed',
      startLocalMinute: 570,            // 09:30
      ageDays: i % days,
      dayKey: i % days,
    });
  }
  return out;
}
const fit = { work: { a: 0, b: 1.2 } };

describe('reveal-early focus window', () => {
  it('stays forming below the two gates, exposing only sessions + days', () => {
    const w = learnFocusWindow({ events: morningEvents(8, 4), fitByCategory: fit, shown: null });
    expect(w.basis).toBe('forming');
    expect(w.gates.sessions).toEqual({ have: 8, need: C.FW_GATE_MIN_COMPLETED });
    expect(w.gates.days).toEqual({ have: 4, need: C.FW_GATE_MIN_DISTINCT_DAYS });
    // @ts-expect-error — the peak gate no longer exists on FocusGates
    expect(w.gates.peak).toBeUndefined();
  });

  it('reveals a window as soon as both gates clear, even at low confidence', () => {
    const w = learnFocusWindow({ events: morningEvents(15, 5), fitByCategory: fit, shown: null });
    expect(w.basis).toBe('revealed');
    expect(w.coarseBlockLabel).toBe('Mornings');
    expect(['low', 'building', 'steady']).toContain(w.confidenceTier);
    expect(w.startMin).toBeLessThan(w.endMin);
  });

  it('climbs to steady confidence with many distinct days', () => {
    const w = learnFocusWindow({ events: morningEvents(60, 20), fitByCategory: fit, shown: null });
    expect(w.basis).toBe('revealed');
    expect(w.confidence).toBeGreaterThanOrEqual(C.FW_CONF_HIGH);
    expect(w.confidenceTier).toBe('steady');
  });

  it('buckets peak times into coarse blocks', () => {
    expect(peakBucketLabel(540)).toBe('Mornings');    // 09:00
    expect(peakBucketLabel(720)).toBe('Midday');      // 12:00
    expect(peakBucketLabel(900)).toBe('Afternoons');  // 15:00
    expect(peakBucketLabel(1080)).toBe('Evenings');   // 18:00
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/engine/__tests__/focusWindowLearn.test.ts -t "reveal-early focus window"`
Expected: FAIL — `peakBucketLabel` undefined; `basis` is `'prior'`/`'personal'`; no `confidenceTier`/`coarseBlockLabel`.

- [ ] **Step 3: Implement the engine changes**

In `src/engine/focusWindowLearn.ts`:

(a) Add the bucket helper near `strongestCoveredBinEvents` (mirrors `whyNarrative` boundaries), the confidence blend (decision Q1=B), and the tier helper:

```ts
/** Coarse time-of-day bucket for the low-confidence reveal + forming hint. */
export function peakBucketLabel(peakMin: number): string {
  if (peakMin < 660) return 'Mornings';       // before 11:00
  if (peakMin < 780) return 'Midday';         // 11:00–13:00
  if (peakMin < 1020) return 'Afternoons';    // 13:00–17:00
  return 'Evenings';                          // after 17:00
}

/** Permutation strength ∈ [0,1] = share of null maxes strictly below the observed
 *  max (i.e. 1 − p). Replaces the old boolean gate; feeds both the tier boundary
 *  and the meter fill. Seeded — pure. */
export function permutationStrength(signals: EventSignal[], seed: number): number {
  if (signals.length === 0) return 0;
  const observed = Math.max(...scoreBins(signals).shrunk);
  const rand = mulberry32(seed);
  const positions = signals.map((s) => s.binPos);
  let below = 0;
  for (let k = 0; k < C.FW_PERM_N; k++) {
    const shuffled = shuffleInPlace([...positions], rand);
    const permuted = signals.map((s, i) => ({ ...s, binPos: shuffled[i]! }));
    if (Math.max(...scoreBins(permuted).shrunk) < observed) below++;
  }
  return below / C.FW_PERM_N;
}

/** Blend day-progress with significance strength (Q1=B): the meter reflects how
 *  trustworthy the window is, not just elapsed days. */
function blendConfidence(distinctDays: number, permStrength: number): number {
  const dayProgress = clamp(distinctDays / 14, 0, 1);
  return clamp(C.FW_CONF_DAY_WEIGHT * dayProgress + (1 - C.FW_CONF_DAY_WEIGHT) * permStrength, 0.3, 1);
}

/** Tier the meter/label off confidence + significance. Never gates the window. */
function tierFor(confidence: number, significant: boolean): 'low' | 'building' | 'steady' {
  if (confidence >= C.FW_CONF_HIGH) return 'steady';
  if (significant && confidence >= C.FW_CONF_BUILDING) return 'building';
  return 'low';
}
```

Delete the old boolean `passesPermutationGate` (lines 162-174) — `permutationStrength(...) >= C.FW_PERM_PCTL` reproduces it. Grep for other callers of `passesPermutationGate` first; if any exist, give them the `>= FW_PERM_PCTL` form.

Add the weight constant in `src/engine/constants.ts` (near the other `FW_CONF_*`, ~line 190):

```ts
export const FW_CONF_DAY_WEIGHT = 0.55; // confidence blend: day-progress vs permutation strength
```

(b) Replace `buildGates` (was lines 209-218) with the 2-gate version:

```ts
/** Builds the 2-gate unlock ladder (sessions + distinct days). */
function buildGates(signals: EventSignal[], distinctDays: number): FocusGates {
  return {
    sessions: { have: signals.length, need: C.FW_GATE_MIN_COMPLETED },
    days: { have: distinctDays, need: C.FW_GATE_MIN_DISTINCT_DAYS },
  };
}
```

(c) Rewrite `learnFocusWindow` (was lines 220-254). Note: `selectWindow` + `passesPermutationGate` are unchanged; the permutation result now feeds the tier instead of returning `prior()`, and `centerMin` derives the bucket:

```ts
export function learnFocusWindow(input: LearnFocusInput): LearnedFocusWindow {
  const signals = buildSignals(input.events, input.fitByCategory);
  const distinctDays = new Set(signals.map((s) => s.dayKey)).size;
  const scores = scoreBins(signals);
  const gates = buildGates(signals, distinctDays);

  const forming = (): LearnedFocusWindow => {
    // A faint coarse hint even while forming, if any covered peak bin exists.
    const hintIdx = strongestCoveredBinIndex(scores);
    const hintLabel = hintIdx >= 0 ? peakBucketLabel(binStartMin(hintIdx) + C.FW_BIN_MIN / 2) : '';
    return {
      startMin: C.FW_PRIOR_WINDOW.startMin, endMin: C.FW_PRIOR_WINDOW.endMin,
      basis: 'forming', confidence: clamp(signals.length / C.FW_GATE_MIN_COMPLETED, 0, 0.9),
      confidenceTier: 'low', coarseBlockLabel: hintLabel,
      scoreByBin: normalise(priorCurve()), sampleCount: signals.length, distinctDays, held: false,
      gates,
    };
  };

  if (signals.length < C.FW_GATE_MIN_COMPLETED || distinctDays < C.FW_GATE_MIN_DISTINCT_DAYS) {
    return forming();
  }
  const candidate = selectWindow(scores);
  if (!candidate) return forming(); // truly flat / spread-out — no window to reveal yet

  const seed = input.seed && input.seed > 0
    ? input.seed
    : (signals.length * 1000 + signals.reduce((a, s) => a + Math.round(s.binPos), 0)) >>> 0;
  const permStrength = permutationStrength(signals, seed);
  const significant = permStrength >= C.FW_PERM_PCTL;

  // hysteresis (unchanged)
  let startMin = candidate.startMin, endMin = candidate.endMin, held = false;
  if (input.shown) {
    const ov = overlapFrac(candidate.startMin, candidate.endMin, input.shown.startMin, input.shown.endMin);
    const dwellOk = input.shown.lastMoveAtDays >= C.FW_DWELL_DAYS;
    const realShift = ov < C.FW_MOVE_OVERLAP_MAX;
    if (!(realShift && dwellOk)) { startMin = input.shown.startMin; endMin = input.shown.endMin; held = true; }
  }

  const confidence = blendConfidence(distinctDays, permStrength);
  const centerMin = binStartMin(candidate.peakIdx) + C.FW_BIN_MIN / 2;
  return {
    startMin, endMin, basis: 'revealed',
    confidence, confidenceTier: tierFor(confidence, significant),
    coarseBlockLabel: peakBucketLabel(centerMin),
    scoreByBin: normalise(scores.shrunk), sampleCount: signals.length, distinctDays, held,
    gates,
  };
}
```

(d) Rename `strongestCoveredBinEvents` → add a sibling `strongestCoveredBinIndex` (returns the index, `-1` if none) used above; keep or delete the events-count version depending on remaining callers:

```ts
/** Index of the covered bin with the highest shrunk score (−1 if none). */
function strongestCoveredBinIndex(scores: BinScores): number {
  const { shrunk, eventsCount } = scores;
  let bestIdx = -1;
  for (let i = 0; i < shrunk.length; i++) {
    if (eventsCount[i]! <= 0) continue;
    if (bestIdx < 0 || shrunk[i]! > shrunk[bestIdx]!) bestIdx = i;
  }
  return bestIdx;
}
```

Grep for `strongestCoveredBinEvents`; if nothing else references it, delete it. Update the `import` of `FocusGates` to also pull `LearnedFocusWindow` (already imported at top, line 4) — no new import needed beyond removing dead ones.

- [ ] **Step 4: Run the reveal-early tests**

Run: `npx jest src/engine/__tests__/focusWindowLearn.test.ts -t "reveal-early focus window"`
Expected: PASS.

- [ ] **Step 5: Run the full focus engine suite**

Run: `npx jest src/engine/__tests__/focusWindowLearn.test.ts`
Expected: PASS. Fix any legacy test still asserting `basis: 'personal'`/`'prior'`, `gates.peak`, or `.confirming` — migrate them to `'revealed'`/`'forming'` and the 2-gate shape (recompute expected values, don't weaken).

- [ ] **Step 6: Typecheck (types + engine now cohere)**

Run: `npm run typecheck`
Expected: errors ONLY in `focusCopy.ts`, `FocusPeakCard.tsx`, `useLearnedFocusWindow.ts` (later tasks). Engine + domain compile clean.

- [ ] **Step 7: Commit**

```bash
git add src/domain/types.ts src/engine/focusWindowLearn.ts src/engine/__tests__/focusWindowLearn.test.ts
git commit -m "feat(focus): reveal window at 2 gates, grade precision by confidence"
```

---

### Task 4: Copy — coarse block, confidence labels, 2-gate tag, drop peak copy

**Files:**
- Modify: `src/features/patterns/focusCopy.ts:33-101`
- Test: `src/features/patterns/__tests__/focusCopy.test.ts`

**Interfaces:**
- Consumes: `FocusConfidenceTier` (domain), `peakBucketLabel` (engine).
- Produces: `FOCUS_GATE_LABELS = { sessions, days }`; `focusUnlockedTag(n) → "${n} of 2 unlocked"`; `confidenceLabel(tier) → string`; `coarseHintCopy(block) → string`; `coarseBlockLabel = peakBucketLabel` (re-export). Removes `peakGateCopy`, `peakUpcomingCopy`, `FOCUS_GATE_LABELS.peak`.

- [ ] **Step 1: Write the failing tests**

In `src/features/patterns/__tests__/focusCopy.test.ts`, delete any `peakGateCopy`/`peakUpcomingCopy` cases and add:

```ts
import {
  focusUnlockedTag,
  confidenceLabel,
  coarseHintCopy,
  FOCUS_GATE_LABELS,
} from '../focusCopy';

describe('focus copy (reveal-early)', () => {
  it('tags progress out of two gates', () => {
    expect(focusUnlockedTag(1)).toBe('1 of 2 unlocked');
  });

  it('has no peak gate label', () => {
    expect(FOCUS_GATE_LABELS).toEqual({ sessions: 'Timed sessions', days: 'Different days' });
    expect('peak' in FOCUS_GATE_LABELS).toBe(false);
  });

  it('labels each confidence tier without guilt', () => {
    expect(confidenceLabel('low')).toBe('Still learning · sharpening');
    expect(confidenceLabel('building')).toBe('Building · getting sharper');
    expect(confidenceLabel('steady')).toBe('Steady · locked to your rhythm');
  });

  it('names the coarse block in the forming hint', () => {
    expect(coarseHintCopy('Mornings')).toBe(
      "Leaning toward mornings — keep timing and I'll sharpen it.",
    );
    expect(coarseHintCopy('')).toBe('');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/features/patterns/__tests__/focusCopy.test.ts -t "reveal-early"`
Expected: FAIL — `confidenceLabel`/`coarseHintCopy` undefined; `focusUnlockedTag` still says "of 3"; `FOCUS_GATE_LABELS.peak` present.

- [ ] **Step 3: Edit the copy module**

In `src/features/patterns/focusCopy.ts`:

- Line 34-38 — drop the `peak` label:
```ts
export const FOCUS_GATE_LABELS = {
  sessions: 'Timed sessions',
  days: 'Different days',
} as const;
```
- Delete `peakGateCopy` (62-78) and `peakUpcomingCopy` (85-89).
- Line 92-94 — retarget the tag:
```ts
export function focusUnlockedTag(unlocked: number): string {
  return `${unlocked} of 2 unlocked`;
}
```
- Add the new helpers (below `daysUpcomingCopy`):
```ts
import type { FocusConfidenceTier } from '@/src/domain/types';
import { peakBucketLabel } from '@/src/engine';

/** Re-export so UI derives the block name from one place (the engine bucket). */
export const coarseBlockLabel = peakBucketLabel;

/** Confidence meter label per tier. No guilt: "learning → sharper → locked in". */
export function confidenceLabel(tier: FocusConfidenceTier): string {
  switch (tier) {
    case 'low': return 'Still learning · sharpening';
    case 'building': return 'Building · getting sharper';
    case 'steady': return 'Steady · locked to your rhythm';
  }
}

/** Forming-state hint — names the leaning block; my job to sharpen, not the user's. */
export function coarseHintCopy(block: string): string {
  if (!block) return '';
  return `Leaning toward ${block.toLowerCase()} — keep timing and I'll sharpen it.`;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest src/features/patterns/__tests__/focusCopy.test.ts`
Expected: PASS.

- [ ] **Step 5: Lint the copy module**

Run: `npx eslint src/features/patterns/focusCopy.ts`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/patterns/focusCopy.ts src/features/patterns/__tests__/focusCopy.test.ts
git commit -m "feat(focus): reveal-early copy — coarse hint, confidence labels, 2-gate tag"
```

---

### Task 5: FocusConfidenceMeter component

**Files:**
- Create: `src/features/planner/FocusConfidenceMeter.tsx`
- Test: `src/features/planner/__tests__/FocusConfidenceMeter.test.tsx`

**Interfaces:**
- Consumes: `FocusConfidenceTier` (domain), `confidenceLabel` (copy), `useTheme`.
- Produces: `<FocusConfidenceMeter tier={FocusConfidenceTier} fill={number /* 0–1 */} />`.

- [ ] **Step 1: Write the failing render test**

Create `src/features/planner/__tests__/FocusConfidenceMeter.test.tsx`:

```tsx
import { render } from '@testing-library/react-native';
import { FocusConfidenceMeter } from '../FocusConfidenceMeter';

describe('FocusConfidenceMeter', () => {
  it('renders the tier label', () => {
    const { getByText } = render(<FocusConfidenceMeter tier="building" fill={0.64} />);
    expect(getByText('Building · getting sharper')).toBeTruthy();
  });

  it('renders the steady label at full fill', () => {
    const { getByText } = render(<FocusConfidenceMeter tier="steady" fill={1} />);
    expect(getByText('Steady · locked to your rhythm')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/features/planner/__tests__/FocusConfidenceMeter.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

Create `src/features/planner/FocusConfidenceMeter.tsx`. Honey-fill (amber) on a sunken track; label above; `steady` label in `amberText`. Fill animates via width (`motion.honeyFill`, ease-out, grow-only, reduced-motion → final):

```tsx
import { useEffect } from 'react';
import { View, type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { AppText } from '@/src/components/AppText';
import { confidenceLabel } from '@/src/features/patterns/focusCopy';
import type { FocusConfidenceTier } from '@/src/domain/types';

export interface FocusConfidenceMeterProps {
  tier: FocusConfidenceTier;
  fill: number; // 0–1
}

export function FocusConfidenceMeter({ tier, fill }: FocusConfidenceMeterProps) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const clamped = Math.max(0, Math.min(1, fill));
  const w = useSharedValue(reduced ? clamped : 0);

  useEffect(() => {
    if (reduced) {
      w.set(clamped);
      return;
    }
    w.set(withTiming(clamped, { duration: t.motion.honeyFill, easing: Easing.out(Easing.cubic) }));
  }, [clamped, reduced, w, t.motion.honeyFill]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${w.get() * 100}%` }));

  const label: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: tier === 'steady' ? t.colors.amberText : t.colors.inkSoft,
    fontWeight: tier === 'steady' ? (t.fontWeight.semibold as TextStyle['fontWeight']) : undefined,
  };
  const track: ViewStyle = {
    height: t.progress.track,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.surfaceSunken,
    overflow: 'hidden',
  };
  const bar: ViewStyle = { height: '100%', borderRadius: t.radii.full, backgroundColor: t.colors.accent };

  return (
    <View style={{ gap: t.space[1.5] }}>
      <AppText style={label}>{confidenceLabel(tier)}</AppText>
      <View style={track}>
        <Animated.View style={[bar, fillStyle]} />
      </View>
    </View>
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest src/features/planner/__tests__/FocusConfidenceMeter.test.tsx`
Expected: PASS.

- [ ] **Step 5: Lint**

Run: `npx eslint src/features/planner/FocusConfidenceMeter.tsx`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/planner/FocusConfidenceMeter.tsx src/features/planner/__tests__/FocusConfidenceMeter.test.tsx
git commit -m "feat(focus): honey-fill confidence meter"
```

---

### Task 6: FocusCurve — coarse vs precise band variant

**Files:**
- Modify: `src/features/planner/FocusCurve.tsx`

**Interfaces:**
- Produces: `FocusCurve` gains optional `bandVariant?: 'coarse' | 'precise'` (default `'precise'`). `'coarse'` = wider band + dashed amber edges; `'precise'` = current solid band.

- [ ] **Step 1: Read the current props + band render**

Run: `npx eslint --print-config /dev/null >/dev/null 2>&1; sed -n '1,60p' src/features/planner/FocusCurve.tsx` — locate the props interface and the `<Rect>`/band element (uses `t.focusCurve.bandOpacity`, `colors.accentSoft`). Confirm exact prop names before editing.

- [ ] **Step 2: Add the prop + dashed-edge branch**

Add `bandVariant?: 'coarse' | 'precise'` to the props (default `'precise'`). Where the window band `<Rect>` renders, when `bandVariant === 'coarse'` widen the band (extend `windowStartMin`/`windowEndMin` outward to the enclosing coarse block, or draw the band across the full covered spread) and add two dashed vertical edge `<Line>`s using `stroke={t.colors.accent}`, `strokeDasharray="3 3"`, `strokeOpacity={t.opacity.rangeArc}`. Keep all geometry from `t.focusCurve` tokens — add a `dashEdge` token to `focusCurve` if a new value is needed rather than inlining.

- [ ] **Step 3: Typecheck + lint the file**

Run: `npm run typecheck && npx eslint src/features/planner/FocusCurve.tsx`
Expected: no errors. (Existing callers pass no `bandVariant` → default `'precise'` → unchanged render.)

- [ ] **Step 4: Commit**

```bash
git add src/features/planner/FocusCurve.tsx src/theme/tokens.ts
git commit -m "feat(focus): coarse band variant for low-confidence reveal"
```

---

### Task 7: FocusPeakCard — header cleanup, 2-rung ladder, revealed states, meter

**Files:**
- Modify: `src/features/patterns/FocusPeakCard.tsx`
- Test: `src/features/patterns/__tests__/FocusPeakCard.test.tsx` (create if absent)

**Interfaces:**
- Consumes: `LearnedFocusWindow` (`basis:'forming'|'revealed'`, `confidenceTier`, `coarseBlockLabel`); `FocusConfidenceMeter`; `confidenceLabel`, `coarseHintCopy`, `focusUnlockedTag`, `FOCUS_GATE_LABELS`, `sessionsGateCopy`, `daysGateCopy`, `daysUpcomingCopy`; `FocusCurve` `bandVariant`.

- [ ] **Step 1: Write the failing render tests**

Create/extend `src/features/patterns/__tests__/FocusPeakCard.test.tsx`. Mock `useLearnedFocusWindow` per state (mock `useEntitlement` → Pro, and the settings selectors as the existing card tests do). Example forming case:

```tsx
jest.mock('@/src/features/planner/useLearnedFocusWindow', () => ({
  useLearnedFocusWindow: () => global.__focusWin,
}));
// ...mock useEntitlement (isPro:true), settingsStore selectors, useFocusInsights.

it('forming: header has no unlocked tag; ladder shows two rungs + the tag', () => {
  global.__focusWin = {
    basis: 'forming', confidence: 0.5, confidenceTier: 'low', coarseBlockLabel: 'Mornings',
    scoreByBin: Array(19).fill(0.5), sampleCount: 7, distinctDays: 3, held: false,
    startMin: 540, endMin: 690,
    gates: { sessions: { have: 7, need: 15 }, days: { have: 3, need: 5 } },
  };
  const { getByText, queryAllByText } = render(<FocusPeakCard />);
  expect(getByText('1 of 2 unlocked')).toBeTruthy();       // moved onto the ladder
  expect(getByText('Timed sessions')).toBeTruthy();
  expect(getByText('Different days')).toBeTruthy();
  expect(queryAllByText(/of 3 unlocked/).length).toBe(0);  // old tag gone
});

it('revealed low: shows coarse block name + confidence label', () => {
  global.__focusWin = {
    basis: 'revealed', confidence: 0.4, confidenceTier: 'low', coarseBlockLabel: 'Mornings',
    scoreByBin: Array(19).fill(0.5), sampleCount: 16, distinctDays: 5, held: false,
    startMin: 480, endMin: 690, gates: { sessions: { have: 16, need: 15 }, days: { have: 5, need: 5 } },
  };
  const { getByText } = render(<FocusPeakCard />);
  expect(getByText('Mornings')).toBeTruthy();
  expect(getByText('Still learning · sharpening')).toBeTruthy();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/features/patterns/__tests__/FocusPeakCard.test.tsx`
Expected: FAIL — card still renders the 3-gate forming block and old header tag.

- [ ] **Step 3: Rewire the card**

In `src/features/patterns/FocusPeakCard.tsx`:

(a) Update imports: drop `peakGateCopy`, `peakUpcomingCopy`; add `confidenceLabel`, `coarseHintCopy`, `coarseBlockLabel`; import `FocusConfidenceMeter`. Update the `basis` checks: `basis === 'prior'` → `basis === 'forming'`; the personal branches → `basis === 'revealed'`.

(b) **Header (all states):** remove the `{focusUnlockedTag(...)}` tag from the header cluster — leave only `<Eyebrow />` and (when `!isPro`) `<ProCoinPill icon="ribbon" />`.

(c) **forming branch:** compute only two gate states; delete the peak `FocusGateRow`. Add a `.ladderHead` row (right-aligned) holding `<AppText style={tagStyle}>{focusUnlockedTag(unlocked)}</AppText>` directly above the two rows, with `unlocked = (sDone?1:0) + (dDone?1:0)`. Replace the body sentence "Three signals…" with the coarse hint when present: `coarseHintCopy(win.coarseBlockLabel)` (fall back to "Keep timing and I'll find the hours you focus best." when empty). Keep `FocusRewardPreview` + "Set my hours myself".

(d) **revealed branch:** if `confidenceTier === 'low'`, render `coarseBlockLabel(...)` as `type.subtitle` + a muted "around H:MM–H:MM" subline + `<FocusCurve bandVariant="coarse" … />` + `<FocusConfidenceMeter tier={win.confidenceTier} fill={win.confidence} />`. Else render the existing window-range hero + `<FocusCurve bandVariant="precise" … />` + why-line + `<FocusConfidenceMeter … />` + footer `Open ›`. The free/locked (`!isPro`) frosted teaser path is unchanged except its guard is now `basis === 'revealed'`.

- [ ] **Step 4: Run the card tests**

Run: `npx jest src/features/patterns/__tests__/FocusPeakCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck + lint**

Run: `npm run typecheck && npx eslint src/features/patterns/FocusPeakCard.tsx`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/patterns/FocusPeakCard.tsx src/features/patterns/__tests__/FocusPeakCard.test.tsx
git commit -m "feat(focus): reveal-early card — clean header, 2-rung ladder, coarse reveal, meter"
```

---

### Task 8: Hook pass-through (basis rename) + full green

**Files:**
- Modify: `src/features/planner/useLearnedFocusWindow.ts:126`

**Interfaces:**
- Consumes: `LearnedFocusWindow.basis: 'revealed'` (was `'personal'`).

- [ ] **Step 1: Migrate the basis check**

In `useLearnedFocusWindow.ts` line 126, change the auto-persist guard:

```ts
      result.basis === 'revealed' &&
```

(The comment on line 116 "The engine gained enough data to say 'personal'" → update to "…to say 'revealed'".)

- [ ] **Step 2: Grep for any remaining old basis strings**

Run: `grep -rn "'personal'\|'prior'\|gates.peak\|\.confirming\|of 3 unlocked\|peakGateCopy\|strongestCoveredBinEvents" src/`
Expected: no matches in `src/` (only historical mentions in `docs/`). Fix any straggler.

- [ ] **Step 3: Full verification**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all green. Investigate and fix any focus-related failure at its root (no weakening).

- [ ] **Step 4: Commit**

```bash
git add src/features/planner/useLearnedFocusWindow.ts
git commit -m "refactor(focus): rename learned-window basis personal→revealed"
```

---

## Self-Review (completed against the spec)

- **Spec coverage:** §4.1 bins → Task 1; §4.2 two gates + §4.3 reveal-early/confidence + §4.1 coarse label → Task 3 (types Task 2); §5 copy → Task 4; §6 UI (header/ladderHead/reveal/meter) → Tasks 5–7; §6 FocusCurve band → Task 6; §7 motion → Tasks 5 (meter honey-fill), 6 (band edges), reuse of existing curve draw; §8 invariants → Global Constraints + per-task guards; §9 tests → each task's test steps; §10 files → File Structure + tasks.
- **Open decisions (§11):** (1) **Q1=B** — confidence blends day-progress + permutation strength via `blendConfidence` / `FW_CONF_DAY_WEIGHT=0.55` (Task 3). (2) **Q2** — `basis` rename `personal→revealed`; migration in Task 8.
- **Type consistency:** `FocusGates` (sessions, days) used identically in Tasks 2/3/4/7; `FocusConfidenceTier` values `'low'|'building'|'steady'` consistent across engine (`tierFor`), copy (`confidenceLabel`), meter, card; `peakBucketLabel` defined in engine (Task 3), re-exported as `coarseBlockLabel` in copy (Task 4), consumed in card (Task 7); `basis:'forming'|'revealed'` consistent across engine, hook, card.

---

## Execution Handoff

Plan complete and saved to `docs/product/specs/plans/2026-07-12-focus-window-reveal-early.md`. Two execution options:

**1. Subagent-Driven (recommended)** — a fresh subagent per task, review between tasks, fast iteration.
**2. Inline Execution** — tasks executed in this session with checkpoints.

Note: implementation edits code → per the project HARD GATE, ask before creating a branch, and never merge (open a PR, founder reviews).
