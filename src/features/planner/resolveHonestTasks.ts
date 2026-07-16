import { resolveSuggestion, seededPriorFor, PERSONAL_MIN_LOGS } from '@/src/engine';
import type { AffineFit } from '@/src/engine/affine';
import type { ArchetypeSeed } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// resolveHonestTasks — the shared honest-number resolver for planning surfaces.
//
// Pure-ish: pass in the raw draft + today task lists and the calibration stats
// map; it returns the deduped union resolved to honest minutes. It does NOT read
// stores itself, so it is cheap to unit-test. The hook wires the stores to it.
//
// Draft tasks already carry `durationMin` (the honest block the planner chose) →
// used directly and counted as 'personal'. Today tasks resolve their honest
// number the same way `usePlanner.suggestedDuration` does — round5(guess × M)
// per category, prior fallback. `basis` is 'prior' only when EVERY resolved task
// fell back to priors (no personal draft task, no learned today category).
// ──────────────────────────────────────────────────────────────────────────────

/** Minimal shape of a plan-draft task this resolver needs. */
export interface DraftTaskInput {
  id: string;
  label: string;
  durationMin: number;
  status: 'upcoming' | 'running' | 'done';
}

/** Minimal shape of a Today task this resolver needs. */
export interface TodayTaskInput {
  id: string;
  label: string;
  category: string;
  guessMin: number;
  status: 'queued' | 'done';
}

/** Minimal shape of a cached calibration stat this resolver reads. */
export interface ResolverStat {
  fit: AffineFit;
  n: number;
}

export interface ResolveHonestTasksInput {
  draftTasks: readonly DraftTaskInput[];
  todayTasks: readonly TodayTaskInput[];
  statsByCategory: Record<string, ResolverStat>;
  /** The quiz archetype seed, or undefined when no quiz was taken (falls back
   *  to the plain population prior — unchanged pre-quiz behavior). */
  seed: ArchetypeSeed | undefined;
}

/** One task resolved to its honest block, with a done flag for context. */
export interface ResolvedHonestTask {
  id: string;
  label: string;
  honestMin: number;
  done: boolean;
}

export interface ResolveHonestTasksResult {
  tasks: ResolvedHonestTask[];
  basis: 'personal' | 'prior';
}

/** Honest minutes for a Today guess in `category`, mirroring usePlanner. */
function resolveTodayHonest(
  category: string,
  guessMin: number,
  statsByCategory: Record<string, ResolverStat>,
  seed: ArchetypeSeed | undefined,
): { honestMin: number; isPersonal: boolean } {
  const cached = statsByCategory[category];
  const cat = cached
    ? { fit: cached.fit, n: cached.n }
    : { fit: { a: 0, b: seededPriorFor(category, seed) }, n: 0 };
  const honestMin = resolveSuggestion({ guessMinutes: guessMin, category: cat, recurring: null })
    .honestMinutes;
  return { honestMin, isPersonal: cat.n >= PERSONAL_MIN_LOGS };
}

export function resolveHonestTasks(input: ResolveHonestTasksInput): ResolveHonestTasksResult {
  const { draftTasks, todayTasks, statsByCategory, seed } = input;

  const draftIds = new Set(draftTasks.map((t) => t.id));
  let anyPersonal = false;

  const draftResolved: ResolvedHonestTask[] = draftTasks.map((t) => {
    anyPersonal = true; // a planner-built block is the user's own number
    return { id: t.id, label: t.label, honestMin: t.durationMin, done: t.status === 'done' };
  });

  const todayResolved: ResolvedHonestTask[] = todayTasks
    .filter((t) => !draftIds.has(t.id))
    .map((t) => {
      const { honestMin, isPersonal } = resolveTodayHonest(t.category, t.guessMin, statsByCategory, seed);
      if (isPersonal) anyPersonal = true;
      return { id: t.id, label: t.label, honestMin, done: t.status === 'done' };
    });

  const tasks = [...draftResolved, ...todayResolved];
  return { tasks, basis: anyPersonal ? 'personal' : 'prior' };
}
