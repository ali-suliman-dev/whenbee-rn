// Thin semantic wrapper over the Database port for routines + their ordered steps.
// Features never touch raw SQL — they go through this repo (and the store). Maps
// db DTOs ↔ domain types so nothing above the repo sees a row shape.

import type { Database } from '../Database';
import type { RoutineRow, RoutineStepRow } from '../types';
import type { Routine, RoutineStep } from '@/src/domain/types';

/** A routine paired with its ordered steps — the shape the store consumes. */
export interface RoutineWithSteps {
  routine: Routine;
  steps: RoutineStep[];
}

export interface RoutinesRepo {
  /** All routines (newest-updated first) with their ordered steps. */
  list(): Promise<RoutineWithSteps[]>;
  /** A single routine + steps, or null if absent. */
  get(id: string): Promise<RoutineWithSteps | null>;
  /** Insert a routine + its steps. */
  create(routine: Routine, steps: RoutineStep[]): Promise<void>;
  /** Replace a routine + its steps wholesale (atomic in the adapter). */
  update(routine: Routine, steps: RoutineStep[]): Promise<void>;
  /** Delete a routine and all of its step rows. */
  remove(id: string): Promise<void>;
  /** Persist a routine's learned transition factor. */
  setTransitionFactor(id: string, factor: number, updatedAt?: number): Promise<void>;
  /** Monotonic — bump a routine's completed-full-run count. */
  incrementRunCount(id: string, updatedAt?: number): Promise<void>;
}

/** Parse a comma-joined schedule_days string into a number[]. */
function parseScheduleDays(raw: string): number[] {
  if (raw === '') return [];
  return raw.split(',').map(Number);
}

/** Serialize a weekday array into a comma-joined string for the row. */
function serializeScheduleDays(days: number[]): string {
  return days.join(',');
}

function toRoutine(row: RoutineRow): Routine {
  return {
    id: row.id,
    name: row.name,
    doneByMinuteOfDay: row.doneByMinuteOfDay,
    transitionFactor: row.transitionFactor,
    runCount: row.runCount,
    scheduleDays: parseScheduleDays(row.scheduleDays),
    alertEnabled: row.alertEnabled,
    alertLeadMin: row.alertLeadMin,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toRoutineRow(routine: Routine): RoutineRow {
  return {
    id: routine.id,
    name: routine.name,
    doneByMinuteOfDay: routine.doneByMinuteOfDay,
    transitionFactor: routine.transitionFactor,
    runCount: routine.runCount,
    scheduleDays: serializeScheduleDays(routine.scheduleDays),
    alertEnabled: routine.alertEnabled,
    alertLeadMin: routine.alertLeadMin,
    createdAt: routine.createdAt,
    updatedAt: routine.updatedAt,
  };
}

function toStep(row: RoutineStepRow): RoutineStep {
  return {
    id: row.id,
    routineId: row.routineId,
    position: row.position,
    label: row.label,
    category: row.category,
    guessMin: row.guessMin,
  };
}

function toStepRow(step: RoutineStep): RoutineStepRow {
  return {
    id: step.id,
    routineId: step.routineId,
    position: step.position,
    label: step.label,
    category: step.category,
    guessMin: step.guessMin,
  };
}

export function makeRoutinesRepo(db: Database): RoutinesRepo {
  async function withSteps(row: RoutineRow): Promise<RoutineWithSteps> {
    const stepRows = await db.listRoutineSteps(row.id);
    return { routine: toRoutine(row), steps: stepRows.map(toStep) };
  }

  async function save(routine: Routine, steps: RoutineStep[]): Promise<void> {
    await db.saveRoutine(toRoutineRow(routine), steps.map(toStepRow));
  }

  return {
    async list(): Promise<RoutineWithSteps[]> {
      const rows = await db.listRoutines();
      return Promise.all(rows.map(withSteps));
    },

    async get(id: string): Promise<RoutineWithSteps | null> {
      const row = await db.getRoutine(id);
      return row ? withSteps(row) : null;
    },

    create: save,
    update: save,

    async remove(id: string): Promise<void> {
      await db.deleteRoutine(id);
    },

    async setTransitionFactor(id: string, factor: number, updatedAt?: number): Promise<void> {
      await db.setRoutineTransitionFactor(id, factor, updatedAt ?? Date.now());
    },

    async incrementRunCount(id: string, updatedAt?: number): Promise<void> {
      await db.incrementRoutineRunCount(id, updatedAt ?? Date.now());
    },
  };
}
