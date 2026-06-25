// Reverse Start-By planner. PURE TS — no RN/Expo/clock.
// A deterministic backward pass from a finish-by deadline plus a "cut one"
// feasibility verdict. Read-only consumer of the engine: never writes logs/stats,
// never reads the clock (callers pass `nowMs`/`deadline`), never mutates inputs.
import type {
  PlanResult,
  PlanTaskInput,
  PlanTaskStatus,
  PlanTimelineItem,
  PlanVerdict,
} from '../domain/types';

const MS_PER_MIN = 60_000;

/** Per-task auto-buffer chip: Off(0)/+5/+10/+20. Default +5. */
export const DEFAULT_BUFFER_MIN = 5;

interface PlanBackwardInput {
  /** epoch ms — the finish-by time. */
  deadline: number;
  /** ordered list, executed in this order. */
  tasks: PlanTaskInput[];
  /** per-task buffer chip; default DEFAULT_BUFFER_MIN. */
  bufferMin?: number;
  /** Gap inserted between consecutive tasks (minutes). 0 = no gap. */
  breatherMin?: number;
  /** current time, to judge feasibility. Pass explicitly (engine is clock-free). */
  nowMs: number;
}

/** A task paired with its effective block (duration + buffer), in minutes. */
export interface EffectiveTask {
  task: PlanTaskInput;
  effectiveMin: number;
}

/** Effective block for one task = honest duration + the buffer chip, never < 0. */
export function effectiveBlockMin(durationMin: number, bufferMin: number): number {
  return Math.max(0, durationMin) + Math.max(0, bufferMin);
}

/** startBy such that placing `totalMin` of work ends exactly at `deadline`. */
export function startByFor(deadline: number, totalMin: number): number {
  return deadline - totalMin * MS_PER_MIN;
}

/**
 * Place task blocks forward from `startBy`, inserting a breather gap between
 * each consecutive pair when `breatherMin > 0`. Returns a mixed timeline of
 * `'task'` and `'breather'` items in chronological order.
 *
 * With N tasks there are N−1 inter-task gaps, so a single task never emits a
 * breather item.
 */
function buildTimeline(
  startBy: number,
  items: readonly EffectiveTask[],
  breatherMin: number,
): PlanTimelineItem[] {
  const breatherMs = breatherMin * MS_PER_MIN;
  const result: PlanTimelineItem[] = [];
  let cursor = startBy;

  items.forEach(({ task, effectiveMin }, index) => {
    // Insert a breather before every task except the first.
    if (index > 0 && breatherMs > 0) {
      const gapStart = cursor;
      const gapEnd = cursor + breatherMs;
      result.push({ id: `breather-${index}`, label: '', startAt: gapStart, endAt: gapEnd, kind: 'breather' as const });
      cursor = gapEnd;
    }

    const startAt = cursor;
    const endAt = startAt + effectiveMin * MS_PER_MIN;
    result.push({ id: task.id, label: task.label, startAt, endAt, kind: 'task' as const });
    cursor = endAt;
  });

  return result;
}

/** Minutes the FULL plan overshoots the deadline, given we can't start before now. */
function overshootMinutes(nowMs: number, totalMin: number, deadline: number): number {
  return Math.ceil((nowMs + totalMin * MS_PER_MIN - deadline) / MS_PER_MIN);
}

/**
 * The deterministic "cut one" ladder, reached only when the full plan can't
 * start on time (`startBy < nowMs`). Drops tasks largest-effective-block first,
 * because each such drop buys back the most time:
 *
 *   1. Drop the single largest → if it now fits → `cut-one`.
 *   2. Keep dropping the next-largest until it fits → `multi-cut` (≥2 dropped).
 *   3. If even keeping only the single SMALLEST task won't fit → `push-deadline`.
 */
export function cutLadder(
  deadline: number,
  nowMs: number,
  totalMin: number,
  effectives: readonly EffectiveTask[],
): PlanVerdict {
  // Largest-effective-block first; ties broken by original order (stable).
  const byLargest = effectives
    .map((e, index) => ({ ...e, index }))
    .sort((a, b) => b.effectiveMin - a.effectiveMin || a.index - b.index);

  const dropped: EffectiveTask[] = [];
  let remainingMin = totalMin;

  // Greedily drop largest tasks, but never the final survivor — step 3 owns the
  // "can't even keep one" case via the smallest-task feasibility check below.
  for (let i = 0; i < byLargest.length - 1; i += 1) {
    const candidate = byLargest[i];
    if (!candidate) continue;
    dropped.push(candidate);
    remainingMin -= candidate.effectiveMin;
    if (startByFor(deadline, remainingMin) >= nowMs) {
      const cuts = dropped.map((d) => ({ id: d.task.id, label: d.task.label }));
      const savedMin = dropped.reduce((sum, d) => sum + d.effectiveMin, 0);
      const first = cuts[0];
      if (cuts.length === 1 && first) {
        return { kind: 'cut-one', startBy: startByFor(deadline, remainingMin), cut: first, savedMin };
      }
      return { kind: 'multi-cut', startBy: startByFor(deadline, remainingMin), cuts, savedMin };
    }
  }

  // Even the single smallest task alone won't fit before the deadline → push it.
  return {
    kind: 'push-deadline',
    feasibleDeadline: nowMs + smallestEffectiveMin(effectives) * MS_PER_MIN,
    overshootMin: overshootMinutes(nowMs, totalMin, deadline),
  };
}

