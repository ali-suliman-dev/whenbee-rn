// "What steals your time" — deterministic reason correlations. PURE TS: no
// React/RN/Expo and no clock (Date.now). Callers pass already-bucketed local
// hour/weekday on each ReasonSample, so the same input always maps to the same
// output. Over-runs only train the read; under-runs are ignored.
import type { ReasonCorrelation, ReasonSample } from '../domain/types';
import {
  REASON_AFTERNOON_HOUR,
  REASON_DOMINANCE_SHARE,
  REASON_MIN_OVER_SAMPLES,
  REASON_NOTE_MIN_SHARE,
  REASON_TIME_SHARE,
  REASON_WEEKDAY_SHARE,
} from './constants';

// Kind, blame-free phrasing per known over-run slug (see ReasonChips OVER_OPTIONS).
// Anything unmapped falls back so a new slug never crashes the read.
const REASON_PHRASE: Record<string, string> = {
  context_switch: 'getting pulled away',
  interrupted: 'getting interrupted',
  underestimated: 'the task being bigger than it looked',
};
const FALLBACK_PHRASE = 'a few recurring snags';

export function reasonPhrase(reason: string): string {
  return REASON_PHRASE[reason] ?? FALLBACK_PHRASE;
}

// Highest count, ties broken by lexical key order — deterministic regardless of
// Map insertion order.
function topCount<T extends string>(counts: Map<T, number>): { key: T; count: number } | null {
  let best: { key: T; count: number } | null = null;
  for (const key of [...counts.keys()].sort()) {
    const count = counts.get(key) ?? 0;
    if (best === null || count > best.count) best = { key, count };
  }
  return best;
}

function timeSkewOf(samples: ReasonSample[]): ReasonCorrelation['timeSkew'] {
  if (samples.length === 0) return null;
  const afternoon = samples.filter((s) => s.hour >= REASON_AFTERNOON_HOUR).length;
  const share = afternoon / samples.length;
  if (share >= REASON_TIME_SHARE) return 'afternoon';
  if (1 - share >= REASON_TIME_SHARE) return 'morning';
  return null;
}

function weekdaySkewOf(samples: ReasonSample[]): number | null {
  if (samples.length === 0) return null;
  const counts = new Map<number, number>();
  for (const s of samples) counts.set(s.weekday, (counts.get(s.weekday) ?? 0) + 1);
  let bestDay: number | null = null;
  let bestCount = 0;
  for (const day of [...counts.keys()].sort((a, b) => a - b)) {
    const c = counts.get(day) ?? 0;
    if (c > bestCount) {
      bestCount = c;
      bestDay = day;
    }
  }
  if (bestDay === null) return null;
  return bestCount / samples.length >= REASON_WEEKDAY_SHARE ? bestDay : null;
}

function correlateOne(categoryId: string, overSamples: ReasonSample[]): ReasonCorrelation | null {
  if (overSamples.length < REASON_MIN_OVER_SAMPLES) return null;
  const counts = new Map<string, number>();
  for (const s of overSamples) counts.set(s.reason, (counts.get(s.reason) ?? 0) + 1);
  const top = topCount(counts);
  if (top === null) return null;
  const share = top.count / overSamples.length;
  if (share <= REASON_DOMINANCE_SHARE) return null;
  const ofReason = overSamples.filter((s) => s.reason === top.key);
  return {
    categoryId,
    reason: top.key,
    share,
    sampleCount: top.count,
    totalOver: overSamples.length,
    timeSkew: timeSkewOf(ofReason),
    weekdaySkew: weekdaySkewOf(ofReason),
  };
}

export function correlateReasons(samples: ReasonSample[]): ReasonCorrelation[] {
  const byCategory = new Map<string, ReasonSample[]>();
  for (const s of samples) {
    if (s.direction !== 'over') continue;
    const bucket = byCategory.get(s.category);
    if (bucket) bucket.push(s);
    else byCategory.set(s.category, [s]);
  }
  const out: ReasonCorrelation[] = [];
  for (const categoryId of [...byCategory.keys()].sort()) {
    const corr = correlateOne(categoryId, byCategory.get(categoryId) ?? []);
    if (corr) out.push(corr);
  }
  return out.sort((a, b) => b.share - a.share || a.categoryId.localeCompare(b.categoryId));
}

// B15: a single kind sentence for one category's detail screen. Returns null
// unless one cause clears the stricter note share — no half-confident claims.
export function reasonNoteFor(
  categoryId: string,
  samples: ReasonSample[],
  opts?: { share?: number },
): string | null {
  const minShare = opts?.share ?? REASON_NOTE_MIN_SHARE;
  const overSamples = samples.filter((s) => s.direction === 'over' && s.category === categoryId);
  if (overSamples.length < REASON_MIN_OVER_SAMPLES) return null;
  const counts = new Map<string, number>();
  for (const s of overSamples) counts.set(s.reason, (counts.get(s.reason) ?? 0) + 1);
  const top = topCount(counts);
  if (top === null) return null;
  if (top.count / overSamples.length < minShare) return null;
  return `Most overruns here trace back to ${reasonPhrase(top.key)}.`;
}
