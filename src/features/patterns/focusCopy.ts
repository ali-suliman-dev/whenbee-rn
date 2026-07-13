import type { FocusConfidenceTier } from '@/src/domain/types';
import { peakBucketLabel } from '@/src/engine';

// Shared "why" narrative copy for the focus-window card and detail sheet.
// Peak bin → narrative bucket (Tier-1, derived from peak time only).
//
// Returned strings have NO trailing period — callers append the optional
// contrast clause and a single closing period, so the sentence stays
// grammatical whether or not the contrast clause is present.
export function whyNarrative(peakMin: number): string {
  if (peakMin < 660) return 'You start sharp and fade after lunch'; // before 11:00
  if (peakMin < 780) return 'You hit your stride around midday'; // 11:00–13:00
  if (peakMin < 1020) return 'Mornings warm up slow — you peak after lunch'; // 13:00–17:00
  return "You're a slow burn — you peak in the evening"; // after 17:00
}

// ──────────────────────────────────────────────────────────────────────────────
// Focus-unlock ladder copy — the 3-gate "what's left" milestone card.
//
// Every helper is pure and returns plain, warm strings (no guilt, no streaks,
// always "N to go" — never "not enough data"). Plurals are guarded so a single
// remaining item never reads "1 more days".
// ──────────────────────────────────────────────────────────────────────────────

/** One gate's rendered value + sub-line. */
export interface FocusGateCopy {
  valueText: string;
  sub: string;
}

/** "1 more day" vs "2 more days" — pluralise the noun by count. */
function plural(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

/** Row labels for the two gates (kept beside their copy so they stay in sync). */
export const FOCUS_GATE_LABELS = {
  sessions: 'Timed sessions',
  days: 'Different days',
} as const;

/** Gate 1 — enough timed sessions logged. */
export function sessionsGateCopy(have: number, need: number): FocusGateCopy {
  if (have >= need) {
    return { valueText: `${have} ✓`, sub: 'Plenty logged for me to learn from.' };
  }
  return {
    valueText: `${have}/${need}`,
    sub: `${plural(need - have, 'more timed session')} to go.`,
  };
}

/** Gate 2 — sessions spread across enough distinct days. */
export function daysGateCopy(have: number, need: number): FocusGateCopy {
  if (have >= need) {
    return { valueText: `${have} ✓`, sub: `Spread over ${have} days — not a one-day fluke.` };
  }
  return {
    valueText: `${have}/${need}`,
    sub: `${plural(need - have, 'more day')} with a session logged.`,
  };
}

/** Gate 2 shown before it's the active step — quiet, forward-looking. */
export function daysUpcomingCopy(have: number, need: number): FocusGateCopy {
  return { valueText: `${have}/${need}`, sub: 'Next: a spread of different days.' };
}

/** The right-aligned "N of 2 unlocked" progress tag. */
export function focusUnlockedTag(unlocked: number): string {
  return `${unlocked} of 2 unlocked`;
}

/** Caption under the frosted reward preview — pulls toward the finish. */
export function focusRewardCaption(gatesLeft: number): string {
  return gatesLeft > 1
    ? 'Keep logging — your sharpest hours are forming.'
    : 'One more signal reveals your sharpest hours.';
}

// ──────────────────────────────────────────────────────────────────────────────
// Reveal-early copy: coarse block (forming), confidence tiers, 2-gate progress.
// ──────────────────────────────────────────────────────────────────────────────

/** Re-export so UI derives the block name from one place (the engine bucket). */
export const coarseBlockLabel = peakBucketLabel;

/** Confidence meter label per tier. No guilt: "learning → sharper → locked in". */
export function confidenceLabel(tier: FocusConfidenceTier): string {
  switch (tier) {
    case 'low': return 'Still learning · sharpening';
    case 'building': return 'Building · getting sharper';
    case 'steady': return 'Steady · locked to your rhythm';
  }
}

/** Forming-state hint — names the leaning block; my job to sharpen, not the user's. */
export function coarseHintCopy(block: string): string {
  if (!block) return '';
  return `Leaning toward ${block.toLowerCase()} — keep timing and I'll sharpen it.`;
}
