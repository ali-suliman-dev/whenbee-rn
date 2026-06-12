import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandKv } from '@/src/lib/kv';

// ──────────────────────────────────────────────────────────────────────────────
// Tasks store — ephemeral "today" list (the MVP has no tasks DB table).
//
// The Today screen's focus/peer cards come from this kv-persisted, FIFO list.
// tasks[0] is the focus card. addTask APPENDS, so the oldest unfinished task
// stays in front until it's logged. removeTask is called after a task is
// logged / started+logged. clear() resets the list (e.g. day rollover).
// ──────────────────────────────────────────────────────────────────────────────

export interface TodayTask {
  id: string;
  label: string;
  category: string;
  guessMin: number;
  createdAt: number;
}

interface TasksState {
  tasks: TodayTask[];
  addTask: (t: Omit<TodayTask, 'id' | 'createdAt'> & { nowMs?: number }) => TodayTask;
  removeTask: (id: string) => void;
  clear: () => void;
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
        };
        // Append → focus (tasks[0]) is the oldest unfinished task.
        set((state) => ({ tasks: [...state.tasks, task] }));
        return task;
      },

      removeTask: (id) =>
        set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) })),

      clear: () => set({ tasks: [] }),
    }),
    { name: 'today-tasks', storage: createJSONStorage(() => zustandKv) },
  ),
);
