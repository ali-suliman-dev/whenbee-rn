// Every user-facing string on the landing card. Kept out of the component so the
// copy is unit-testable and so a wording change never touches layout.
//
// Rules baked in here (audited 2026-07-25, spec §"Copy decisions worth keeping"):
//   · "Done ~9:50pm", never "Done by" — this is a forecast, not a promise.
//   · "past your day", never "past your 9:00" — one clock reading per line.
//   · Name the tail task; don't restate the overage the headline just gave.
//   · "logged", never "banked" (Reclaim vocabulary, cut as off-thesis).
//   · "tightens", never "narrows" (that's the Pro confidence-band verb).
//   · No scold in any state. The past-end-of-day line is a fact plus an offer.
import { fmtHm, formatClockMeridiem } from '@/src/lib/time';
import type { LandingResult } from '@/src/engine';

export interface HeadlineOpts {
  rangeLowMs?: number;
  rangeHighMs?: number;
  /** 'd' (default) = "Done ~9:50pm · 50m past your day". 'dAlt' = clock first. */
  variant?: 'd' | 'dAlt';
}

export interface HeadlineCopy {
  lead: string;
  /** The emphasised span — amber on 'over', ink otherwise. */
  clock: string;
  trail: string;
}

export interface FooterCtx {
  doneCount: number;
  doneHonestMin: number;
  logsToWarm: number;
  /** The user's end of day, spoken short ("9", "17:00"), for the tail sentence. */
  dayEndShort: string;
  /**
   * Pro only: the day has calendar minutes still ahead. Swaps the *offer* on a
   * day with nothing more urgent to say — padding the meetings a user already
   * has beats adding a task they don't. Never outranks naming the tail: when the
   * day runs over, the task to move is the more useful thing to point at.
   */
  hasMeetings?: boolean;
}

export interface FooterCopy {
  text: string;
  /** The span within `text` rendered semibold, or null. */
  boldSpan: string | null;
  action: string;
}

export function landingHeadline(
  landing: LandingResult,
  { rangeLowMs, rangeHighMs, variant = 'd' }: HeadlineOpts,
): HeadlineCopy {
  // No plan yet — `landingMs` is null exactly here; never fall through to the
  // `?? 0` epoch fallback below.
  if (landing.kind === 'empty') {
    return { lead: '', clock: '', trail: '' };
  }

  if (landing.kind === 'past') {
    return {
      lead: 'Your day ended ',
      clock: `${fmtHm(landing.overMin)} ago`,
      trail: ` · ${fmtHm(landing.remainingMin)} still queued`,
    };
  }

  // Cold start wins over the exact-time forms: a seeded prior can't name a minute.
  if (rangeLowMs !== undefined && rangeHighMs !== undefined) {
    return {
      lead: 'Roughly done ',
      clock: `${formatClockMeridiem(rangeLowMs)} – ${formatClockMeridiem(rangeHighMs)}`,
      trail: '',
    };
  }

  const clock = `~${formatClockMeridiem(landing.landingMs ?? 0)}`;

  if (landing.kind === 'clear') {
    return { lead: 'Done ', clock, trail: ` · ${fmtHm(landing.openMin)} still open` };
  }

  if (variant === 'dAlt') {
    return { lead: '', clock, trail: `. That's ${fmtHm(landing.overMin)} past your day.` };
  }
  return { lead: 'Done ', clock, trail: ` · ${fmtHm(landing.overMin)} past your day` };
}

export interface ScaleCtx {
  /** The tick the card was computed at — the bar's left edge. */
  nowMs: number;
  /** The user's end of day — the bar's colour boundary ('over') or right edge ('clear'). */
  dayEndMs: number;
}

/**
 * The labels under the bar, left to right. The first is anchored ("now · 7:10pm")
 * because three bare clock times read as a list of nothing in particular — the
 * user has to be told which one is the present moment. The rest are bare clocks.
 *
 * Empty on the states that render no bar ('empty', 'past'), so the component
 * never has to decide what a scale under a missing bar would say.
 */
export function landingScale(landing: LandingResult, { nowMs, dayEndMs }: ScaleCtx): string[] {
  if (landing.kind === 'empty' || landing.kind === 'past') return [];

  const labels = [`now · ${formatClockMeridiem(nowMs)}`, formatClockMeridiem(dayEndMs)];
  if (landing.kind === 'over' && landing.landingMs !== null) {
    labels.push(formatClockMeridiem(landing.landingMs));
  }
  return labels;
}

export function landingFooter(
  landing: LandingResult,
  { doneCount, doneHonestMin, logsToWarm, dayEndShort, hasMeetings = false }: FooterCtx,
): FooterCopy {
  if (logsToWarm > 0) {
    return {
      text: `${logsToWarm} more logs and this tightens`,
      boldSpan: `${logsToWarm} more logs`,
      action: 'Start one',
    };
  }

  if (landing.kind === 'past') {
    return {
      text: `${doneCount} done · ${fmtHm(doneHonestMin)} logged`,
      boldSpan: fmtHm(doneHonestMin),
      action: `Move ${landing.ends.length} to tomorrow`,
    };
  }

  if (landing.kind === 'over' && landing.tail) {
    // "lands after 9" — the end-of-day hour spoken the way a person would say it.
    return {
      text: `${landing.tail.label} lands after ${dayEndShort}`,
      boldSpan: landing.tail.label,
      action: 'Move it',
    };
  }

  // The label the Pro chip used, carried over verbatim — it already reads as an
  // offer rather than a chore, and the user has met it before.
  const action = hasMeetings ? 'Pad calendar' : 'Add a task';

  if (doneCount === 0) {
    return { text: 'Nothing logged yet', boldSpan: null, action };
  }
  return {
    text: `${doneCount} done · ${fmtHm(doneHonestMin)} logged`,
    boldSpan: fmtHm(doneHonestMin),
    action,
  };
}
