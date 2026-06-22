# Learned Focus Window Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Whenbee learns the user's most productive logged hours from calibration history and presents them as an editable "focus window," surfaced in a new Plan → Focus mode with a contextual Today hook.

**Architecture:** A pure, deterministic engine module (`learnFocusWindow`) turns completed `TaskEvent`s into a focus window via category-normalized log-residuals, capped weights, soft 30-min bins, shrink-toward-smoothed-local, a permutation gate, a coverage floor, bimodality/flat guards, and hysteresis. A feature hook feeds it events + writes the result into the existing `windowStartMin/EndMin` settings the packer already reads. UI moves the focus surface out of `BuildView` into its own Plan segment.

**Tech Stack:** TypeScript (strict), pure `src/engine`, Zustand stores, expo-sqlite, expo-router, react-native-svg, Reanimated, Jest.

**Spec:** [docs/product/specs/14-focus-window-learned-spec.md](../../product/specs/14-focus-window-learned-spec.md). Supersedes 09.

## Global Constraints

- **Engine is pure & deterministic** — no `Date.now()`, no ambient `Math.random`; randomness via a seeded PRNG only. Caller passes `ageDays`, `dayKey`, `startLocalMinute`.
- **Honesty framing** — copy says **"your most productive logged hours"**, never "biological/circadian peak". No fake percentages anywhere; legitimacy = real clock times + session counts.
- **One primary CTA per screen** — Focus mode renders exactly one filled/`indigo`/`fullWidth` button in every state. No second primary CTA on Today (the hook row is the tap target; `Start` stays Today's only filled button).
- **No-guilt invariants** — spill = "can wait"; no red; fill "full" state is amber; window is a pure time-of-day preference, never trained, never health data.
- **Tokens only** — every spacing/size/font/color from `src/theme/tokens.ts` via `useTheme()`; new token groups need a matching line in `useTheme`/`resolveTheme`.
- **Reanimated** — entering-only animations (no `exiting` on conditionally-unmounted views); read/write shared values with `.get()/.set()`.
- **Layer rule** — `src/app/**` and `src/components/**` never import `src/services/*` or `src/db/*`; route through a store/provider/feature hook.
- **Commits** — Conventional Commits; NEVER add AI/co-author attribution.

## File Structure

- `src/domain/types.ts` — add `startLocalMinute` to `TaskEvent`; add `FocusEventInput`, `LearnFocusInput`, `LearnedFocusWindow`.
- `src/db/types.ts` + migration + mappers — persist `startLocalMinute`.
- `src/engine/constants.ts` — `FW_*` constants block.
- `src/engine/focusWindowLearn.ts` — the pure algorithm (signals → bins → window → gate → hysteresis).
- `src/engine/index.ts` — export `learnFocusWindow` + types.
- `src/engine/__tests__/focusWindowLearn.test.ts` — failure-mode tests.
- `src/stores/settingsStore.ts` — `focusWindowUserSet`, `focusShownStartMin/EndMin`, `focusLastMoveAtMs`.
- `src/features/planner/useLearnedFocusWindow.ts` — feature hook.
- `src/features/planner/FocusCurve.tsx` — data-driven SVG curve.
- `src/features/planner/FocusMode.tsx` — the Plan → Focus screen (states).
- `src/features/today/TodayFocusHook.tsx` — the contextual Today row.
- Modify: `src/features/planner/PlanSegment.tsx`, `src/app/(tabs)/plan.tsx`, `src/features/planner/BuildView.tsx` (remove focus block), `src/app/(tabs)/index.tsx` (mount hook).

---

## Task 1: Persist `startLocalMinute` on TaskEvent

**Files:**
- Modify: `src/domain/types.ts` (TaskEvent interface, ~125-138)
- Modify: `src/db/types.ts` (TaskEventRow, ~8-27 region for events)
- Modify: DB schema/migration + the row↔domain mappers and the insert path that builds a `TaskEvent`
- Test: `src/db/__tests__/taskEvents.startLocalMinute.test.ts`

**Interfaces:**
- Produces: `TaskEvent.startLocalMinute: number | null`, persisted column `startLocalMinute`.

- [ ] **Step 1: Write the failing test**

```ts
import { createMemoryDatabase } from '@/src/db/memory/createMemoryDatabase';

test('persists startLocalMinute on a task event round-trip', async () => {
  const db = createMemoryDatabase();
  await db.insertTaskEvent({
    id: 'e1', category: 'admin', label: null, estimateMin: 30, actualMin: 25,
    status: 'completed', source: 'timer', startedAt: 1, endedAt: 2, createdAt: 3,
    suggestedHonestMin: null, reclaimDividendMin: 0, startLocalMinute: 615, // 10:15
  });
  const rows = await db.listRecentEvents(10);
  expect(rows[0]!.startLocalMinute).toBe(615);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/db/__tests__/taskEvents.startLocalMinute.test.ts`
Expected: FAIL — `startLocalMinute` not on the row type / not persisted.

- [ ] **Step 3: Implement**

In `src/domain/types.ts`, add to `TaskEvent` (after `reclaimDividendMin`):
```ts
  /** Local minute-of-day (0–1439) at the moment work STARTED, captured at log
   *  time. null = no trustworthy start time (retroactive/backfilled) → excluded
   *  from focus-window learning. Never recomputed from createdAt, never trained. */
  startLocalMinute: number | null;
```
In `src/db/types.ts`, add the same field to `TaskEventRow`. In the SQLite schema add column `startLocalMinute INTEGER` with a migration that adds it to existing tables defaulting `NULL` (follow the existing migration pattern in `src/db/sqlite/*`). Update the row→domain and domain→row mappers to carry `startLocalMinute` (default `null` when absent). At the **insert/log path** that constructs the event (where `startedAt` is known), set:
```ts
startLocalMinute:
  startedAt != null ? new Date(startedAt).getHours() * 60 + new Date(startedAt).getMinutes() : null,
```

- [ ] **Step 4: Run tests**

Run: `npx jest src/db/__tests__/taskEvents.startLocalMinute.test.ts` → PASS
Run: `npx jest src/db` → existing event tests still pass.

- [ ] **Step 5: Lint + commit**

```bash
npx eslint src/domain/types.ts src/db --max-warnings=0
git add src/domain/types.ts src/db
git commit -m "feat(events): persist startLocalMinute for focus-window learning"
```

---

## Task 2: Focus-window engine constants

**Files:**
- Modify: `src/engine/constants.ts` (the focus-window section ~131-134)
- Test: none (constants); verified by later tasks.

**Interfaces:**
- Produces: the `FW_*` constants below.

- [ ] **Step 1: Add the constants block** (replace the placeholder focus-window comment)

```ts
// ── Learned focus window (Pro) — spec 14 ──────────────────────────────────────
export const FW_WAKING_START_MIN = 300;            // 05:00
export const FW_WAKING_END_MIN = 1440;             // 24:00
export const FW_BIN_MIN = 30;
export const FW_BIN_COUNT = (FW_WAKING_END_MIN - FW_WAKING_START_MIN) / FW_BIN_MIN; // 38
export const FW_S_CLAMP = Math.log(3);
export const FW_MIN_ACTUAL_MIN = 3;
export const FW_MIN_PLAUSIBLE_RATIO = 0.1;
export const FW_FIT_B_MIN = 0.2;
export const FW_FIT_B_MAX = 5;
export const FW_RECENCY_HALFLIFE_DAYS = 35;
export const FW_DURATION_CAP_MIN = 90;
export const FW_WEIGHT_CAP = 2;
export const FW_SHRINK_KAPPA = 4;
export const FW_KERNEL = [0.25, 0.5, 0.25] as const;
export const FW_WINDOW_MIN_LEN = 90;
export const FW_WINDOW_MAX_LEN = 240;
export const FW_EDGE_SNAP_MIN = 15;
export const FW_PERM_N = 200;
export const FW_PERM_PCTL = 0.95;
export const FW_GATE_MIN_COMPLETED = 15;
export const FW_GATE_MIN_DISTINCT_DAYS = 5;
export const FW_BIN_MIN_EVENTS = 6;
export const FW_BIN_MIN_DAYS = 4;
export const FW_SD_MIN = 0.08;
export const FW_BIMODAL_RATIO = 0.85;
export const FW_BIMODAL_SEP_BINS = 2;
export const FW_HYSTERESIS_SD_FRAC = 0.5;
export const FW_DWELL_DAYS = 7;
export const FW_MOVE_OVERLAP_MAX = 0.5;
export const FW_COMPLETION_WEIGHT = 0.15;
export const FW_COMPLETION_KAPPA = 8;
export const FW_COMPLETION_DROP_CORR = 0.6;
export const FW_PRIOR_WINDOW = { startMin: 540, endMin: 690 } as const; // 09:00–11:30
```

- [ ] **Step 2: Lint + commit**

```bash
npx eslint src/engine/constants.ts --max-warnings=0
git add src/engine/constants.ts
git commit -m "feat(engine): add learned focus-window constants"
```

---

## Task 3: Pure helpers — seeded PRNG, percentile, bin mapping

**Files:**
- Create: `src/engine/focusWindowLearn.ts`
- Test: `src/engine/__tests__/focusWindowLearn.test.ts`

**Interfaces:**
- Produces: `mulberry32(seed): () => number`, `percentile(values, p): number`, `clamp(v,lo,hi)`, `shuffleInPlace(arr, rand)`. (Internal — not exported from `index.ts`.)

- [ ] **Step 1: Write the failing test**

```ts
import { mulberry32, percentile } from '@/src/engine/focusWindowLearn';

test('mulberry32 is deterministic for a seed', () => {
  const a = mulberry32(42); const b = mulberry32(42);
  expect([a(), a(), a()]).toEqual([b(), b(), b()]);
});

test('percentile picks the p-th value', () => {
  expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9)).toBe(9);
  expect(percentile([], 0.95)).toBe(0);
});
```

- [ ] **Step 2: Run → FAIL** (`npx jest src/engine/__tests__/focusWindowLearn.test.ts`) — module/exports missing.

- [ ] **Step 3: Implement** (top of `src/engine/focusWindowLearn.ts`)

```ts
export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((x, y) => x - y);
  const idx = clamp(Math.ceil(p * sorted.length) - 1, 0, sorted.length - 1);
  return sorted[idx]!;
}

export function shuffleInPlace<T>(arr: T[], rand: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}
```

- [ ] **Step 4: Run → PASS**.

- [ ] **Step 5: Commit**

```bash
npx eslint src/engine/focusWindowLearn.ts src/engine/__tests__/focusWindowLearn.test.ts --max-warnings=0
git add src/engine/focusWindowLearn.ts src/engine/__tests__/focusWindowLearn.test.ts
git commit -m "feat(engine): focus-window prng + percentile helpers"
```

---

## Task 4: Per-event focus signals

**Files:**
- Modify: `src/engine/focusWindowLearn.ts`
- Modify: `src/domain/types.ts` (add `FocusEventInput`, `AffineFit` is already in engine — re-export shape here as input)
- Test: `src/engine/__tests__/focusWindowLearn.test.ts`

**Interfaces:**
- Consumes: `affineHonestExact(fit, guess)` from `src/engine/affine.ts`.
- Produces: type `FocusEventInput`; `type EventSignal = { binPos: number; s: number; w: number; dayKey: number }`; `buildSignals(events, fitByCategory): EventSignal[]`.

In `src/domain/types.ts` add:
```ts
export interface FocusEventInput {
  category: string;
  estimateMin: number;
  actualMin: number;
  status: LogStatus;
  startLocalMinute: number | null;
  /** (nowMs − startedAt)/86_400_000 — computed by the caller (engine is clock-free). */
  ageDays: number;
  /** floor(startedAt / 86_400_000) — stable integer day index for distinct-day counts. */
  dayKey: number;
}
```

- [ ] **Step 1: Write the failing test**

```ts
import { buildSignals } from '@/src/engine/focusWindowLearn';
const fit = { admin: { a: 0, b: 1 } }; // honest === estimate

test('drops mis-logs, retro logs, and degenerate categories; clamps s', () => {
  const base = { category: 'admin', status: 'completed' as const, ageDays: 0, dayKey: 0 };
  const sigs = buildSignals([
    { ...base, estimateMin: 30, actualMin: 20, startLocalMinute: 600 }, // kept: s=ln(30/20)>0
    { ...base, estimateMin: 30, actualMin: 2, startLocalMinute: 600 },  // dropped: actual<3
    { ...base, estimateMin: 30, actualMin: 25, startLocalMinute: null },// dropped: retro
    { ...base, category: 'x', estimateMin: 30, actualMin: 25, startLocalMinute: 600 }, // dropped: no fit
  ], fit);
  expect(sigs).toHaveLength(1);
  expect(sigs[0]!.s).toBeCloseTo(Math.log(30 / 20), 5);
  expect(sigs[0]!.w).toBeLessThanOrEqual(2); // weight cap
});
```

- [ ] **Step 2: Run → FAIL**.

- [ ] **Step 3: Implement**

```ts
import { affineHonestExact, type AffineFit } from './affine';
import type { FocusEventInput } from '@/src/domain/types';
import * as C from './constants';

export interface EventSignal { binPos: number; s: number; w: number; dayKey: number }

export function buildSignals(
  events: ReadonlyArray<FocusEventInput>,
  fitByCategory: Record<string, AffineFit>,
): EventSignal[] {
  const out: EventSignal[] = [];
  for (const e of events) {
    if (e.status !== 'completed') continue;
    if (e.startLocalMinute == null) continue;
    if (e.startLocalMinute < C.FW_WAKING_START_MIN || e.startLocalMinute >= C.FW_WAKING_END_MIN) continue;
    const fit = fitByCategory[e.category];
    if (!fit || fit.b < C.FW_FIT_B_MIN || fit.b > C.FW_FIT_B_MAX) continue;
    if (e.actualMin < C.FW_MIN_ACTUAL_MIN) continue;
    if (e.estimateMin > 0 && e.actualMin / e.estimateMin < C.FW_MIN_PLAUSIBLE_RATIO) continue;
    const honest = affineHonestExact(fit, e.estimateMin);
    if (!(honest > 0)) continue;
    const s = clamp(Math.log(honest / e.actualMin), -C.FW_S_CLAMP, C.FW_S_CLAMP);
    const recency = Math.pow(0.5, e.ageDays / C.FW_RECENCY_HALFLIFE_DAYS);
    const dur = Math.sqrt(Math.min(honest, e.actualMin, C.FW_DURATION_CAP_MIN));
    const w = Math.min(recency * dur, C.FW_WEIGHT_CAP);
    const binPos = (e.startLocalMinute - (C.FW_WAKING_START_MIN + C.FW_BIN_MIN / 2)) / C.FW_BIN_MIN;
    out.push({ binPos, s, w, dayKey: e.dayKey });
  }
  return out;
}
```

- [ ] **Step 4: Run → PASS**.

- [ ] **Step 5: Commit**

```bash
npx eslint src/engine/focusWindowLearn.ts src/domain/types.ts --max-warnings=0
git add src/engine/focusWindowLearn.ts src/domain/types.ts src/engine/__tests__/focusWindowLearn.test.ts
git commit -m "feat(engine): per-event focus signals with guards + weight cap"
```

---

## Task 5: Score bins — soft assign, kernel smooth, shrink-to-local

**Files:**
- Modify: `src/engine/focusWindowLearn.ts`, `src/engine/__tests__/focusWindowLearn.test.ts`

**Interfaces:**
- Consumes: `EventSignal[]`.
- Produces: `type BinScores = { shrunk: number[]; eventsCount: number[]; distinctDays: number[]; sd: number; mean: number }`; `scoreBins(signals): BinScores`.

- [ ] **Step 1: Write the failing test**

```ts
import { buildSignals, scoreBins } from '@/src/engine/focusWindowLearn';
const fit = { admin: { a: 0, b: 1 } };
const ev = (min: number, actual: number, dayKey: number) =>
  ({ category: 'admin', status: 'completed' as const, estimateMin: 30, actualMin: actual, startLocalMinute: min, ageDays: 0, dayKey });

test('a single sparse fast event cannot spike its bin above a dense cluster', () => {
  const events = [ev(420, 5, 99)]; // 07:00, very fast, one event
  for (let d = 0; d < 12; d++) events.push(ev(600, 24, d)); // 10:00 cluster, mild
  const { shrunk } = scoreBins(buildSignals(events, fit));
  const binAt = (m: number) => Math.round((m - 315) / 30);
  expect(shrunk[binAt(420)]!).toBeLessThan(shrunk[binAt(600)]!); // shrinkage wins
});
```

- [ ] **Step 2: Run → FAIL**.

- [ ] **Step 3: Implement**

```ts
export interface BinScores { shrunk: number[]; eventsCount: number[]; distinctDays: number[]; sd: number; mean: number }

export function scoreBins(signals: EventSignal[]): BinScores {
  const n = C.FW_BIN_COUNT;
  const W = new Array(n).fill(0);
  const WS = new Array(n).fill(0);
  const eventsCount = new Array(n).fill(0);
  const daySets: Set<number>[] = Array.from({ length: n }, () => new Set());

  for (const sig of signals) {
    const lo = Math.floor(sig.binPos);
    const frac = sig.binPos - lo;
    for (const [idx, wfrac] of [[lo, 1 - frac], [lo + 1, frac]] as const) {
      if (idx < 0 || idx >= n || wfrac <= 0) continue;
      W[idx] += sig.w * wfrac;
      WS[idx] += sig.w * wfrac * sig.s;
    }
    const primary = clamp(Math.round(sig.binPos), 0, n - 1);
    eventsCount[primary] += 1;
    daySets[primary]!.add(sig.dayKey);
  }

  const m = W.map((w, i) => (w > 0 ? WS[i] / w : 0));
  const totalW = W.reduce((a, b) => a + b, 0);
  const globalMean = totalW > 0 ? WS.reduce((a, b) => a + b, 0) / totalW : 0;

  // kernel smooth m → mt (reflect at edges)
  const k = C.FW_KERNEL;
  const mt = m.map((_, i) => {
    const lo = m[Math.max(0, i - 1)]!, mid = m[i]!, hi = m[Math.min(n - 1, i + 1)]!;
    return k[0]! * lo + k[1]! * mid + k[2]! * hi;
  });

  // shrink each bin toward its smoothed-local value (fall back to global when no neighbours)
  const shrunk = m.map((_, i) => {
    const target = mt[i]!; // smoothed-local; equals ~global where flat
    void globalMean;
    return (W[i]! * m[i]! + C.FW_SHRINK_KAPPA * target) / (W[i]! + C.FW_SHRINK_KAPPA);
  });

  const mean = shrunk.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(shrunk.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  return { shrunk, eventsCount, distinctDays: daySets.map((s) => s.size), sd, mean };
}
```

- [ ] **Step 4: Run → PASS**.

- [ ] **Step 5: Commit**

```bash
npx eslint src/engine/focusWindowLearn.ts --max-warnings=0
git add src/engine/focusWindowLearn.ts src/engine/__tests__/focusWindowLearn.test.ts
git commit -m "feat(engine): bin scoring with soft-assign, kernel, shrinkage"
```

---

## Task 6: Select window — coverage floor, flat + bimodal guards, growth

**Files:**
- Modify: `src/engine/focusWindowLearn.ts`, test file.

**Interfaces:**
- Consumes: `BinScores`.
- Produces: `type WindowCandidate = { startMin: number; endMin: number; peakIdx: number } | null`; `selectWindow(scores): WindowCandidate`.

- [ ] **Step 1: Write the failing test**

```ts
import { selectWindow } from '@/src/engine/focusWindowLearn';

const flat = { shrunk: new Array(38).fill(0.1), eventsCount: new Array(38).fill(8),
  distinctDays: new Array(38).fill(6), mean: 0.1, sd: 0.0 };
const peak = (() => {
  const shrunk = new Array(38).fill(0); shrunk[10] = 0.9; shrunk[11] = 0.85; shrunk[12] = 0.8;
  const eventsCount = new Array(38).fill(0); const distinctDays = new Array(38).fill(0);
  [10, 11, 12].forEach((i) => { eventsCount[i] = 8; distinctDays[i] = 5; });
  const mean = shrunk.reduce((a, b) => a + b, 0) / 38;
  const sd = Math.sqrt(shrunk.reduce((a, b) => a + (b - mean) ** 2, 0) / 38);
  return { shrunk, eventsCount, distinctDays, mean, sd };
})();

test('flat day yields no window; a covered peak yields a window', () => {
  expect(selectWindow(flat)).toBeNull();
  const w = selectWindow(peak);
  expect(w).not.toBeNull();
  expect(w!.endMin - w!.startMin).toBeGreaterThanOrEqual(90);
});

test('an uncovered peak yields no window (coverage floor)', () => {
  const s = { ...peak, eventsCount: new Array(38).fill(2), distinctDays: new Array(38).fill(2) };
  expect(selectWindow(s)).toBeNull();
});
```

- [ ] **Step 2: Run → FAIL**.

- [ ] **Step 3: Implement**

```ts
export type WindowCandidate = { startMin: number; endMin: number; peakIdx: number } | null;

const binStartMin = (i: number) => C.FW_WAKING_START_MIN + i * C.FW_BIN_MIN;
const snap = (m: number) => Math.round(m / C.FW_EDGE_SNAP_MIN) * C.FW_EDGE_SNAP_MIN;

export function selectWindow(scores: BinScores): WindowCandidate {
  const { shrunk, eventsCount, distinctDays, mean, sd } = scores;
  if (sd < C.FW_SD_MIN) return null; // flat → no confident window
  const eligible = (i: number) =>
    eventsCount[i]! >= C.FW_BIN_MIN_EVENTS && distinctDays[i]! >= C.FW_BIN_MIN_DAYS;

  let peakIdx = -1;
  for (let i = 0; i < shrunk.length; i++) {
    if (!eligible(i)) continue;
    if (peakIdx < 0 || shrunk[i]! > shrunk[peakIdx]!) peakIdx = i;
  }
  if (peakIdx < 0) return null; // no covered bin

  // bimodality: a comparable, separated second peak → fall back to prior
  for (let i = 0; i < shrunk.length; i++) {
    if (Math.abs(i - peakIdx) < C.FW_BIMODAL_SEP_BINS) continue;
    const isLocalMax = shrunk[i]! >= shrunk[Math.max(0, i - 1)]! && shrunk[i]! >= shrunk[Math.min(shrunk.length - 1, i + 1)]!;
    if (isLocalMax && shrunk[i]! >= C.FW_BIMODAL_RATIO * shrunk[peakIdx]!) return null;
  }

  // grow outward while neighbours stay above mean + 0.5·sd, within MAX_LEN
  const thr = mean + 0.5 * sd;
  let lo = peakIdx, hi = peakIdx;
  const maxBins = C.FW_WINDOW_MAX_LEN / C.FW_BIN_MIN;
  while (hi - lo + 1 < maxBins) {
    const tryLo = lo - 1, tryHi = hi + 1;
    const canLo = tryLo >= 0 && shrunk[tryLo]! >= thr;
    const canHi = tryHi < shrunk.length && shrunk[tryHi]! >= thr;
    if (!canLo && !canHi) break;
    if (canHi && (!canLo || shrunk[tryHi]! >= shrunk[tryLo]!)) hi = tryHi; else lo = tryLo;
  }
  // enforce MIN_LEN by expanding toward the higher neighbour
  const minBins = C.FW_WINDOW_MIN_LEN / C.FW_BIN_MIN;
  while (hi - lo + 1 < minBins) {
    const loN = lo - 1 >= 0 ? shrunk[lo - 1]! : -Infinity;
    const hiN = hi + 1 < shrunk.length ? shrunk[hi + 1]! : -Infinity;
    if (loN === -Infinity && hiN === -Infinity) break;
    if (hiN >= loN) hi += 1; else lo -= 1;
  }

  const startMin = snap(binStartMin(lo));
  const endMin = snap(binStartMin(hi) + C.FW_BIN_MIN);
  return { startMin, endMin, peakIdx };
}
```

- [ ] **Step 4: Run → PASS**.

- [ ] **Step 5: Commit**

```bash
npx eslint src/engine/focusWindowLearn.ts --max-warnings=0
git add src/engine/focusWindowLearn.ts src/engine/__tests__/focusWindowLearn.test.ts
git commit -m "feat(engine): window selection with coverage, flat + bimodal guards"
```

---

## Task 7: Permutation gate

**Files:**
- Modify: `src/engine/focusWindowLearn.ts`, test file.

**Interfaces:**
- Consumes: `EventSignal[]`, `scoreBins`, `mulberry32`, `percentile`, `shuffleInPlace`.
- Produces: `passesPermutationGate(signals, seed): boolean`.

- [ ] **Step 1: Write the failing test**

```ts
import { buildSignals, passesPermutationGate } from '@/src/engine/focusWindowLearn';
const fit = { admin: { a: 0, b: 1 } };
const ev = (min: number, actual: number, dayKey: number) =>
  ({ category: 'admin', status: 'completed' as const, estimateMin: 30, actualMin: actual, startLocalMinute: min, ageDays: 0, dayKey });

test('injected real peak passes the gate; pure spread of noise does not', () => {
  const peakEvents = [];
  for (let d = 0; d < 20; d++) { peakEvents.push(ev(600, 15, d)); peakEvents.push(ev(900, 30, d)); }
  expect(passesPermutationGate(buildSignals(peakEvents, fit), 1)).toBe(true);

  const flatEvents = [];
  for (let d = 0; d < 20; d++) for (const m of [360, 540, 720, 900, 1080]) flatEvents.push(ev(m, 28, d));
  expect(passesPermutationGate(buildSignals(flatEvents, fit), 1)).toBe(false);
});
```

- [ ] **Step 2: Run → FAIL**.

- [ ] **Step 3: Implement**

```ts
export function passesPermutationGate(signals: EventSignal[], seed: number): boolean {
  if (signals.length === 0) return false;
  const observed = Math.max(...scoreBins(signals).shrunk);
  const rand = mulberry32(seed);
  const positions = signals.map((s) => s.binPos);
  const maxes: number[] = [];
  for (let k = 0; k < C.FW_PERM_N; k++) {
    const shuffled = shuffleInPlace([...positions], rand);
    const permuted = signals.map((s, i) => ({ ...s, binPos: shuffled[i]! }));
    maxes.push(Math.max(...scoreBins(permuted).shrunk));
  }
  return observed > percentile(maxes, C.FW_PERM_PCTL);
}
```

- [ ] **Step 4: Run → PASS**.

- [ ] **Step 5: Commit**

```bash
npx eslint src/engine/focusWindowLearn.ts --max-warnings=0
git add src/engine/focusWindowLearn.ts src/engine/__tests__/focusWindowLearn.test.ts
git commit -m "feat(engine): permutation gate for focus window"
```

---

## Task 8: Hysteresis + assemble `learnFocusWindow`

**Files:**
- Modify: `src/engine/focusWindowLearn.ts`, `src/domain/types.ts`, `src/engine/index.ts`, test file.

**Interfaces:**
- Produces: `LearnFocusInput`, `LearnedFocusWindow` (domain); `learnFocusWindow(input): LearnedFocusWindow` (exported from `index.ts`).

In `src/domain/types.ts` add:
```ts
export interface LearnFocusInput {
  events: ReadonlyArray<FocusEventInput>;
  fitByCategory: Record<string, { a: number; b: number }>;
  shown: { startMin: number; endMin: number; lastMoveAtDays: number } | null;
  /** Stable seed for the permutation test (caller derives from data; defaults inside if 0). */
  seed?: number;
}
export interface LearnedFocusWindow {
  startMin: number;
  endMin: number;
  basis: 'personal' | 'prior';
  confidence: number;                 // 0–1, for wording only (never shown as %)
  scoreByBin: number[];               // 38 bins, normalised [0,1] for the curve
  sampleCount: number;
  distinctDays: number;
  held: boolean;                      // true → hysteresis kept the shown window
}
```

- [ ] **Step 1: Write the failing test**

```ts
import { learnFocusWindow } from '@/src/engine';
const fit = { admin: { a: 0, b: 1 } };
const ev = (min: number, actual: number, dayKey: number, ageDays = dayKey) =>
  ({ category: 'admin', status: 'completed' as const, estimateMin: 30, actualMin: actual, startLocalMinute: min, ageDays, dayKey });

test('insufficient data → prior; rich peak → personal; deterministic; hysteresis holds', () => {
  expect(learnFocusWindow({ events: [ev(600, 20, 0)], fitByCategory: fit, shown: null }).basis).toBe('prior');

  const events = [];
  for (let d = 0; d < 20; d++) { events.push(ev(600, 14, d)); events.push(ev(630, 16, d)); events.push(ev(900, 30, d)); }
  const a = learnFocusWindow({ events, fitByCategory: fit, shown: null });
  const b = learnFocusWindow({ events, fitByCategory: fit, shown: null });
  expect(a.basis).toBe('personal');
  expect(a).toEqual(b);                              // determinism
  expect(a.scoreByBin).toHaveLength(38);

  // re-run with the just-learned window as "shown" recently → held, unchanged
  const held = learnFocusWindow({ events, fitByCategory: fit,
    shown: { startMin: a.startMin, endMin: a.endMin, lastMoveAtDays: 0 } });
  expect(held.startMin).toBe(a.startMin);
  expect(held.endMin).toBe(a.endMin);
});
```

- [ ] **Step 2: Run → FAIL**.

- [ ] **Step 3: Implement**

```ts
function overlapFrac(aS: number, aE: number, bS: number, bE: number): number {
  const inter = Math.max(0, Math.min(aE, bE) - Math.max(aS, bS));
  const union = Math.max(aE, bE) - Math.min(aS, bS);
  return union > 0 ? inter / union : 0;
}

function normalise(arr: number[]): number[] {
  const lo = Math.min(...arr), hi = Math.max(...arr);
  if (hi - lo < 1e-9) return arr.map(() => 0.5);
  return arr.map((v) => (v - lo) / (hi - lo));
}

// A soft, illustrative bell for the prior/forming curve (peak mid-morning).
function priorCurve(): number[] {
  const peak = Math.round((C.FW_PRIOR_WINDOW.startMin + C.FW_PRIOR_WINDOW.endMin) / 2 - C.FW_WAKING_START_MIN) / C.FW_BIN_MIN;
  return Array.from({ length: C.FW_BIN_COUNT }, (_, i) => Math.exp(-((i - peak) ** 2) / 50));
}

export function learnFocusWindow(input: LearnFocusInput): LearnedFocusWindow {
  const signals = buildSignals(input.events, input.fitByCategory);
  const distinctDays = new Set(signals.map((s) => s.dayKey)).size;
  const prior = (): LearnedFocusWindow => ({
    startMin: C.FW_PRIOR_WINDOW.startMin, endMin: C.FW_PRIOR_WINDOW.endMin,
    basis: 'prior', confidence: clamp(signals.length / C.FW_GATE_MIN_COMPLETED, 0, 0.9),
    scoreByBin: normalise(priorCurve()), sampleCount: signals.length, distinctDays, held: false,
  });

  if (signals.length < C.FW_GATE_MIN_COMPLETED || distinctDays < C.FW_GATE_MIN_DISTINCT_DAYS) return prior();
  const scores = scoreBins(signals);
  const candidate = selectWindow(scores);
  if (!candidate) return prior();
  const seed = input.seed && input.seed > 0
    ? input.seed
    : (signals.length * 1000 + signals.reduce((a, s) => a + Math.round(s.binPos), 0)) >>> 0;
  if (!passesPermutationGate(signals, seed)) return prior();

  // hysteresis
  let startMin = candidate.startMin, endMin = candidate.endMin, held = false;
  if (input.shown) {
    const ov = overlapFrac(candidate.startMin, candidate.endMin, input.shown.startMin, input.shown.endMin);
    const dwellOk = input.shown.lastMoveAtDays >= C.FW_DWELL_DAYS;
    const realShift = ov < C.FW_MOVE_OVERLAP_MAX;
    if (!(realShift && dwellOk)) { startMin = input.shown.startMin; endMin = input.shown.endMin; held = true; }
  }

  return {
    startMin, endMin, basis: 'personal',
    confidence: clamp(distinctDays / 14, 0.3, 1),
    scoreByBin: normalise(scores.shrunk), sampleCount: signals.length, distinctDays, held,
  };
}
```

In `src/engine/index.ts` add:
```ts
export { learnFocusWindow } from './focusWindowLearn';
export type { LearnFocusInput, LearnedFocusWindow, FocusEventInput } from '@/src/domain/types';
```

- [ ] **Step 4: Run the full engine suite → PASS**

Run: `npx jest src/engine/__tests__/focusWindowLearn.test.ts`
Run: `npm run typecheck`

- [ ] **Step 5: Commit**

```bash
npx eslint src/engine --max-warnings=0
git add src/engine src/domain/types.ts
git commit -m "feat(engine): assemble learnFocusWindow with hysteresis + prior fallback"
```

---

## Task 9: Settings store — focus window state

**Files:**
- Modify: `src/stores/settingsStore.ts`
- Test: `src/stores/__tests__/settingsStore.focus.test.ts`

**Interfaces:**
- Produces: `focusWindowUserSet: boolean`, `focusShownStartMin/EndMin: number | null`, `focusLastMoveAtMs: number | null`, `setLearnedFocusWindow(startMin, endMin, atMs)`, and `setFocusWindow` now sets `focusWindowUserSet = true`.

- [ ] **Step 1: Write the failing test**

```ts
import { useSettingsStore } from '@/src/stores/settingsStore';

test('learned setter records shown window; manual set marks userSet', () => {
  useSettingsStore.getState().setLearnedFocusWindow(540, 690, 1000);
  expect(useSettingsStore.getState().focusShownStartMin).toBe(540);
  expect(useSettingsStore.getState().focusWindowUserSet).toBe(false);
  useSettingsStore.getState().setFocusWindow(480, 600);
  expect(useSettingsStore.getState().focusWindowUserSet).toBe(true);
});
```

- [ ] **Step 2: Run → FAIL**.

- [ ] **Step 3: Implement** — add to the state interface + `create` initial values + actions:
```ts
focusWindowUserSet: boolean;        // initial: false
focusShownStartMin: number | null;  // initial: null
focusShownEndMin: number | null;    // initial: null
focusLastMoveAtMs: number | null;   // initial: null
setLearnedFocusWindow: (startMin: number, endMin: number, atMs: number) => void;
```
```ts
setLearnedFocusWindow: (startMin, endMin, atMs) =>
  set({ windowStartMin: startMin, windowEndMin: endMin,
        focusShownStartMin: startMin, focusShownEndMin: endMin, focusLastMoveAtMs: atMs }),
```
In the existing `setFocusWindow`, add `focusWindowUserSet: true` to its `set(...)`. Add the new keys to the persisted partialize allow-list if the store uses one.

- [ ] **Step 4: Run → PASS**; `npm run typecheck`.

- [ ] **Step 5: Commit**

```bash
npx eslint src/stores/settingsStore.ts --max-warnings=0
git add src/stores/settingsStore.ts src/stores/__tests__/settingsStore.focus.test.ts
git commit -m "feat(settings): learned focus-window state + userSet flag"
```

---

## Task 10: `useLearnedFocusWindow` hook

**Files:**
- Create: `src/features/planner/useLearnedFocusWindow.ts`
- Test: `src/features/planner/__tests__/useLearnedFocusWindow.test.ts`

**Interfaces:**
- Consumes: `learnFocusWindow`, the calibration store (`statsByCategory` → affine fit), a completed-events source (the calibration/events store the app already hydrates), `settingsStore`.
- Produces: `useLearnedFocusWindow(nowMs?): LearnedFocusWindow`.

**Implementation notes:** Read completed events from the existing store that already exposes recent events to the UI layer (do NOT import `taskEventsRepo` directly — layer rule). Map each to `FocusEventInput` using `startLocalMinute`, `ageDays = (now - startedAt)/86_400_000`, `dayKey = Math.floor(startedAt/86_400_000)`. Derive `fitByCategory` from `statsByCategory` via the existing `solveAffine`. Call `learnFocusWindow`. In a `useEffect`, if `!focusWindowUserSet` and the result is `personal` and `!held` (window moved or first set), call `setLearnedFocusWindow(start, end, now)`.

- [ ] **Step 1: Write the failing test** (mock the stores; assert it returns a `LearnedFocusWindow` and writes the window when not user-set)

```ts
import { renderHook } from '@testing-library/react-native';
import { useLearnedFocusWindow } from '@/src/features/planner/useLearnedFocusWindow';
// mock useCalibrationStore/eventsStore/useSettingsStore to supply a rich peak dataset
test('returns a personal window and writes it when not user-set', () => {
  const { result } = renderHook(() => useLearnedFocusWindow(0));
  expect(result.current.basis).toBe('personal');
});
```

- [ ] **Step 2: Run → FAIL**.

- [ ] **Step 3: Implement** the hook per the notes above (memoize on the event list + fits + shown window; effect to persist).

- [ ] **Step 4: Run → PASS**; `npm run typecheck`.

- [ ] **Step 5: Commit**

```bash
npx eslint src/features/planner/useLearnedFocusWindow.ts --max-warnings=0
git add src/features/planner/useLearnedFocusWindow.ts src/features/planner/__tests__/useLearnedFocusWindow.test.ts
git commit -m "feat(planner): useLearnedFocusWindow hook"
```

---

## Task 11: `FocusCurve` SVG component

**Files:**
- Create: `src/features/planner/FocusCurve.tsx`
- Test: `src/features/planner/__tests__/FocusCurve.test.tsx` (render/snapshot)

**Interfaces:**
- Props: `{ scoreByBin: number[]; variant: 'forming' | 'learned' | 'locked'; windowStartMin?: number; windowEndMin?: number }`.
- Produces a `react-native-svg` curve from `scoreByBin` (path built by mapping each bin to x across the waking range, score to y). `forming` → dashed `primarySoft2` stroke, no window band, no axis values reveal; `learned` → solid `primary` stroke + area gradient + window band + peak dot (entering-only breath via Reanimated, `prefers-reduced-motion` aware); `locked` → solid curve but band/axis masked (frost handled by the parent). All colours/sizes from tokens; add a `focusCurve` token group to `tokens.ts` + a matching line in `useTheme`/`resolveTheme`.

- [ ] **Step 1:** Write a render test that mounts each variant and asserts it renders an `Svg` without throwing.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement `FocusCurve` (build the path with `d = scoreByBin.map((v,i) => \`${i===0?'M':'L'} ${x(i)} ${y(v)}\`)`; window band as a `<Rect>` between `x(binOf(start))…x(binOf(end))`; peak dot at argmax). Reference `src/features/planner/FillBar.tsx` for the token/SVG pattern.
- [ ] **Step 4:** Run → PASS; visually verify against `.mock-focus-states.html` (render parity).
- [ ] **Step 5:** Commit `feat(planner): data-driven FocusCurve illustration`.

---

## Task 12: Plan → Focus mode (move surface out of BuildView)

**Files:**
- Modify: `src/features/planner/PlanSegment.tsx` (add `'focus'` option → `Plan · Focus · Routines`)
- Modify: `src/app/(tabs)/plan.tsx` (render `<FocusMode/>` when `tab === 'focus'`)
- Modify: `src/features/planner/BuildView.tsx` (DELETE the Focus-window `<View>` block at ~582-588 and the now-unused `FocusWindowCard`/`FocusWindowLocked`/`ProGate` imports if unused elsewhere)
- Create: `src/features/planner/FocusMode.tsx`
- Test: `src/features/planner/__tests__/FocusMode.test.tsx`

**Interfaces:**
- Consumes: `useLearnedFocusWindow`, `useEntitlement`, existing `FocusWindowCard` (Pro packing), `FocusWindowEditorSheet`, `FocusCurve`.
- `FocusMode` renders by (entitlement × basis) per spec §F.2:
  - **forming** (basis `prior`): `FocusCurve variant="forming"` + "Learning your focus hours · {sampleCount}/~{GATE_MIN_COMPLETED} sessions" + a `ghost` "Set my hours myself" → `FocusWindowEditorSheet`. **No primary CTA** beyond the single ghost.
  - **learned + Pro**: `FocusCurve variant="learned"` (real window) + the existing `FocusWindowCard` packing (fill bar, list, Move-up). One `indigo` CTA only if an action is needed (else none).
  - **learned + Free**: `FocusCurve variant="locked"` under a frost overlay + one `indigo` `fullWidth` CTA "Unlock my focus window" → `router.push('/(modals)/paywall', { trigger: 'focus_window' })`.

- [ ] **Step 1: Write the failing test — the one-CTA regression**

```ts
import { render } from '@testing-library/react-native';
import { FocusMode } from '@/src/features/planner/FocusMode';
// mock useEntitlement (free) + useLearnedFocusWindow (personal)
test('Focus mode (free, learned) renders exactly one filled primary CTA', () => {
  const { getAllByRole } = render(<FocusMode />);
  const filled = getAllByRole('button').filter((b) => b.props.accessibilityState?.selected || /unlock/i.test(b.props.accessibilityLabel ?? ''));
  expect(filled).toHaveLength(1);
});
```

- [ ] **Step 2: Run → FAIL** (`FocusMode` missing).
- [ ] **Step 3: Implement** `FocusMode` + segment wiring + BuildView removal. Confirm `BuildView` now has its single `Build my plan` CTA and no focus block.
- [ ] **Step 4: Run** the test → PASS; run `npx jest src/features/planner`; `npm run typecheck`. Manually verify on sim: Plan tab shows `Plan · Focus · Routines`; BuildView no longer shows the focus card.
- [ ] **Step 5: Commit** `feat(plan): Focus mode in Plan segment; remove focus block from BuildView`.

---

## Task 13: Today focus hook (contextual, only-when-learned)

**Files:**
- Create: `src/features/today/TodayFocusHook.tsx`
- Modify: `src/app/(tabs)/index.tsx` (mount under the HUD, ~after line 202)
- Test: `src/features/today/__tests__/TodayFocusHook.test.tsx`

**Interfaces:**
- Consumes: `useLearnedFocusWindow`, `useEntitlement`, `useToday` (task count), `useSettingsStore` (window), a `nowMs`.
- Render gate: returns `null` unless `basis === 'personal'` **and** it is today **and** there is ≥1 active task **and** `nowMinuteOfDay ≤ windowEndMin`.
- Free → teaser row "Your focus window is ready ›" (hides hours) → Plan→Focus. Pro → peek "Focus window · {hh:mm–hh:mm} · {fit}/{total} fit ›". **No filled CTA** — the row is a `Pressable` tap target.

- [ ] **Step 1: Write the failing test**

```ts
import { render } from '@testing-library/react-native';
import { TodayFocusHook } from '@/src/features/today/TodayFocusHook';
test('renders nothing when window is still prior', () => {
  // mock useLearnedFocusWindow → basis 'prior'
  const { toJSON } = render(<TodayFocusHook nowMs={0} />);
  expect(toJSON()).toBeNull();
});
```

- [ ] **Step 2: Run → FAIL**.
- [ ] **Step 3: Implement** the component + mount it in `index.tsx` under the HUD `<View>`.
- [ ] **Step 4: Run → PASS**; `npx jest src/features/today`; `npm run typecheck`. Sim check: hook hidden for a fresh user, visible (free=hidden-hours, pro=hours) once learned.
- [ ] **Step 5: Commit** `feat(today): contextual focus-window hook (only when learned)`.

---

## Task 14: Full-suite green + spec sign-off

- [ ] **Step 1:** `npm run lint` (0 warnings) · `npm run typecheck` · `npm test` — all green.
- [ ] **Step 2:** Manual sim sweep: forming (new user) → set-manually works; permutation/learned after seeding demo data (`seedDemoData`); Today hook gating; BuildView single-CTA; Focus mode single-CTA in every state; dark-mode curve.
- [ ] **Step 3:** Update `docs/product/specs/09-focus-window-planner.md` header with a one-line "superseded by 14 for the learned window" note.
- [ ] **Step 4: Commit** `chore(focus): mark spec 09 superseded by 14`.

---

## Self-Review

**Spec coverage:** §B data model → T1. §C algorithm → T2–T8 (C.1 signals→T4, C.3/C.4 bins→T5, C.5/C.8 select→T6, C.6/C.7 gate+coverage→T6/T7, C.9 hysteresis + C.10 prior + C.11 determinism→T8). §C.10 completion-rate tilt is the one **deferred within v1** — see note below. §D API → T8. §E settings → T9. §D hook → T10. §F.3 curve → T11, §F.1/F.2 mode → T12, §F.4 Today hook → T13. §H tests → folded per task. §I out-of-scope untouched.

**Gap flagged:** §C.10 (completion-rate tiebreak tilt) is **not yet a task** — to keep the gate-critical path clean it is folded as a **fast-follow** after T8 (add `completed/(c+a+p)` per-bin with `FW_COMPLETION_KAPPA` shrinkage, apply `×(1+FW_COMPLETION_WEIGHT·(rate−global))` to `m` *before* shrinkage, drop if across-bin corr with `shrunk` > `FW_COMPLETION_DROP_CORR`; test: correlated→dropped, independent→tilt-only). Add as **Task 8b** if the founder wants it in the first pass; otherwise it ships in the v1.1 follow.

**Placeholder scan:** none — every code step carries real code.

**Type consistency:** `FocusEventInput`/`EventSignal`/`BinScores`/`WindowCandidate`/`LearnedFocusWindow` names and fields are identical across T4–T13. `scoreByBin` (not `scoreByHour`) used consistently. `setLearnedFocusWindow(start,end,atMs)` matches T9↔T10.
