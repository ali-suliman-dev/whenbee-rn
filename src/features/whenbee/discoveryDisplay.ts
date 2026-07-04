import type { TFunction } from 'i18next';
import { CATEGORY_NAMES } from '@/src/engine';

// ──────────────────────────────────────────────────────────────────────────────
// Discovery display helpers — pure presentation logic shared by the hub featured
// card and the full-list gallery. A discovery's direction (longer vs faster) and
// its plain-English proof all derive from the banked multiplier + honestForFifteen
// (the canonical 15-minute baseline). No guilt: "faster" is framed as good news.
// ──────────────────────────────────────────────────────────────────────────────

export type DiscoveryDirection = 'longer' | 'faster';

/** M ≥ 1 → runs longer than the 15m guess; M < 1 → runs faster. */
export function discoveryDirection(multiplier: number): DiscoveryDirection {
  return multiplier >= 1 ? 'longer' : 'faster';
}

/** "1.6" — one decimal, no × (the view renders the × as a smaller suffix). */
export function multiplierValue(multiplier: number): string {
  return multiplier.toFixed(1);
}

/** `tr` is the whenbee-namespace translator (from `useTranslation('whenbee')`).
 *  Omitted in pure unit tests, where the canonical English fallback applies. */
export function dirLabel(direction: DiscoveryDirection, tr?: TFunction<'whenbee'>): string {
  if (tr) return tr(`discoveries.gallery.dirLabel.${direction}`);
  return direction === 'longer' ? 'LONGER' : 'FASTER';
}

/** Gallery proof line, 15m baseline. */
export function discoveryProof(
  honestForFifteen: number,
  direction: DiscoveryDirection,
  tr?: TFunction<'whenbee'>,
): string {
  if (tr) {
    return direction === 'longer'
      ? tr('discoveries.gallery.proofLonger', { minutes: honestForFifteen })
      : tr('discoveries.gallery.proofFaster', { minutes: honestForFifteen });
  }
  return direction === 'longer'
    ? `You plan 15m · really runs ~${honestForFifteen}m`
    : `You plan 15m · really only ~${honestForFifteen}m`;
}

/** Hub featured sentence, 15m baseline. */
export function discoverySentence(
  honestForFifteen: number,
  direction: DiscoveryDirection,
  tr?: TFunction<'whenbee'>,
): string {
  if (tr) {
    return direction === 'longer'
      ? tr('discoveries.preview.sentenceLonger', { minutes: honestForFifteen })
      : tr('discoveries.preview.sentenceFaster', { minutes: honestForFifteen });
  }
  return direction === 'longer'
    ? `You plan 15 minutes — it really takes about ${honestForFifteen}.`
    : `You plan 15 minutes — it really takes only about ${honestForFifteen}.`;
}

/** Seed-name map, else title-case the slug ("deep_work" → "Deep Work"). */
export function categoryLabel(id: string): string {
  const seed = CATEGORY_NAMES[id];
  if (seed) return seed;
  return id
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
