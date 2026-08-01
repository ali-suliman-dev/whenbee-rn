// src/features/today/dayRecapCopy.ts
// Pure copy for the past-day recap card. No React, no clock, no store access.
//
// No guilt: running over is a fact the model learns from, running under is not
// a prize. Neither branch praises or scolds — "the day you pictured" is what
// they're measured against, because a picture is something you had, not a
// target you missed.
//
// Every string is looked up through the `t` the caller passes in (the default,
// common-namespace translator, so `formatDuration` finds its unit words) with
// `today:`-qualified keys.

import type { TFunction } from 'i18next';
import { formatDuration } from '@/src/i18n/formatDuration';

/**
 * The translator these helpers take. `common` stays the default namespace so
 * `formatDuration` finds its unit words; `today` is reachable through the
 * `today:` prefix. A plain `useTranslation()` result satisfies it.
 */
export type RecapT = TFunction<['common', 'today']>;

export interface RecapHeadline {
  /** Text before the gap span. Carries the whole line when `gap` is null. */
  lead: string;
  /** The emphasised gap phrase ("35m over"), or null when there isn't one. */
  gap: string | null;
  /** Text after the gap span. Empty when `gap` is null. */
  trail: string;
  direction: 'over' | 'under' | 'even' | 'empty';
}

export function recapHeadline(
  recap: { doneCount: number; vsGuessMin: number },
  t: RecapT,
): RecapHeadline {
  if (recap.doneCount === 0) {
    return {
      lead: t('today:dayRecap.recap.nothingLogged'),
      gap: null,
      trail: '',
      direction: 'empty',
    };
  }
  // The direction word lives in the sentence, so no caller ever renders a
  // leading + or −. (`fmtDelta` in lib/time hardcodes English and is skipped.)
  const rounded = Math.round(recap.vsGuessMin);
  if (rounded === 0) {
    return { lead: t('today:dayRecap.recap.even'), gap: null, trail: '', direction: 'even' };
  }
  const over = rounded > 0;
  const duration = formatDuration(Math.abs(rounded), t);
  return {
    lead: t(over ? 'today:dayRecap.recap.overLead' : 'today:dayRecap.recap.underLead'),
    gap: t(over ? 'today:dayRecap.recap.gapOver' : 'today:dayRecap.recap.gapUnder', { duration }),
    trail: t('today:dayRecap.recap.trail'),
    direction: over ? 'over' : 'under',
  };
}

/** The two ends of the gap bar, named so the bar needs no legend. */
export function recapScale(
  guessedMin: number,
  honestMin: number,
  t: RecapT,
): { left: string; right: string } {
  return {
    left: t('today:dayRecap.recap.scaleLeft', { duration: formatDuration(guessedMin, t) }),
    right: t('today:dayRecap.recap.scaleRight', { duration: formatDuration(honestMin, t) }),
  };
}
