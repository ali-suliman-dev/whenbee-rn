import * as C from '../constants';
import { mulberry32, percentile, buildSignals, scoreBins, selectWindow, permutationStrength } from '@/src/engine/focusWindowLearn';
import { learnFocusWindow, peakBucketLabel } from '@/src/engine';
import type { FocusEventInput } from '@/src/domain/types';

// ── Task 1: Bin geometry (reveal-early: coarser 60-min bins) ──────────────────

describe('bin geometry (reveal-early: coarser 60-min bins)', () => {
  it('keeps FW_BIN_COUNT an integer at the coarser bin width', () => {
    expect(C.FW_BIN_MIN).toBe(60);
    expect((C.FW_WAKING_END_MIN - C.FW_WAKING_START_MIN) / C.FW_BIN_MIN).toBe(19);
    expect(Number.isInteger(C.FW_BIN_COUNT)).toBe(true);
    expect(C.FW_BIN_COUNT).toBe(19);
  });
});

// ── Task 3: PRNG + percentile helpers ────────────────────────────────────────

test('mulberry32 is deterministic for a seed', () => {
  const a = mulberry32(42); const b = mulberry32(42);
  expect([a(), a(), a()]).toEqual([b(), b(), b()]);
});

test('percentile picks the p-th value', () => {
  expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9)).toBe(9);
  expect(percentile([], 0.95)).toBe(0);
});

// ── Task 4: Per-event focus signals ──────────────────────────────────────────

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

// ── Task 5: Score bins ────────────────────────────────────────────────────────

const ev = (min: number, actual: number, dayKey: number) =>
  ({ category: 'admin', status: 'completed' as const, estimateMin: 30, actualMin: actual, startLocalMinute: min, ageDays: 0, dayKey });

test('a single extreme event is pulled toward the global mean, not left at its raw value', () => {
  const events = [ev(420, 3, 0)]; // one very-fast event (s clamped high ≈ ln3)
  for (let d = 0; d < 12; d++) events.push(ev(600, 30, d)); // baseline cluster, s≈0
  const { shrunk } = scoreBins(buildSignals(events, fit));
  const binAt = (m: number) => Math.round((m - 330) / 60);
  expect(shrunk[binAt(420)]!).toBeLessThan(0.6); // suppressed well below its raw clamped s≈1.1
});

test('a single outlier fast event never manufactures a revealed window (coverage + gate)', () => {
  const events: ReturnType<typeof ev>[] = [];
  for (let d = 0; d < 20; d++) for (const m of [360, 540, 720, 900, 1080]) events.push(ev(m, 28, d));
  events.push(ev(420, 3, 99)); // lone outlier, single day
  expect(learnFocusWindow({ events, fitByCategory: fit, shown: null }).basis).toBe('forming');
});

// ── Task 6: Select window ─────────────────────────────────────────────────────

const flat = { shrunk: new Array<number>(19).fill(0.1), eventsCount: new Array<number>(19).fill(8),
  distinctDays: new Array<number>(19).fill(6), mean: 0.1, sd: 0.0 };
const peak = (() => {
  const shrunk = new Array<number>(19).fill(0); shrunk[5] = 0.9; shrunk[6] = 0.85; shrunk[7] = 0.8;
  const eventsCount = new Array<number>(19).fill(0); const distinctDays = new Array<number>(19).fill(0);
  [5, 6, 7].forEach((i) => { eventsCount[i] = 8; distinctDays[i] = 5; });
  const mean = shrunk.reduce((a, b) => a + b, 0) / 19;
  const sd = Math.sqrt(shrunk.reduce((a, b) => a + (b - mean) ** 2, 0) / 19);
  return { shrunk, eventsCount, distinctDays, mean, sd };
})();

test('flat day yields no window; a covered peak yields a window', () => {
  expect(selectWindow(flat)).toBeNull();
  const w = selectWindow(peak);
  expect(w).not.toBeNull();
  expect(w!.endMin - w!.startMin).toBeGreaterThanOrEqual(90);
});

test('an uncovered peak yields no window (coverage floor)', () => {
  const s = { ...peak, eventsCount: new Array<number>(19).fill(2), distinctDays: new Array<number>(19).fill(2) };
  expect(selectWindow(s)).toBeNull();
});

// ── Task 7: Permutation strength ──────────────────────────────────────────────

test('injected real peak has strong permutation significance; pure spread of noise does not', () => {
  const peakEvents = [];
  for (let d = 0; d < 20; d++) { peakEvents.push(ev(600, 15, d)); peakEvents.push(ev(900, 30, d)); }
  expect(permutationStrength(buildSignals(peakEvents, fit), 1)).toBeGreaterThanOrEqual(C.FW_PERM_PCTL);

  const flatEvents = [];
  for (let d = 0; d < 20; d++) for (const m of [360, 540, 720, 900, 1080]) flatEvents.push(ev(m, 28, d));
  expect(permutationStrength(buildSignals(flatEvents, fit), 1)).toBeLessThan(C.FW_PERM_PCTL);
});

// ── Task 8: Hysteresis + assemble learnFocusWindow ───────────────────────────

const ev8 = (min: number, actual: number, dayKey: number, ageDays = dayKey) =>
  ({ category: 'admin', status: 'completed' as const, estimateMin: 30, actualMin: actual, startLocalMinute: min, ageDays, dayKey });

