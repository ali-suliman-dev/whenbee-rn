import type { FocusConfidenceTier } from '@/src/domain/types';
import i18n from '@/src/i18n';

// Shared "why" narrative copy for the focus-window card and detail sheet.
// Peak bin → narrative bucket (Tier-1, derived from peak time only).
//
// Returned strings have NO trailing period — callers append the optional
// contrast clause and a single closing period, so the sentence stays
// grammatical whether or not the contrast clause is present.
export function whyNarrative(peakMin: number): string {
  if (peakMin < 660) return i18n.t('patterns:focusCopy.whyNarrative.early'); // before 11:00
  if (peakMin < 780) return i18n.t('patterns:focusCopy.whyNarrative.midday'); // 11:00–13:00
  if (peakMin < 1020) return i18n.t('patterns:focusCopy.whyNarrative.afternoon'); // 13:00–17:00
  return i18n.t('patterns:focusCopy.whyNarrative.evening'); // after 17:00
}

// ──────────────────────────────────────────────────────────────────────────────
// Focus-unlock ladder copy — the 3-gate "what's left" milestone card.
//
// Every helper returns plain, warm strings (no guilt, no streaks, always
// "N to go" — never "not enough data"). Plural forms belong to the LOCALE
// (i18next `{{count}}`), not to a JS `+ 's'`: the previous helper appended an
// English plural 's', which no other language keeps.
// ──────────────────────────────────────────────────────────────────────────────

/** One gate's rendered value + sub-line. */
export interface FocusGateCopy {
  valueText: string;
  sub: string;
}

/** Row labels for the two gates (kept beside their copy so they stay in sync). */
export function focusGateLabels(): { sessions: string; days: string } {
  return {
    sessions: i18n.t('patterns:focusCopy.gateLabels.sessions'),
    days: i18n.t('patterns:focusCopy.gateLabels.days'),
  };
}

/** Gate 1 — enough timed sessions logged. */
export function sessionsGateCopy(have: number, need: number): FocusGateCopy {
  if (have >= need) {
    return {
      valueText: i18n.t('patterns:focusCopy.sessions.doneValue', { have }),
      sub: i18n.t('patterns:focusCopy.sessions.doneSub'),
    };
  }
  return {
    valueText: i18n.t('patterns:focusCopy.sessions.progressValue', { have, need }),
    sub: i18n.t('patterns:focusCopy.sessions.togo', { count: need - have }),
  };
}

/** Gate 2 — sessions spread across enough distinct days. */
export function daysGateCopy(have: number, need: number): FocusGateCopy {
  if (have >= need) {
    return {
      valueText: i18n.t('patterns:focusCopy.sessions.doneValue', { have }),
      sub: i18n.t('patterns:focusCopy.days.doneSub', { count: have }),
    };
  }
  return {
    valueText: i18n.t('patterns:focusCopy.sessions.progressValue', { have, need }),
    sub: i18n.t('patterns:focusCopy.days.togo', { count: need - have }),
  };
}

/** Gate 2 shown before it's the active step — quiet, forward-looking. */
export function daysUpcomingCopy(have: number, need: number): FocusGateCopy {
  return {
    valueText: i18n.t('patterns:focusCopy.sessions.progressValue', { have, need }),
    sub: i18n.t('patterns:focusCopy.days.upcomingSub'),
  };
}

/** The right-aligned "N of 2 unlocked" progress tag. */
export function focusUnlockedTag(unlocked: number): string {
  return i18n.t('patterns:focusCopy.unlockedTag', { count: unlocked });
}

/** Caption under the frosted reward preview — pulls toward the finish. */
export function focusRewardCaption(gatesLeft: number): string {
  return gatesLeft > 1
    ? i18n.t('patterns:focusCopy.rewardCaption.more')
    : i18n.t('patterns:focusCopy.rewardCaption.last');
}

// ──────────────────────────────────────────────────────────────────────────────
// Reveal-early copy: coarse block (forming), confidence tiers, 2-gate progress.
// ──────────────────────────────────────────────────────────────────────────────

/** Display name for the engine's coarse block ID. The engine returns an ID
 *  (`'mornings'`), never a word — copy lives here. Empty ID → empty label. */
export function coarseBlockLabel(block: string): string {
  if (!block) return '';
  // Lower-cased before lookup: the engine emits ids, but a value that survived
  // from the pre-i18n build ("Mornings") must still resolve rather than render
  // its own key.
  const id = block.toLowerCase();
  return i18n.t(`patterns:focusCopy.block.${id}` as 'patterns:focusCopy.block.mornings');
}

/** Confidence meter label per tier. No guilt: "learning → sharper → locked in". */
export function confidenceLabel(tier: FocusConfidenceTier): string {
  switch (tier) {
    case 'low':
      return i18n.t('patterns:focusCopy.confidence.low');
    case 'building':
      return i18n.t('patterns:focusCopy.confidence.building');
    case 'steady':
      return i18n.t('patterns:focusCopy.confidence.steady');
  }
}

/** Forming-state hint — names the leaning block; my job to sharpen, not the user's. */
export function coarseHintCopy(block: string): string {
  if (!block) return '';
  return i18n.t('patterns:focusCopy.coarseHint', { block: coarseBlockLabel(block).toLowerCase() });
}
