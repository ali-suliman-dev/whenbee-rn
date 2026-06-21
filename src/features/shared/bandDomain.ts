import type { HonestRange } from '@/src/domain/types';

// Presentation-only minutes→fraction mapper for the honest band (spec 03 §8.4).
// A fixed padded domain so the segment width is comparable across renders and a
// ghost of a prior (wider) range maps onto the same axis.
const floor5 = (n: number) => Math.floor(n / 5) * 5;
const ceil5 = (n: number) => Math.ceil(n / 5) * 5;

export function makeBandDomain(range: HonestRange): { at: (minutes: number) => number } {
  const domainLow = Math.max(0, floor5(range.lowMinutes * 0.6));
  const domainHigh = ceil5(range.highMinutes * 1.4);
  const span = Math.max(domainHigh - domainLow, 5);
  const at = (m: number) => Math.min(1, Math.max(0, (m - domainLow) / span));
  return { at };
}
