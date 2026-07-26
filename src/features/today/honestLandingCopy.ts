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
   * Pro only: minutes of calendar time already booked into the span the bar is
   * measuring (the same value the bar's booked segment renders — see `meetMs`
   * in `HonestLandingCard`). Swaps the *offer* on a day with nothing more urgent
   * to say — naming what's already booked beats adding a task they don't need.
   * Never outranks naming the tail: when the day runs over, the task to move is
   * the more useful thing to point at.
   */
  bookedMin?: number;
}

export interface FooterCopy {
  text: string;
  /** The span within `text` rendered semibold, or null. */
  boldSpan: string | null;
  /**
   * The offer, or `null` when there is nothing the offer could act on. An action
   * that cannot act must not be shown — a tappable "Move 0 to tomorrow" that does
   * nothing is worse than a footer with no action at all.
   */
  action: string | null;
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
  /**
   * The headline is showing a range ("Roughly done 9:10pm – 10:30pm") because the
   * categories in play are still cold. The scale then must NOT name a landing
   * minute: a card that disclaims precision in the headline and asserts it two
   * lines down is worse than one that says less.
   */
  hasRange?: boolean;
}

/**
 * The labels under the bar, left to right. The first is anchored ("now · 7:10pm")
 * because three bare clock times read as a list of nothing in particular — the
 * user has to be told which one is the present moment. The rest are bare clocks.
 *
 * Empty on the states that render no bar ('empty', 'past'), so the component
 * never has to decide what a scale under a missing bar would say.
 *
 * The third label (the landing minute) is dropped whenever a range is in play —
 * see `ScaleCtx.hasRange`. The bar itself still runs to the point estimate; only
 * the claim in words goes away, which is the part that could be quoted back.
 */
export function landingScale(
  landing: LandingResult,
  { nowMs, dayEndMs, hasRange = false }: ScaleCtx,
): string[] {
  if (landing.kind === 'empty' || landing.kind === 'past') return [];

  const labels = [`now · ${formatClockMeridiem(nowMs)}`, formatClockMeridiem(dayEndMs)];
  if (!hasRange && landing.kind === 'over' && landing.landingMs !== null) {
    labels.push(formatClockMeridiem(landing.landingMs));
  }
  return labels;
}

export function landingFooter(
  landing: LandingResult,
  { doneCount, doneHonestMin, logsToWarm, dayEndShort, bookedMin = 0 }: FooterCtx,
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
      action: landing.ends.length > 0 ? `Move ${landing.ends.length} to tomorrow` : null,
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

  // The offer names what's already on the calendar rather than a generic
  // chore — a user who has booked time doesn't need to be told to "pad" it,
  // just shown it's accounted for.
  const action = bookedMin > 0 ? `${fmtHm(bookedMin)} already booked today` : 'Add a task';

  if (doneCount === 0) {
    return { text: 'Nothing logged yet', boldSpan: null, action };
  }
  return {
    text: `${doneCount} done · ${fmtHm(doneHonestMin)} logged`,
    boldSpan: fmtHm(doneHonestMin),
    action,
  };
}

export interface LegendEntryArgs {
  taskMin: number;
  bookedMin: number;
  overMin: number;
}

export interface LegendEntry {
  key: 'tasks' | 'booked' | 'over';
  value: string;
  label: string;
}

/**
 * The legend under the bar, in the same order the segments render: tasks,
 * booked, over. Callers must pass the same measured minutes the bar's segments
 * use (`taskInDayMs`/`meetMs`/`overMs` in `HonestLandingCard`, converted to
 * whole minutes) — a legend computed from anything else could disagree with
 * the bar it's explaining.
 *
 * Empty whenever there's no booked time: the legend's whole reason to exist is
 * explaining the booked segment's colour, so a day with none gets nothing to
 * decode.
 */
export function landingLegend({ taskMin, bookedMin, overMin }: LegendEntryArgs): LegendEntry[] {
  if (bookedMin <= 0) return [];

  const entries: LegendEntry[] = [
    { key: 'tasks', value: fmtHm(taskMin), label: 'tasks' },
    { key: 'booked', value: fmtHm(bookedMin), label: 'booked' },
  ];
  if (overMin > 0) {
    entries.push({ key: 'over', value: fmtHm(overMin), label: 'over' });
  }
  return entries;
}

export interface UpsellCopy {
  text: string;
  action: string;
}

/**
 * The free-user offer to connect their calendar. Names the limit of the
 * number already on screen ("your calendar isn't in it") rather than telling
 * them what to do — no guilt, no "you're missing out".
 */
export function landingUpsell(): UpsellCopy {
  return { text: "Optimistic — your calendar isn't in it", action: 'Add it' };
}
