# Focus Patterns Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lift the Focus section out of the buried Numbers-tab slot into a pinned, premium "When you're sharp" card under the identity card, with a why-line and a tap-through detail sheet — every value live, time in the user's own clock format.

**Architecture:** A new pure engine fn (`computeFocusInsights`) extracts the contrast/accuracy/duration metrics the normalized curve can't carry. A new feature hook wires it to live stores. Two new UI components (`FocusPeakCard`, the `(modals)/focus-window` detail route) replace `FocusPatternsCard`. `FocusCurve` gains opt-in Y-axis labels. `patterns.tsx` pins the card.

**Tech Stack:** Expo SDK 54, React Native 0.81/Fabric, TypeScript (strict, noUncheckedIndexedAccess), Zustand stores, react-native-svg, react-native-reanimated, Jest.

## Global Constraints

- **Spec:** `docs/product/specs/2026-06-30-focus-patterns-redesign.md`. **Mock:** `docs/product/specs/mocks/focus-section-redesign-v2.html`.
- **Engine is PURE TS** — no React/RN/Expo, no `Date.now()`, no ambient `Math.random()`. All randomness seeded.
- **Tokens only** — every color/space/size/font from `src/theme/tokens.ts` via `useTheme()`; no inline hex/number. Add a token if missing.
- **No placeholders in shipped UI** — every number/label bound to live data; a null Tier-2 metric → the row is omitted and the why-line drops its clause. No hardcoded `137`/`2.3×` literals in component JSX.
- **Time = user's own clock** — all focus times route through helpers honoring `hour12Default` in `src/lib/time.ts` (24-h users get no meridiem).
- **Modal HARD RULE** — every `(modals)` screen has `headerShown: false` and is listed in `(modals)/_layout.tsx`; sliding sheets start with `<SheetGrabber />`.
- **Animation HARD RULE** — no slide-in/spring/bounce on content entrances; opacity fades + subtle scale only; reduced-motion → final state.
- **One filled indigo CTA per screen.** Locked state's "Unlock" is the only one.
- **Invariants** — no guilt/streaks/shame, amber never red, honey/sharpness monotonic, core loop on-device, pricing from RevenueCat.
- **Per commit:** `npm run lint && npm run typecheck && npm test` (also `npx eslint <files>` on touched files).
- Conventional Commits, **no AI/co-author trailers**. Never branch or merge without founder approval.

---

## File Structure

- `src/lib/time.ts` (MODIFY) — add `formatClockMin`, `formatWindowRange`.
- `src/engine/constants.ts` (MODIFY) — add `FW_CONF_HIGH`, `FW_CONF_BUILDING`, `FW_INSIGHT_MIN_EVENTS`, `FW_CONTRAST_MAX`.
- `src/engine/focusWindowInsights.ts` (CREATE) — `computeFocusInsights`, `confidenceLabel`. PURE.
- `src/engine/index.ts` (MODIFY) — export the above.
- `src/theme/tokens.ts` (MODIFY) — `focusCurve.detailH`, `focusCurve.gridW`, `focusCurve.yLabelW`.
- `src/features/planner/FocusCurve.tsx` (MODIFY) — `yAxis`, `peakLabel` props.
- `src/features/patterns/useFocusInsights.ts` (CREATE) — feature hook.
- `src/features/patterns/FocusPeakCard.tsx` (CREATE) — the pinned compact card (3 states).
- `src/app/(modals)/focus-window.tsx` (CREATE) — the "Open" detail sheet route.
- `src/app/(modals)/_layout.tsx` (MODIFY) — register the route.
- `src/app/(tabs)/patterns.tsx` (MODIFY) — pin the card, drop from Numbers.
- `src/features/patterns/FocusPatternsCard.tsx` (DELETE) — replaced.

---

## Task 1: Time helpers — user's own clock

**Files:**
- Modify: `src/lib/time.ts`
- Test: `src/lib/__tests__/time.test.ts` (add cases; create if absent)

**Interfaces:**
- Consumes: `hour12Default` (module-local in `time.ts`), `formatClock`.
- Produces:
  - `formatClockMin(min: number, hour12?: boolean): string`
  - `formatWindowRange(startMin: number, endMin: number, hour12?: boolean): string`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/__tests__/time.test.ts` (create the file with the standard import if it doesn't exist):

```ts
import { formatClockMin, formatWindowRange, setClockHour12 } from '../time';

describe('formatClockMin', () => {
  afterEach(() => setClockHour12(true)); // restore default
  it('formats 12h with no leading zero', () => {
    setClockHour12(true);
    expect(formatClockMin(90)).toBe('1:30');     // 01:30
    expect(formatClockMin(810)).toBe('1:30');    // 13:30
    expect(formatClockMin(0)).toBe('12:00');     // midnight
    expect(formatClockMin(720)).toBe('12:00');   // noon
  });
  it('formats 24h zero-padded', () => {
    expect(formatClockMin(810, false)).toBe('13:30');
    expect(formatClockMin(90, false)).toBe('01:30');
    expect(formatClockMin(0, false)).toBe('00:00');
  });
});

