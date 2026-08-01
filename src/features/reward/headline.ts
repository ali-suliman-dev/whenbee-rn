import i18n from '@/src/i18n';
import type { LogResult } from '@/src/stores/calibrationStore';

// ──────────────────────────────────────────────────────────────────────────────
// Variable reward headline (DESIGN §2.6). The rotating set keeps the moment
// fresh so no two consecutive logs read identically. Retro logs get a dedicated,
// forgiving "caught up" line. Selection is DETERMINISTIC (no Math.random in
// render) so the screen is test-stable: we rotate by the running log count so a
// fresh sequence of logs cycles through the set.
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Pick a headline deterministically.
 * - retro source → the dedicated "caught up" line.
 * - otherwise → rotate the timed set by `logs` (a monotonically increasing
 *   counter on calibrationStore), so consecutive logs vary.
 */
export function rewardHeadline(source: 'timed' | 'retro', logs: number): string {
  if (source === 'retro') return i18n.t('reward:headlines.retro');
  const timed = i18n.t('reward:headlines.timed', { returnObjects: true }) as readonly string[];
  const idx = ((logs % timed.length) + timed.length) % timed.length;
  return timed[idx] ?? timed[0] ?? '';
}

/** True when this log sealed a new Honest cell (tier climbed to the top). */
export function isCapSeal(result: LogResult | null): boolean {
  return !!result && result.leveledUp && result.tierAfter === 'Honest';
}
