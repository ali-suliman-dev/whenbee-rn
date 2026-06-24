import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandKv } from '@/src/lib/kv';
import {
  getDatabase,
  makeRoutinesRepo,
  makeRecurringRepo,
  makeCategoryStatsRepo,
  type Database,
  type RoutineWithSteps,
} from '@/src/db';
import {
  distributeRoutineRun,
  routineBasis,
  blendWithPrior,
  updateEwma,
  recurringHasEnoughData,
  alphaFor,
  clampRatio,
  priorFor,
  TRANSITION_PRIOR,
  stepHonestMinutes,
  routineHonestTotal,
} from '@/src/engine';
import type { Routine, RoutineStep, RoutineStepKey } from '@/src/domain/types';
import { analytics } from '@/src/services/analytics';
import {
  scheduleRoutineAlerts,
  cancelRoutineAlerts,
} from '@/src/services/routineNotifications';

// ──────────────────────────────────────────────────────────────────────────────
// routinesStore — saved routines list + build/edit draft + a KV-persisted
// active-run slice (mirrors planStore.active so a backgrounded run survives reopen).
//
// Per-step learning REUSES the existing recurring_stats table via a namespaced key
// `routine:{routineId}:{stepId}` — NOT a parallel learning store. Each completed
// step trains the same EWMA-over-ln(ratio) recurring stat a free recurring task
// trains, with the step's category prior anchoring the blend. The chain-level
// transition factor is the only routine-specific stat; it is trained ONLY on a
// full run (every step completed) via the pure `distributeRoutineRun`.
// ──────────────────────────────────────────────────────────────────────────────

/** The per-step recurring key — namespaced so it never collides with free keys. */
export function routineStepKey(routineId: string, stepId: string): RoutineStepKey {
  return `routine:${routineId}:${stepId}`;
}

/** Collision-resistant id without a uuid dependency (mirrors the other stores). */
function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** A step being composed in the build draft (no id/position until saved/loaded). */
export interface DraftStep {
  id: string;
  label: string;
  category: string;
  guessMin: number;
}

interface RoutineDraft {
  /** The routine id being edited, or null for a brand-new routine. */
  editingId: string | null;
  name: string;
  doneByMinuteOfDay: number | null;
  steps: DraftStep[];
  /** Weekdays on which this routine is scheduled (0–6). Empty = unscheduled. */
  scheduleDays: number[];
  alertEnabled: boolean;
  alertLeadMin: number;
}

/** Per-step status during a live run. A skip is first-class, never a failure. */
export type RunStepStatus = 'upcoming' | 'running' | 'done' | 'skipped';

/** One step's live run state (the actual is the timer's elapsed minutes). */
export interface RunStep {
  stepId: string;
  status: RunStepStatus;
  actualMin?: number;
}

/** The single active routine run (KV-persisted). */
export interface ActiveRoutineRun {
  routineId: string;
  startedAt: number;
  steps: RunStep[];
}

const emptyDraft: RoutineDraft = {
  editingId: null,
  name: '',
  doneByMinuteOfDay: null,
  steps: [],
  scheduleDays: [],
  alertEnabled: false,
  alertLeadMin: 0,
};

interface RoutinesState {
  db: Database | null;
  routines: RoutineWithSteps[];
  /** Per-step learned multiplier, keyed by `routine:{routineId}:{stepId}`. Present
   *  only when the step's recurring stat has earned its own fit (≥ RECURRING_MIN_LOGS);
   *  the hook falls back to the step's category M otherwise. Refreshed on load. */
  stepMByKey: Record<string, number>;
  draft: RoutineDraft;
  activeRun: ActiveRoutineRun | null;

  setDatabase: (db: Database) => void;
  loadRoutines: () => Promise<void>;

  // ── Build draft ──────────────────────────────────────────────────────────────
  setName: (name: string) => void;
  setDoneBy: (minuteOfDay: number | null) => void;
  setSchedule: (days: number[]) => void;
  setAlert: (enabled: boolean, leadMin: number) => void;
  addStep: (step: { label: string; category: string; guessMin: number }) => void;
  editStep: (id: string, patch: Partial<Omit<DraftStep, 'id'>>) => void;
  removeStep: (id: string) => void;
  reorderSteps: (ids: string[]) => void;
  editExisting: (id: string) => Promise<void>;
  resetDraft: () => void;
  /** Persist the draft (insert or update). Returns the routine id. */
  saveDraft: () => Promise<string>;
  /** Delete a routine + its learned transition factor (steps' learned stats stay). */
  removeRoutine: (id: string) => Promise<void>;