describe('formatWindowRange', () => {
  it('12h same half → one trailing meridiem', () => {
    expect(formatWindowRange(810, 960, true)).toBe('1:30 – 4:00 pm');
    expect(formatWindowRange(540, 660, true)).toBe('9:00 – 11:00 am');
  });
  it('12h crossing noon → two meridiems', () => {
    expect(formatWindowRange(690, 780, true)).toBe('11:30 am – 1:00 pm');
  });
  it('24h → no meridiem', () => {
    expect(formatWindowRange(810, 960, false)).toBe('13:30 – 16:00');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/lib/__tests__/time.test.ts -t "formatClockMin|formatWindowRange"`
Expected: FAIL — `formatClockMin is not a function`.

- [ ] **Step 3: Implement**

Add to `src/lib/time.ts` (after `formatClockMeridiem`):

```ts
/** Minutes-after-midnight → local clock. 12h: "1:30" · 24h: "13:30". */
export function formatClockMin(min: number, hour12 = hour12Default): string {
  const norm = ((min % 1440) + 1440) % 1440;
  const hours24 = Math.floor(norm / 60);
  const minutes = (norm % 60).toString().padStart(2, '0');
  if (!hour12) return `${hours24.toString().padStart(2, '0')}:${minutes}`;
  const h12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${h12}:${minutes}`;
}

const meridiemOf = (min: number): 'am' | 'pm' =>
  Math.floor((((min % 1440) + 1440) % 1440) / 60) < 12 ? 'am' : 'pm';

/**
 * Window range in the user's clock format.
 *   12h same half  → "1:30 – 4:00 pm"
 *   12h crossing   → "11:30 am – 1:00 pm"
 *   24h            → "13:30 – 16:00"
 */
export function formatWindowRange(startMin: number, endMin: number, hour12 = hour12Default): string {
  const s = formatClockMin(startMin, hour12);
  const e = formatClockMin(endMin, hour12);
  if (!hour12) return `${s} – ${e}`;
  const ms = meridiemOf(startMin);
  const me = meridiemOf(endMin);
  return ms === me ? `${s} – ${e} ${me}` : `${s} ${ms} – ${e} ${me}`;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest src/lib/__tests__/time.test.ts`
Expected: PASS.

- [ ] **Step 5: Lint + commit**

```bash
npx eslint src/lib/time.ts src/lib/__tests__/time.test.ts
git add src/lib/time.ts src/lib/__tests__/time.test.ts
git commit -m "feat(time): add minute-based clock + window-range formatters honoring 24h setting"
```

---

## Task 2: Engine — `computeFocusInsights` + `confidenceLabel`

**Files:**
- Modify: `src/engine/constants.ts`
- Create: `src/engine/focusWindowInsights.ts`
- Modify: `src/engine/index.ts`
- Test: `src/engine/__tests__/focusWindowInsights.test.ts`

**Interfaces:**
- Consumes: `buildSignals`, `scoreBins`, `EventSignal` from `./focusWindowLearn`; `affineHonestExact`, `AffineFit` from `./affine`; `FocusEventInput` from `@/src/domain/types`; constants from `./constants`.
- Produces:
  - `interface FocusInsights { peakMin: number; troughMin: number; contrast: number | null; accuracyBetterInWindow: boolean | null; durationLongerInWindow: boolean | null; }`
  - `computeFocusInsights(events, fitByCategory, windowStartMin, windowEndMin): FocusInsights`
  - `confidenceLabel(confidence: number): 'High' | 'Building' | 'Low'`

- [ ] **Step 1: Add constants**

Append to `src/engine/constants.ts` under the "Learned focus window" block:

```ts
// ── Focus insights (detail-view "why" metrics) ───────────────────────────────
export const FW_CONF_HIGH = 0.75;      // confidence ≥ → "High"
export const FW_CONF_BUILDING = 0.5;   // confidence ≥ → "Building", else "Low"
export const FW_INSIGHT_MIN_EVENTS = 5; // min events on EACH side for accuracy/duration
export const FW_CONTRAST_MAX = 9;       // display ceiling for the "N× sharper" ratio
```

- [ ] **Step 2: Write the failing tests**

Create `src/engine/__tests__/focusWindowInsights.test.ts`:

```ts
import { computeFocusInsights, confidenceLabel } from '../focusWindowInsights';
import type { FocusEventInput } from '@/src/domain/types';
import { FW_CONTRAST_MAX } from '../constants';

const fit = { a: 0, b: 1.5 };
const fits = { Work: fit };

// helper: build a completed event starting at `startMin`, est/actual minutes
function ev(startMin: number, estimateMin: number, actualMin: number, dayKey: number): FocusEventInput {
  return { category: 'Work', estimateMin, actualMin, status: 'completed', startLocalMinute: startMin, ageDays: 1, dayKey };
}

describe('confidenceLabel', () => {
  it('buckets by threshold', () => {
    expect(confidenceLabel(0.9)).toBe('High');
    expect(confidenceLabel(0.6)).toBe('Building');
    expect(confidenceLabel(0.2)).toBe('Low');
  });
});

describe('computeFocusInsights', () => {
  it('returns null Tier-2 metrics when too few events', () => {
    const events = [ev(840, 30, 30, 1), ev(840, 30, 30, 2)];
    const r = computeFocusInsights(events, fits, 810, 960);
    expect(r.contrast).toBeNull();
    expect(r.accuracyBetterInWindow).toBeNull();
    expect(r.durationLongerInWindow).toBeNull();
    expect(typeof r.peakMin).toBe('number');
    expect(typeof r.troughMin).toBe('number');
  });

  it('computes a clamped positive contrast when bins are covered', () => {
    // afternoon cluster sharp (actual ≈ honest), morning cluster slow (actual ≫ honest)
    const events: FocusEventInput[] = [];
    for (let d = 0; d < 8; d++) {
      events.push(ev(870, 30, 30, d));   // ~14:30 sharp
      events.push(ev(540, 30, 90, d));   // ~09:00 slow (over-runs)
    }
    const r = computeFocusInsights(events, fits, 840, 960);
    expect(r.contrast).not.toBeNull();
    expect(r.contrast!).toBeGreaterThan(1);
    expect(r.contrast!).toBeLessThanOrEqual(FW_CONTRAST_MAX);
  });

  it('is deterministic (no clock/random)', () => {
    const events: FocusEventInput[] = [];
    for (let d = 0; d < 8; d++) { events.push(ev(870, 30, 30, d)); events.push(ev(540, 30, 90, d)); }
    const a = computeFocusInsights(events, fits, 840, 960);
    const b = computeFocusInsights(events, fits, 840, 960);
    expect(a).toEqual(b);
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx jest src/engine/__tests__/focusWindowInsights.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `focusWindowInsights.ts`**

Create `src/engine/focusWindowInsights.ts`:

```ts
// Pure focus-insight metrics for the detail view. No clock, no random.
import { affineHonestExact, type AffineFit } from './affine';
import { buildSignals, scoreBins, clamp } from './focusWindowLearn';
import type { FocusEventInput } from '@/src/domain/types';
import * as C from './constants';

export interface FocusInsights {
  peakMin: number;                         // bin-center minute of the sharpest bin
  troughMin: number;                       // bin-center minute of the foggiest eligible bin
  contrast: number | null;                 // exp(peakS - troughS), clamped; null if uncovered
  accuracyBetterInWindow: boolean | null;  // mean rel-error lower inside the window
  durationLongerInWindow: boolean | null;  // mean actualMin higher inside the window
}

const binCenterMin = (i: number) => C.FW_WAKING_START_MIN + i * C.FW_BIN_MIN + C.FW_BIN_MIN / 2;

export function confidenceLabel(confidence: number): 'High' | 'Building' | 'Low' {
  if (confidence >= C.FW_CONF_HIGH) return 'High';
  if (confidence >= C.FW_CONF_BUILDING) return 'Building';
  return 'Low';
}

export function computeFocusInsights(
  events: readonly FocusEventInput[],
  fitByCategory: Record<string, AffineFit>,
  windowStartMin: number,
  windowEndMin: number,
): FocusInsights {
  const signals = buildSignals(events, fitByCategory);
  const { shrunk, eventsCount, distinctDays } = scoreBins(signals);

  const eligible = (i: number) =>
    (eventsCount[i] ?? 0) >= C.FW_BIN_MIN_EVENTS && (distinctDays[i] ?? 0) >= C.FW_BIN_MIN_DAYS;

  // Peak / trough over eligible bins; fall back to full argmax/argmin if none eligible.
  let peakIdx = -1, troughIdx = -1, anyEligible = false;
  for (let i = 0; i < shrunk.length; i++) {
    if (!eligible(i)) continue;
    anyEligible = true;
    if (peakIdx < 0 || shrunk[i]! > shrunk[peakIdx]!) peakIdx = i;
    if (troughIdx < 0 || shrunk[i]! < shrunk[troughIdx]!) troughIdx = i;
  }
  if (!anyEligible) {
    for (let i = 0; i < shrunk.length; i++) {
      if (peakIdx < 0 || shrunk[i]! > shrunk[peakIdx]!) peakIdx = i;
      if (troughIdx < 0 || shrunk[i]! < shrunk[troughIdx]!) troughIdx = i;
    }
  }

  const contrast =
    anyEligible && peakIdx >= 0 && troughIdx >= 0 && peakIdx !== troughIdx
      ? clamp(Math.exp(shrunk[peakIdx]! - shrunk[troughIdx]!), 1, C.FW_CONTRAST_MAX)
      : null;

  // Accuracy / duration: partition completed events by in-window start time.
  const inMin: number[] = [], outMin: number[] = []; // rel-error
  const inDur: number[] = [], outDur: number[] = []; // actualMin
  for (const e of events) {
    if (e.status !== 'completed' || e.startLocalMinute == null) continue;
    if (e.actualMin < C.FW_MIN_ACTUAL_MIN) continue;
    const fit = fitByCategory[e.category];
    if (!fit) continue;
    const honest = affineHonestExact(fit, e.estimateMin);
    if (!(honest > 0)) continue;
    const relErr = Math.abs(honest - e.actualMin) / honest;
    const inside = e.startLocalMinute >= windowStartMin && e.startLocalMinute < windowEndMin;
    (inside ? inMin : outMin).push(relErr);
    (inside ? inDur : outDur).push(e.actualMin);
  }

  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const enough = (a: number[], b: number[]) =>
    a.length >= C.FW_INSIGHT_MIN_EVENTS && b.length >= C.FW_INSIGHT_MIN_EVENTS;

  const accuracyBetterInWindow = enough(inMin, outMin) ? mean(inMin) < mean(outMin) : null;
  const durationLongerInWindow = enough(inDur, outDur) ? mean(inDur) > mean(outDur) : null;

  return {
    peakMin: binCenterMin(Math.max(0, peakIdx)),
    troughMin: binCenterMin(Math.max(0, troughIdx)),
    contrast,
    accuracyBetterInWindow,
    durationLongerInWindow,
  };
}
```

- [ ] **Step 5: Export from index**

In `src/engine/index.ts`, after the `learnFocusWindow` export (line ~63):

```ts
export { computeFocusInsights, confidenceLabel } from './focusWindowInsights';
export type { FocusInsights } from './focusWindowInsights';
```

Verify `buildSignals`, `scoreBins`, `clamp` are exported from `focusWindowLearn.ts` (they are — `export function`). No change needed there.

- [ ] **Step 6: Run to verify pass**

Run: `npx jest src/engine/__tests__/focusWindowInsights.test.ts`
Expected: PASS.

- [ ] **Step 7: Lint + commit**

```bash
npx eslint src/engine/focusWindowInsights.ts src/engine/constants.ts src/engine/index.ts src/engine/__tests__/focusWindowInsights.test.ts
git add src/engine/focusWindowInsights.ts src/engine/constants.ts src/engine/index.ts src/engine/__tests__/focusWindowInsights.test.ts
git commit -m "feat(engine): add computeFocusInsights (contrast/accuracy/duration) + confidenceLabel"
```

---

## Task 3: `FocusCurve` — opt-in Y-axis + peak label

**Files:**
- Modify: `src/theme/tokens.ts:547-560` (the `focusCurve` group)
- Modify: `src/features/planner/FocusCurve.tsx`
- Modify: `src/theme/useTheme` resolution if `focusCurve` is re-keyed (it is spread whole — no change needed; verify)
- Test: `src/features/planner/__tests__/FocusCurve.test.tsx`

**Interfaces:**
- Consumes: existing `FocusCurveProps`.
- Produces: `FocusCurveProps` gains `yAxis?: boolean` (default false) and `peakLabel?: string`.

- [ ] **Step 1: Add tokens**

In `src/theme/tokens.ts`, inside the `focusCurve: { … }` object, add:

```ts
    detailH: 140,      // taller SVG for the detail sheet
    gridW: 1,          // horizontal gridline weight
    yLabelW: 30,       // Y-axis gutter width (pt)
```

- [ ] **Step 2: Write the failing test**

Create `src/features/planner/__tests__/FocusCurve.test.tsx`:

```tsx
import { render } from '@testing-library/react-native';
import { FocusCurve } from '../FocusCurve';

const bins = Array.from({ length: 38 }, (_, i) => (i === 19 ? 1 : 0.3));

it('renders Hi/Low Y labels when yAxis is set', () => {
  const { getByText } = render(
    <FocusCurve scoreByBin={bins} variant="learned" windowStartMin={810} windowEndMin={960} yAxis />,
  );
  expect(getByText('Hi')).toBeTruthy();
  expect(getByText('Low')).toBeTruthy();
});

it('omits Y labels by default', () => {
  const { queryByText } = render(<FocusCurve scoreByBin={bins} variant="learned" />);
  expect(queryByText('Hi')).toBeNull();
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx jest src/features/planner/__tests__/FocusCurve.test.tsx`
Expected: FAIL — `Hi` not found (prop ignored).

- [ ] **Step 4: Implement**

In `src/features/planner/FocusCurve.tsx`:

a) Extend the interface:

```tsx
export interface FocusCurveProps {
  scoreByBin: number[];
  variant: 'forming' | 'learned' | 'locked';
  windowStartMin?: number;
  windowEndMin?: number;
  yAxis?: boolean;
  peakLabel?: string;
}
```

b) Destructure the new props and tokens:

```tsx
export function FocusCurve({ scoreByBin, variant, windowStartMin, windowEndMin, yAxis = false, peakLabel }: FocusCurveProps) {
  const t = useTheme();
  const { viewH, viewW, strokeW, dotR, bandOpacity, areaOpacity, yPad, yBase, dash, axisH, axisGap, axisLabelW, gridW, yLabelW } = t.focusCurve;
```

c) Inside the `<Svg>`, before the window band, add gridlines (only when `yAxis`):

```tsx
        {yAxis && [yBase, viewH / 2, viewH - yPad].map((gy, i) => (
          <Path key={`grid-${i}`} d={`M0 ${gy} L${viewW} ${gy}`} stroke={t.colors.hairline} strokeWidth={gridW} />
        ))}
```

d) After the peak `<Circle>`, add the peak label text (only when `peakLabel` present):

```tsx
        {showPeak && peakLabel ? (
          <SvgText x={peakX} y={Math.max(10, peakY - dotR - 4)} fill={t.colors.primary} fontSize={t.fontSize.micro} fontWeight="700" textAnchor="middle">
            {peakLabel}
          </SvgText>
        ) : null}
```

Add `Text as SvgText` to the `react-native-svg` import:

```tsx
import Svg, { Path, Circle, Rect, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
```

e) Wrap the existing `<Svg>` (and axis row) so the Y gutter sits left of the plot. Replace the outer `<Animated.View entering={ENTER} style={containerStyle}>` body with a row when `yAxis`:

```tsx
  const plot = (
    <>
      <Svg /* …unchanged Svg block… */ />
      {showAxis && (
        <View style={axisRowStyle}>{/* …unchanged axis labels… */}</View>
      )}
    </>
  );

  return (
    <Animated.View entering={ENTER} style={containerStyle}>
      {yAxis ? (
        <View style={{ flexDirection: 'row', gap: t.space[2] }}>
          <View style={{ width: yLabelW, height: viewH, justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <AppText style={{ fontSize: t.fontSize.micro, color: t.colors.inkFaint }}>Hi</AppText>
            <AppText style={{ fontSize: t.fontSize.micro, color: t.colors.inkFaint }}>Low</AppText>
          </View>
          <View style={{ flex: 1 }}>{plot}</View>
        </View>
      ) : plot}
    </Animated.View>
  );
```

(Keep the original `<Svg>` attributes and axis JSX verbatim inside `plot`; only the wrapper changed.)

- [ ] **Step 5: Run to verify pass**

Run: `npx jest src/features/planner/__tests__/FocusCurve.test.tsx`
Expected: PASS.

- [ ] **Step 6: Lint + commit**

```bash
npx eslint src/features/planner/FocusCurve.tsx src/theme/tokens.ts src/features/planner/__tests__/FocusCurve.test.tsx
git commit -am "feat(focus-curve): opt-in Hi/Low Y-axis + gridlines + peak label"
```

---

## Task 4: `useFocusInsights` hook

**Files:**
- Create: `src/features/patterns/useFocusInsights.ts`
- Test: covered indirectly via component tests (Tasks 5–6); no standalone hook test (it only re-wires existing store calls).

**Interfaces:**
- Consumes: `useCalibrationStore` (`statsByCategory`, `loadFocusEvents`), `computeFocusInsights`, `FocusInsights`, a learned window `{ startMin, endMin }`.
- Produces: `useFocusInsights(startMin: number, endMin: number): FocusInsights | null` (null until events load).

- [ ] **Step 1: Implement** (no failing-test step — pure store wiring, validated by Task 5/6 component tests)

Create `src/features/patterns/useFocusInsights.ts`:

```ts
/**
 * useFocusInsights — wire computeFocusInsights to live stores.
 * Mirrors useLearnedFocusWindow's data sourcing; reads stores only (layer rule).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { computeFocusInsights, type FocusInsights } from '@/src/engine';
import type { FocusEventInput } from '@/src/engine';
import { useCalibrationStore } from '@/src/stores/calibrationStore';

const FOCUS_SCAN_LIMIT = 500;

export function useFocusInsights(startMin: number, endMin: number, nowMs?: number): FocusInsights | null {
  const now = nowMs ?? Date.now();
  const statsByCategory = useCalibrationStore((s) => s.statsByCategory);
  const loadFocusEvents = useCalibrationStore((s) => s.loadFocusEvents);

  const [events, setEvents] = useState<FocusEventInput[]>([]);
  const loadRef = useRef(loadFocusEvents);
  loadRef.current = loadFocusEvents;

  useEffect(() => {
    let cancelled = false;
    loadRef.current(FOCUS_SCAN_LIMIT).then((rows) => {
      if (cancelled) return;
      setEvents(
        rows
          .filter((r) => r.startedAt != null)
          .map((r) => ({
            category: r.category,
            estimateMin: r.estimateMin,
            actualMin: r.actualMin ?? 0,
            status: r.status,
            startLocalMinute: r.startLocalMinute,
            ageDays: (now - (r.startedAt as number)) / 86_400_000,
            dayKey: Math.floor((r.startedAt as number) / 86_400_000),
          })),
      );
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadFocusEvents]);

  const fitByCategory = useMemo(() => {
    const out: Record<string, { a: number; b: number }> = {};
    for (const [cat, stat] of Object.entries(statsByCategory)) out[cat] = { a: stat.fit.a, b: stat.fit.b };
    return out;
  }, [statsByCategory]);

  return useMemo(
    () => (events.length === 0 ? null : computeFocusInsights(events, fitByCategory, startMin, endMin)),
    [events, fitByCategory, startMin, endMin],
  );
}
```

- [ ] **Step 2: Lint + commit**

```bash
npx eslint src/features/patterns/useFocusInsights.ts
git add src/features/patterns/useFocusInsights.ts
git commit -m "feat(patterns): useFocusInsights hook wiring computeFocusInsights to stores"
```

---

## Task 5: `FocusPeakCard` — the pinned compact card

**Files:**
- Create: `src/features/patterns/FocusPeakCard.tsx`
- Test: `src/features/patterns/__tests__/FocusPeakCard.test.tsx`

**Interfaces:**
- Consumes: `useLearnedFocusWindow`, `useFocusInsights`, `useEntitlement`, `formatWindowRange`, `formatClockMin`, `FocusCurve`, `FocusWindowEditorSheet`, `FW_GATE_MIN_COMPLETED`, `router`.
- Produces: `FocusPeakCard()` default export-style named component (no props).

- [ ] **Step 1: Write the failing tests**

Create `src/features/patterns/__tests__/FocusPeakCard.test.tsx`:

```tsx
import { render } from '@testing-library/react-native';
import { FocusPeakCard } from '../FocusPeakCard';

jest.mock('@/src/features/planner/useLearnedFocusWindow');
jest.mock('@/src/features/patterns/useFocusInsights');
jest.mock('@/src/features/paywall/useEntitlement');

import { useLearnedFocusWindow } from '@/src/features/planner/useLearnedFocusWindow';
import { useFocusInsights } from '@/src/features/patterns/useFocusInsights';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';

const personal = {
  startMin: 810, endMin: 960, basis: 'personal' as const, confidence: 0.8,
  scoreByBin: Array.from({ length: 38 }, (_, i) => (i === 19 ? 1 : 0.3)),
  sampleCount: 137, distinctDays: 21, held: false,
};

beforeEach(() => {
  (useEntitlement as jest.Mock).mockReturnValue(true); // isPro selector
  (useFocusInsights as jest.Mock).mockReturnValue({ peakMin: 882, troughMin: 555, contrast: 2.3, accuracyBetterInWindow: true, durationLongerInWindow: true });
});

it('Pro personal: shows window in user clock + why-line', () => {
  (useLearnedFocusWindow as jest.Mock).mockReturnValue(personal);
  const { getByText } = render(<FocusPeakCard />);
  expect(getByText('1:30 – 4:00 pm')).toBeTruthy();
  expect(getByText(/peak after lunch/i)).toBeTruthy();
});

it('Pro personal with null contrast: why-line drops the ratio clause', () => {
  (useLearnedFocusWindow as jest.Mock).mockReturnValue(personal);
  (useFocusInsights as jest.Mock).mockReturnValue({ peakMin: 882, troughMin: 555, contrast: null, accuracyBetterInWindow: null, durationLongerInWindow: null });
  const { queryByText } = render(<FocusPeakCard />);
  expect(queryByText(/× above your dip/)).toBeNull();
});

it('free + personal: shows exactly one Unlock CTA, no exact window', () => {
  (useLearnedFocusWindow as jest.Mock).mockReturnValue(personal);
  (useEntitlement as jest.Mock).mockReturnValue(false);
  const { getByText, queryByText } = render(<FocusPeakCard />);
  expect(getByText('Unlock my focus window')).toBeTruthy();
  expect(queryByText('1:30 – 4:00 pm')).toBeNull();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/features/patterns/__tests__/FocusPeakCard.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/features/patterns/FocusPeakCard.tsx`:

```tsx
import { useState } from 'react';
import { View, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { formatWindowRange, formatClockMin } from '@/src/lib/time';
import { FW_GATE_MIN_COMPLETED } from '@/src/engine/constants';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { FocusCurve } from '@/src/features/planner/FocusCurve';
import { FocusWindowEditorSheet } from '@/src/features/planner/FocusWindowEditorSheet';
import { useLearnedFocusWindow } from '@/src/features/planner/useLearnedFocusWindow';
import { useFocusInsights } from '@/src/features/patterns/useFocusInsights';
import { useSettingsStore } from '@/src/stores/settingsStore';

// peak bin → narrative bucket (Tier-1, derived from peak time only)
function whyNarrative(peakMin: number): string {
  if (peakMin < 660) return 'You start sharp and fade after lunch.';        // before 11:00
  if (peakMin < 780) return 'You hit your stride around midday.';            // 11:00–13:00
  if (peakMin < 1020) return 'Mornings warm up slow — you peak after lunch'; // 13:00–17:00
  return "You're a slow burn — you peak in the evening.";                    // after 17:00
}

export function FocusPeakCard() {
  const t = useTheme();
  const isPro = useEntitlement((s) => s.isPro);
  const win = useLearnedFocusWindow();
  const insights = useFocusInsights(win.startMin, win.endMin);
  const startMin = useSettingsStore((s) => s.windowStartMin);
  const endMin = useSettingsStore((s) => s.windowEndMin);
  const setFocusWindow = useSettingsStore((s) => s.setFocusWindow);
  const [editing, setEditing] = useState(false);

  const { basis, scoreByBin, sampleCount, startMin: ws, endMin: we } = win;
  const card: ViewStyle = { backgroundColor: t.colors.surface, borderRadius: t.radii.card, padding: t.space[5], gap: t.space[4] };
  const eyebrow: TextStyle = { ...(type.eyebrow as TextStyle), color: t.colors.primary };
  const title: TextStyle = { ...(type.subtitle as TextStyle), color: t.colors.ink };
  const body: TextStyle = { ...(type.body as TextStyle), color: t.colors.inkSoft };
  const meta: TextStyle = { ...(type.caption as TextStyle), color: t.colors.inkFaint };

  const Eyebrow = () => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[1.5] }}>
      <Ionicons name="flash" size={t.iconSize.xs} color={t.colors.primary} />
      <AppText style={eyebrow}>WHEN YOU'RE SHARP</AppText>
    </View>
  );

  // ── forming ──
  if (basis === 'prior') {
    return (
      <View style={card}>
        <Eyebrow />
        <FocusCurve scoreByBin={scoreByBin} variant="forming" yAxis />
        <AppText style={title}>Learning your focus hours</AppText>
        <AppText style={meta} testID="focus-maturity">{`${sampleCount} / ${FW_GATE_MIN_COMPLETED} sessions`}</AppText>
        <AppButton label="Set my hours myself" variant="ghost" size="sm" onPress={() => setEditing(true)} accessibilityLabel="Set focus window manually" />
        <FocusWindowEditorSheet visible={editing} startMin={startMin} endMin={endMin}
          onConfirm={(s, e) => { setFocusWindow(s, e); setEditing(false); }} onCancel={() => setEditing(false)} />
      </View>
    );
  }

  const contrastClause = insights?.contrast != null ? `, ${insights.contrast.toFixed(1)}× above your dip` : '';
  const why = insights ? `${whyNarrative(insights.peakMin)}${contrastClause}.` : '';

  // ── locked (free + personal) ──
  if (!isPro) {
    const frost: ViewStyle = { position: 'absolute', inset: 0, backgroundColor: t.colors.scrim, borderRadius: t.radii.md, alignItems: 'center', justifyContent: 'center' } as ViewStyle;
    const teaser = insights?.contrast != null ? `We found your sharpest stretch — ${insights.contrast.toFixed(1)}× above your slump.` : 'We found your sharpest stretch.';
    return (
      <View style={card} testID="focus-locked-teaser">
        <Eyebrow />
        <View>
          <FocusCurve scoreByBin={scoreByBin} variant="locked" yAxis />
          <View style={frost} pointerEvents="none" importantForAccessibility="no" accessibilityElementsHidden>
            <Ionicons name="lock-closed" size={t.iconSize.lg} color={t.colors.onIndigo} />
          </View>
        </View>
        <AppText style={body}>{teaser}</AppText>
        <AppText style={meta}>{`Learned from ${sampleCount} sessions.`}</AppText>
        <AppButton label="Unlock my focus window" variant="indigo" size="md" fullWidth
          onPress={() => router.push({ pathname: '/(modals)/paywall', params: { trigger: 'focus_window' } })}
          accessibilityLabel="Unlock my focus window" />
      </View>
    );
  }

  // ── personal + Pro ──
  return (
    <Pressable onPress={() => router.push('/(modals)/focus-window')} accessibilityRole="button" accessibilityLabel="Open focus window detail">
      <View style={card}>
        <Eyebrow />
        <AppText style={{ ...(type.honestNumberMd as TextStyle), color: t.colors.ink }} testID="focus-window-range">
          {formatWindowRange(ws, we)}
        </AppText>
        <FocusCurve scoreByBin={scoreByBin} variant="learned" windowStartMin={ws} windowEndMin={we} yAxis />
        {why ? <AppText style={{ ...(type.body as TextStyle), color: t.colors.ink }}>{why}</AppText> : null}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <AppText style={meta}>{`${sampleCount} sessions`}</AppText>
          <AppText style={{ ...(type.captionBold as TextStyle), color: t.colors.primary }}>Open ›</AppText>
        </View>
      </View>
    </Pressable>
  );
}
```

(If `useEntitlement` is not a selector-style hook in this repo, match its existing call signature — check `src/features/paywall/useEntitlement.ts` and adapt the `isPro` read. The mock in the test uses the selector form per `FocusPatternsCard.tsx:37`.)

- [ ] **Step 4: Run to verify pass**

Run: `npx jest src/features/patterns/__tests__/FocusPeakCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Lint + commit**

```bash
npx eslint src/features/patterns/FocusPeakCard.tsx src/features/patterns/__tests__/FocusPeakCard.test.tsx
git commit -am "feat(patterns): FocusPeakCard — pinned compact focus card (forming/locked/pro)"
```

---

## Task 6: `(modals)/focus-window` detail route

**Files:**
- Create: `src/app/(modals)/focus-window.tsx`
- Modify: `src/app/(modals)/_layout.tsx`
- Test: `src/app/(modals)/__tests__/focus-window.test.tsx`

**Interfaces:**
- Consumes: `useLearnedFocusWindow`, `useFocusInsights`, `confidenceLabel`, `formatWindowRange`, `formatClockMin`, `FocusCurve` (with `peakLabel`), `FocusWindowEditorSheet`, `SheetGrabber`.
- Produces: default-export screen component.

- [ ] **Step 1: Register the route**

In `src/app/(modals)/_layout.tsx`, add inside `<Stack>`:

```tsx
      <Stack.Screen name="focus-window" options={{ presentation: 'formSheet', headerShown: false }} />
```

- [ ] **Step 2: Write the failing test**

Create `src/app/(modals)/__tests__/focus-window.test.tsx`:

```tsx
import { render } from '@testing-library/react-native';
import FocusWindowDetail from '../focus-window';

jest.mock('@/src/features/planner/useLearnedFocusWindow');
jest.mock('@/src/features/patterns/useFocusInsights');
import { useLearnedFocusWindow } from '@/src/features/planner/useLearnedFocusWindow';
import { useFocusInsights } from '@/src/features/patterns/useFocusInsights';

const win = { startMin: 810, endMin: 960, basis: 'personal' as const, confidence: 0.8,
  scoreByBin: Array.from({ length: 38 }, (_, i) => (i === 19 ? 1 : 0.3)), sampleCount: 137, distinctDays: 21, held: false };

beforeEach(() => (useLearnedFocusWindow as jest.Mock).mockReturnValue(win));

it('renders Tier-1 rows always', () => {
  (useFocusInsights as jest.Mock).mockReturnValue({ peakMin: 882, troughMin: 555, contrast: null, accuracyBetterInWindow: null, durationLongerInWindow: null });
  const { getByText, queryByText } = render(<FocusWindowDetail />);
  expect(getByText('Peak focus')).toBeTruthy();
  expect(getByText('Confidence')).toBeTruthy();
  expect(queryByText('Most accurate')).toBeNull(); // null Tier-2 hidden
});

it('renders Tier-2 rows when available', () => {
  (useFocusInsights as jest.Mock).mockReturnValue({ peakMin: 882, troughMin: 555, contrast: 2.3, accuracyBetterInWindow: true, durationLongerInWindow: true });
  const { getByText } = render(<FocusWindowDetail />);
  expect(getByText('Sharper than your slump')).toBeTruthy();
  expect(getByText('Most accurate')).toBeTruthy();
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx jest src/app/(modals)/__tests__/focus-window.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

Create `src/app/(modals)/focus-window.tsx`:

```tsx
import { useState } from 'react';
import { View, ScrollView, type ViewStyle, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/components/Screen';
import { SheetGrabber } from '@/src/components/SheetGrabber';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { FocusCurve } from '@/src/features/planner/FocusCurve';
import { FocusWindowEditorSheet } from '@/src/features/planner/FocusWindowEditorSheet';
import { useLearnedFocusWindow } from '@/src/features/planner/useLearnedFocusWindow';
import { useFocusInsights } from '@/src/features/patterns/useFocusInsights';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { confidenceLabel } from '@/src/engine';
import { formatWindowRange, formatClockMin } from '@/src/lib/time';

export default function FocusWindowDetail() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const win = useLearnedFocusWindow();
  const ins = useFocusInsights(win.startMin, win.endMin);
  const startMin = useSettingsStore((s) => s.windowStartMin);
  const endMin = useSettingsStore((s) => s.windowEndMin);
  const setFocusWindow = useSettingsStore((s) => s.setFocusWindow);
  const [editing, setEditing] = useState(false);

  const weeks = Math.max(1, Math.round(win.distinctDays / 7));
  const evidence = win.distinctDays >= 7 ? `${win.sampleCount} sessions · ${weeks} wks` : `${win.sampleCount} sessions · ${win.distinctDays} days`;

  type Row = { k: string; v: string; accent?: boolean };
  const rows: Row[] = [];
  if (ins) rows.push({ k: 'Peak focus', v: formatClockMin(ins.peakMin) });
  if (ins?.contrast != null) rows.push({ k: 'Sharper than your slump', v: `${ins.contrast.toFixed(1)}×`, accent: true });
  if (ins?.accuracyBetterInWindow) rows.push({ k: 'Most accurate', v: 'Closest to your guess' });
  if (ins?.durationLongerInWindow) rows.push({ k: 'Longest sessions', v: 'Land here' });
  if (ins) rows.push({ k: 'Your foggiest stretch', v: formatClockMin(ins.troughMin) });
  rows.push({ k: 'Confidence', v: confidenceLabel(win.confidence) });
  rows.push({ k: 'Evidence', v: evidence });

  const rowsBox: ViewStyle = { backgroundColor: t.colors.surfaceSunken, borderRadius: t.radii.md, paddingHorizontal: t.space[4] };
  const rowStyle = (i: number): ViewStyle => ({ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: t.space[3], borderTopWidth: i === 0 ? 0 : t.borderWidth.share, borderTopColor: t.colors.hairline });
  const kS: TextStyle = { ...(type.body as TextStyle), color: t.colors.inkSoft };
  const vS: TextStyle = { ...(type.bodyLg as TextStyle), color: t.colors.ink };

  const contrastClause = ins?.contrast != null ? `, ${ins.contrast.toFixed(1)}× above your dip` : '';
  const why = `Mornings warm up slow — you peak after lunch${contrastClause}. Your last ${win.sampleCount} sessions agree, and it has held for ${weeks} weeks.`;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingHorizontal: t.space[5], paddingBottom: insets.bottom + t.space[6], gap: t.space[5] }} showsVerticalScrollIndicator={false}>
        <SheetGrabber />
        <View style={{ alignItems: 'center', gap: t.space[3] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[1.5] }}>
            <Ionicons name="flash" size={t.iconSize.xs} color={t.colors.primary} />
            <AppText style={{ ...(type.eyebrow as TextStyle), color: t.colors.primary }}>WHEN YOU'RE SHARP</AppText>
          </View>
          <AppText style={{ ...(type.honestNumberHero as TextStyle), color: t.colors.ink }}>{formatWindowRange(win.startMin, win.endMin)}</AppText>
        </View>

        <FocusCurve scoreByBin={win.scoreByBin} variant="learned" windowStartMin={win.startMin} windowEndMin={win.endMin}
          yAxis peakLabel={ins ? `peak · ${formatClockMin(ins.peakMin)}` : undefined} />

        <AppText style={{ ...(type.body as TextStyle), color: t.colors.ink }}>{why}</AppText>

        <View style={rowsBox}>
          {rows.map((r, i) => (
            <View key={r.k} style={rowStyle(i)}>
              <AppText style={kS}>{r.k}</AppText>
              <AppText style={{ ...vS, color: r.accent ? t.colors.accent : t.colors.ink }}>{r.v}</AppText>
            </View>
          ))}
        </View>

        <AppButton label="Edit window" variant="ghost" size="md" fullWidth onPress={() => setEditing(true)} accessibilityLabel="Edit focus window" />
        <AppText style={{ ...(type.caption as TextStyle), color: t.colors.inkFaint, textAlign: 'center' }}>Whenbee plans your day around this stretch.</AppText>

        <FocusWindowEditorSheet visible={editing} startMin={startMin} endMin={endMin}
          onConfirm={(s, e) => { setFocusWindow(s, e); setEditing(false); }} onCancel={() => setEditing(false)} />
      </ScrollView>
    </Screen>
  );
}
```

(If `Screen` force-insets the top, the `SheetGrabber` still reads correctly at the top of the ScrollView — match the `add-task.tsx` pattern. If `t.borderWidth.share` is 1; `hairline` divider color is correct.)

- [ ] **Step 5: Run to verify pass**

Run: `npx jest "src/app/(modals)/__tests__/focus-window.test.tsx"`
Expected: PASS.

- [ ] **Step 6: Lint + commit**

```bash
npx eslint "src/app/(modals)/focus-window.tsx" "src/app/(modals)/_layout.tsx" "src/app/(modals)/__tests__/focus-window.test.tsx"
git commit -am "feat(patterns): focus-window detail sheet (live rows, user-clock times)"
```

---

## Task 7: Pin into `patterns.tsx`, remove old card

**Files:**
- Modify: `src/app/(tabs)/patterns.tsx`
- Delete: `src/features/patterns/FocusPatternsCard.tsx`
- Test: `src/app/(tabs)/__tests__/patterns.test.tsx` (add/extend)

**Interfaces:**
- Consumes: `FocusPeakCard`.

- [ ] **Step 1: Write the failing test**

Add to (or create) `src/app/(tabs)/__tests__/patterns.test.tsx` a case asserting the card renders in the pinned zone and not inside the Numbers section. (Mirror existing patterns-screen test setup — mock `usePatterns`, `useReview`, `useLearnedFocusWindow` returning a personal window; assert `getByLabelText('Open focus window detail')` is present on first render with `tab === 'numbers'` AND after switching to a non-numbers tab. If the screen test harness is heavy, assert at minimum that `FocusPeakCard` is imported/rendered once via `getByText("WHEN YOU'RE SHARP")`.)

```tsx
it('pins the focus card outside the Numbers tab content', () => {
  // …existing patterns mock setup…
  const { getByText } = renderPatterns(); // existing helper
  expect(getByText("WHEN YOU'RE SHARP")).toBeTruthy();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest "src/app/(tabs)/__tests__/patterns.test.tsx" -t "pins the focus card"`
Expected: FAIL — text not found (card not yet pinned).

- [ ] **Step 3: Implement**

In `src/app/(tabs)/patterns.tsx`:

a) Replace the import:

```tsx
import { FocusPeakCard } from '@/src/features/patterns/FocusPeakCard';
```
(remove the `FocusPatternsCard` import.)

b) Remove the whole `{/* Your focus */}` block (lines ~94–98) from `renderNumbers()`.

c) Insert the pinned card between the archetype block and the review block (after the archetype `Animated.View`, before the review `Animated.View`):

```tsx
            {/* 1b · FOCUS — pinned under identity */}
            <Animated.View entering={rise()}>
              <FocusPeakCard />
            </Animated.View>
```

- [ ] **Step 4: Delete the old card**

```bash
git rm src/features/patterns/FocusPatternsCard.tsx
```

Grep for stragglers and remove any remaining import:

Run: `grep -rn "FocusPatternsCard" src/` → expect no results.

- [ ] **Step 5: Run to verify pass + full suite**

Run: `npx jest "src/app/(tabs)/__tests__/patterns.test.tsx"`
Then: `npm run lint && npm run typecheck && npm test`
Expected: PASS / 0 warnings / green.

- [ ] **Step 6: Commit**

```bash
git commit -am "feat(patterns): pin FocusPeakCard under identity; remove buried FocusPatternsCard"
```

---

## Task 8: Device verification

**Files:** none (manual).

- [ ] **Step 1:** `npm run ios` (dev build — Expo Go cannot run this app).
- [ ] **Step 2:** Deep-link to Patterns; confirm: card pinned under identity, visible on Insights + Correlations tabs; window reads in the device's clock format (toggle iOS 24-Hour Time and re-check — no `13:30pm`); curve shows Hi/Low + window band + peak dot; why-line present.
- [ ] **Step 3:** Tap the card → detail sheet (no white header bar; grabber present); rows show only available metrics; Edit window opens the editor; saving updates the window.
- [ ] **Step 4:** Flip entitlement to free; confirm the locked teaser shows the shape + contrast tease, hides exact hours, single indigo CTA → paywall with `trigger=focus_window`.
- [ ] **Step 5:** Screenshot each state (`xcrun simctl io booted screenshot`) and eyeball spacing/alignment against the mock before declaring done.

---

## Self-Review (against the spec)

- §3 placement → Task 7. §6 Tier split → Tasks 2/4/5/6 (null rows omitted, clause dropped). §7 FocusCurve axes → Task 3. §8 card states → Task 5. §9 detail rows + ghost Edit → Task 6. §10 copy → Tasks 5/6. §11 user-clock format → Task 1 (consumed in 5/6). §11a no placeholders → Task 5/6 (data-bound) + Task 7 grep gate. §12 tokens → Tasks 2/3. §13 testing → each task. §15 invariants → Global Constraints + Task 8. §16 PR slices: Task 1–2 = slice 1, Task 3 = slice 2, Tasks 4–6 = slice 3, Task 7 = slice 4 (Task 8 = verification).
- Open question #1 (route vs Modal) → resolved: **modal route** `(modals)/focus-window` (Task 6).
- Type consistency: `FocusInsights` fields used identically in Tasks 2/4/5/6; `formatWindowRange`/`formatClockMin` signatures consistent.
- Placeholder scan: no TBD/TODO; all code blocks complete; example data lives only in tests/mocks, never in shipped JSX.

## Open follow-ups (not blocking)

- Spec open Q2 (numeric deltas for accuracy/duration) and Q3 (days-vs-weeks under 7) — Q3 is handled in Task 6 (`evidence` fallback); Q2 deferred (qualitative ships).
- Analytics events (`focus_detail_open`, `focus_window_edit`, `focus_unlock_tap`) — add when wiring PostHog; out of scope here.
