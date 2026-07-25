// ──────────────────────────────────────────────────────────────────────────────
// useHonestLanding — feeds the pure `honestLanding` engine read from the stores
// and keeps it honest as the clock moves.
//
// The engine is clock-free, so `nowMs` is state here: a landing time is wrong the
// moment the minute rolls over. One interval per mounted card, cleared on unmount.
//
// Free-path gate: routine blocks and calendar minutes are Pro. They must not
// enter the free landing — the Pro-gate rule hides a gated value AND its position,
// and a landing time that silently included them would leak both.
// ──────────────────────────────────────────────────────────────────────────────

import { useMemo } from 'react';
import {
  honestLanding,
  landingRange,
  resolveSuggestion,
  seededPriorFor,
  honestRangeFor,
  CONFIDENCE_HONEST_MIN_LOGS,
  type LandingResult,
  type LandingTask,
} from '@/src/engine';
import { dayEndEpochFor } from '@/src/lib/time';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useDayTasksStore } from '@/src/stores/dayTasksStore';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { useMinuteTick, MINUTE_TICK_MS } from './useMinuteTick';

/** The landing text reads in whole minutes, so one tick a minute is exact enough. */
export const LANDING_TICK_MS = MINUTE_TICK_MS;

/** Anything with a start and an end — a calendar event, structurally. */
export interface TimedSpan {
  startMs: number;
  endMs: number;
}

/**
 * Meeting minutes still ahead of `nowMs`. A meeting already half over counts only
 * its remainder, and one that has ended counts for nothing — the landing is a
 * forecast from here, not a tally of the whole day.
 */
export function eventMinutesAhead(events: readonly TimedSpan[], nowMs: number): number {
  let ms = 0;
  for (const e of events) ms += Math.max(0, e.endMs - Math.max(e.startMs, nowMs));
  return Math.round(ms / 60_000);
}

/**
 * The live `eventMinAhead` for `useHonestLanding`, recomputed on the same shared
 * minute tick the landing itself runs on.
 *
 * Deriving it any other way is the trap: a `Date.now()` read inside a memo keyed
 * only on the event list freezes at first render, so a meeting that ended hours
 * ago keeps pushing the landing time out. The clock has to be a dependency, and
 * `useMinuteTick` is what makes it one.
 */
export function useEventMinAhead(events: readonly TimedSpan[]): number {
  const nowMs = useMinuteTick();
  return useMemo(() => eventMinutesAhead(events, nowMs), [events, nowMs]);
}

export interface HonestLandingResult {
  landing: LandingResult;
  /** Non-null only while the categories in play are still cold. */
  range: { lowMs: number; highMs: number } | null;
  /** Logs still needed before the range collapses to one time. 0 when warm. */
  logsToWarm: number;
  /** Epoch ms of the user's end of day, for the card's bar geometry. */
  dayEndMs: number;
  /** The tick this result was computed at — the card formats clocks from it. */
  nowMs: number;
}

export function useHonestLanding(eventMinAhead = 0): HonestLandingResult {
  const dayTasks = useDayTasksStore((s) => s.dayTasks);
  const statsByCategory = useCalibrationStore((s) => s.statsByCategory);
  const dayEndMin = useSettingsStore((s) => s.dayEndMin);
  const archetypeSeed = useSettingsStore((s) => s.archetypeSeed);
  const isPro = useEntitlement((s) => s.isPro);

  // Shared with `useEventMinAhead` so the meetings slice and the landing time can
  // never be drawn from two different readings of the clock.
  const nowMs = useMinuteTick();

  // Honest minutes per queued task — mirrors the resolver useToday / useDayCapacity
  // already use, so the card and the rows can never disagree.
  const { tasks, coldLogsNeeded, lowMin, highMin } = useMemo(() => {
    const queued = dayTasks.filter((t) => t.status === 'queued');
    const out: LandingTask[] = [];
    let low = 0;
    let high = 0;
    let needed = 0;

    for (const t of queued) {
      const cached = statsByCategory[t.category];
      const prior = cached?.priorMult ?? seededPriorFor(t.category, archetypeSeed);
      const cat = cached
        ? { fit: cached.fit, n: cached.n }
        : { fit: { a: 0, b: prior }, n: 0 };
      const suggestion = resolveSuggestion({
        guessMinutes: t.guessMin,
        category: cat,
        recurring: null,
      });
      out.push({ id: t.id, label: t.label, honestMin: suggestion.honestMinutes });

      const band = honestRangeFor({
        honestMinutes: suggestion.honestMinutes,
        guessMinutes: t.guessMin,
        clampedRatios: cached?.clampedRatios ?? [],
        prior,
      });
      low += band.lowMinutes;
      high += band.highMinutes;
      needed = Math.max(needed, Math.max(0, CONFIDENCE_HONEST_MIN_LOGS - (cached?.n ?? 0)));
    }

    return { tasks: out, coldLogsNeeded: needed, lowMin: low, highMin: high };
  }, [dayTasks, statsByCategory, archetypeSeed]);

  const dayEndMs = useMemo(() => dayEndEpochFor(nowMs, dayEndMin), [nowMs, dayEndMin]);

  // Calendar minutes are Pro-only and arrive from useDayCapacity; a free caller
  // passes nothing and the default 0 keeps them out of the math entirely.
  const events = isPro ? Math.max(0, eventMinAhead) : 0;

  const landing = useMemo(
    () => honestLanding({ nowMs, dayEndMs, tasks, eventMinAhead: events }),
    [nowMs, dayEndMs, tasks, events],
  );

  const range = useMemo(
    () =>
      coldLogsNeeded > 0 && landing.kind !== 'empty'
        ? landingRange({ nowMs, lowMin, highMin, eventMinAhead: events })
        : null,
    [coldLogsNeeded, landing.kind, nowMs, lowMin, highMin, events],
  );

  return { landing, range, logsToWarm: coldLogsNeeded, dayEndMs, nowMs };
}