test('insufficient data → forming; rich peak → revealed; deterministic; hysteresis holds', () => {
  expect(learnFocusWindow({ events: [ev8(600, 20, 0)], fitByCategory: fit, shown: null }).basis).toBe('forming');

  const events = [];
  for (let d = 0; d < 20; d++) { events.push(ev8(600, 14, d)); events.push(ev8(630, 16, d)); events.push(ev8(900, 30, d)); }
  const a = learnFocusWindow({ events, fitByCategory: fit, shown: null });
  const b = learnFocusWindow({ events, fitByCategory: fit, shown: null });
  expect(a.basis).toBe('revealed');
  expect(a).toEqual(b);                              // determinism
  expect(a.scoreByBin).toHaveLength(19);

  // re-run with the just-learned window as "shown" recently → held, unchanged
  const held = learnFocusWindow({ events, fitByCategory: fit,
    shown: { startMin: a.startMin, endMin: a.endMin, lastMoveAtDays: 0 } });
  expect(held.startMin).toBe(a.startMin);
  expect(held.endMin).toBe(a.endMin);
});

// ── Task 1 (focus-unlock ladder): 2-gate ladder on LearnedFocusWindow ────────

test('gates: few signals reports raw have/need, no peak gate on the shape', () => {
  const events = [ev8(600, 20, 0), ev8(600, 20, 0, 1), ev8(600, 20, 1, 1)]; // 3 events, 2 distinct days
  const w = learnFocusWindow({ events, fitByCategory: fit, shown: null });
  expect(w.basis).toBe('forming');
  expect(w.gates.sessions).toEqual({ have: 3, need: 15 });
  expect(w.gates.days).toEqual({ have: 2, need: 5 });
  // @ts-expect-error — the peak gate no longer exists on FocusGates
  expect(w.gates.peak).toBeUndefined();
});

test('gates: sessions+days met but flat/bimodal spread → forming, gates report both met', () => {
  const flatEvents: ReturnType<typeof ev8>[] = [];
  for (let d = 0; d < 20; d++) for (const m of [360, 540, 720, 900, 1080]) flatEvents.push(ev8(m, 28, d));
  const w = learnFocusWindow({ events: flatEvents, fitByCategory: fit, shown: null });
  expect(w.basis).toBe('forming');
  expect(w.gates.sessions.have).toBeGreaterThanOrEqual(15);
  expect(w.gates.days.have).toBeGreaterThanOrEqual(5);
});

test('gates: a real revealed window reports both counting gates met', () => {
  const events: ReturnType<typeof ev8>[] = [];
  for (let d = 0; d < 20; d++) { events.push(ev8(600, 14, d)); events.push(ev8(630, 16, d)); events.push(ev8(900, 30, d)); }
  const w = learnFocusWindow({ events, fitByCategory: fit, shown: null });
  expect(w.basis).toBe('revealed');
  expect(w.gates.sessions.have).toBeGreaterThanOrEqual(15);
  expect(w.gates.days.have).toBeGreaterThanOrEqual(5);
});

// ── Task 3 (reveal-early): reveal at 2 gates, grade by confidence tier ──────

// Alternates a morning cluster (honest 36 >> actual 15 → a real signal) with an
// afternoon baseline (honest === actual → no signal) so the two bins diverge
// enough to clear FW_SD_MIN — a single-bin-only fixture is degenerate: its local
// mean always equals the global mean, so scoreBins reports zero variance no
// matter how large the honest/actual gap is.
function morningEvents(count: number, days: number): FocusEventInput[] {
  const out: FocusEventInput[] = [];
  for (let i = 0; i < count; i++) {
    const day = i % days;
    const morning = i % 2 === 0;
    out.push({
      category: 'work',
      estimateMin: 30,
      actualMin: morning ? 15 : 36,     // morning: honest(36) >> actual(15); afternoon: honest === actual
      status: 'completed',
      startLocalMinute: morning ? 570 : 900, // 09:30 morning peak vs 15:00 afternoon baseline
      ageDays: day,
      dayKey: day,
    });
  }
  return out;
}
const workFit = { work: { a: 0, b: 1.2 } };

describe('reveal-early focus window', () => {
  it('stays forming below the two gates, exposing only sessions + days', () => {
    const w = learnFocusWindow({ events: morningEvents(8, 4), fitByCategory: workFit, shown: null });
    expect(w.basis).toBe('forming');
    expect(w.gates.sessions).toEqual({ have: 8, need: C.FW_GATE_MIN_COMPLETED });
    expect(w.gates.days).toEqual({ have: 4, need: C.FW_GATE_MIN_DISTINCT_DAYS });
    // @ts-expect-error — the peak gate no longer exists on FocusGates
    expect(w.gates.peak).toBeUndefined();
  });

  it('reveals a window as soon as both gates clear, even at low confidence', () => {
    const w = learnFocusWindow({ events: morningEvents(15, 5), fitByCategory: workFit, shown: null });
    expect(w.basis).toBe('revealed');
    expect(w.coarseBlockLabel).toBe('Mornings');
    expect(['low', 'building', 'steady']).toContain(w.confidenceTier);
    expect(w.startMin).toBeLessThan(w.endMin);
  });

  it('climbs to steady confidence with many distinct days', () => {
    const w = learnFocusWindow({ events: morningEvents(60, 20), fitByCategory: workFit, shown: null });
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