/** The smallest effective block among the tasks (0 when there are none). */
export function smallestEffectiveMin(effectives: readonly EffectiveTask[]): number {
  let min = Infinity;
  for (const e of effectives) min = Math.min(min, e.effectiveMin);
  return Number.isFinite(min) ? min : 0;
}

/** Total breather gap in minutes for N tasks: (N − 1) × breatherMin. */
function totalBreatherMin(taskCount: number, breatherMin: number): number {
  return Math.max(0, taskCount - 1) * breatherMin;
}

// ── Reproject (incomplete-task diff) ────────────────────────────────────────

/** One task fed to `reproject`. `status` is used only to filter out done tasks. */
interface ReprojectTask {
  id: string;
  /** Human-readable label forwarded to the timeline items. */
  label?: string;
  /** Normalized category for display. Not used by the pure planner. */
  category?: string;
  durationMin: number;
  /** Tasks with status 'done' are excluded from the reproject pass. */
  status?: PlanTaskStatus;
}

/** Input to `reproject` — mirrors `PlanBackwardInput` with an extended task shape. */
interface ReprojectInput {
  deadline: number;
  nowMs: number;
  bufferMin?: number;
  breatherMin?: number;
  tasks: ReprojectTask[];
}

/** Result of `reproject`: the `PlanResult` of the remaining tasks plus a fit flag. */
export interface ReprojectResult extends PlanResult {
  /** True when the verdict is 'fits' (remaining tasks finish before the deadline). */
  stillFits: boolean;
}

/**
 * Backward-pass scheduler. Walks `tasks` in order, placing them to finish exactly
 * at `deadline`, then judges feasibility against `nowMs` and returns a structured
 * verdict. When `breatherMin > 0`, inserts gap items between tasks and shifts
 * `startBy` earlier by (N − 1) × breatherMin. Pure and order-preserving; inputs
 * are never mutated.
 */
export function planBackward(input: PlanBackwardInput): PlanResult {
  const { deadline, tasks, nowMs } = input;
  const bufferMin = input.bufferMin ?? DEFAULT_BUFFER_MIN;
  const breatherMin = Math.max(0, input.breatherMin ?? 0);

  const effectives: EffectiveTask[] = tasks.map((task) => ({
    task,
    effectiveMin: effectiveBlockMin(task.durationMin, bufferMin),
  }));
  const taskTotalMin = effectives.reduce((sum, e) => sum + e.effectiveMin, 0);
  const gapTotalMin = totalBreatherMin(tasks.length, breatherMin);
  const totalMin = taskTotalMin + gapTotalMin;

  const startBy = startByFor(deadline, totalMin);
  const timeline = buildTimeline(startBy, effectives, breatherMin);

  // Empty plan, or you can still start on time → it fits.
  if (startBy >= nowMs) {
    return { startBy, timeline, verdict: { kind: 'fits', startBy }, totalMin };
  }

  // Feasibility is judged on task-only blocks (the cut ladder reasons over tasks,
  // not gap items). Breather gaps are a display/pacing concern, not a workload cut.
  const verdict = cutLadder(deadline, nowMs, taskTotalMin, effectives);
  return { startBy, timeline, verdict, totalMin };
}

/**
 * Re-runs the backward pass over **incomplete** tasks only (filters out
 * `status === 'done'`). Returns the same shape as `planBackward` plus a
 * `stillFits` convenience flag so callers don't have to inspect `verdict.kind`.
 *
 * Pure and non-mutating. The `cutLadder` is reused through `planBackward` so
 * the over-case cut suggestion is still available on the result.
 */
export function reproject(input: ReprojectInput): ReprojectResult {
  const remaining: PlanTaskInput[] = input.tasks
    .filter((t) => t.status !== 'done')
    .map((t) => ({
      id: t.id,
      label: t.label ?? t.id,
      category: t.category ?? '',
      durationMin: t.durationMin,
    }));

  const result = planBackward({ ...input, tasks: remaining });
  return { ...result, stillFits: result.verdict.kind === 'fits' };
}
