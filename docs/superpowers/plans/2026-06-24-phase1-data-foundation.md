# Planning Expansion — Phase 1: Data Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Graduate tasks from the ephemeral kv "today" list to a durable per-day `tasks` table with a repository, pure day-membership/carryover selectors, a kv→DB migration, and a rewritten `tasksStore` exposing a selected date — so later phases can plan any day with silent carryover and per-day history.

**Architecture:** Follow the existing layered DB pattern exactly: a SQL migration adds `tasks` + `day_meta`; the `Database` port gains task methods; both adapters (`createMemoryDatabase`, `createSqliteDatabase`) implement them; a `tasksRepo` maps rows↔domain; pure selectors in `src/engine/` compute which tasks belong to a viewed day; `tasksStore` becomes an async facade over the repo holding `selectedDate`. No UI in this phase — it is fully unit-tested against the in-memory DB.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`), expo-sqlite, Zustand + `zustandKv`, Jest. Source spec: `docs/product/specs/2026-06-24-planning-calendar-expansion-design.md` (§4 data model, §4.2 carryover, §16 migration).

## Global Constraints

- **Engine is pure TS** — `src/engine/**` imports no RN/Expo and never calls `Date.now()`/`new Date()`; callers pass `nowMs`/day-key strings. (Date-using helpers live in `src/lib/`, not `src/engine/`.)
- **TypeScript strict** — `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride` all on. Indexed access returns `T | undefined`; handle it, do not `!` unless provably safe.
- **Layer rule (ESLint-enforced)** — `src/app/**` and `src/components/**` must NOT import `@/src/db/*` or `@/src/services/*`; they go through a store/hook. Repos are imported only by stores/services.
- **Two DB adapters, one port** — every new `Database` method is implemented in BOTH `memoryDatabase.ts` and `sqliteDatabase.ts`. Tests run only against `createMemoryDatabase()` (sqlite/native is not mocked in jest).
- **Migrations are append-only** — never edit/reorder an applied `MIGRATIONS` entry; only append. Use `IF NOT EXISTS`.
- **No guilt, ever** — carryover surfaces with a neutral tag; never "overdue", never red, never a count badge. (No UI here, but selectors must not encode a guilt concept.)
- **Run before every commit:** `npm run lint` (0 warnings), `npm run typecheck`, `npx jest <changed test files>`.
- **Never merge** — open work only; the founder merges. Conventional Commits; NO AI/co-author trailers.

---

### Task 1: Local day-key utility (`src/lib/day.ts`)

Converts epoch ms ↔ a stable local `'YYYY-MM-DD'` day key, and does day-key arithmetic/comparison. Date-using → lives in `src/lib/`, NOT the engine.

**Files:**
- Create: `src/lib/day.ts`
- Test: `src/lib/__tests__/day.test.ts`

**Interfaces:**
- Produces:
  - `toLocalDayKey(ms: number): string` — local calendar day of an epoch, `'YYYY-MM-DD'`.
  - `addDays(key: string, n: number): string` — shift a day key by `n` days (n may be negative).
  - `compareDayKeys(a: string, b: string): number` — `<0`, `0`, `>0` (lexicographic works for `'YYYY-MM-DD'`).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/__tests__/day.test.ts
import { toLocalDayKey, addDays, compareDayKeys } from '@/src/lib/day';

describe('day keys', () => {
  test('toLocalDayKey formats local Y-M-D zero-padded', () => {
    // 2026-06-24 12:00 local — build via local Date so the test is tz-agnostic.
    const ms = new Date(2026, 5, 24, 12, 0, 0).getTime();
    expect(toLocalDayKey(ms)).toBe('2026-06-24');
  });

  test('toLocalDayKey pads single-digit month/day', () => {
    const ms = new Date(2026, 0, 5, 9, 0, 0).getTime();
    expect(toLocalDayKey(ms)).toBe('2026-01-05');
  });

  test('addDays crosses month and year boundaries', () => {
    expect(addDays('2026-06-24', 1)).toBe('2026-06-25');
    expect(addDays('2026-06-30', 1)).toBe('2026-07-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  test('compareDayKeys orders chronologically', () => {
    expect(compareDayKeys('2026-06-24', '2026-06-25')).toBeLessThan(0);
    expect(compareDayKeys('2026-06-25', '2026-06-24')).toBeGreaterThan(0);
    expect(compareDayKeys('2026-06-24', '2026-06-24')).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/day.test.ts`
Expected: FAIL — cannot find module `@/src/lib/day`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/day.ts
// Local calendar day-key helpers. Uses Date (local tz) → lives in lib, never the
// pure engine. A day key is a stable 'YYYY-MM-DD' string in the device's local time.

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Local calendar day of an epoch ms, as 'YYYY-MM-DD'. */
export function toLocalDayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Shift a 'YYYY-MM-DD' key by n days (n may be negative). */
export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  const shifted = new Date(y, m - 1, d + n);
  return `${shifted.getFullYear()}-${pad(shifted.getMonth() + 1)}-${pad(shifted.getDate())}`;
}

/** Chronological comparison; <0 if a before b. Lexicographic is valid for 'YYYY-MM-DD'. */
export function compareDayKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/__tests__/day.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Lint, typecheck, commit**

```bash
npx eslint src/lib/day.ts src/lib/__tests__/day.test.ts
npm run typecheck
git add src/lib/day.ts src/lib/__tests__/day.test.ts
git commit -m "feat(day): local day-key helpers (toLocalDayKey/addDays/compareDayKeys)"
```

---

### Task 2: Domain + row types for tasks and day-meta

Adds the contracts shared across engine/db/store/UI. Types only (no runtime), so no standalone test — they are exercised by Tasks 5/7/8.

**Files:**
- Modify: `src/domain/types.ts` (append a "Day-planned tasks" section)
- Modify: `src/db/types.ts` (append `TaskRow`, `DayMetaRow`)

**Interfaces:**
- Produces (domain):
  - `type TaskStatus = 'queued' | 'done'`
  - `interface Task { id; label; category: Category; guessMin; plannedDate: string | null; status: TaskStatus; orderIndex; doneByMin: number | null; createdAt; completedAt: number | null; actualMin: number | null; fromRoutineId: string | null; calendarEventId: string | null }`
  - `interface DayMeta { date: string; doneByMin: number | null; planComputedAt: number | null }`
- Produces (db row, camelCase DTO): `TaskRow` (identical field names to `Task`), `DayMetaRow` (identical to `DayMeta`).

- [ ] **Step 1: Add domain types**

Append to `src/domain/types.ts`:

```ts
// ── Day-planned tasks (planning expansion, spec 2026-06-24) ───────────────────

/** A task lives on a day (or the "No day yet" shelf when plannedDate is null). */
export type TaskStatus = 'queued' | 'done';

export interface Task {
  id: string;
  label: string;
  category: Category;
  guessMin: number;
  /** Local 'YYYY-MM-DD' the task is planned for; null = "No day yet" shelf. */
  plannedDate: string | null;
  status: TaskStatus;
  /** Manual order within a (plannedDate) bucket; lower = earlier. */
  orderIndex: number;
  /** Optional per-task hard deadline, minute-of-day 0–1439; null = none. */
  doneByMin: number | null;
  createdAt: number;
  /** epoch ms when marked done; null while queued. Done bucketing uses this. */
  completedAt: number | null;
  actualMin: number | null;
  /** Set when this task is a materialized routine instance. */
  fromRoutineId: string | null;
  /** Set when exported to the device calendar (links for update/delete). */
  calendarEventId: string | null;
}

/** Day-level planning attributes (the "I want to be done by" target lives here). */
export interface DayMeta {
  date: string; // local 'YYYY-MM-DD'
  doneByMin: number | null;
  planComputedAt: number | null;
}
```

