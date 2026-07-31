// Whether the Today landing card is collapsed. One flag, synchronous kv, so the
// card renders in its remembered state on the first frame — a card that expands
// a beat after mount reads as a glitch.
//
// Default is EXPANDED: the card has to teach itself once before someone can
// decide they'd rather have it small.

import { kv } from '@/src/lib/kv';

export const LANDING_COLLAPSE_KEY = 'today.landing.collapsed';

export function readLandingCollapsed(): boolean {
  return kv.getString(LANDING_COLLAPSE_KEY) === '1';
}

export function writeLandingCollapsed(collapsed: boolean): void {
  kv.set(LANDING_COLLAPSE_KEY, collapsed ? '1' : '0');
}
