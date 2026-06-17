// Reverse Start-By planner. PURE TS — no RN/Expo/clock.
// A deterministic backward pass from a finish-by deadline plus a "cut one"
// feasibility verdict. Read-only consumer of the engine: never writes logs/stats,
// never reads the clock (callers pass `nowMs`/`deadline`), never mutates inputs.
import type {
  PlanResult,
  PlanTaskInput,
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
  /** current time, to judge feasibility. Pass explicitly (engine is clock-free). */
  nowMs: number;
}

/** A task paired with its effective block (duration + buffer), in minutes. */
interface EffectiveTask {
  task: PlanTaskInput;
  effectiveMin: number;
}

/** Effective block for one task = honest duration + the buffer chip, never < 0. */
function effectiveBlockMin(durationMin: number, bufferMin: number): number {
  return Math.max(0, durationMin) + Math.max(0, bufferMin);
}

/** startBy such that placing `totalMin` of work ends exactly at `deadline`. */
function startByFor(deadline: number, totalMin: number): number {
  return deadline - totalMin * MS_PER_MIN;
}

/** Place blocks forward from `startBy`, preserving the given order. */
function buildTimeline(startBy: number, items: readonly EffectiveTask[]): PlanTimelineItem[] {
  let cursor = startBy;
  return items.map(({ task, effectiveMin }) => {
    const startAt = cursor;
    const endAt = startAt + effectiveMin * MS_PER_MIN;
    cursor = endAt;
    return { id: task.id, label: task.label, startAt, endAt, kind: 'task' as const };
  });
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
function cutLadder(
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
function smallestEffectiveMin(effectives: readonly EffectiveTask[]): number {
  let min = Infinity;
  for (const e of effectives) min = Math.min(min, e.effectiveMin);
  return Number.isFinite(min) ? min : 0;
}

/**
 * Backward-pass scheduler. Walks `tasks` in order, placing them to finish exactly
 * at `deadline`, then judges feasibility against `nowMs` and returns a structured
 * verdict. Pure and order-preserving; inputs are never mutated.
 */
export function planBackward(input: PlanBackwardInput): PlanResult {
  const { deadline, tasks, nowMs } = input;
  const bufferMin = input.bufferMin ?? DEFAULT_BUFFER_MIN;

  const effectives: EffectiveTask[] = tasks.map((task) => ({
    task,
    effectiveMin: effectiveBlockMin(task.durationMin, bufferMin),
  }));
  const totalMin = effectives.reduce((sum, e) => sum + e.effectiveMin, 0);

  const startBy = startByFor(deadline, totalMin);
  const timeline = buildTimeline(startBy, effectives);

  // Empty plan, or you can still start on time → it fits.
  if (startBy >= nowMs) {
    return { startBy, timeline, verdict: { kind: 'fits', startBy }, totalMin };
  }

  const verdict = cutLadder(deadline, nowMs, totalMin, effectives);
  return { startBy, timeline, verdict, totalMin };
}
