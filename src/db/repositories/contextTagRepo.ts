import type { Database } from '../Database';
import type { ContextTagRow } from '../types';

export function makeContextTagRepo(db: Database) {
  return {
    /** Capture-only. Never read on the calibration path. */
    setReason: (row: ContextTagRow) => db.insertContextTag(row),
    /** Read-only reason⋈event join for the Pro correlation read. Never the model. */
    listReasonEvents: (limit: number) => db.listReasonEvents(limit),
  };
}
