import type { Database } from '../Database';
import type { ContextTagRow } from '../types';

export function makeContextTagRepo(db: Database) {
  return {
    /** Capture-only. Never read on the calibration path. */
    setReason: (row: ContextTagRow) => db.insertContextTag(row),
    /** Capture-only generic tag write (e.g. key:'energy'). Never read by the model. */
    set: (row: ContextTagRow) => db.insertContextTag(row),
    /** Read-only reason⋈event join for the Pro correlation read. Never the model. */
    listReasonEvents: (limit: number) => db.listReasonEvents(limit),
    /** Read-only context⋈event join (one key) for the Pro S4 read. Never the model. */
    listContextEvents: (key: string, limit: number) => db.listContextEvents(key, limit),
  };
}
