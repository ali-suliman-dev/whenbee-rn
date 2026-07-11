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

/** Row labels for the three gates (kept beside their copy so they stay in sync). */
export const FOCUS_GATE_LABELS = {
  sessions: 'Timed sessions',
  days: 'Different days',
  peak: 'A clear peak',
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

/** Gate 3 — a clear peak forming in your most-used time of day. This one isn't a
 *  chore you can aim at: the number counts sessions landing around the same hours,
 *  and I certify the peak once they cluster. `confirming` = counts met but the
 *  window hasn't certified yet, so it settles rather than dead-ends. When it does
 *  clear, the card graduates into your real focus window — you never see "3/3" here. */
export function peakGateCopy(have: number, need: number, confirming: boolean): FocusGateCopy {
  if (confirming) {
    return {
      valueText: `${need}/${need}`,
      sub: 'Almost — a session or two more and I lock your peak in.',
    };
  }
  return {
    valueText: `${have}/${need}`,
    sub: `${plural(need - have, 'more session')} around your usual hours and your peak shows.`,
  };
}

/** Gate 2 shown before it's the active step — quiet, forward-looking. */
export function daysUpcomingCopy(have: number, need: number): FocusGateCopy {
  return { valueText: `${have}/${need}`, sub: 'Next: a spread of different days.' };
}

/** Gate 3 shown before it's the active step — quiet, last in line. Framed as my
 *  job (I watch for the pattern), not a task the user has to hit. */
export function peakUpcomingCopy(have: number, need: number): FocusGateCopy {
  return { valueText: `${have}/${need}`, sub: 'Last: I spot the hours you keep coming back to.' };
}

/** The right-aligned "N of 3 unlocked" progress tag. */
export function focusUnlockedTag(unlocked: number): string {
  return `${unlocked} of 3 unlocked`;
}

/** Caption under the frosted reward preview — pulls toward the finish. */
export function focusRewardCaption(gatesLeft: number): string {
  return gatesLeft > 1
    ? 'Keep logging — your sharpest hours are forming.'
    : 'One more signal reveals your sharpest hours.';
}