  // ── Active run ────────────────────────────────────────────────────────────────
  startRun: (routineId: string) => Promise<void>;
  completeStep: (stepId: string, actualMin: number) => void;
  skipStep: (stepId: string) => void;
  /** Train completed steps; on a FULL run also train the factor + bump runCount. */
  finishRun: () => Promise<void>;
  abandonRun: () => Promise<void>;

  reset: () => void;
}

async function resolveDb(
  get: () => RoutinesState,
  set: (p: Partial<RoutinesState>) => void,
): Promise<Database> {
  const existing = get().db;
  if (existing) return existing;
  const db = await getDatabase();
  set({ db });
  return db;
}

/**
 * Compute startByMinuteOfDay for a routine, given its persisted steps.
 * Returns null when doneByMinuteOfDay is null or there are no steps.
 * Mirrors the engine call in useRoutines (no React dependency so it's usable in
 * the async store action). Uses the default transition prior for newly created
 * routines until trained.
 */
async function computeStartByMinuteOfDay(
  db: Database,
  routine: Routine,
  steps: RoutineStep[],
): Promise<number | null> {
  if (routine.doneByMinuteOfDay === null || steps.length === 0) return null;
  const recurring = makeRecurringRepo(db);
  const catStats = makeCategoryStatsRepo(db);
  const perStepHonest = await Promise.all(
    steps.map(async (step) => {
      const key = `routine:${routine.id}:${step.id}` as import('@/src/domain/types').RoutineStepKey;
      const stat = await recurring.get(key);
      let m: number;
      if (stat && recurringHasEnoughData(stat.n)) {
        m = stat.mEffective;
      } else {
        const cat = await catStats.get(step.category);
        m = cat.mEffective;
      }
      return stepHonestMinutes(step.guessMin, m);
    }),
  );
  const honestTotalMin = routineHonestTotal(perStepHonest, routine.transitionFactor);
  return Math.max(0, routine.doneByMinuteOfDay - honestTotalMin);
}

/**
 * Resolve a step's multiplier BEFORE this run trains it: the step's own recurring
 * stat once it has enough logs, else the step category's learned M (the same
 * fallback resolveSuggestion encodes). Pure read — never trains.
 */
async function resolveStepMBefore(db: Database, key: string, category: string): Promise<number> {
  const recurring = await makeRecurringRepo(db).get(key);
  if (recurring && recurringHasEnoughData(recurring.n)) return recurring.mEffective;
  const cat = await makeCategoryStatsRepo(db).get(category);
  return cat.mEffective;
}

/**
 * Train ONE step through the recurring path: advance its recurring_stats EWMA over
 * ln(clampedRatio), exactly like a free recurring task. The blend against the
 * category prior keeps a thin step smart on day 1.
 */
async function trainStep(
  db: Database,
  key: string,
  category: string,
  estimateMin: number,
  actualMin: number,
  nowMs: number,
): Promise<void> {
  const repo = makeRecurringRepo(db);
  const prev = await repo.get(key);
  const prior = priorFor(category);
  const ratio = clampRatio(estimateMin, actualMin);
  // Timed run → the timed alpha for the category's learning speed (balanced default).
  const alpha = alphaFor('balanced', 'timed');
  const prevEwma = prev?.logEwma ?? 0;
  const n = (prev?.n ?? 0) + 1;
  const logEwma = updateEwma(prevEwma, ratio, alpha);
  const mEffective = blendWithPrior(n, logEwma, prior);
  await repo.upsert({ key, categoryId: category, n, logEwma, mEffective, updatedAt: nowMs });
}

