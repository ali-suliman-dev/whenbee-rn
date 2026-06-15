import type { Database } from '../Database';
import type { DiscoveryRow } from '../types';

export interface DiscoveriesRepo {
  bank(row: DiscoveryRow): Promise<void>;
  list(limit?: number): Promise<DiscoveryRow[]>;
  lastForCategory(categoryId: string): Promise<DiscoveryRow | null>;
}

export function makeDiscoveriesRepo(db: Database): DiscoveriesRepo {
  return {
    async bank(row) {
      await db.insertDiscovery(row);
      await db.incrementDiscoveryCount();
    },
    async list(limit = 50) {
      return db.listDiscoveries(limit);
    },
    async lastForCategory(categoryId) {
      return db.getLastDiscoveryForCategory(categoryId);
    },
  };
}
