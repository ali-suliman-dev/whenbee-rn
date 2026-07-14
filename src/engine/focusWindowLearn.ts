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

// ── Task 7: Permutation strength ──────────────────────────────────────────────

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

/** Coarse time-of-day bucket for the low-confidence reveal + forming hint. */
export function peakBucketLabel(peakMin: number): string {
  if (peakMin < 660) return 'Mornings';       // before 11:00
  if (peakMin < 780) return 'Midday';         // 11:00–13:00
  if (peakMin < 1020) return 'Afternoons';    // 13:00–17:00
  return 'Evenings';                          // after 17:00
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

/** Coarse fallback window when no statistically clear peak exists yet: a
 *  max-length block centred on the strongest covered bin. Both gates being met
 *  promises the user a window ("always shows a window — even a weak, coarse
 *  one"), so significance can grade the reveal but must never withhold it. */
function coarseCandidate(scores: BinScores): WindowCandidate {
  const peakIdx = strongestCoveredBinIndex(scores);
  if (peakIdx < 0) return null; // no covered bin at all — nothing to point at
  const maxBins = C.FW_WINDOW_MAX_LEN / C.FW_BIN_MIN;
  let lo = peakIdx - Math.floor((maxBins - 1) / 2);
  let hi = lo + maxBins - 1;
  if (lo < 0) { hi -= lo; lo = 0; }
  if (hi > C.FW_BIN_COUNT - 1) { lo = Math.max(0, lo - (hi - (C.FW_BIN_COUNT - 1))); hi = C.FW_BIN_COUNT - 1; }
  return { startMin: snap(binStartMin(lo)), endMin: snap(binStartMin(hi) + C.FW_BIN_MIN), peakIdx };
}

/** Builds the 2-gate unlock ladder (sessions + distinct days). */
function buildGates(signals: EventSignal[], distinctDays: number): FocusGates {
  return {
    sessions: { have: signals.length, need: C.FW_GATE_MIN_COMPLETED },
    days: { have: distinctDays, need: C.FW_GATE_MIN_DISTINCT_DAYS },
  };
}

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
  // Reveal-early contract: once both gates clear, the user always gets a window.
  // A statistically clear peak yields the precise candidate; flat / spread-out /
  // bimodal data falls back to a coarse block pinned at confidence 'low'.
  const selected = selectWindow(scores);
  const candidate = selected ?? coarseCandidate(scores);
  if (!candidate) return forming(); // unreachable in practice: gates met ⇒ ≥1 covered bin
  const coarse = selected == null;

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
    // A coarse fallback window is never presented as more than 'low' — precision
    // is earned by a real selectWindow candidate, not by elapsed days.
    confidence, confidenceTier: coarse ? 'low' : tierFor(confidence, significant),
    coarseBlockLabel: peakBucketLabel(centerMin),
    scoreByBin: normalise(scores.shrunk), sampleCount: signals.length, distinctDays, held,
    gates,
  };
}
