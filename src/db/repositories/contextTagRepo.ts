import type { Database } from '../Database';
import type { ContextTagRow } from '../types';

export function makeContextTagRepo(db: Database) {
  return {
    /** Capture-only. Never read on the calibration path. */
    setReason: (row: ContextTagRow) => db.insertContextTag(row),
  };
}
