// In-memory Database adapter — backed by Maps. Used by tests (no native module
// required) and as a runtime fallback when expo-sqlite is unavailable. Logic is
// fully synchronous; the async signatures satisfy the port contract.

import type { Database } from './Database';
import type { CategoryStatRow, CompanionRow, ContextEventRow, ContextTagRow, DayMetaRow, DiscoveryRow, ReasonEventRow, RecurringStatRow, RoutineRow, RoutineStepRow, TaskEventRow, TaskRow } from './types';

export function createMemoryDatabase(): Database {
  const categoryStats = new Map<string, CategoryStatRow>();
  const recurringStats = new Map<string, RecurringStatRow>();
  const events = new Map<string, TaskEventRow>();
  const contextTags = new Map<string, ContextTagRow>();
  const discoveries = new Map<string, DiscoveryRow>();
  const routines = new Map<string, RoutineRow>();
  const routineSteps = new Map<string, RoutineStepRow>();
  const tasks = new Map<string, TaskRow>();
  const dayMeta = new Map<string, DayMetaRow>();
  const companion: CompanionRow = {
    reclaimedMinutesLifetime: 0,
    lifetimeDataPoints: 0,
    maxTier: 0,
    keeper: false,
    seed: 1,
    driftHealth: 'settled',
    discoveryCount: 0,
    name: null,
  };

  /** Newest first by createdAt, sliced to `limit`. */
  function sortedEvents(rows: TaskEventRow[], limit: number): TaskEventRow[] {
    return [...rows].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  }

  return {
    async getCategoryStat(categoryId: string): Promise<CategoryStatRow | null> {
      return categoryStats.get(categoryId) ?? null;
    },
    async upsertCategoryStat(row: CategoryStatRow): Promise<void> {
      categoryStats.set(row.categoryId, { ...row });
    },

    async insertTaskEvent(row: TaskEventRow): Promise<void> {
      events.set(row.id, { ...row });
    },
    async listEventsByCategory(categoryId: string, limit: number): Promise<TaskEventRow[]> {
      const matching = [...events.values()].filter((e) => e.category === categoryId);
      return sortedEvents(matching, limit);
    },
    async deleteEventsByCategory(categoryId: string): Promise<void> {
      for (const [id, row] of events) {
        if (row.category === categoryId) events.delete(id);
      }
    },
    async listRecentEvents(limit: number): Promise<TaskEventRow[]> {
      return sortedEvents([...events.values()], limit);
    },

    async getRecurringStat(key: string): Promise<RecurringStatRow | null> {
      return recurringStats.get(key) ?? null;
    },
    async upsertRecurringStat(row: RecurringStatRow): Promise<void> {
      recurringStats.set(row.key, { ...row });
    },

    async listRoutines(): Promise<RoutineRow[]> {
      return [...routines.values()].sort((a, b) => b.updatedAt - a.updatedAt).map((r) => ({ ...r }));
    },
    async getRoutine(id: string): Promise<RoutineRow | null> {
      const row = routines.get(id);
      return row ? { ...row } : null;
    },
    async listRoutineSteps(routineId: string): Promise<RoutineStepRow[]> {
      return [...routineSteps.values()]
        .filter((s) => s.routineId === routineId)
        .sort((a, b) => a.position - b.position)
        .map((s) => ({ ...s }));
    },
    async saveRoutine(routine: RoutineRow, steps: RoutineStepRow[]): Promise<void> {
      routines.set(routine.id, { ...routine });
      // Replace this routine's steps wholesale.
      for (const [id, s] of routineSteps) {
        if (s.routineId === routine.id) routineSteps.delete(id);
      }
      for (const step of steps) routineSteps.set(step.id, { ...step });
    },
    async deleteRoutine(id: string): Promise<void> {
      routines.delete(id);
      for (const [stepId, s] of routineSteps) {
        if (s.routineId === id) routineSteps.delete(stepId);
      }
    },
    async setRoutineTransitionFactor(id: string, factor: number, updatedAt: number): Promise<void> {
      const row = routines.get(id);
      if (row === undefined) return;
      routines.set(id, { ...row, transitionFactor: factor, updatedAt });
    },
    async incrementRoutineRunCount(id: string, updatedAt: number): Promise<void> {
      const row = routines.get(id);
      if (row === undefined) return;
      routines.set(id, { ...row, runCount: row.runCount + 1, updatedAt });
    },

    async getCompanion(): Promise<CompanionRow> {
      return { ...companion };
    },
    async addReclaim(deltaMin: number): Promise<void> {
      companion.reclaimedMinutesLifetime += deltaMin;
    },
    async bumpLifetimeNectar(): Promise<void> {
      companion.lifetimeDataPoints += 1;
    },
    async raiseMaxTier(next: number): Promise<void> {
      companion.maxTier = Math.max(companion.maxTier, Math.trunc(next));
    },
    async setKeeper(): Promise<void> {
      companion.keeper = true;
    },
    async setDriftHealth(value: 'settled' | 'curious'): Promise<void> {
      companion.driftHealth = value;
    },
    async setSeed(seed: number): Promise<void> {
      if (companion.seed === 0) companion.seed = seed;
    },
    async setCompanionName(name: string | null): Promise<void> {
      const trimmed = name?.trim();
      companion.name = trimmed ? trimmed : null;
    },
    async addCategoryReclaim(categoryId: string, deltaMin: number): Promise<void> {
      const existing = categoryStats.get(categoryId);
      if (existing === undefined) return;
      categoryStats.set(categoryId, {
        ...existing,
        reclaimedMinutes: existing.reclaimedMinutes + deltaMin,
      });
    },
    async insertContextTag(row: ContextTagRow): Promise<void> {
      contextTags.set(`${row.eventId}:${row.key}`, { ...row });
    },
    async getContextTag(eventId: string, key: string): Promise<ContextTagRow | null> {
      return contextTags.get(`${eventId}:${key}`) ?? null;
    },
    async listReasonEvents(limit: number): Promise<ReasonEventRow[]> {
      const rows: ReasonEventRow[] = [];
      for (const tag of contextTags.values()) {
        if (tag.key !== 'reason') continue;
        const event = events.get(tag.eventId);
        if (event === undefined) continue; // orphan tag — its event was wiped
        rows.push({
          eventId: event.id,
          category: event.category,
          reason: tag.value,
          estimateMin: event.estimateMin,
          actualMin: event.actualMin,
          createdAt: event.createdAt,
        });
      }
      return rows.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
    },

    async listContextEvents(key: string, limit: number): Promise<ContextEventRow[]> {
      const rows: ContextEventRow[] = [];
      for (const tag of contextTags.values()) {
        if (tag.key !== key) continue;
        const event = events.get(tag.eventId);
        if (event === undefined) continue; // orphan tag — its event was wiped
        rows.push({
          eventId: event.id,
          category: event.category,
          value: tag.value,
          estimateMin: event.estimateMin,
          actualMin: event.actualMin,
          createdAt: event.createdAt,
        });
      }
      return rows.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
    },

    async insertDiscovery(row: DiscoveryRow): Promise<void> {
      discoveries.set(row.id, { ...row });
    },
    async listDiscoveries(limit: number): Promise<DiscoveryRow[]> {
      return [...discoveries.values()]
        .sort((a, b) => b.discoveredAt - a.discoveredAt)
        .slice(0, limit);
    },
    async getLastDiscoveryForCategory(categoryId: string): Promise<DiscoveryRow | null> {
      const matching = [...discoveries.values()]
        .filter((d) => d.categoryId === categoryId)
        .sort((a, b) => b.discoveredAt - a.discoveredAt);
      return matching[0] ?? null;
    },
    async incrementDiscoveryCount(): Promise<void> {
      companion.discoveryCount += 1;
    },

    async insertTask(row: TaskRow): Promise<void> {
      tasks.set(row.id, { ...row });
    },
    async updateTask(id: string, patch: Partial<TaskRow>): Promise<void> {
      const existing = tasks.get(id);
      if (existing === undefined) return;
      tasks.set(id, { ...existing, ...patch, id });
    },
    async deleteTask(id: string): Promise<void> {
      tasks.delete(id);
    },
    async getTask(id: string): Promise<TaskRow | null> {
      const r = tasks.get(id);
      return r ? { ...r } : null;
    },
    async listTasksByDate(date: string): Promise<TaskRow[]> {
      return [...tasks.values()]
        .filter((t) => t.plannedDate === date && t.status === 'queued')
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((t) => ({ ...t }));
    },
    async listQueuedOnOrBefore(date: string): Promise<TaskRow[]> {
      return [...tasks.values()]
        .filter((t) => t.status === 'queued' && t.plannedDate !== null && t.plannedDate <= date)
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((t) => ({ ...t }));
    },
    async listDoneCompletedBetween(startMs: number, endMs: number): Promise<TaskRow[]> {
      return [...tasks.values()]
        .filter((t) => t.status === 'done' && t.completedAt !== null && t.completedAt >= startMs && t.completedAt < endMs)
        .sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0))
        .map((t) => ({ ...t }));
    },
    async listShelfTasks(): Promise<TaskRow[]> {
      return [...tasks.values()]
        .filter((t) => t.status === 'queued' && t.plannedDate === null)
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((t) => ({ ...t }));
    },
    async getDayMeta(date: string): Promise<DayMetaRow | null> {
      const r = dayMeta.get(date);
      return r ? { ...r } : null;
    },
    async upsertDayMeta(row: DayMetaRow): Promise<void> {
      dayMeta.set(row.date, { ...row });
    },
    async listDatesWithTasks(): Promise<string[]> {
      const seen = new Set<string>();
      for (const t of tasks.values()) {
        if (t.status === 'queued' && t.plannedDate !== null) {
          seen.add(t.plannedDate);
        }
      }
      return [...seen].sort();
    },
    async listTasksWithCalendarEventId(): Promise<TaskRow[]> {
      return [...tasks.values()]
        .filter((t) => t.calendarEventId !== null)
        .map((t) => ({ ...t }));
    },

    async wipeAll(): Promise<void> {
      categoryStats.clear();
      recurringStats.clear();
      events.clear();
      contextTags.clear();
      discoveries.clear();
      routines.clear();
      routineSteps.clear();
      tasks.clear();
      dayMeta.clear();
      companion.reclaimedMinutesLifetime = 0;
      companion.lifetimeDataPoints = 0;
      companion.maxTier = 0;
      companion.keeper = false;
      companion.seed = 0;
      companion.driftHealth = 'settled';
      companion.discoveryCount = 0;
      companion.name = null;
    },
  };
}
