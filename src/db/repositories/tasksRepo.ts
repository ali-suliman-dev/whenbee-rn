// src/db/repositories/tasksRepo.ts
// Semantic wrapper over the Database port for day-planned tasks + day meta.
// Maps rows ↔ domain Task; features go through this repo (and the store), never SQL.

import type { Database } from '../Database';
import type { TaskRow, DayMetaRow } from '../types';
import type { Task, DayMeta } from '@/src/domain/types';

export interface TasksRepo {
  add(task: Task): Promise<void>;
  update(id: string, patch: Partial<Task>): Promise<void>;
  remove(id: string): Promise<void>;
  get(id: string): Promise<Task | null>;
  listByDate(date: string): Promise<Task[]>;
  listCarryover(today: string): Promise<Task[]>;
  listDoneForDay(dayKey: string): Promise<Task[]>;
  listShelf(): Promise<Task[]>;
  move(id: string, toDate: string | null): Promise<void>;
  complete(id: string, opts: { completedAt: number; actualMin?: number }): Promise<void>;
  getDayMeta(date: string): Promise<DayMeta | null>;
  setDoneBy(date: string, doneByMin: number | null): Promise<void>;
}

function toTask(r: TaskRow): Task {
  return { ...r };
}
function toRow(t: Task): TaskRow {
  return { ...t };
}
function toDayMeta(r: DayMetaRow): DayMeta {
  return { ...r };
}

/** Local-day window [start, end) in epoch ms for a 'YYYY-MM-DD' key. */
function dayWindow(dayKey: string): { startMs: number; endMs: number } {
  const [y, m, d] = dayKey.split('-').map(Number) as [number, number, number];
  const start = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
  const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0).getTime();
  return { startMs: start, endMs: end };
}

export function makeTasksRepo(db: Database): TasksRepo {
  return {
    async add(task) {
      await db.insertTask(toRow(task));
    },
    async update(id, patch) {
      await db.updateTask(id, patch as Partial<TaskRow>);
    },
    async remove(id) {
      await db.deleteTask(id);
    },
    async get(id) {
      const row = await db.getTask(id);
      return row ? toTask(row) : null;
    },
    async listByDate(date) {
      return (await db.listTasksByDate(date)).map(toTask);
    },
    async listCarryover(today) {
      return (await db.listQueuedOnOrBefore(today)).map(toTask);
    },
    async listDoneForDay(dayKey) {
      const { startMs, endMs } = dayWindow(dayKey);
      return (await db.listDoneCompletedBetween(startMs, endMs)).map(toTask);
    },
    async listShelf() {
      return (await db.listShelfTasks()).map(toTask);
    },
    async move(id, toDate) {
      await db.updateTask(id, { plannedDate: toDate });
    },
    async complete(id, opts) {
      await db.updateTask(id, {
        status: 'done',
        completedAt: opts.completedAt,
        ...(opts.actualMin !== undefined ? { actualMin: opts.actualMin } : {}),
      });
    },
    async getDayMeta(date) {
      const row = await db.getDayMeta(date);
      return row ? toDayMeta(row) : null;
    },
    async setDoneBy(date, doneByMin) {
      const existing = await db.getDayMeta(date);
      await db.upsertDayMeta({
        date,
        doneByMin,
        planComputedAt: existing?.planComputedAt ?? null,
      });
    },
  };
}
