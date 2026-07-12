import * as C from '../constants';
import { mulberry32, percentile, buildSignals, scoreBins, selectWindow, passesPermutationGate } from '@/src/engine/focusWindowLearn';
import { learnFocusWindow } from '@/src/engine';

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

test('a single outlier fast event never manufactures a personal window (coverage + gate)', () => {
  const events: ReturnType<typeof ev>[] = [];
  for (let d = 0; d < 20; d++) for (const m of [360, 540, 720, 900, 1080]) events.push(ev(m, 28, d));
  events.push(ev(420, 3, 99)); // lone outlier, single day
  expect(learnFocusWindow({ events, fitByCategory: fit, shown: null }).basis).toBe('prior');
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

// ── Task 7: Permutation gate ──────────────────────────────────────────────────

test('injected real peak passes the gate; pure spread of noise does not', () => {
  const peakEvents = [];
  for (let d = 0; d < 20; d++) { peakEvents.push(ev(600, 15, d)); peakEvents.push(ev(900, 30, d)); }
  expect(passesPermutationGate(buildSignals(peakEvents, fit), 1)).toBe(true);

  const flatEvents = [];
  for (let d = 0; d < 20; d++) for (const m of [360, 540, 720, 900, 1080]) flatEvents.push(ev(m, 28, d));
  expect(passesPermutationGate(buildSignals(flatEvents, fit), 1)).toBe(false);
});

// ── Task 8: Hysteresis + assemble learnFocusWindow ───────────────────────────

const ev8 = (min: number, actual: number, dayKey: number, ageDays = dayKey) =>
  ({ category: 'admin', status: 'completed' as const, estimateMin: 30, actualMin: actual, startLocalMinute: min, ageDays, dayKey });

test('insufficient data → prior; rich peak → personal; deterministic; hysteresis holds', () => {
  expect(learnFocusWindow({ events: [ev8(600, 20, 0)], fitByCategory: fit, shown: null }).basis).toBe('prior');

  const events = [];
  for (let d = 0; d < 20; d++) { events.push(ev8(600, 14, d)); events.push(ev8(630, 16, d)); events.push(ev8(900, 30, d)); }
  const a = learnFocusWindow({ events, fitByCategory: fit, shown: null });
  const b = learnFocusWindow({ events, fitByCategory: fit, shown: null });
  expect(a.basis).toBe('personal');
  expect(a).toEqual(b);                              // determinism
  expect(a.scoreByBin).toHaveLength(19);

  // re-run with the just-learned window as "shown" recently → held, unchanged
  const held = learnFocusWindow({ events, fitByCategory: fit,
    shown: { startMin: a.startMin, endMin: a.endMin, lastMoveAtDays: 0 } });
  expect(held.startMin).toBe(a.startMin);
  expect(held.endMin).toBe(a.endMin);
});

// ── Task 1 (focus-unlock ladder): gates on LearnedFocusWindow ────────────────

test('gates: few signals reports raw have/need and no confirming peak', () => {
  const events = [ev8(600, 20, 0), ev8(600, 20, 0, 1), ev8(600, 20, 1, 1)]; // 3 events, 2 distinct days
  const w = learnFocusWindow({ events, fitByCategory: fit, shown: null });
  expect(w.basis).toBe('prior');
  expect(w.gates.sessions).toEqual({ have: 3, need: 15 });
  expect(w.gates.days).toEqual({ have: 2, need: 5 });
  expect(w.gates.peak.confirming).toBe(false);
});

test('gates: sessions+days met but flat/bimodal spread → prior, peak gate reflects coverage', () => {
  const flatEvents: ReturnType<typeof ev8>[] = [];
  for (let d = 0; d < 20; d++) for (const m of [360, 540, 720, 900, 1080]) flatEvents.push(ev8(m, 28, d));
  const w = learnFocusWindow({ events: flatEvents, fitByCategory: fit, shown: null });
  expect(w.basis).toBe('prior');
  expect(w.gates.sessions.have).toBeGreaterThanOrEqual(15);
  expect(w.gates.days.have).toBeGreaterThanOrEqual(5);
  expect(w.gates.peak.need).toBe(6);
  expect(w.gates.peak.confirming).toBe(w.gates.peak.have >= 6);
});

test('gates: a real personal window reports both counting gates met and confirming=false', () => {
  const events: ReturnType<typeof ev8>[] = [];
  for (let d = 0; d < 20; d++) { events.push(ev8(600, 14, d)); events.push(ev8(630, 16, d)); events.push(ev8(900, 30, d)); }
  const w = learnFocusWindow({ events, fitByCategory: fit, shown: null });
  expect(w.basis).toBe('personal');
  expect(w.gates.sessions.have).toBeGreaterThanOrEqual(15);
  expect(w.gates.days.have).toBeGreaterThanOrEqual(5);
  expect(w.gates.peak.confirming).toBe(false); // never true on the personal return
});

test('gates: peak.have is the strongest (highest-shrunk) covered bin, not the most-populous one', () => {
  const events: ReturnType<typeof ev8>[] = [];
  // Bin A (minute 600): fewer events, but a strong consistent signal (honest >> actual).
  for (let d = 0; d < 10; d++) events.push(ev8(600, 14, d));
  // Bin B (minute 900, far away → bimodal): more events, but near-zero signal (honest ≈ actual).
  for (let d = 100; d < 112; d++) events.push(ev8(900, 30, d));
  const w = learnFocusWindow({ events, fitByCategory: fit, shown: null });
  expect(w.gates.peak.have).toBe(10); // bin A's eventsCount, not bin B's 12
});
