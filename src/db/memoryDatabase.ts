// In-memory Database adapter — backed by Maps. Used by tests (no native module
// required) and as a runtime fallback when expo-sqlite is unavailable. Logic is
// fully synchronous; the async signatures satisfy the port contract.

import type { Database } from './Database';
import type { CategoryStatRow, CompanionRow, ContextTagRow, DiscoveryRow, ReasonEventRow, RecurringStatRow, TaskEventRow } from './types';

export function createMemoryDatabase(): Database {
  const categoryStats = new Map<string, CategoryStatRow>();
  const recurringStats = new Map<string, RecurringStatRow>();
  const events = new Map<string, TaskEventRow>();
  const contextTags = new Map<string, ContextTagRow>();
  const discoveries = new Map<string, DiscoveryRow>();
  const companion: CompanionRow = {
    reclaimedMinutesLifetime: 0,
    lifetimeDataPoints: 0,
    maxTier: 0,
    keeper: false,
    seed: 1,
    driftHealth: 'settled',
    discoveryCount: 0,
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
  };
}
