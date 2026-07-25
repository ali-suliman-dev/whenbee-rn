// PURE. The forward day read: walk the queued tasks from `now` at their honest
// minutes and report what time the day actually ends. No window, no fraction —
// a landing time can't collapse the way a shrinking denominator does.
//
// Deliberately NOT planner.ts's backward model: that one solves "when must I
// start to hit a deadline" and adds a per-task buffer. Honest minutes already
// carry the personal multiplier, so a buffer on top would double-count the very
// bias the multiplier exists to correct.
// NOTE: MS_PER_MIN is not actually exported from constants.ts (despite the
// planner-parity assumption) — planner.ts and planDayAroundAnchors.ts both
// define it locally as `const MS_PER_MIN = 60_000`. Match that house pattern
// rather than add a new export to constants.ts.
const MS_PER_MIN = 60_000;

export interface LandingTask {
  id: string;
  label: string;
  /** Honest minutes for this task (guess × M_eff, already rounded). */
  honestMin: number;
}

export interface TaskEnd {
  id: string;
  /** Epoch ms this task finishes, given everything before it runs first. */
  endMs: number;
}

export interface LandingInput {
  nowMs: number;
  /** Epoch ms of the user's end of day (from `dayEndEpochFor`). */
  dayEndMs: number;
  /** Queued tasks in execution order. */
  tasks: readonly LandingTask[];
  /** Timed calendar minutes still ahead of now. Pro only; 0 for free users. */
  eventMinAhead?: number;
}

export type LandingKind =
  | 'clear' // lands at or before dayEnd
  | 'over' // lands after dayEnd
  | 'past' // now is already at/after dayEnd
  | 'empty'; // nothing queued and no events ahead

export interface LandingResult {
  kind: LandingKind;
  /** Epoch ms the last task finishes. `null` only when kind === 'empty'. */
  landingMs: number | null;
  /** Minutes past dayEnd — the overshoot when 'over', the time since dayEnd when 'past'. */
  overMin: number;
  /** Minutes between landing and dayEnd. 0 unless 'clear'. */
  openMin: number;
  /** Total honest minutes still queued (tasks only — events are not "your" work). */
  remainingMin: number;
  /** First task whose block crosses dayEnd, in execution order. `null` unless 'over'. */
  tail: LandingTask | null;
  /** Cumulative finish per task, same order as `tasks`. */
  ends: readonly TaskEnd[];
}

const EMPTY: LandingResult = {
  kind: 'empty',
  landingMs: null,
  overMin: 0,
  openMin: 0,
  remainingMin: 0,
  tail: null,
  ends: [],
};

export function honestLanding({
  nowMs,
  dayEndMs,
  tasks,
  eventMinAhead = 0,
}: LandingInput): LandingResult {
  const eventMin = Math.max(0, eventMinAhead);
  const remainingMin = tasks.reduce((sum, t) => sum + Math.max(0, t.honestMin), 0);

  if (remainingMin === 0 && eventMin === 0) return EMPTY;

  // Events are committed time that has to happen alongside the tasks, so they
  // push the whole chain out. They get no row of their own in `ends`.
  const landingMs = nowMs + (remainingMin + eventMin) * MS_PER_MIN;

  const ends: TaskEnd[] = [];
  let cursor = nowMs;
  let tail: LandingTask | null = null;
  for (const t of tasks) {
    cursor += Math.max(0, t.honestMin) * MS_PER_MIN;
    ends.push({ id: t.id, endMs: cursor });
    if (tail === null && cursor > dayEndMs) tail = t;
  }

  if (nowMs >= dayEndMs) {
    return {
      kind: 'past',
      landingMs,
      overMin: Math.round((nowMs - dayEndMs) / MS_PER_MIN),
      openMin: 0,
      remainingMin,
      tail: null,
      ends,
    };
  }

  if (landingMs > dayEndMs) {
    return {
      kind: 'over',
      landingMs,
      overMin: Math.round((landingMs - dayEndMs) / MS_PER_MIN),
      openMin: 0,
      remainingMin,
      tail,
      ends,
    };
  }

  return {
    kind: 'clear',
    landingMs,
    overMin: 0,
    openMin: Math.round((dayEndMs - landingMs) / MS_PER_MIN),
    remainingMin,
    tail: null,
    ends,
  };
}

export interface LandingRangeInput {
  nowMs: number;
  /** Summed lower edge of every task's honest range, in minutes. */
  lowMin: number;
  /** Summed upper edge, in minutes. */
  highMin: number;
  eventMinAhead?: number;
}

export interface LandingRangeResult {
  lowMs: number;
  highMs: number;
}

/**
 * Projects a summed honest band onto the clock. Used only before the categories
 * in play have enough logs for a single time to be honest. Edges are sorted, so
 * a caller that hands them over in the wrong order still gets a sane range.
 */
export function landingRange({
  nowMs,
  lowMin,
  highMin,
  eventMinAhead = 0,
}: LandingRangeInput): LandingRangeResult {
  const events = Math.max(0, eventMinAhead);
  const low = Math.max(0, Math.min(lowMin, highMin)) + events;
  const high = Math.max(0, Math.max(lowMin, highMin)) + events;
  return { lowMs: nowMs + low * MS_PER_MIN, highMs: nowMs + high * MS_PER_MIN };
}
