// Pure, deterministic focus-window learning engine. No Date.now(), no ambient
// Math.random — all randomness is seeded via mulberry32. PURE TS only.
import { affineHonestExact, type AffineFit } from './affine';
import type { FocusEventInput, FocusGates, LearnFocusInput, LearnedFocusWindow } from '@/src/domain/types';
import * as C from './constants';

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Task 4: Per-event focus signals ──────────────────────────────────────────

export interface EventSignal { binPos: number; s: number; w: number; dayKey: number }

export function buildSignals(
  events: readonly FocusEventInput[],
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

// ── Task 5: Score bins ────────────────────────────────────────────────────────

export interface BinScores { shrunk: number[]; eventsCount: number[]; distinctDays: number[]; sd: number; mean: number }

export function scoreBins(signals: EventSignal[]): BinScores {
  const n = C.FW_BIN_COUNT;
  const W = new Array<number>(n).fill(0);
  const WS = new Array<number>(n).fill(0);
  const eventsCount = new Array<number>(n).fill(0);
  const daySets: Set<number>[] = Array.from({ length: n }, () => new Set());

  for (const sig of signals) {
    const lo = Math.floor(sig.binPos);
    const frac = sig.binPos - lo;
    for (const [idx, wfrac] of [[lo, 1 - frac], [lo + 1, frac]] as const) {
      if (idx < 0 || idx >= n || wfrac <= 0) continue;
      W[idx]! += sig.w * wfrac;
      WS[idx]! += sig.w * wfrac * sig.s;
    }
    const primary = clamp(Math.round(sig.binPos), 0, n - 1);
    eventsCount[primary]! += 1;
    daySets[primary]!.add(sig.dayKey);
  }

  const m = W.map((w, i) => (w > 0 ? WS[i]! / w : 0));
  const totalW = W.reduce((a, b) => a + b, 0);
  const globalMean = totalW > 0 ? WS.reduce((a, b) => a + b, 0) / totalW : 0;

  // EB-shrink each bin toward the GLOBAL mean (confidence weighting), THEN kernel-smooth
  // for contiguity. Shrinking toward a smoothed-LOCAL value let a single soft-split event
  // reinforce itself across its two bins and spike the displayed curve.
  const eb = m.map((mb, i) => (W[i]! * mb + C.FW_SHRINK_KAPPA * globalMean) / (W[i]! + C.FW_SHRINK_KAPPA));
  const k = C.FW_KERNEL;
  const shrunk = eb.map((_, i) => {
    const lo = eb[Math.max(0, i - 1)]!, mid = eb[i]!, hi = eb[Math.min(n - 1, i + 1)]!;
    return k[0]! * lo + k[1]! * mid + k[2]! * hi;
  });

  const mean = shrunk.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(shrunk.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  return { shrunk, eventsCount, distinctDays: daySets.map((s) => s.size), sd, mean };
}

// ── Task 6: Select window ─────────────────────────────────────────────────────

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

// ── Task 7: Permutation gate ──────────────────────────────────────────────────

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

// ── Task 8: Hysteresis + assemble learnFocusWindow ───────────────────────────

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

/** The eventsCount of the bin with the highest shrunk score among covered bins (0 if none). */
function strongestCoveredBinEvents(scores: BinScores): number {
  const { shrunk, eventsCount } = scores;
  let bestIdx = -1;
  for (let i = 0; i < shrunk.length; i++) {
    if (eventsCount[i]! <= 0) continue;
    if (bestIdx < 0 || shrunk[i]! > shrunk[bestIdx]!) bestIdx = i;
  }
  return bestIdx < 0 ? 0 : eventsCount[bestIdx]!;
}

/** Builds the 3-gate unlock ladder. `isPriorPath` marks whether this call is for the
 *  `prior()` return (where a fully-met-but-uncertified peak reads as "confirming"). */
function buildGates(signals: EventSignal[], distinctDays: number, scores: BinScores, isPriorPath: boolean): FocusGates {
  const sessions = { have: signals.length, need: C.FW_GATE_MIN_COMPLETED };
  const days = { have: distinctDays, need: C.FW_GATE_MIN_DISTINCT_DAYS };
  const peakEvents = strongestCoveredBinEvents(scores);
  const confirming = isPriorPath
    && sessions.have >= sessions.need
    && days.have >= days.need
    && peakEvents >= C.FW_BIN_MIN_EVENTS;
  return { sessions, days, peak: { have: peakEvents, need: C.FW_BIN_MIN_EVENTS, confirming } };
}

export function learnFocusWindow(input: LearnFocusInput): LearnedFocusWindow {
  const signals = buildSignals(input.events, input.fitByCategory);
  const distinctDays = new Set(signals.map((s) => s.dayKey)).size;
  const scores = scoreBins(signals);
  const prior = (): LearnedFocusWindow => ({
    startMin: C.FW_PRIOR_WINDOW.startMin, endMin: C.FW_PRIOR_WINDOW.endMin,
    basis: 'prior', confidence: clamp(signals.length / C.FW_GATE_MIN_COMPLETED, 0, 0.9),
    scoreByBin: normalise(priorCurve()), sampleCount: signals.length, distinctDays, held: false,
    gates: buildGates(signals, distinctDays, scores, true),
  });

  if (signals.length < C.FW_GATE_MIN_COMPLETED || distinctDays < C.FW_GATE_MIN_DISTINCT_DAYS) return prior();
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
    gates: buildGates(signals, distinctDays, scores, false),
  };
}
