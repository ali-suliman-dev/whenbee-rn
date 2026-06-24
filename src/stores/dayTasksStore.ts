// src/stores/dayTasksStore.ts
// DB-backed "selected day" store. Holds selectedDate + the loaded day's tasks and
// delegates persistence to tasksRepo. Runs the legacy kv-list migration once on
// init (guarded by a kv flag). UI reads this store; it never touches the repo/db
// directly (layer rule). Phase 2 will wire Today consumers to this store.

import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { getDatabase } from '@/src/db/client';
import { makeTasksRepo, type TasksRepo } from '@/src/db/repositories/tasksRepo';
import { migrateLegacyTasks, type LegacyTodayTask } from '@/src/db/migrateLegacyTasks';
import { tasksForSelectedDay, type DayTask } from '@/src/engine/daySelectors';
import { toLocalDayKey, addDays } from '@/src/lib/day';
import type { Task } from '@/src/domain/types';
import { kv } from '@/src/lib/kv';

const MIGRATED_FLAG = 'tasks-migrated-v1';
const LEGACY_KV_KEY = 'today-tasks'; // the old persist() store key

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface DayTasksState {
  selectedDate: string;
  viewMode: 'list' | 'timeline';
  dayTasks: DayTask[];
  /** Sorted YYYY-MM-DD keys of all queued-task planned dates — powers calendar dot hints. */
  datesWithTasks: string[];
  /** Tasks with no planned date (shelf / "no day yet"). Populated by loadShelf(). */
  shelfTasks: DayTask[];
  loading: boolean;
  init: (nowMs?: number) => Promise<void>;
  selectDate: (date: string) => Promise<void>;
  goToToday: (nowMs?: number) => Promise<void>;
  setViewMode: (m: 'list' | 'timeline') => void;
  addTask: (input: {
    label: string;
    category: string;
    guessMin: number;
    date?: string | null;
    nowMs?: number;
  }) => Promise<Task>;
  completeTask: (
    id: string,
    opts: { completedAt: number; actualMin?: number; nowMs?: number },
  ) => Promise<void>;
  moveTask: (id: string, toDate: string | null, nowMs?: number) => Promise<void>;
  removeTask: (id: string, nowMs?: number) => Promise<void>;
  promoteToFocus: (id: string, nowMs?: number) => Promise<void>;
  /** Move a task to tomorrow (today + 1). Convenience over moveTask. */
  moveToTomorrow: (id: string, nowMs?: number) => Promise<void>;
  selectFocusTask: () => DayTask | null;
  reload: (nowMs?: number) => Promise<void>;
  /** Refresh shelfTasks from the repo (tasks with plannedDate = null). */
  loadShelf: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// DI deps (test-injectable)
// ---------------------------------------------------------------------------

interface Deps {
  repo: TasksRepo;
  kvGet: (k: string) => string | null;
  kvSet: (k: string, v: string) => void;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function makeId(createdAt: number): string {
  return `${createdAt}-${Math.random().toString(36).slice(2)}`;
}

interface LegacyTodayTaskRaw {
  id: string;
  label: string;
  category: string;
  guessMin: number;
  createdAt: number;
  status: 'queued' | 'done';
  completedAt?: number | null;
  actualMin?: number | null;
}

interface LegacyKvState {
  state?: { tasks?: LegacyTodayTaskRaw[] };
}

/** Union the three query buckets into a deduplicated DayTask list.
 *  C1: queued tasks are filtered by plannedDate rules; done tasks are already
 *  scoped to the day by completedAt window and included as-is. */
async function loadDay(
  repo: TasksRepo,
  selectedDate: string,
  today: string,
): Promise<DayTask[]> {
  const isToday = selectedDate === today;
  const [byDate, carry, doneForDay] = await Promise.all([
    repo.listByDate(selectedDate),
    isToday ? repo.listCarryover(today) : Promise.resolve([]),
    repo.listDoneForDay(selectedDate),
  ]);
  // Deduplicate the queued set (byDate + carry may overlap). Done is kept separate.
  const seenQueued = new Map<string, (typeof byDate)[number]>();
  for (const t of [...byDate, ...carry]) seenQueued.set(t.id, t);

  return tasksForSelectedDay({
    queued: [...seenQueued.values()],
    done: doneForDay,
    selectedDate,
    today,
  });
}

// ---------------------------------------------------------------------------
// Factory (for DI / tests)
// ---------------------------------------------------------------------------

export function makeDayTasksStore(deps: Deps): UseBoundStore<StoreApi<DayTasksState>> {
  const { repo, kvGet, kvSet } = deps;

  /** Load day tasks + refresh dot hints in one shot. */
  async function loadDayAndDots(
    selectedDate: string,
    today: string,
  ): Promise<Pick<DayTasksState, 'dayTasks' | 'datesWithTasks'>> {
    const [dayTasks, datesWithTasks] = await Promise.all([
      loadDay(repo, selectedDate, today),
      repo.dates(),
    ]);
    return { dayTasks, datesWithTasks };
  }

  return create<DayTasksState>()((set, get) => ({
    selectedDate: toLocalDayKey(Date.now()),
    viewMode: 'list',
    dayTasks: [],
    datesWithTasks: [],
    shelfTasks: [],
    loading: false,

    async init(nowMs) {
      const now = nowMs ?? Date.now();
      const today = toLocalDayKey(now);
      set({ loading: true, selectedDate: today });

      // One-time legacy kv migration (I1: use the tested migrateLegacyTasks module).
      const raw = kvGet(LEGACY_KV_KEY);
      const parsed = raw ? (JSON.parse(raw) as LegacyKvState) : null;
      const rawLegacy: LegacyTodayTaskRaw[] = parsed?.state?.tasks ?? [];
      const legacy: LegacyTodayTask[] = rawLegacy.map((t) => ({
        id: t.id,
        label: t.label,
        category: t.category,
        guessMin: t.guessMin,
        createdAt: t.createdAt,
        status: t.status,
        completedAt: t.completedAt ?? null,
        actualMin: t.actualMin ?? null,
      }));
      await migrateLegacyTasks({
        add: (t) => repo.add(t),
        legacy,
        nowMs: now,
        alreadyMigrated: kvGet(MIGRATED_FLAG) === '1',
      });
      kvSet(MIGRATED_FLAG, '1');

      set({ ...(await loadDayAndDots(today, today)), loading: false });
    },

    async selectDate(date) {
      const today = toLocalDayKey(Date.now());
      set({ selectedDate: date, ...(await loadDayAndDots(date, today)) });
    },

    async goToToday(nowMs) {
      const today = toLocalDayKey(nowMs ?? Date.now());
      set({ selectedDate: today, ...(await loadDayAndDots(today, today)) });
    },

    setViewMode(m) {
      set({ viewMode: m });
    },

    async addTask({ label, category, guessMin, date, nowMs }) {
      const createdAt = nowMs ?? Date.now();
      const plannedDate = date === undefined ? get().selectedDate : date;
      const task: Task = {
        id: makeId(createdAt),
        label,
        category,
        guessMin,
        plannedDate,
        status: 'queued',
        orderIndex: createdAt,
        doneByMin: null,
        createdAt,
        completedAt: null,
        actualMin: null,
        fromRoutineId: null,
        calendarEventId: null,
      };
      await repo.add(task);
      const today = toLocalDayKey(createdAt);
      set(await loadDayAndDots(get().selectedDate, today));
      return task;
    },

    async completeTask(id, opts) {
      await repo.complete(id, opts);
      const today = toLocalDayKey(opts.nowMs ?? Date.now());
      set(await loadDayAndDots(get().selectedDate, today));
    },

    async moveTask(id, toDate, nowMs) {
      await repo.move(id, toDate);
      const today = toLocalDayKey(nowMs ?? Date.now());
      set(await loadDayAndDots(get().selectedDate, today));
    },

    async removeTask(id, nowMs) {
      await repo.remove(id);
      const today = toLocalDayKey(nowMs ?? Date.now());
      set(await loadDayAndDots(get().selectedDate, today));
    },

    async promoteToFocus(id, nowMs) {
      const queued = get().dayTasks.filter((t) => t.status === 'queued');
      const minOrder = queued.reduce(
        (min, t) => Math.min(min, t.orderIndex),
        queued[0]?.orderIndex ?? 0,
      );
      await repo.update(id, { orderIndex: minOrder - 1 });
      const today = toLocalDayKey(nowMs ?? Date.now());
      set(await loadDayAndDots(get().selectedDate, today));
    },

    async moveToTomorrow(id, nowMs) {
      const tomorrow = addDays(toLocalDayKey(nowMs ?? Date.now()), 1);
      await get().moveTask(id, tomorrow, nowMs);
    },

    selectFocusTask() {
      return get().dayTasks.find((t) => t.status === 'queued') ?? null;
    },

    async reload(nowMs) {
      const today = toLocalDayKey(nowMs ?? Date.now());
      set(await loadDayAndDots(get().selectedDate, today));
    },

    async loadShelf() {
      const raw = await repo.listShelf();
      const shelfTasks: DayTask[] = raw.map((t) => ({ ...t, carriedFrom: null }));
      set({ shelfTasks });
    },
  }));
}

// ---------------------------------------------------------------------------
// App-wide singleton (lazy repo proxy bound to real kv)
// ---------------------------------------------------------------------------

/** A TasksRepo that resolves the real DB on first call (getDatabase is async). */
function makeLazyRepo(): TasksRepo {
  let real: Promise<TasksRepo> | null = null;
  const resolve = (): Promise<TasksRepo> =>
    (real ??= getDatabase().then(makeTasksRepo));
  return {
    add: async (t) => (await resolve()).add(t),
    update: async (id, p) => (await resolve()).update(id, p),
    remove: async (id) => (await resolve()).remove(id),
    get: async (id) => (await resolve()).get(id),
    listByDate: async (d) => (await resolve()).listByDate(d),
    listCarryover: async (d) => (await resolve()).listCarryover(d),
    listDoneForDay: async (d) => (await resolve()).listDoneForDay(d),
    listShelf: async () => (await resolve()).listShelf(),
    move: async (id, d) => (await resolve()).move(id, d),
    complete: async (id, o) => (await resolve()).complete(id, o),
    getDayMeta: async (d) => (await resolve()).getDayMeta(d),
    setDoneBy: async (d, m) => (await resolve()).setDoneBy(d, m),
    dates: async () => (await resolve()).dates(),
  };
}

/** The app-wide store. Call `.getState().init()` once at boot. */
export const useDayTasksStore: UseBoundStore<StoreApi<DayTasksState>> = makeDayTasksStore({
  repo: makeLazyRepo(),
  kvGet: (k) => kv.getString(k),
  kvSet: (k, v) => kv.set(k, v),
});