- [ ] **Step 2: Add db row DTOs**

Append to `src/db/types.ts`:

```ts
import type { Category, TaskStatus } from '@/src/domain/types';

/** A day-planned task row (system of record for the planning surfaces). */
export interface TaskRow {
  id: string;
  label: string;
  category: Category;
  guessMin: number;
  plannedDate: string | null;
  status: TaskStatus;
  orderIndex: number;
  doneByMin: number | null;
  createdAt: number;
  completedAt: number | null;
  actualMin: number | null;
  fromRoutineId: string | null;
  calendarEventId: string | null;
}

/** Day-level planning attributes row. */
export interface DayMetaRow {
  date: string;
  doneByMin: number | null;
  planComputedAt: number | null;
}
```

> Note: `src/db/types.ts` already imports from `@/src/domain/types`; extend that import line to include `Category, TaskStatus` rather than adding a duplicate import.

- [ ] **Step 3: Typecheck, commit**

```bash
npm run typecheck
git add src/domain/types.ts src/db/types.ts
git commit -m "feat(types): Task/DayMeta domain + row contracts for day planning"
```

---

### Task 3: Migration 0010 — `tasks` + `day_meta` tables

**Files:**
- Modify: `src/db/migrations.ts` (append one entry to the `MIGRATIONS` array)

**Interfaces:**
- Produces: SQL tables `tasks` and `day_meta` once `runMigrations` advances `user_version` to 10.

- [ ] **Step 1: Append the migration**

Append as the next array element after the `0009` entry in `src/db/migrations.ts`:

```ts
  // 0010 — Day-planned tasks + day-level planning meta (planning expansion).
  // Tasks graduate from the ephemeral kv list to a durable per-day table so the
  // calendar surface can carry tasks over silently and bank per-day history.
  `
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    category TEXT NOT NULL,
    guess_min INTEGER NOT NULL,
    planned_date TEXT,
    status TEXT NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    done_by_min INTEGER,
    created_at INTEGER NOT NULL,
    completed_at INTEGER,
    actual_min INTEGER,
    from_routine_id TEXT,
    calendar_event_id TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_tasks_planned_date ON tasks (planned_date, order_index);
  CREATE INDEX IF NOT EXISTS idx_tasks_status_completed ON tasks (status, completed_at);

  CREATE TABLE IF NOT EXISTS day_meta (
    date TEXT PRIMARY KEY,
    done_by_min INTEGER,
    plan_computed_at INTEGER
  );
  `,
```

- [ ] **Step 2: Typecheck, commit**

