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
import { syncDayPlanToCalendar } from '@/src/services/calendarExport';
import { getCalendar } from '@/src/services/calendar';
import { cancelStartBy } from '@/src/services/timerNotifications';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';

/** Timed task from the plan engine — the minimum shape needed for a calendar sync. */
export interface PlannedExportTask {
  id: string;
  label: string;
  startMs: number;
  endMs: number;
  calendarEventId: string | null;
}

const MIGRATED_FLAG = 'tasks-migrated-v1';
const LEGACY_KV_KEY = 'today-tasks'; // the old persist() store key

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface DayTasksState {
  selectedDate: string;
  viewMode: 'list' | 'timeline';
  dayTasks: DayTask[];
  /** Day-level planning metadata for the currently selected date. Null until loaded. */
  dayMeta: { doneByMin: number | null; planComputedAt: number | null } | null;
  /** Sorted YYYY-MM-DD keys of all queued-task planned dates — powers calendar dot hints. */
  datesWithTasks: string[];
  /** Tasks with no planned date (shelf / "no day yet"). Populated by loadShelf(). */
  shelfTasks: DayTask[];
  loading: boolean;
  init: (nowMs?: number) => Promise<void>;
  selectDate: (date: string) => Promise<void>;
  goToToday: (nowMs?: number) => Promise<void>;
  setViewMode: (m: 'list' | 'timeline') => void;
  /** Persist a "done by" minute-of-day target for the selected date and reload dayMeta. */
  setDoneBy: (min: number | null) => Promise<void>;
  /** Stamp planComputedAt = now for the selected date (called when a plan is triggered). */
  markPlanned: (nowMs?: number) => Promise<void>;
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
  /**
   * Sync the selected day's timed plan to the Whenbee calendar.
   *
   * Guard: no-op when export is disabled, not Pro, or whenbeeCalendarId is null.
   * Horizon: v1 syncs the SELECTED day only — multi-day auto-sync is future work.
   *
   * `plannedTasks` — the timed tasks from the plan engine (kind 'task' items with
   * startMs/endMs). The caller (Plan-my-day handler or Timeline) builds this list.
   * The store derives priorLinks from the tasks' current calendarEventIds.
   */
  syncExportForSelectedDay: (
    plannedTasks: PlannedExportTask[],
    nowMs?: number,
  ) => Promise<void>;
  /**
   * Clear calendarEventId on ALL tasks that currently have one.
   * Called after disabling the calendar export (B1) so stale db links don't
   * accumulate. The caller's disableExport already deleted the Whenbee events;
   * this clears the local task→event mapping.
   */
  clearAllCalendarLinks: () => Promise<void>;
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

  /** Load the day-level meta for a date from the repo (null when no row exists). */
  async function loadDayMeta(
    date: string,
  ): Promise<{ doneByMin: number | null; planComputedAt: number | null } | null> {
    const row = await repo.getDayMeta(date);
    if (!row) return null;
    return { doneByMin: row.doneByMin, planComputedAt: row.planComputedAt };
  }

  return create<DayTasksState>()((set, get) => {
    /** Refresh shelfTasks from the repo. Called after any mutation that can
     *  change shelf membership (add/move/complete/remove). */
    async function refreshShelf(): Promise<void> {
      const raw = await repo.listShelf();
      set({ shelfTasks: raw.map((t) => ({ ...t, carriedFrom: null })) });
    }

    return ({
    selectedDate: toLocalDayKey(Date.now()),
    viewMode: 'list',
    dayTasks: [],
    dayMeta: null,
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

      const [dayAndDots, shelfRaw, dayMetaRow] = await Promise.all([
        loadDayAndDots(today, today),
        repo.listShelf(),
        loadDayMeta(today),
      ]);
      set({
        ...dayAndDots,
        dayMeta: dayMetaRow,
        shelfTasks: shelfRaw.map((t) => ({ ...t, carriedFrom: null })),
        loading: false,
      });
    },

    async selectDate(date) {
      const today = toLocalDayKey(Date.now());
      const [dayAndDots, dayMetaRow] = await Promise.all([
        loadDayAndDots(date, today),
        loadDayMeta(date),
      ]);
      set({ selectedDate: date, ...dayAndDots, dayMeta: dayMetaRow });
    },

    async goToToday(nowMs) {
      const today = toLocalDayKey(nowMs ?? Date.now());
      const [dayAndDots, dayMetaRow] = await Promise.all([
        loadDayAndDots(today, today),
        loadDayMeta(today),
      ]);
      set({ selectedDate: today, ...dayAndDots, dayMeta: dayMetaRow });
    },

    setViewMode(m) {
      set({ viewMode: m });
    },

    async setDoneBy(min) {
      const { selectedDate } = get();
      await repo.setDoneBy(selectedDate, min);
      set({ dayMeta: await loadDayMeta(selectedDate) });
    },

    async markPlanned(nowMs) {
      const { selectedDate } = get();
      await repo.setPlanComputedAt(selectedDate, nowMs ?? Date.now());
      set({ dayMeta: await loadDayMeta(selectedDate) });
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
      await Promise.all([
        loadDayAndDots(get().selectedDate, today).then((d) => set(d)),
        refreshShelf(),
      ]);
      return task;
    },

    async completeTask(id, opts) {
      await repo.complete(id, opts);
      const today = toLocalDayKey(opts.nowMs ?? Date.now());
      await Promise.all([
        loadDayAndDots(get().selectedDate, today).then((d) => set(d)),
        refreshShelf(),
      ]);
    },

    async moveTask(id, toDate, nowMs) {
      await repo.move(id, toDate);
      const today = toLocalDayKey(nowMs ?? Date.now());
      await Promise.all([
        loadDayAndDots(get().selectedDate, today).then((d) => set(d)),
        refreshShelf(),
      ]);
    },

    async removeTask(id, nowMs) {
      // Phase 7 B2: if export is on and the task has a linked Whenbee event,
      // delete the event before removing the task from the db.
      const { calendar: calPrefs } = useSettingsStore.getState();
      if (calPrefs.exportEnabled && calPrefs.whenbeeCalendarId) {
        const task = await repo.get(id);
        if (task?.calendarEventId) {
          try {
            await getCalendar().deleteWhenbeeEvent(task.calendarEventId);
          } catch {
            // Best-effort — the db row is removed regardless.
          }
        }
      }

      await repo.remove(id);
      // The deleted task may have had a scheduled "start by" reminder — cancel it
      // now so the OS never fires a notification for a task that no longer
      // exists. The Today screen's effect re-schedules a fresh one from the
      // reloaded plan below if the day still has tasks.
      await cancelStartBy();
      const today = toLocalDayKey(nowMs ?? Date.now());
      await Promise.all([
        loadDayAndDots(get().selectedDate, today).then((d) => set(d)),
        refreshShelf(),
      ]);
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
      await refreshShelf();
    },

    async syncExportForSelectedDay(plannedTasks, nowMs) {
      // Guard: export must be on, user must be Pro, and the Whenbee calendar id set.
      const { calendar: calPrefs } = useSettingsStore.getState();
      const { isPro } = useEntitlement.getState();
      if (!calPrefs.exportEnabled || !isPro || !calPrefs.whenbeeCalendarId) return;

      const { selectedDate } = get();
      const calendarId = calPrefs.whenbeeCalendarId;

      // Build priorLinks from the PERSISTED day tasks (tasks that currently have a
      // calendarEventId in the db for this day). Using plannedTasks would mean
      // every priorLink.taskId is always in the new plan, so the reconcile-delete
      // path in the sync service never fires and orphaned events leak.
      const persistedDayTasks = await repo.listByDate(selectedDate);
      const priorLinks = persistedDayTasks
        .filter((t) => t.calendarEventId !== null)
        .map((t) => ({ taskId: t.id, eventId: t.calendarEventId as string }));

      const result = await syncDayPlanToCalendar({
        date: selectedDate,
        calendarId,
        plannedTasks,
        priorLinks,
      });

      // Persist the returned taskId→eventId links onto the tasks.
      await Promise.all(
        result.links.map(({ taskId, eventId }) =>
          repo.update(taskId, { calendarEventId: eventId }),
        ),
      );

      // Clear calendarEventId for tasks whose event was deleted (no longer in plan).
      // These are tasks that were in priorLinks but not in plannedTasks — the sync
      // service already deleted their events; we clear the stale db link.
      const plannedIds = new Set(plannedTasks.map((t) => t.id));
      const staleLinkIds = priorLinks
        .filter((l) => !plannedIds.has(l.taskId))
        .map((l) => l.taskId);
      if (staleLinkIds.length > 0) {
        await Promise.all(
          staleLinkIds.map((taskId) => repo.update(taskId, { calendarEventId: null })),
        );
      }

      // Refresh the day view so the store reflects the updated calendarEventIds.
      const today = toLocalDayKey(nowMs ?? Date.now());
      set(await loadDayAndDots(selectedDate, today));
    },

    async clearAllCalendarLinks() {
      const linked = await repo.listWithCalendarEventId();
      await Promise.all(
        linked.map((t) => repo.update(t.id, { calendarEventId: null })),
      );
    },
  });
  });
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
    setPlanComputedAt: async (d, t) => (await resolve()).setPlanComputedAt(d, t),
    dates: async () => (await resolve()).dates(),
    listWithCalendarEventId: async () => (await resolve()).listWithCalendarEventId(),
  };
}

/** The app-wide store. Call `.getState().init()` once at boot. */
export const useDayTasksStore: UseBoundStore<StoreApi<DayTasksState>> = makeDayTasksStore({
  repo: makeLazyRepo(),
  kvGet: (k) => kv.getString(k),
  kvSet: (k, v) => kv.set(k, v),
});
