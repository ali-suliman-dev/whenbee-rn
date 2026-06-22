import { mulberry32, percentile, buildSignals, scoreBins, selectWindow, passesPermutationGate } from '@/src/engine/focusWindowLearn';
import { learnFocusWindow } from '@/src/engine';

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
  const binAt = (m: number) => Math.round((m - 315) / 30);
  expect(shrunk[binAt(420)]!).toBeLessThan(0.6); // suppressed well below its raw clamped s≈1.1
});

test('a single outlier fast event never manufactures a personal window (coverage + gate)', () => {
  const events: ReturnType<typeof ev>[] = [];
  for (let d = 0; d < 20; d++) for (const m of [360, 540, 720, 900, 1080]) events.push(ev(m, 28, d));
  events.push(ev(420, 3, 99)); // lone outlier, single day
  expect(learnFocusWindow({ events, fitByCategory: fit, shown: null }).basis).toBe('prior');
});

// ── Task 6: Select window ─────────────────────────────────────────────────────

const flat = { shrunk: new Array<number>(38).fill(0.1), eventsCount: new Array<number>(38).fill(8),
  distinctDays: new Array<number>(38).fill(6), mean: 0.1, sd: 0.0 };
const peak = (() => {
  const shrunk = new Array<number>(38).fill(0); shrunk[10] = 0.9; shrunk[11] = 0.85; shrunk[12] = 0.8;
  const eventsCount = new Array<number>(38).fill(0); const distinctDays = new Array<number>(38).fill(0);
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
  const s = { ...peak, eventsCount: new Array<number>(38).fill(2), distinctDays: new Array<number>(38).fill(2) };
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
  expect(a.scoreByBin).toHaveLength(38);

  // re-run with the just-learned window as "shown" recently → held, unchanged
  const held = learnFocusWindow({ events, fitByCategory: fit,
    shown: { startMin: a.startMin, endMin: a.endMin, lastMoveAtDays: 0 } });
  expect(held.startMin).toBe(a.startMin);
  expect(held.endMin).toBe(a.endMin);
});