export const useRoutinesStore = create<RoutinesState>()(
  persist(
    (set, get) => ({
      db: null,
      routines: [],
      stepMByKey: {},
      draft: emptyDraft,
      activeRun: null,

      setDatabase: (db) => set({ db }),

      loadRoutines: async () => {
        const db = await resolveDb(get, set);
        const repo = makeRoutinesRepo(db);
        const recurring = makeRecurringRepo(db);
        const routines = await repo.list();
        // Resolve each step's earned recurring M (when it has its own fit) so the
        // hook can derive honest minutes purely; thin steps fall back to category M.
        const stepMByKey: Record<string, number> = {};
        for (const { routine, steps } of routines) {
          for (const step of steps) {
            const key = routineStepKey(routine.id, step.id);
            const stat = await recurring.get(key);
            if (stat && recurringHasEnoughData(stat.n)) stepMByKey[key] = stat.mEffective;
          }
        }
        set({ routines, stepMByKey });
      },

      // ── Build draft ──────────────────────────────────────────────────────────
      setName: (name) => set((s) => ({ draft: { ...s.draft, name } })),

      setDoneBy: (minuteOfDay) =>
        set((s) => ({ draft: { ...s.draft, doneByMinuteOfDay: minuteOfDay } })),

      setSchedule: (days) => set((s) => ({ draft: { ...s.draft, scheduleDays: days } })),

      setAlert: (enabled, leadMin) =>
        set((s) => ({ draft: { ...s.draft, alertEnabled: enabled, alertLeadMin: leadMin } })),

      addStep: ({ label, category, guessMin }) =>
        set((s) => ({
          draft: {
            ...s.draft,
            steps: [...s.draft.steps, { id: makeId(), label, category, guessMin: Math.max(1, guessMin) }],
          },
        })),

      editStep: (id, patch) =>
        set((s) => ({
          draft: {
            ...s.draft,
            steps: s.draft.steps.map((step) =>
              step.id === id
                ? {
                    ...step,
                    ...patch,
                    ...(patch.guessMin !== undefined ? { guessMin: Math.max(1, patch.guessMin) } : {}),
                  }
                : step,
            ),
          },
        })),

      removeStep: (id) =>
        set((s) => ({
          draft: { ...s.draft, steps: s.draft.steps.filter((step) => step.id !== id) },
        })),

      reorderSteps: (ids) =>
        set((s) => {
          const byId = new Map(s.draft.steps.map((step) => [step.id, step]));
          const ordered = ids.map((id) => byId.get(id)).filter((step): step is DraftStep => !!step);
          const seen = new Set(ids);
          const leftovers = s.draft.steps.filter((step) => !seen.has(step.id));
          return { draft: { ...s.draft, steps: [...ordered, ...leftovers] } };
        }),

      editExisting: async (id) => {
        const db = await resolveDb(get, set);
        const loaded = await makeRoutinesRepo(db).get(id);
        if (!loaded) return;
        set({
          draft: {
            editingId: loaded.routine.id,
            name: loaded.routine.name,
            doneByMinuteOfDay: loaded.routine.doneByMinuteOfDay,
            scheduleDays: loaded.routine.scheduleDays,
            alertEnabled: loaded.routine.alertEnabled,
            alertLeadMin: loaded.routine.alertLeadMin,
            steps: loaded.steps
              .slice()
              .sort((a, b) => a.position - b.position)
              .map((step) => ({ id: step.id, label: step.label, category: step.category, guessMin: step.guessMin })),
          },
        });
      },

      resetDraft: () => set({ draft: emptyDraft }),

      saveDraft: async () => {
        const db = await resolveDb(get, set);
        const repo = makeRoutinesRepo(db);
        const { draft } = get();
        const now = Date.now();
        const isEdit = draft.editingId !== null;
        const id = draft.editingId ?? makeId();

        // Preserve the learned factor + runCount when editing; fresh otherwise.
        const existing = isEdit ? await repo.get(id) : null;
        const routine: Routine = {
          id,
          name: draft.name.trim(),
          doneByMinuteOfDay: draft.doneByMinuteOfDay,
          transitionFactor: existing?.routine.transitionFactor ?? TRANSITION_PRIOR,
          runCount: existing?.routine.runCount ?? 0,
          scheduleDays: draft.scheduleDays,
          alertEnabled: draft.alertEnabled,
          alertLeadMin: draft.alertLeadMin,
          createdAt: existing?.routine.createdAt ?? now,
          updatedAt: now,
        };
        const steps: RoutineStep[] = draft.steps.map((step, position) => ({
          id: step.id,
          routineId: id,
          position,
          label: step.label.trim(),
          category: step.category,
          guessMin: Math.max(1, step.guessMin),
        }));

        if (isEdit) await repo.update(routine, steps);
        else await repo.create(routine, steps);

        analytics.capture(isEdit ? 'routine_edited' : 'routine_created', isEdit
          ? { routine_id_hash: hashId(id), step_count: steps.length }
          : { step_count: steps.length, has_anchor: draft.doneByMinuteOfDay !== null });

        // Schedule or cancel start-by alerts based on the saved routine.
        const startByMin = await computeStartByMinuteOfDay(db, routine, steps);
        if (startByMin !== null) {
          await scheduleRoutineAlerts(routine, startByMin);
        } else {
          // No anchor → cancel any existing alerts (alert toggle changed or anchor removed).
          await cancelRoutineAlerts(id);
        }

        set({ draft: emptyDraft });
        await get().loadRoutines();
        return id;
      },

      removeRoutine: async (id) => {
        const db = await resolveDb(get, set);
        await makeRoutinesRepo(db).remove(id);
        // Cancel any scheduled alerts for the deleted routine.
        await cancelRoutineAlerts(id);
        await get().loadRoutines();
      },

      // ── Active run ──────────────────────────────────────────────────────────────
      startRun: async (routineId) => {
        const db = await resolveDb(get, set);
        const loaded = await makeRoutinesRepo(db).get(routineId);
        if (!loaded) return;
        const steps: RunStep[] = loaded.steps
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((step, index) => ({ stepId: step.id, status: index === 0 ? 'running' : 'upcoming' }));
        set({ activeRun: { routineId, startedAt: Date.now(), steps } });
        analytics.capture('routine_run_started', {
          step_count: steps.length,
          basis: routineBasis(loaded.routine.runCount).basis,
        });
      },

      completeStep: (stepId, actualMin) =>
        set((s) => {
          if (!s.activeRun) return s;
          const steps = advanceAfter(s.activeRun.steps, stepId, {
            status: 'done',
            actualMin: Math.max(0, actualMin),
          });
          return { activeRun: { ...s.activeRun, steps } };
        }),

      skipStep: (stepId) =>
        set((s) => {
          if (!s.activeRun) return s;
          const steps = advanceAfter(s.activeRun.steps, stepId, { status: 'skipped' });
          return { activeRun: { ...s.activeRun, steps } };
        }),

      finishRun: async () => {
        const run = get().activeRun;
        if (!run) return;
        const db = await resolveDb(get, set);
        const repo = makeRoutinesRepo(db);
        const loaded = await repo.get(run.routineId);
        if (!loaded) {
          set({ activeRun: null });
          return;
        }
        const now = Date.now();
        const stepById = new Map(loaded.steps.map((step) => [step.id, step]));

        const completed = run.steps.filter(
          (rs): rs is RunStep & { actualMin: number } => rs.status === 'done' && rs.actualMin !== undefined,
        );
        const fullRun = run.steps.length > 0 && run.steps.every((rs) => rs.status === 'done');

        // Build the distribution input for the completed steps (chain residual + per-step).
        const distSteps = await Promise.all(
          completed.map(async (rs) => {
            const step = stepById.get(rs.stepId);
            const category = step?.category ?? 'admin';
            const guessMin = step?.guessMin ?? 0;
            const key = routineStepKey(run.routineId, rs.stepId);
            const stepMBefore = await resolveStepMBefore(db, key, category);
            return { stepKey: key, guessMin, actualMin: rs.actualMin, stepMBefore, category };
          }),
        );

        const dist = distributeRoutineRun({
          steps: distSteps.map(({ stepKey, guessMin, actualMin, stepMBefore }) => ({
            stepKey,
            guessMin,
            actualMin,
            stepMBefore,
          })),
          priorFactor: loaded.routine.transitionFactor,
        });

        // Train each completed step through the recurring path (always — even on a
        // partial run, self-knowledge is kept).
        for (const ds of distSteps) {
          await trainStep(db, ds.stepKey, ds.category, ds.guessMin, ds.actualMin, now);
        }

        // The transition factor + runCount advance ONLY on a full completed run.
        if (fullRun) {
          await repo.setTransitionFactor(run.routineId, dist.nextTransitionFactor, now);
          await repo.incrementRunCount(run.routineId, now);
        }

        analytics.capture('routine_run_completed', {
          step_count: run.steps.length,
          full_run: fullRun,
          total_actual_min: completed.reduce((sum, rs) => sum + rs.actualMin, 0),
          total_honest_min: 0,
          run_count_after: loaded.routine.runCount + (fullRun ? 1 : 0),
        });

        set({ activeRun: null });
        await get().loadRoutines();
      },

      abandonRun: async () => {
        const run = get().activeRun;
        if (run) {
          const stepsDone = run.steps.filter((rs) => rs.status === 'done').length;
          analytics.capture('routine_run_abandoned', { steps_done: stepsDone, step_count: run.steps.length });
        }
        set({ activeRun: null });
      },

      reset: () => set({ routines: [], stepMByKey: {}, draft: emptyDraft, activeRun: null }),
    }),
    {
      name: 'routines-active-run',
      storage: createJSONStorage(() => zustandKv),
      // Only the live run survives reopen; the routine list + draft are not persisted.
      partialize: (s) => ({ activeRun: s.activeRun }),
    },
  ),
);

/**
 * Apply a status patch to `stepId` and, when that step leaves the running slot,
 * promote the next upcoming step to running. Keeps exactly one running step and
 * never resurrects a done/skipped one. Pure.
 */
function advanceAfter(
  steps: RunStep[],
  stepId: string,
  patch: { status: RunStepStatus; actualMin?: number },
): RunStep[] {
  const next = steps.map((rs) => (rs.stepId === stepId ? { ...rs, ...patch } : rs));
  const hasRunning = next.some((rs) => rs.status === 'running');
  if (hasRunning) return next;
  const idx = next.findIndex((rs) => rs.status === 'upcoming');
  if (idx === -1) return next;
  const promoted = next.slice();
  const target = promoted[idx];
  if (target) promoted[idx] = { ...target, status: 'running' };
  return promoted;
}

/** Non-reversible short hash for analytics (a routine id, never its name). */
function hashId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}
