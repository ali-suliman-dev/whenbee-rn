// src/services/calendarExport.ts
//
// ──────────────────────────────────────────────────────────────────────────────
// Calendar export sync service (Phase 7 — Task A3).
//
// WRITE SAFETY (do not weaken):
//   Every create / update / delete goes through the Whenbee-owned calendar ops
//   defined in calendar.ts.  The `calendarId` argument MUST be the value stored
//   in settings.calendar.whenbeeCalendarId — callers are responsible for
//   passing that id and nothing else.  If `calendarId` is falsy, this module
//   performs no calendar operations and returns zeros.
//
//   This service never enumerates or touches any user-owned calendar. It only
//   operates on event ids that it either just created (via createWhenbeeEvent)
//   or that the caller passed in from tasks.calendarEventId (which were
//   previously created by this same service).
//
// Guarding:
//   getCalendar() is already isExpoGo-guarded in calendar.ts — the stub
//   returns no-ops, so all writes are safe in Expo Go / CI / tests.
//   Horizon cap is the CALLER's responsibility (pass at most ≤ N days of plans).
// ──────────────────────────────────────────────────────────────────────────────

import { getCalendar } from './calendar';

// ── Public types ──────────────────────────────────────────────────────────────

export interface PlannedTask {
  /** The app-internal task id. */
  id: string;
  /** Display title to write as the event title. */
  label: string;
  /** Epoch ms — when the task starts in the day plan. */
  startMs: number;
  /** Epoch ms — when the task ends in the day plan. */
  endMs: number;
  /**
   * The native Whenbee calendar event id previously created for this task,
   * or null if it has never been exported.
   */
  calendarEventId: string | null;
}

export interface TaskEventLink {
  taskId: string;
  eventId: string;
}

export interface SyncDayPlanInput {
  /** YYYY-MM-DD local day key (informational — not used for range queries). */
  date: string;
  /**
   * The app-owned Whenbee calendar id from settings.calendar.whenbeeCalendarId.
   * MUST be the Whenbee calendar. If falsy, the service is a no-op.
   */
  calendarId: string;
  /** All timed tasks in the day's plan (already horizon-capped by the caller). */
  plannedTasks: PlannedTask[];
  /**
   * The taskId→eventId mapping from the previous sync pass for this day.
   * Tasks whose taskId appears here but NOT in plannedTasks will have their
   * events deleted (they were removed from the day plan since the last export).
   */
  priorLinks: TaskEventLink[];
}

export interface SyncDayPlanResult {
  /** Number of new events created. */
  created: number;
  /** Number of existing events updated. */
  updated: number;
  /** Number of stale events deleted. */
  deleted: number;
  /**
   * The current taskId→eventId mapping for the caller to persist onto tasks
   * (via tasksRepo.update(id, { calendarEventId })).
   */
  links: TaskEventLink[];
}

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * Sync a day's timed plan into the app-owned Whenbee calendar.
 *
 * For each task in `plannedTasks`:
 *   - calendarEventId === null  → create a new Whenbee event, record the link.
 *   - calendarEventId !== null  → update the existing Whenbee event's times + title.
 *
 * Any priorLink whose taskId is NOT in plannedTasks → the task was removed from
 * the plan; delete its Whenbee event.
 *
 * Returns { created, updated, deleted, links } — the caller MUST persist
 * `links` back to the tasks (via tasksRepo or dayTasksStore) so that the next
 * sync pass can correctly update rather than re-create.
 *
 * WRITE SAFETY: if `calendarId` is falsy, returns zeros immediately without
 * touching any calendar.
 */
export async function syncDayPlanToCalendar(
  input: SyncDayPlanInput,
): Promise<SyncDayPlanResult> {
  const { calendarId, plannedTasks, priorLinks } = input;

  // Guard: if no calendar id, do nothing.
  if (!calendarId) {
    return { created: 0, updated: 0, deleted: 0, links: [] };
  }

  const calendar = getCalendar();
  const links: TaskEventLink[] = [];
  let created = 0;
  let updated = 0;

  // Build a set of planned task ids for reconciliation.
  const plannedTaskIdSet = new Set(plannedTasks.map((t) => t.id));

  // ── Create / update ───────────────────────────────────────────────────────
  for (const task of plannedTasks) {
    if (task.calendarEventId === null) {
      // First export of this task → create a new Whenbee event.
      const eventId = await calendar.createWhenbeeEvent(calendarId, {
        title: task.label,
        startMs: task.startMs,
        endMs: task.endMs,
      });
      links.push({ taskId: task.id, eventId });
      created += 1;
    } else {
      // Task already has an event → update its times and title.
      await calendar.updateWhenbeeEvent(task.calendarEventId, {
        startMs: task.startMs,
        endMs: task.endMs,
        title: task.label,
      });
      links.push({ taskId: task.id, eventId: task.calendarEventId });
      updated += 1;
    }
  }

  // ── Reconcile deletions ───────────────────────────────────────────────────
  // Any priorLink whose task is no longer in the planned set is stale.
  let deleted = 0;
  for (const prior of priorLinks) {
    if (!plannedTaskIdSet.has(prior.taskId)) {
      await calendar.deleteWhenbeeEvent(prior.eventId);
      deleted += 1;
    }
  }

  return { created, updated, deleted, links };
}

/**
 * Disable export: delete ALL events in the Whenbee calendar.
 *
 * The caller is responsible for clearing tasks.calendarEventId on all tasks
 * and clearing settings.calendar.whenbeeCalendarId afterward.
 *
 * WRITE SAFETY: if `calendarId` is falsy, returns 0 without any calendar ops.
 */
export async function disableExport(calendarId: string): Promise<number> {
  if (!calendarId) return 0;
  return getCalendar().deleteAllWhenbeeEvents(calendarId);
}
