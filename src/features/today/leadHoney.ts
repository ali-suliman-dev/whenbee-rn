import type { HoneycombCell } from '@/src/components/honeycomb/Honeycomb';

// Pure: the most-ripened cell drives the Today header ring. Returns that cell's
// absolute sharpness (0..100, the same scale HoneyRing fills by) + its tier (the
// caption word). Empty list → a Raw/0 baseline (HoneyRing's endowedPct floor
// keeps a fresh ring from reading as a cold empty circle).
export function leadHoney(
  cells: HoneycombCell[],
): { sharpness: number; tier: HoneycombCell['tier'] } {
  const lead = cells.reduce<HoneycombCell | null>(
    (best, c) => (best === null || c.sharpness > best.sharpness ? c : best),
    null,
  );
  return { sharpness: lead?.sharpness ?? 0, tier: lead?.tier ?? 'Raw' };
}
