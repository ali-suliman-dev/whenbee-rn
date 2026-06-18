import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandKv } from '@/src/lib/kv';

// ──────────────────────────────────────────────────────────────────────────────
// Tasks store — ephemeral "today" list (there is no tasks DB table; it's in-memory + kv).
//
// The Today screen renders this kv-persisted, FIFO list with explicit states:
//   • queued — not yet done; the OLDEST queued task is the focus (the Next card).
//   • done   — logged/finished; kept (checked off) until day rollover so the day
//              shows progress, not a vanishing list.
//
// addTask APPENDS (oldest queued stays in front). completeTask flips a task to
// 'done' + stamps completedAt — called after a task is logged. removeTask hard-
// deletes (explicit swipe/delete). clear() resets the list (day rollover).
// ──────────────────────────────────────────────────────────────────────────────

export type TaskStatus = 'queued' | 'done';

export interface TodayTask {
  id: string;
  label: string;
  category: string;
  guessMin: number;
  createdAt: number;
  status: TaskStatus;
  /** Wall-clock ms the task was marked done (null while queued). */
  completedAt: number | null;
  /** Actual minutes the task took, when known from a timed/logged finish. */
  actualMin: number | null;
}

interface TasksState {
  tasks: TodayTask[];
  addTask: (t: Omit<TodayTask, 'id' | 'createdAt' | 'status' | 'completedAt' | 'actualMin'> & { nowMs?: number }) => TodayTask;
  /** Flip a task to done; stamps completedAt and (optionally) the actual minutes. */
  completeTask: (id: string, opts?: { nowMs?: number; actualMin?: number }) => void;
  removeTask: (id: string) => void;
  clear: () => void;
}

/** The focus task = the oldest task still queued (skips done). */
export function selectFocus(tasks: TodayTask[]): TodayTask | null {
  return tasks.find((task) => task.status === 'queued') ?? null;
}

/** Collision-resistant id without a uuid dependency (mirrors calibrationStore). */
function makeId(createdAt: number): string {
  return `${createdAt}-${Math.random().toString(36).slice(2)}`;
}

export const useTasksStore = create<TasksState>()(
  persist(
    (set) => ({
      tasks: [],

      addTask: ({ label, category, guessMin, nowMs }) => {
        const createdAt = nowMs ?? Date.now();
        const task: TodayTask = {
          id: makeId(createdAt),
          label,
          category,
          guessMin,
          createdAt,
          status: 'queued',
          completedAt: null,
          actualMin: null,
        };
        // Append → focus is the oldest queued task.
        set((state) => ({ tasks: [...state.tasks, task] }));
        return task;
      },

      completeTask: (id, opts) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  status: 'done',
                  completedAt: opts?.nowMs ?? Date.now(),
                  actualMin: opts?.actualMin ?? t.actualMin,
                }
              : t,
          ),
        })),

      removeTask: (id) =>
        set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) })),

      clear: () => set({ tasks: [] }),
    }),
    {
      name: 'today-tasks',
      storage: createJSONStorage(() => zustandKv),
      // v1 introduced the status model — backfill rows persisted before it so a
      // pre-update queue isn't silently dropped by the focus selector.
      version: 1,
      migrate: (persisted) => {
        const state = persisted as { tasks?: Partial<TodayTask>[] } | undefined;
        const tasks = (state?.tasks ?? []).map((t) => ({
          ...t,
          status: t.status ?? 'queued',
          completedAt: t.completedAt ?? null,
          actualMin: t.actualMin ?? null,
        })) as TodayTask[];
        return { tasks } as TasksState;
      },
    },
  ),
);
