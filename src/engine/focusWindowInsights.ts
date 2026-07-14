// Pure focus-insight metrics for the detail view. No clock, no random.
import { affineHonestExact, type AffineFit } from './affine';
import { buildSignals, scoreBins, clamp } from './focusWindowLearn';
import type { FocusEventInput } from '@/src/domain/types';
import * as C from './constants';

export interface FocusInsights {
  peakMin: number;                         // bin-center minute of the sharpest bin
  troughMin: number;                       // bin-center minute of the foggiest eligible bin
  troughStartMin: number;                  // trough bin start — the foggiest stretch is a real
  troughEndMin: number;                    //   bin-wide span, never presented as a single minute
  contrast: number | null;                 // exp(peakS - troughS), clamped; null if uncovered
  accuracyBetterInWindow: boolean | null;  // mean rel-error lower inside the window
  durationLongerInWindow: boolean | null;  // mean actualMin higher inside the window
}

const binCenterMin = (i: number) => C.FW_WAKING_START_MIN + i * C.FW_BIN_MIN + C.FW_BIN_MIN / 2;
const binStartMin = (i: number) => C.FW_WAKING_START_MIN + i * C.FW_BIN_MIN;

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

  // Peak over all eligible bins (boundary bins included — a strong start/end-of-day
  // peak is real). Trough is restricted to *interior* bins (excludes index 0 and the
  // last index) so a boundary artifact never gets reported as "your foggiest stretch".
  // Falls back to full argmax/argmin over all bins if nothing qualifies.
  const isInterior = (i: number) => i > 0 && i < shrunk.length - 1;
  let peakIdx = -1, troughIdx = -1, anyEligible = false, anyEligibleInterior = false;
  for (let i = 0; i < shrunk.length; i++) {
    if (!eligible(i)) continue;
    anyEligible = true;
    if (peakIdx < 0 || shrunk[i]! > shrunk[peakIdx]!) peakIdx = i;
    if (isInterior(i)) {
      anyEligibleInterior = true;
      if (troughIdx < 0 || shrunk[i]! < shrunk[troughIdx]!) troughIdx = i;
    }
  }
  if (!anyEligible) {
    for (let i = 0; i < shrunk.length; i++) {
      if (peakIdx < 0 || shrunk[i]! > shrunk[peakIdx]!) peakIdx = i;
    }
  }
  if (!anyEligibleInterior) {
    for (let i = 0; i < shrunk.length; i++) {
      if (!isInterior(i)) continue;
      if (troughIdx < 0 || shrunk[i]! < shrunk[troughIdx]!) troughIdx = i;
    }
    // Degenerate case: fewer than 3 bins total — no interior bin exists at all.
    if (troughIdx < 0) {
      for (let i = 0; i < shrunk.length; i++) {
        if (troughIdx < 0 || shrunk[i]! < shrunk[troughIdx]!) troughIdx = i;
      }
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

  const troughBin = Math.max(0, troughIdx);
  return {
    peakMin: binCenterMin(Math.max(0, peakIdx)),
    troughMin: binCenterMin(troughBin),
    troughStartMin: binStartMin(troughBin),
    troughEndMin: binStartMin(troughBin) + C.FW_BIN_MIN,
    contrast,
    accuracyBetterInWindow,
    durationLongerInWindow,
  };
}
