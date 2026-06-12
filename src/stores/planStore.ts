import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandKv } from '@/src/lib/kv';
import { DEFAULT_BUFFER_MIN } from '@/src/engine';

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

export interface PlanDraftTask {
  id: string;
  label: string;
  category: string;
  durationMin: number;
}

export interface ActivePlan {
  deadline: number;
  bufferMin: number;
  tasks: PlanDraftTask[];
  createdAt: number;
}

interface PlanDraft {
  deadline: number | null;
  bufferMin: number;
  tasks: PlanDraftTask[];
}

interface PlanState {
  draft: PlanDraft;
  active: ActivePlan | null;
  setDeadline: (ms: number) => void;
  setBuffer: (min: number) => void;
  addTask: (t: Omit<PlanDraftTask, 'id'>) => PlanDraftTask;
  updateTaskDuration: (id: string, min: number) => void;
  removeTask: (id: string) => void;
  reorderTasks: (ids: string[]) => void;
  saveActive: (nowMs?: number) => void;
  clearActive: () => void;
}

/** Collision-resistant id without a uuid dependency (mirrors tasksStore). */
function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const emptyDraft: PlanDraft = { deadline: null, bufferMin: DEFAULT_BUFFER_MIN, tasks: [] };

export const usePlanStore = create<PlanState>()(
  persist(
    (set, get) => ({
      draft: emptyDraft,
      active: null,

      setDeadline: (ms) => set((s) => ({ draft: { ...s.draft, deadline: ms } })),

      setBuffer: (min) =>
        set((s) => ({ draft: { ...s.draft, bufferMin: Math.max(0, min) } })),

      addTask: ({ label, category, durationMin }) => {
        const task: PlanDraftTask = { id: makeId(), label, category, durationMin };
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
      reorderTasks: (ids) =>
        set((s) => {
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
          tasks: draft.tasks.map((t) => ({ ...t })),
          createdAt: nowMs ?? Date.now(),
        };
        set({ active });
      },

      clearActive: () => set({ active: null }),
    }),
    {
      name: 'active-plan',
      storage: createJSONStorage(() => zustandKv),
      // Only the frozen active plan survives reopen; draft is session state.
      partialize: (s) => ({ active: s.active }),
    },
  ),
);
