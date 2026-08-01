import i18n from '@/src/i18n';
import type { CalibrationMapRow } from './usePatterns';

// ──────────────────────────────────────────────────────────────────────────────
// archetypeStats — turns the per-category calibration map into a few honest,
// LEARNED stat rows for the Patterns archetype hero (no quiz needed). Pure.
// Surfaces only what the on-device model already knows: how much you've tracked,
// where you read time most accurately, and where tasks run longest. No guilt, no
// streaks, no verdicts (product invariant). Empty in → empty out (card hides them).
// ──────────────────────────────────────────────────────────────────────────────

export interface ArchetypeStatRow {
  label: string;
  value: string;
}

export function archetypeStats(map: CalibrationMapRow[]): ArchetypeStatRow[] {
  if (map.length === 0) return [];

  const totalLogs = map.reduce((sum, r) => sum + r.sampleSize, 0);
  const rows: ArchetypeStatRow[] = [
    {
      label: i18n.t('patterns:archetypeStats.tracked.label'),
      value: i18n.t('patterns:archetypeStats.tracked.value', { count: totalLogs }),
    },
  ];

  // Most accurate = multiplier closest to 1×; runs longest = the highest multiplier.
  const mostAccurate = [...map].sort(
    (a, b) => Math.abs(a.multiplier - 1) - Math.abs(b.multiplier - 1),
  )[0];
  if (mostAccurate) {
    rows.push({ label: i18n.t('patterns:archetypeStats.mostAccurate.label'), value: mostAccurate.categoryName });
  }

  if (map.length >= 2) {
    const runsLongest = [...map].sort((a, b) => b.multiplier - a.multiplier)[0];
    if (runsLongest && runsLongest.categoryId !== mostAccurate?.categoryId) {
      rows.push({ label: i18n.t('patterns:archetypeStats.runsLongest.label'), value: runsLongest.categoryName });
    }
  }

  return rows;
}
