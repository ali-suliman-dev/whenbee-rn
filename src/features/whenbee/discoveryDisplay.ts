import type { TFunction } from 'i18next';
import { categoryName } from '@/src/features/shared/categoryName';

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
 *  Required: this is display copy, so there is no correct untranslated answer. */
export function dirLabel(direction: DiscoveryDirection, tr: TFunction<'whenbee'>): string {
  return tr(`discoveries.gallery.dirLabel.${direction}`);
}

/** Gallery proof line, 15m baseline. */
export function discoveryProof(
  honestForFifteen: number,
  direction: DiscoveryDirection,
  tr: TFunction<'whenbee'>,
): string {
  return direction === 'longer'
    ? tr('discoveries.gallery.proofLonger', { minutes: honestForFifteen })
    : tr('discoveries.gallery.proofFaster', { minutes: honestForFifteen });
}

/** Hub featured sentence, 15m baseline. */
export function discoverySentence(
  honestForFifteen: number,
  direction: DiscoveryDirection,
  tr: TFunction<'whenbee'>,
): string {
  return direction === 'longer'
    ? tr('discoveries.preview.sentenceLonger', { minutes: honestForFifteen })
    : tr('discoveries.preview.sentenceFaster', { minutes: honestForFifteen });
}

/** Localized display name for a discovery's category (built-in ids translate;
 *  a user-authored slug title-cases and is never translated). */
export const categoryLabel = categoryName;
