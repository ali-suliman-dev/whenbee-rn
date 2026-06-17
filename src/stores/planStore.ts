import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandKv } from '@/src/lib/kv';
import { DEFAULT_BUFFER_MIN, DEFAULT_BREATHER_MIN } from '@/src/engine';
import type { PlanTaskStatus } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// Plan store — the reverse Start-By day planner's draft + one active plan.
//
// `draft` is ephemeral composition state (the rows you're editing before you
// build/save). `active` is the single frozen plan, the only thing persisted to
// kv (mirroring app_settings['active_plan'] in the spec). Saving freezes the
// current draft into `active`; clearing drops it. Re-projection reads `active`
// and is applied by the UI via setDeadline/saveActive on explicit confirm — the
// store never silently reshuffles.
// ──────────────────────────────────────────────────────────────────────────────

export type { PlanTaskStatus } from '@/src/domain/types';

export interface PlanDraftTask {
  id: string;
  label: string;
  category: string;
  durationMin: number;
  /** Frozen honest estimate (minutes) at the moment the task was added. */
  suggestedHonestMin: number;
  /** Run-phase lifecycle status. Starts as 'upcoming'. */
  status: PlanTaskStatus;
  /** Wall-clock ms when the task was marked done. */
  completedAt?: number;
  /** Actual elapsed minutes, recorded when completeTask is called. */
  actualMin?: number;
}

export interface ActivePlan {
  deadline: number;
  bufferMin: number;
  breatherMin: number;
  tasks: PlanDraftTask[];
  createdAt: number;
}

interface PlanDraft {
  deadline: number | null;
  bufferMin: number;
  breatherMin: number;
  tasks: PlanDraftTask[];
}

interface PlanState {
  draft: PlanDraft;
  active: ActivePlan | null;
  setDeadline: (ms: number) => void;
  setBuffer: (min: number) => void;
  setBreather: (min: number) => void;
  addTask: (t: Omit<PlanDraftTask, 'id' | 'status' | 'suggestedHonestMin'>) => PlanDraftTask;
  updateTaskDuration: (id: string, min: number) => void;
  removeTask: (id: string) => void;
  reorderTasks: (ids: string[]) => void;
  saveActive: (nowMs?: number) => void;
  clearActive: () => void;
  /** Set a task to 'running'; all others remain at their current status. */
  startTask: (id: string) => void;
  /** Mark a task done with the actual elapsed minutes. */
  completeTask: (id: string, actualMin: number) => void;
  /** Drop the active plan and the working draft (full + progress data-reset path). */
  reset: () => void;
}

/** Collision-resistant id without a uuid dependency (mirrors tasksStore). */
function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const emptyDraft: PlanDraft = {
  deadline: null,
  bufferMin: DEFAULT_BUFFER_MIN,
  breatherMin: DEFAULT_BREATHER_MIN,
  tasks: [],
};

export const usePlanStore = create<PlanState>()(
  persist(
    (set, get) => ({
      draft: emptyDraft,
      active: null,

      setDeadline: (ms) => set((s) => ({ draft: { ...s.draft, deadline: ms } })),

      setBuffer: (min) =>
        set((s) => ({ draft: { ...s.draft, bufferMin: Math.max(0, min) } })),

      setBreather: (min) =>
        set((s) => ({ draft: { ...s.draft, breatherMin: Math.max(0, min) } })),

      addTask: ({ label, category, durationMin }) => {
        const task: PlanDraftTask = {
          id: makeId(),
          label,
          category,
          durationMin,
          suggestedHonestMin: durationMin,
          status: 'upcoming',
        };
        set((s) => ({ draft: { ...s.draft, tasks: [...s.draft.tasks, task] } }));
        return task;
      },

      updateTaskDuration: (id, min) =>
        set((s) => ({
          draft: {
            ...s.draft,
            tasks: s.draft.tasks.map((t) =>
              t.id === id ? { ...t, durationMin: Math.max(5, min) } : t,
            ),
          },
        })),

      removeTask: (id) =>
        set((s) => ({
          draft: { ...s.draft, tasks: s.draft.tasks.filter((t) => t.id !== id) },
        })),

      // Reorder to match the given id order; ids not present are dropped, and any
      // current task missing from `ids` is appended (defensive, keeps tasks safe).
      // If an active plan exists and a running task would change index, the reorder
      // is rejected and the state is returned unchanged.
      reorderTasks: (ids) =>
        set((s) => {
          // Run-phase reorder guard: operate on active tasks if available.
          if (s.active !== null) {
            const activeTasks = s.active.tasks;
            const runningIndex = activeTasks.findIndex((t) => t.status === 'running');
            if (runningIndex !== -1) {
              const runningId = activeTasks[runningIndex]?.id;
              // runningId is defined because runningIndex >= 0, but guard for TS strictness.
              if (runningId !== undefined) {
                const newIndex = ids.indexOf(runningId);
                // Reject if the running task would move to a different slot.
                if (newIndex !== runningIndex) return s;
              }
            }
            // Apply the reorder to active tasks.
            const byId = new Map(activeTasks.map((t) => [t.id, t]));
            const ordered = ids.map((id) => byId.get(id)).filter((t): t is PlanDraftTask => !!t);
            const seen = new Set(ids);
            const leftovers = activeTasks.filter((t) => !seen.has(t.id));
            return { active: { ...s.active, tasks: [...ordered, ...leftovers] } };
          }
          // Draft-phase reorder (no running tasks can exist before saveActive).
          const byId = new Map(s.draft.tasks.map((t) => [t.id, t]));
          const ordered = ids.map((id) => byId.get(id)).filter((t): t is PlanDraftTask => !!t);
          const seen = new Set(ids);
          const leftovers = s.draft.tasks.filter((t) => !seen.has(t.id));
          return { draft: { ...s.draft, tasks: [...ordered, ...leftovers] } };
        }),

      // Freeze the current draft into the single active plan. Requires a deadline.
      saveActive: (nowMs) => {
        const { draft } = get();
        if (draft.deadline === null) return;
        const active: ActivePlan = {
          deadline: draft.deadline,
          bufferMin: draft.bufferMin,
          breatherMin: draft.breatherMin,
          tasks: draft.tasks.map((t) => ({ ...t })),
          createdAt: nowMs ?? Date.now(),
        };
        set({ active });
      },

      clearActive: () => set({ active: null }),

      startTask: (id) =>
        set((s) => {
          if (s.active === null) return s;
          return {
            active: {
              ...s.active,
              tasks: s.active.tasks.map((t) => {
                if (t.id === id) return { ...t, status: 'running' };
                // Demote any other running task back to upcoming; done stays done.
                if (t.status === 'running') return { ...t, status: 'upcoming' };
                return t;
              }),
            },
          };
        }),

      completeTask: (id, actualMin) =>
        set((s) => {
          if (s.active === null) return s;
          return {
            active: {
              ...s.active,
              tasks: s.active.tasks.map((t) =>
                t.id === id
                  ? { ...t, status: 'done', completedAt: Date.now(), actualMin }
                  : t,
              ),
            },
          };
        }),

      reset: () => set({ draft: emptyDraft, active: null }),
    }),
    {
      name: 'active-plan',
      storage: createJSONStorage(() => zustandKv),
      // Only the frozen active plan survives reopen; draft is session state.
      partialize: (s) => ({ active: s.active }),
    },
  ),
);