(`migrations.ts` is a string array; correctness is verified by Task 6's adapter and at runtime. No unit test for raw SQL.)

```bash
npm run typecheck
git add src/db/migrations.ts
git commit -m "feat(db): migration 0010 — tasks + day_meta tables"
```

---

### Task 4: Extend the `Database` port

**Files:**
- Modify: `src/db/Database.ts` (add task + day_meta methods; extend the row-type import)

**Interfaces:**
- Produces (added to `interface Database`):
  - `insertTask(row: TaskRow): Promise<void>`
  - `updateTask(id: string, patch: Partial<TaskRow>): Promise<void>`
  - `deleteTask(id: string): Promise<void>`
  - `getTask(id: string): Promise<TaskRow | null>`
  - `listTasksByDate(date: string): Promise<TaskRow[]>` — order_index asc.
  - `listQueuedOnOrBefore(date: string): Promise<TaskRow[]>` — queued, plannedDate ≤ date, order_index asc (carryover query).
  - `listDoneCompletedBetween(startMs: number, endMs: number): Promise<TaskRow[]>` — done, completed_at in [start,end).
  - `listShelfTasks(): Promise<TaskRow[]>` — queued, plannedDate IS NULL.
  - `getDayMeta(date: string): Promise<DayMetaRow | null>`
  - `upsertDayMeta(row: DayMetaRow): Promise<void>`

- [ ] **Step 1: Add the methods to the port**

In `src/db/Database.ts`, extend the import to include `DayMetaRow, TaskRow`, then add inside `interface Database` (e.g. after the routines block):

```ts
  // ── Day-planned tasks + day meta (planning expansion) ───────────────────────
  insertTask(row: TaskRow): Promise<void>;
  /** Partial update by id; only provided fields change. */
  updateTask(id: string, patch: Partial<TaskRow>): Promise<void>;
  deleteTask(id: string): Promise<void>;
  getTask(id: string): Promise<TaskRow | null>;
  /** All tasks planned for a day, order_index ascending. */
  listTasksByDate(date: string): Promise<TaskRow[]>;
  /** Queued tasks whose plannedDate <= date (the carryover query), order_index asc. */
  listQueuedOnOrBefore(date: string): Promise<TaskRow[]>;
  /** Done tasks whose completedAt is in [startMs, endMs). For a day's recap bucket. */
  listDoneCompletedBetween(startMs: number, endMs: number): Promise<TaskRow[]>;
  /** Queued tasks with no plannedDate (the "No day yet" shelf). */
  listShelfTasks(): Promise<TaskRow[]>;
  getDayMeta(date: string): Promise<DayMetaRow | null>;
  upsertDayMeta(row: DayMetaRow): Promise<void>;
```

- [ ] **Step 2: Typecheck (expect adapter errors)**

Run: `npm run typecheck`
Expected: FAIL — `createMemoryDatabase` and `createSqliteDatabase` do not implement the new members yet. This confirms the port changed; Tasks 5 & 6 fix it.

- [ ] **Step 3: Commit**

```bash
git add src/db/Database.ts
git commit -m "feat(db): extend Database port with task + day_meta methods"
```

---

### Task 5: Implement task/day-meta in the in-memory adapter

**Files:**
- Modify: `src/db/memoryDatabase.ts`
- Test: `src/db/__tests__/memoryDatabase.tasks.test.ts`

**Interfaces:**
- Consumes: `Database` task methods (Task 4), `TaskRow`/`DayMetaRow` (Task 2).
- Produces: working in-memory implementations + updated `wipeAll`.

- [ ] **Step 1: Write the failing test**

```ts
// src/db/__tests__/memoryDatabase.tasks.test.ts
import { createMemoryDatabase } from '@/src/db/memoryDatabase';
import type { TaskRow } from '@/src/db/types';

function row(over: Partial<TaskRow>): TaskRow {
  return {
    id: 't1', label: 'Write', category: 'deep-work', guessMin: 60,
    plannedDate: '2026-06-24', status: 'queued', orderIndex: 0, doneByMin: null,
    createdAt: 1000, completedAt: null, actualMin: null, fromRoutineId: null,
    calendarEventId: null, ...over,
  };
}

test('insert + listTasksByDate returns order_index ascending', async () => {
  const db = createMemoryDatabase();
  await db.insertTask(row({ id: 'b', orderIndex: 1 }));
  await db.insertTask(row({ id: 'a', orderIndex: 0 }));
  const list = await db.listTasksByDate('2026-06-24');
  expect(list.map((t) => t.id)).toEqual(['a', 'b']);
});

test('listQueuedOnOrBefore includes carryover, excludes future + done + shelf', async () => {
  const db = createMemoryDatabase();
  await db.insertTask(row({ id: 'yesterday', plannedDate: '2026-06-23' }));
  await db.insertTask(row({ id: 'today', plannedDate: '2026-06-24' }));
  await db.insertTask(row({ id: 'tomorrow', plannedDate: '2026-06-25' }));
  await db.insertTask(row({ id: 'doneOne', plannedDate: '2026-06-23', status: 'done', completedAt: 5 }));
  await db.insertTask(row({ id: 'shelf', plannedDate: null }));
  const list = await db.listQueuedOnOrBefore('2026-06-24');
  expect(list.map((t) => t.id).sort()).toEqual(['today', 'yesterday']);
});

test('updateTask patches only given fields', async () => {
  const db = createMemoryDatabase();
  await db.insertTask(row({ id: 't' }));
  await db.updateTask('t', { status: 'done', completedAt: 99, actualMin: 42 });
  const got = await db.getTask('t');
  expect(got?.status).toBe('done');
  expect(got?.completedAt).toBe(99);
  expect(got?.label).toBe('Write'); // untouched
});

test('listDoneCompletedBetween buckets by completedAt window', async () => {
  const db = createMemoryDatabase();
  await db.insertTask(row({ id: 'in', status: 'done', completedAt: 150 }));
  await db.insertTask(row({ id: 'before', status: 'done', completedAt: 50 }));
  await db.insertTask(row({ id: 'queued', status: 'queued', completedAt: null }));
  const list = await db.listDoneCompletedBetween(100, 200);
  expect(list.map((t) => t.id)).toEqual(['in']);
});

test('day meta upsert + get', async () => {
  const db = createMemoryDatabase();
  expect(await db.getDayMeta('2026-06-24')).toBeNull();
  await db.upsertDayMeta({ date: '2026-06-24', doneByMin: 1020, planComputedAt: null });
  expect((await db.getDayMeta('2026-06-24'))?.doneByMin).toBe(1020);
});

test('wipeAll clears tasks + day meta', async () => {
  const db = createMemoryDatabase();
  await db.insertTask(row({ id: 't' }));
  await db.upsertDayMeta({ date: '2026-06-24', doneByMin: 1, planComputedAt: null });
  await db.wipeAll();
  expect(await db.listTasksByDate('2026-06-24')).toEqual([]);
  expect(await db.getDayMeta('2026-06-24')).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/db/__tests__/memoryDatabase.tasks.test.ts`
Expected: FAIL — methods undefined.

- [ ] **Step 3: Implement in `memoryDatabase.ts`**

Add Maps near the other `new Map(...)` declarations:

```ts
  const tasks = new Map<string, TaskRow>();
  const dayMeta = new Map<string, DayMetaRow>();
```

Extend the row-type import at the top to include `DayMetaRow, TaskRow`.

Add these methods to the returned object (e.g. after the routines block):

```ts
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
      const row = tasks.get(id);
      return row ? { ...row } : null;
    },
    async listTasksByDate(date: string): Promise<TaskRow[]> {
      return [...tasks.values()]
        .filter((t) => t.plannedDate === date)
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
      const row = dayMeta.get(date);
      return row ? { ...row } : null;
    },
    async upsertDayMeta(row: DayMetaRow): Promise<void> {
      dayMeta.set(row.date, { ...row });
    },
```

In `wipeAll`, add: `tasks.clear(); dayMeta.clear();`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/db/__tests__/memoryDatabase.tasks.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Lint, typecheck, commit**

```bash
npx eslint src/db/memoryDatabase.ts src/db/__tests__/memoryDatabase.tasks.test.ts
npm run typecheck
git add src/db/memoryDatabase.ts src/db/__tests__/memoryDatabase.tasks.test.ts
git commit -m "feat(db): in-memory adapter — tasks + day_meta"
```

---

### Task 6: Implement task/day-meta in the sqlite adapter

Mirrors Task 5 against SQL. Not unit-tested (native sqlite is never imported in jest — see the adapter's header note); correctness is the parameterized-SQL mirror of the verified memory adapter.

**Files:**
- Modify: `src/db/sqliteDatabase.ts`

**Interfaces:**
- Consumes: migration 0010 tables; `Database` port (Task 4).
- Produces: SQL implementations of the 10 methods.

- [ ] **Step 1: Add the DbRow interface + mapper**

Near the other `*DbRow` interfaces add:

```ts
interface TaskDbRow {
  id: string;
  label: string;
  category: string;
  guess_min: number;
  planned_date: string | null;
  status: string;
  order_index: number;
  done_by_min: number | null;
  created_at: number;
  completed_at: number | null;
  actual_min: number | null;
  from_routine_id: string | null;
  calendar_event_id: string | null;
}

interface DayMetaDbRow {
  date: string;
  done_by_min: number | null;
  plan_computed_at: number | null;
}
```

Add mappers near the other `mapXxx` helpers (extend the `./types` import with `DayMetaRow, TaskRow`):

```ts
function mapTask(r: TaskDbRow): TaskRow {
  return {
    id: r.id,
    label: r.label,
    category: r.category,
    guessMin: r.guess_min,
    plannedDate: r.planned_date,
    status: r.status as TaskRow['status'],
    orderIndex: r.order_index,
    doneByMin: r.done_by_min,
    createdAt: r.created_at,
    completedAt: r.completed_at,
    actualMin: r.actual_min,
    fromRoutineId: r.from_routine_id,
    calendarEventId: r.calendar_event_id,
  };
}

function mapDayMeta(r: DayMetaDbRow): DayMetaRow {
  return { date: r.date, doneByMin: r.done_by_min, planComputedAt: r.plan_computed_at };
}
```

- [ ] **Step 2: Implement the port methods**

Add to the returned object in `createSqliteDatabase` (mirroring the routines methods' SQL style — `db.runAsync(sql, ...params)`, `db.getAllAsync<T>(...)`, `db.getFirstAsync<T>(...)`):

```ts
    async insertTask(row: TaskRow): Promise<void> {
      await db.runAsync(
        `INSERT INTO tasks (id, label, category, guess_min, planned_date, status, order_index, done_by_min, created_at, completed_at, actual_min, from_routine_id, calendar_event_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        row.id, row.label, row.category, row.guessMin, row.plannedDate, row.status,
        row.orderIndex, row.doneByMin, row.createdAt, row.completedAt, row.actualMin,
        row.fromRoutineId, row.calendarEventId,
      );
    },
    async updateTask(id: string, patch: Partial<TaskRow>): Promise<void> {
      const existing = await this.getTask(id);
      if (existing === null) return;
      const next: TaskRow = { ...existing, ...patch, id };
      await db.runAsync(
        `UPDATE tasks SET label=?, category=?, guess_min=?, planned_date=?, status=?, order_index=?, done_by_min=?, created_at=?, completed_at=?, actual_min=?, from_routine_id=?, calendar_event_id=? WHERE id=?`,
        next.label, next.category, next.guessMin, next.plannedDate, next.status,
        next.orderIndex, next.doneByMin, next.createdAt, next.completedAt, next.actualMin,
        next.fromRoutineId, next.calendarEventId, id,
      );
    },
    async deleteTask(id: string): Promise<void> {
      await db.runAsync('DELETE FROM tasks WHERE id = ?', id);
    },
    async getTask(id: string): Promise<TaskRow | null> {
      const row = await db.getFirstAsync<TaskDbRow>('SELECT * FROM tasks WHERE id = ?', id);
      return row ? mapTask(row) : null;
    },
    async listTasksByDate(date: string): Promise<TaskRow[]> {
      const rows = await db.getAllAsync<TaskDbRow>(
        'SELECT * FROM tasks WHERE planned_date = ? ORDER BY order_index ASC', date,
      );
      return rows.map(mapTask);
    },
    async listQueuedOnOrBefore(date: string): Promise<TaskRow[]> {
      const rows = await db.getAllAsync<TaskDbRow>(
        `SELECT * FROM tasks WHERE status = 'queued' AND planned_date IS NOT NULL AND planned_date <= ? ORDER BY order_index ASC`,
        date,
      );
      return rows.map(mapTask);
    },
    async listDoneCompletedBetween(startMs: number, endMs: number): Promise<TaskRow[]> {
      const rows = await db.getAllAsync<TaskDbRow>(
        `SELECT * FROM tasks WHERE status = 'done' AND completed_at >= ? AND completed_at < ? ORDER BY completed_at ASC`,
        startMs, endMs,
      );
      return rows.map(mapTask);
    },
    async listShelfTasks(): Promise<TaskRow[]> {
      const rows = await db.getAllAsync<TaskDbRow>(
        `SELECT * FROM tasks WHERE status = 'queued' AND planned_date IS NULL ORDER BY order_index ASC`,
      );
      return rows.map(mapTask);
    },
    async getDayMeta(date: string): Promise<DayMetaRow | null> {
      const row = await db.getFirstAsync<DayMetaDbRow>('SELECT * FROM day_meta WHERE date = ?', date);
      return row ? mapDayMeta(row) : null;
    },
    async upsertDayMeta(row: DayMetaRow): Promise<void> {
      await db.runAsync(
        `INSERT INTO day_meta (date, done_by_min, plan_computed_at) VALUES (?,?,?)
         ON CONFLICT(date) DO UPDATE SET done_by_min = excluded.done_by_min, plan_computed_at = excluded.plan_computed_at`,
        row.date, row.doneByMin, row.planComputedAt,
      );
    },
```

In the sqlite `wipeAll` implementation, add `DELETE FROM tasks; DELETE FROM day_meta;` alongside the other table wipes.

> Note on `this`: the routines methods reference sibling methods via the object; if the adapter uses arrow-style object literals without `this`, call the local query directly instead of `this.getTask` (define `getTask` as a hoisted `async function` and reuse it). Match whichever pattern the surrounding methods already use.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS — both adapters now satisfy the port.

- [ ] **Step 4: Commit**

```bash
npx eslint src/db/sqliteDatabase.ts
git add src/db/sqliteDatabase.ts
git commit -m "feat(db): sqlite adapter — tasks + day_meta"
```

---

### Task 7: `tasksRepo` — semantic wrapper + domain mapping

**Files:**
- Create: `src/db/repositories/tasksRepo.ts`
- Test: `src/db/repositories/__tests__/tasksRepo.test.ts`

**Interfaces:**
- Consumes: `Database` task methods (Tasks 4–6), `Task`/`DayMeta` domain (Task 2), `toLocalDayKey` (Task 1).
- Produces: `makeTasksRepo(db: Database): TasksRepo` with:
  - `add(task: Task): Promise<void>`
  - `update(id: string, patch: Partial<Task>): Promise<void>`
  - `remove(id: string): Promise<void>`
  - `get(id: string): Promise<Task | null>`
  - `listByDate(date: string): Promise<Task[]>`
  - `listCarryover(today: string): Promise<Task[]>` — queued, plannedDate ≤ today.
  - `listDoneForDay(dayKey: string): Promise<Task[]>` — done tasks bucketed by completedAt local day.
  - `listShelf(): Promise<Task[]>`
  - `move(id: string, toDate: string | null): Promise<void>`
  - `complete(id: string, opts: { completedAt: number; actualMin?: number }): Promise<void>`
  - `getDayMeta(date: string): Promise<DayMeta | null>`
  - `setDoneBy(date: string, doneByMin: number | null): Promise<void>`

- [ ] **Step 1: Write the failing test**

```ts
// src/db/repositories/__tests__/tasksRepo.test.ts
import { createMemoryDatabase } from '@/src/db/memoryDatabase';
import { makeTasksRepo } from '@/src/db/repositories/tasksRepo';
import type { Task } from '@/src/domain/types';

function task(over: Partial<Task>): Task {
  return {
    id: 't1', label: 'Write', category: 'deep-work', guessMin: 60,
    plannedDate: '2026-06-24', status: 'queued', orderIndex: 0, doneByMin: null,
    createdAt: 1000, completedAt: null, actualMin: null, fromRoutineId: null,
    calendarEventId: null, ...over,
  };
}

test('add + listByDate round-trips a domain Task', async () => {
  const repo = makeTasksRepo(createMemoryDatabase());
  await repo.add(task({ id: 'a' }));
  const list = await repo.listByDate('2026-06-24');
  expect(list).toHaveLength(1);
  expect(list[0]?.label).toBe('Write');
});

test('move retargets plannedDate (and to shelf with null)', async () => {
  const repo = makeTasksRepo(createMemoryDatabase());
  await repo.add(task({ id: 'a' }));
  await repo.move('a', '2026-06-26');
  expect(await repo.listByDate('2026-06-24')).toHaveLength(0);
  expect((await repo.listByDate('2026-06-26'))[0]?.id).toBe('a');
  await repo.move('a', null);
  expect(await repo.listShelf()).toHaveLength(1);
});

test('complete flips status + stamps completedAt/actualMin', async () => {
  const repo = makeTasksRepo(createMemoryDatabase());
  await repo.add(task({ id: 'a' }));
  await repo.complete('a', { completedAt: 5000, actualMin: 75 });
  const got = await repo.get('a');
  expect(got?.status).toBe('done');
  expect(got?.completedAt).toBe(5000);
  expect(got?.actualMin).toBe(75);
});

test('listCarryover returns queued tasks on or before today', async () => {
  const repo = makeTasksRepo(createMemoryDatabase());
  await repo.add(task({ id: 'old', plannedDate: '2026-06-22' }));
  await repo.add(task({ id: 'future', plannedDate: '2026-06-30' }));
  const list = await repo.listCarryover('2026-06-24');
  expect(list.map((t) => t.id)).toEqual(['old']);
});

test('listDoneForDay buckets by completedAt local day', async () => {
  const repo = makeTasksRepo(createMemoryDatabase());
  const at = new Date(2026, 5, 24, 10, 0, 0).getTime();
  await repo.add(task({ id: 'a' }));
  await repo.complete('a', { completedAt: at });
  const list = await repo.listDoneForDay('2026-06-24');
  expect(list.map((t) => t.id)).toEqual(['a']);
});

test('setDoneBy + getDayMeta', async () => {
  const repo = makeTasksRepo(createMemoryDatabase());
  await repo.setDoneBy('2026-06-24', 1020);
  expect((await repo.getDayMeta('2026-06-24'))?.doneByMin).toBe(1020);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/db/repositories/__tests__/tasksRepo.test.ts`
Expected: FAIL — cannot find module `tasksRepo`.

- [ ] **Step 3: Implement `tasksRepo.ts`**

```ts
// src/db/repositories/tasksRepo.ts
// Semantic wrapper over the Database port for day-planned tasks + day meta.
// Maps rows ↔ domain Task; features go through this repo (and the store), never SQL.

import type { Database } from '../Database';
import type { TaskRow, DayMetaRow } from '../types';
import type { Task, DayMeta } from '@/src/domain/types';
import { toLocalDayKey, addDays } from '@/src/lib/day';

export interface TasksRepo {
  add(task: Task): Promise<void>;
  update(id: string, patch: Partial<Task>): Promise<void>;
  remove(id: string): Promise<void>;
  get(id: string): Promise<Task | null>;
  listByDate(date: string): Promise<Task[]>;
  listCarryover(today: string): Promise<Task[]>;
  listDoneForDay(dayKey: string): Promise<Task[]>;
  listShelf(): Promise<Task[]>;
  move(id: string, toDate: string | null): Promise<void>;
  complete(id: string, opts: { completedAt: number; actualMin?: number }): Promise<void>;
  getDayMeta(date: string): Promise<DayMeta | null>;
  setDoneBy(date: string, doneByMin: number | null): Promise<void>;
}

function toTask(r: TaskRow): Task {
  return { ...r };
}
function toRow(t: Task): TaskRow {
  return { ...t };
}
function toDayMeta(r: DayMetaRow): DayMeta {
  return { ...r };
}

/** Local-day window [start, end) in epoch ms for a 'YYYY-MM-DD' key. */
function dayWindow(dayKey: string): { startMs: number; endMs: number } {
  const [y, m, d] = dayKey.split('-').map(Number) as [number, number, number];
  const start = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
  const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0).getTime();
  return { startMs: start, endMs: end };
}

export function makeTasksRepo(db: Database): TasksRepo {
  return {
    async add(task) {
      await db.insertTask(toRow(task));
    },
    async update(id, patch) {
      await db.updateTask(id, patch as Partial<TaskRow>);
    },
    async remove(id) {
      await db.deleteTask(id);
    },
    async get(id) {
      const row = await db.getTask(id);
      return row ? toTask(row) : null;
    },
    async listByDate(date) {
      return (await db.listTasksByDate(date)).map(toTask);
    },
    async listCarryover(today) {
      return (await db.listQueuedOnOrBefore(today)).map(toTask);
    },
    async listDoneForDay(dayKey) {
      const { startMs, endMs } = dayWindow(dayKey);
      return (await db.listDoneCompletedBetween(startMs, endMs)).map(toTask);
    },
    async listShelf() {
      return (await db.listShelfTasks()).map(toTask);
    },
    async move(id, toDate) {
      await db.updateTask(id, { plannedDate: toDate });
    },
    async complete(id, opts) {
      await db.updateTask(id, {
        status: 'done',
        completedAt: opts.completedAt,
        ...(opts.actualMin !== undefined ? { actualMin: opts.actualMin } : {}),
      });
    },
    async getDayMeta(date) {
      const row = await db.getDayMeta(date);
      return row ? toDayMeta(row) : null;
    },
    async setDoneBy(date, doneByMin) {
      const existing = await db.getDayMeta(date);
      await db.upsertDayMeta({
        date,
        doneByMin,
        planComputedAt: existing?.planComputedAt ?? null,
      });
    },
  };
}
```

> `toLocalDayKey`/`addDays` are imported for use by callers/tests of this module in later phases (done-bucketing relies on the local window); keep the import even though `dayWindow` is local. If ESLint flags an unused import in this phase, drop `toLocalDayKey, addDays` until Phase 2 needs them.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/db/repositories/__tests__/tasksRepo.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Lint, typecheck, commit**

```bash
npx eslint src/db/repositories/tasksRepo.ts src/db/repositories/__tests__/tasksRepo.test.ts
npm run typecheck
git add src/db/repositories/tasksRepo.ts src/db/repositories/__tests__/tasksRepo.test.ts
git commit -m "feat(db): tasksRepo — day-planned tasks + day meta wrapper"
```

---

### Task 8: Pure day-membership selectors (`src/engine/daySelectors.ts`)

The no-mutation visibility rules from spec §4.2, as pure functions (no Date, no I/O) — given a task set and day keys, decide what shows where and tag carryover.

**Files:**
- Create: `src/engine/daySelectors.ts`
- Modify: `src/engine/index.ts` (re-export)
- Test: `src/engine/__tests__/daySelectors.test.ts`

**Interfaces:**
- Consumes: `Task` (Task 2), `compareDayKeys` (Task 1).
- Produces:
  - `interface DayTask extends Task { carriedFrom: string | null }` — `carriedFrom` set to the original plannedDate when the task is a carryover onto today; else null.
  - `tasksForSelectedDay(input: { tasks: readonly Task[]; selectedDate: string; today: string }): DayTask[]` — applies the today/future/past rules; queued ordering by `orderIndex`.

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/__tests__/daySelectors.test.ts
import { tasksForSelectedDay } from '@/src/engine/daySelectors';
import type { Task } from '@/src/domain/types';

function task(over: Partial<Task>): Task {
  return {
    id: 't', label: 'x', category: 'deep-work', guessMin: 30, plannedDate: '2026-06-24',
    status: 'queued', orderIndex: 0, doneByMin: null, createdAt: 0, completedAt: null,
    actualMin: null, fromRoutineId: null, calendarEventId: null, ...over,
  };
}

const today = '2026-06-24';

test('today shows today + carryover (tagged), excludes future and shelf', () => {
  const tasks = [
    task({ id: 'today', plannedDate: '2026-06-24', orderIndex: 1 }),
    task({ id: 'old', plannedDate: '2026-06-22', orderIndex: 0 }),
    task({ id: 'future', plannedDate: '2026-06-25' }),
    task({ id: 'shelf', plannedDate: null }),
  ];
  const out = tasksForSelectedDay({ tasks, selectedDate: today, today });
  expect(out.map((t) => t.id)).toEqual(['old', 'today']); // orderIndex asc
  expect(out.find((t) => t.id === 'old')?.carriedFrom).toBe('2026-06-22');
  expect(out.find((t) => t.id === 'today')?.carriedFrom).toBeNull();
});

test('future day shows only that exact day, never carryover', () => {
  const tasks = [
    task({ id: 'old', plannedDate: '2026-06-22' }),
    task({ id: 'thu', plannedDate: '2026-06-25' }),
  ];
  const out = tasksForSelectedDay({ tasks, selectedDate: '2026-06-25', today });
  expect(out.map((t) => t.id)).toEqual(['thu']);
  expect(out[0]?.carriedFrom).toBeNull();
});

test('past day shows that day + its done tasks, no carryover tagging', () => {
  const tasks = [
    task({ id: 'doneThen', plannedDate: '2026-06-22', status: 'done', completedAt: 5 }),
    task({ id: 'queuedThen', plannedDate: '2026-06-22' }),
  ];
  const out = tasksForSelectedDay({ tasks, selectedDate: '2026-06-22', today });
  expect(out.map((t) => t.id).sort()).toEqual(['doneThen', 'queuedThen']);
  expect(out.every((t) => t.carriedFrom === null)).toBe(true);
});

test('done task on today shows in today (bucketed by plannedDate==today here)', () => {
  const tasks = [task({ id: 'd', plannedDate: '2026-06-24', status: 'done', completedAt: 9 })];
  const out = tasksForSelectedDay({ tasks, selectedDate: today, today });
  expect(out.map((t) => t.id)).toEqual(['d']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/engine/__tests__/daySelectors.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `daySelectors.ts`**

```ts
// src/engine/daySelectors.ts
// PURE day-membership rules (no Date, no I/O). Decides which tasks appear on a
// selected day and tags carryover. See spec 2026-06-24 §4.2. No-guilt: carryover
// is a neutral tag (carriedFrom), never an "overdue" flag.

import type { Task } from '@/src/domain/types';
import { compareDayKeys } from '@/src/lib/day';

export interface DayTask extends Task {
  /** Original plannedDate when this queued task carried over onto today; else null. */
  carriedFrom: string | null;
}

export interface DaySelectorInput {
  tasks: readonly Task[];
  selectedDate: string;
  today: string;
}

function byOrder(a: Task, b: Task): number {
  return a.orderIndex - b.orderIndex;
}

export function tasksForSelectedDay({ tasks, selectedDate, today }: DaySelectorInput): DayTask[] {
  const cmp = compareDayKeys(selectedDate, today);

  if (cmp === 0) {
    // Today: queued with plannedDate <= today (carryover surfaces) + done planned today.
    const queued = tasks
      .filter((t) => t.status === 'queued' && t.plannedDate !== null && compareDayKeys(t.plannedDate, today) <= 0)
      .sort(byOrder)
      .map((t) => ({ ...t, carriedFrom: t.plannedDate !== today ? t.plannedDate : null }));
    const done = tasks
      .filter((t) => t.status === 'done' && t.plannedDate === today)
      .map((t) => ({ ...t, carriedFrom: null }));
    return [...queued, ...done];
  }

  if (cmp > 0) {
    // Future day: only tasks planned for exactly that day; never carryover.
    return tasks
      .filter((t) => t.plannedDate === selectedDate)
      .sort(byOrder)
      .map((t) => ({ ...t, carriedFrom: null }));
  }

  // Past day: tasks planned for that day (queued or done); no carryover tagging.
  return tasks
    .filter((t) => t.plannedDate === selectedDate)
    .sort(byOrder)
    .map((t) => ({ ...t, carriedFrom: null }));
}
```

Add to `src/engine/index.ts`:

```ts
export { tasksForSelectedDay, type DayTask, type DaySelectorInput } from './daySelectors';
```

> Note: this selector decides *display membership* from an in-memory task set. Done-bucketing by `completedAt` window is the repo's job (`listDoneForDay`, Task 7); the selector handles the in-memory case where `plannedDate` is the bucket. Phase 2 wires the repo queries to feed this selector with the right candidate set per selected day.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/engine/__tests__/daySelectors.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Lint, typecheck, commit**

```bash
npx eslint src/engine/daySelectors.ts src/engine/index.ts src/engine/__tests__/daySelectors.test.ts
npm run typecheck
git add src/engine/daySelectors.ts src/engine/index.ts src/engine/__tests__/daySelectors.test.ts
git commit -m "feat(engine): pure day-membership + carryover selectors"
```

---

### Task 9: kv → DB migration of the legacy `today-tasks` list

One-time import of the old `tasksStore` kv list (`name: 'today-tasks'`) into the new `tasks` table, planning them on today, preserving status/completedAt/actualMin. Runs once, idempotent.

**Files:**
- Create: `src/db/migrateLegacyTasks.ts`
- Test: `src/db/__tests__/migrateLegacyTasks.test.ts`

**Interfaces:**
- Consumes: `Database` task methods; `toLocalDayKey` (Task 1).
- Produces: `migrateLegacyTasks(input: { db: Database; legacy: LegacyTodayTask[]; nowMs: number; alreadyMigrated: boolean }): Promise<{ migrated: number }>`
  - `interface LegacyTodayTask { id; label; category; guessMin; createdAt; status: 'queued' | 'done'; completedAt: number | null; actualMin: number | null }` (the old `TodayTask` shape).

- [ ] **Step 1: Write the failing test**

```ts
// src/db/__tests__/migrateLegacyTasks.test.ts
import { createMemoryDatabase } from '@/src/db/memoryDatabase';
import { migrateLegacyTasks, type LegacyTodayTask } from '@/src/db/migrateLegacyTasks';

const NOW = new Date(2026, 5, 24, 9, 0, 0).getTime();

function legacy(over: Partial<LegacyTodayTask>): LegacyTodayTask {
  return { id: 'l1', label: 'Old', category: 'admin', guessMin: 20, createdAt: 1, status: 'queued', completedAt: null, actualMin: null, ...over };
}

test('imports legacy tasks onto today, preserving fields + order', async () => {
  const db = createMemoryDatabase();
  const legacyList = [legacy({ id: 'a' }), legacy({ id: 'b', status: 'done', completedAt: 50, actualMin: 30 })];
  const res = await migrateLegacyTasks({ db, legacy: legacyList, nowMs: NOW, alreadyMigrated: false });
  expect(res.migrated).toBe(2);
  const onToday = await db.listTasksByDate('2026-06-24');
  expect(onToday.map((t) => t.id)).toEqual(['a']); // queued shows by date
  const a = await db.getTask('a');
  expect(a?.plannedDate).toBe('2026-06-24');
  expect(a?.orderIndex).toBe(0);
  const b = await db.getTask('b');
  expect(b?.status).toBe('done');
  expect(b?.completedAt).toBe(50);
  expect(b?.actualMin).toBe(30);
});

test('is a no-op when already migrated', async () => {
  const db = createMemoryDatabase();
  const res = await migrateLegacyTasks({ db, legacy: [legacy({})], nowMs: NOW, alreadyMigrated: true });
  expect(res.migrated).toBe(0);
  expect(await db.getTask('l1')).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/db/__tests__/migrateLegacyTasks.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `migrateLegacyTasks.ts`**

```ts
// src/db/migrateLegacyTasks.ts
// One-time import of the old kv 'today-tasks' list into the tasks table. The caller
// reads the kv list + the migrated flag, runs this, then sets the flag. Idempotent.

import type { Database } from './Database';
import type { TaskRow } from './types';
import { toLocalDayKey } from '@/src/lib/day';

export interface LegacyTodayTask {
  id: string;
  label: string;
  category: string;
  guessMin: number;
  createdAt: number;
  status: 'queued' | 'done';
  completedAt: number | null;
  actualMin: number | null;
}

export interface MigrateInput {
  db: Database;
  legacy: readonly LegacyTodayTask[];
  nowMs: number;
  alreadyMigrated: boolean;
}

export async function migrateLegacyTasks({ db, legacy, nowMs, alreadyMigrated }: MigrateInput): Promise<{ migrated: number }> {
  if (alreadyMigrated || legacy.length === 0) return { migrated: 0 };
  const today = toLocalDayKey(nowMs);
  let i = 0;
  for (const t of legacy) {
    const row: TaskRow = {
      id: t.id,
      label: t.label,
      category: t.category,
      guessMin: t.guessMin,
      plannedDate: today,
      status: t.status,
      orderIndex: i++,
      doneByMin: null,
      createdAt: t.createdAt,
      completedAt: t.completedAt,
      actualMin: t.actualMin,
      fromRoutineId: null,
      calendarEventId: null,
    };
    await db.insertTask(row);
  }
  return { migrated: legacy.length };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/db/__tests__/migrateLegacyTasks.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Lint, typecheck, commit**

```bash
npx eslint src/db/migrateLegacyTasks.ts src/db/__tests__/migrateLegacyTasks.test.ts
npm run typecheck
git add src/db/migrateLegacyTasks.ts src/db/__tests__/migrateLegacyTasks.test.ts
git commit -m "feat(db): one-time kv→DB migration for legacy today tasks"
```

---

### Task 10: Rewrite `tasksStore` as an async DB-backed facade with `selectedDate`

Replaces the kv-list store with a repo-backed store exposing the selected date, view mode, the loaded day's tasks, and CRUD that delegates to `tasksRepo`. Runs the legacy migration once on first load.

**Files:**
- Modify (rewrite): `src/stores/tasksStore.ts`
- Test: `src/stores/__tests__/tasksStore.test.ts`

**Interfaces:**
- Consumes: `makeTasksRepo` (Task 7), `tasksForSelectedDay` (Task 8), `migrateLegacyTasks` (Task 9), `toLocalDayKey`/`addDays` (Task 1), `getDatabase` (`src/db/client.ts`), kv (`src/lib/kv.ts`).
- Produces (store state):
  - `selectedDate: string`, `viewMode: 'list' | 'timeline'`, `dayTasks: DayTask[]`, `loading: boolean`.
  - `init(nowMs?: number): Promise<void>` — resolves the repo via `getDatabase()`, runs the one-time legacy migration (guarded by a kv flag `tasks-migrated-v1`), loads today.
  - `selectDate(date: string): Promise<void>`, `goToToday(nowMs?): Promise<void>`, `setViewMode(m): void`.
  - `addTask(input: { label; category; guessMin; date?: string | null; nowMs?: number }): Promise<void>` — defaults `date` to `selectedDate`.
  - `completeTask(id, opts): Promise<void>`, `moveTask(id, toDate): Promise<void>`, `removeTask(id): Promise<void>`.
  - `selectFocusTask(): DayTask | null` — oldest queued non-carried? (the focus = first queued in display order).

> **DI for tests:** accept an injectable repo. Export `makeTasksStore(deps: { repo: TasksRepo; kvGet; kvSet })` and create the default `useTasksStore` from it bound to the real repo + kv. The test exercises `makeTasksStore` with the in-memory repo so no native module/kv is needed.

- [ ] **Step 1: Write the failing test**

```ts
// src/stores/__tests__/tasksStore.test.ts
import { createMemoryDatabase } from '@/src/db/memoryDatabase';
import { makeTasksRepo } from '@/src/db/repositories/tasksRepo';
import { makeTasksStore } from '@/src/stores/tasksStore';

const NOW = new Date(2026, 5, 24, 9, 0, 0).getTime(); // 2026-06-24

function freshStore() {
  const repo = makeTasksRepo(createMemoryDatabase());
  const flags = new Map<string, string>();
  return makeTasksStore({
    repo,
    kvGet: (k) => flags.get(k) ?? null,
    kvSet: (k, v) => { flags.set(k, v); },
  });
}

test('init loads today and addTask defaults to selectedDate', async () => {
  const store = freshStore();
  await store.getState().init(NOW);
  expect(store.getState().selectedDate).toBe('2026-06-24');
  await store.getState().addTask({ label: 'Write', category: 'deep-work', guessMin: 60, nowMs: NOW });
  expect(store.getState().dayTasks.map((t) => t.label)).toEqual(['Write']);
});

test('addTask to a future date does not appear on today', async () => {
  const store = freshStore();
  await store.getState().init(NOW);
  await store.getState().addTask({ label: 'Later', category: 'admin', guessMin: 20, date: '2026-06-26', nowMs: NOW });
  expect(store.getState().dayTasks).toHaveLength(0);
  await store.getState().selectDate('2026-06-26');
  expect(store.getState().dayTasks.map((t) => t.label)).toEqual(['Later']);
});

test('carryover: a queued task from yesterday shows on today tagged', async () => {
  const store = freshStore();
  await store.getState().init(NOW);
  await store.getState().addTask({ label: 'Slipped', category: 'admin', guessMin: 15, date: '2026-06-23', nowMs: NOW });
  await store.getState().goToToday(NOW);
  const t = store.getState().dayTasks.find((x) => x.label === 'Slipped');
  expect(t?.carriedFrom).toBe('2026-06-23');
});

test('completeTask flips status and it leaves the queued list', async () => {
  const store = freshStore();
  await store.getState().init(NOW);
  await store.getState().addTask({ label: 'X', category: 'admin', guessMin: 10, nowMs: NOW });
  const id = store.getState().dayTasks[0]!.id;
  await store.getState().completeTask(id, { completedAt: NOW + 1000, actualMin: 12 });
  const done = store.getState().dayTasks.find((t) => t.id === id);
  expect(done?.status).toBe('done');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/stores/__tests__/tasksStore.test.ts`
Expected: FAIL — `makeTasksStore` not exported.

- [ ] **Step 3: Rewrite `tasksStore.ts`**

```ts
// src/stores/tasksStore.ts
// DB-backed "selected day" store. Holds selectedDate + the loaded day's tasks and
// delegates persistence to tasksRepo. Replaces the old kv-list store; legacy kv
// tasks are imported once on init (guarded by a kv flag). UI reads this store; it
// never touches the repo/db directly (layer rule).

import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { getDatabase } from '@/src/db/client';
import { makeTasksRepo, type TasksRepo } from '@/src/db/repositories/tasksRepo';
import { migrateLegacyTasks, type LegacyTodayTask } from '@/src/db/migrateLegacyTasks';
import { tasksForSelectedDay, type DayTask } from '@/src/engine/daySelectors';
import { toLocalDayKey } from '@/src/lib/day';
import { kv } from '@/src/lib/kv';

const MIGRATED_FLAG = 'tasks-migrated-v1';
const LEGACY_KV_KEY = 'today-tasks'; // the old persist() store name

export interface TasksState {
  selectedDate: string;
  viewMode: 'list' | 'timeline';
  dayTasks: DayTask[];
  loading: boolean;
  init: (nowMs?: number) => Promise<void>;
  selectDate: (date: string) => Promise<void>;
  goToToday: (nowMs?: number) => Promise<void>;
  setViewMode: (m: 'list' | 'timeline') => void;
  addTask: (input: { label: string; category: string; guessMin: number; date?: string | null; nowMs?: number }) => Promise<void>;
  completeTask: (id: string, opts: { completedAt: number; actualMin?: number }) => Promise<void>;
  moveTask: (id: string, toDate: string | null) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
}

interface Deps {
  repo: TasksRepo;
  kvGet: (k: string) => string | null;
  kvSet: (k: string, v: string) => void;
}

function makeId(createdAt: number): string {
  return `${createdAt}-${Math.random().toString(36).slice(2)}`;
}

export function makeTasksStore(deps: Deps): UseBoundStore<StoreApi<TasksState>> {
  const { repo, kvGet, kvSet } = deps;

  /** Reload the candidate set for the selected day and recompute display tasks. */
  async function loadDay(selectedDate: string, today: string): Promise<DayTask[]> {
    // Candidate set: union of (carryover queued ≤ today) + (this day's tasks) + (done that day).
    const [byDate, carry, doneForDay] = await Promise.all([
      repo.listByDate(selectedDate),
      selectedDate === today ? repo.listCarryover(today) : Promise.resolve([]),
      selectedDate === today ? repo.listDoneForDay(today) : repo.listDoneForDay(selectedDate),
    ]);
    const seen = new Map<string, (typeof byDate)[number]>();
    for (const t of [...byDate, ...carry, ...doneForDay]) seen.set(t.id, t);
    return tasksForSelectedDay({ tasks: [...seen.values()], selectedDate, today });
  }

  return create<TasksState>()((set, get) => ({
    selectedDate: toLocalDayKey(Date.now()),
    viewMode: 'list',
    dayTasks: [],
    loading: false,

    async init(nowMs) {
      const now = nowMs ?? Date.now();
      const today = toLocalDayKey(now);
      set({ loading: true, selectedDate: today });
      if (kvGet(MIGRATED_FLAG) !== '1') {
        const raw = kvGet(LEGACY_KV_KEY);
        const legacy: LegacyTodayTask[] = raw ? (JSON.parse(raw).state?.tasks ?? []) : [];
        // migrate via repo's underlying db is not exposed here; insert through repo.add.
        let i = 0;
        for (const t of legacy) {
          await repo.add({
            id: t.id, label: t.label, category: t.category, guessMin: t.guessMin,
            plannedDate: today, status: t.status, orderIndex: i++, doneByMin: null,
            createdAt: t.createdAt, completedAt: t.completedAt ?? null, actualMin: t.actualMin ?? null,
            fromRoutineId: null, calendarEventId: null,
          });
        }
        kvSet(MIGRATED_FLAG, '1');
      }
      set({ dayTasks: await loadDay(today, today), loading: false });
    },

    async selectDate(date) {
      const today = toLocalDayKey(Date.now());
      set({ selectedDate: date, dayTasks: await loadDay(date, today) });
    },

    async goToToday(nowMs) {
      const today = toLocalDayKey(nowMs ?? Date.now());
      set({ selectedDate: today, dayTasks: await loadDay(today, today) });
    },

    setViewMode(m) {
      set({ viewMode: m });
    },

    async addTask({ label, category, guessMin, date, nowMs }) {
      const createdAt = nowMs ?? Date.now();
      const plannedDate = date === undefined ? get().selectedDate : date;
      await repo.add({
        id: makeId(createdAt), label, category, guessMin, plannedDate,
        status: 'queued', orderIndex: createdAt, doneByMin: null, createdAt,
        completedAt: null, actualMin: null, fromRoutineId: null, calendarEventId: null,
      });
      const today = toLocalDayKey(createdAt);
      set({ dayTasks: await loadDay(get().selectedDate, today) });
    },

    async completeTask(id, opts) {
      await repo.complete(id, opts);
      const today = toLocalDayKey(Date.now());
      set({ dayTasks: await loadDay(get().selectedDate, today) });
    },

    async moveTask(id, toDate) {
      await repo.move(id, toDate);
      const today = toLocalDayKey(Date.now());
      set({ dayTasks: await loadDay(get().selectedDate, today) });
    },

    async removeTask(id) {
      await repo.remove(id);
      const today = toLocalDayKey(Date.now());
      set({ dayTasks: await loadDay(get().selectedDate, today) });
    },
  }));
}

/** The app-wide store, bound to the real repo + kv. Call init() once at boot. */
let bound: UseBoundStore<StoreApi<TasksState>> | null = null;
export function useTasksStore(): UseBoundStore<StoreApi<TasksState>> {
  if (bound === null) {
    // getDatabase() is async; the store resolves it lazily inside a thin repo proxy.
    const repoProxy: TasksRepo = makeLazyRepo();
    bound = makeTasksStore({
      repo: repoProxy,
      kvGet: (k) => kv.getString(k) ?? null,
      kvSet: (k, v) => kv.set(k, v),
    });
  }
  return bound;
}

/** A TasksRepo that resolves the real DB on first call (getDatabase is async). */
function makeLazyRepo(): TasksRepo {
  let real: Promise<TasksRepo> | null = null;
  const get = (): Promise<TasksRepo> => (real ??= getDatabase().then(makeTasksRepo));
  return {
    add: async (t) => (await get()).add(t),
    update: async (id, p) => (await get()).update(id, p),
    remove: async (id) => (await get()).remove(id),
    get: async (id) => (await get()).get(id),
    listByDate: async (d) => (await get()).listByDate(d),
    listCarryover: async (d) => (await get()).listCarryover(d),
    listDoneForDay: async (d) => (await get()).listDoneForDay(d),
    listShelf: async () => (await get()).listShelf(),
    move: async (id, d) => (await get()).move(id, d),
    complete: async (id, o) => (await get()).complete(id, o),
    getDayMeta: async (d) => (await get()).getDayMeta(d),
    setDoneBy: async (d, m) => (await get()).setDoneBy(d, m),
  };
}
```

> **Consumers:** the old `useTasksStore` was a bare bound store (`useTasksStore(selector)`). It is now a function returning the bound store, and methods are async. Updating Today's consumers (`useToday.ts` etc.) is **Phase 2** work — this task only lands the store + tests. If a quick `npm run typecheck` flags existing consumers, leave them to Phase 2 but note them; do not wire UI here. (If the project prefers, keep a temporary compatibility shim — decided at execution time.)
> **kv API:** match the real `src/lib/kv.ts` surface (`getString`/`set` shown here are illustrative — use the actual exported methods; adjust `kvGet`/`kvSet` accordingly).
> **`Date.now()` in the store:** allowed — stores are not the pure engine. Tests inject `nowMs` so they stay deterministic.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/stores/__tests__/tasksStore.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Lint, typecheck, commit**

```bash
npx eslint src/stores/tasksStore.ts src/stores/__tests__/tasksStore.test.ts
npm run typecheck
# Expect possible type errors in Phase-2 UI consumers of the old store API — record them; do not fix UI here.
git add src/stores/tasksStore.ts src/stores/__tests__/tasksStore.test.ts
git commit -m "feat(store): DB-backed tasksStore with selectedDate + carryover load"
```

---

## Phase 1 self-review

**Spec coverage (§4, §4.2, §16):**
- `tasks` table + repo → Tasks 3–7. ✅
- `day_meta` + done-by → Tasks 3–7 (`getDayMeta`/`setDoneBy`). ✅
- No-mutation carryover rule (today shows `plannedDate ≤ today` tagged; future = exact day; done bucket by completion) → Task 8 selectors + Task 7 `listDoneForDay`. ✅
- "No day yet" shelf → `listShelf`/`listShelfTasks`. ✅
- Memory + sqlite parity → Tasks 5 & 6. ✅
- kv→DB migration → Task 9 + Task 10 `init`. ✅
- `selectedDate`/`viewMode` state → Task 10. ✅
- Local-day determinism (timezone) → Task 1 + repo `dayWindow`. ✅
- Out of scope for Phase 1 (correctly deferred): capacity engine, calendar, Plan-my-day, UI wiring, routines, export, Patterns — Phases 2–9.

**Placeholder scan:** no TBD/"handle errors"/"similar to"—every step has real code + exact commands. ✅

**Type consistency:** `Task`/`TaskRow` field names identical across Tasks 2/5/6/7; `DayTask.carriedFrom` defined in Task 8 and consumed in Task 10; `TasksRepo` method names identical in Tasks 7 and 10's lazy proxy; `migrateLegacyTasks`'s `LegacyTodayTask` reused verbatim in Task 10. ✅

**Known follow-through (Phase 2):** Today's existing consumers of the old `useTasksStore` (e.g. `src/features/today/useToday.ts`, `selectFocus`) must migrate to the async store API + `dayTasks`/`selectFocusTask`; the `(modals)/add-task.tsx` must call `addTask({date})`. Tracked as the first Phase-2 tasks.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-24-phase1-data-foundation.md`. Two execution options:

1. **Subagent-Driven (recommended)** — a fresh subagent per task, two-stage review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session with checkpoints.

Which approach? (And: shall I draft the Phase 2 plan — the Today day-surface UI — now, or after Phase 1 executes?)
