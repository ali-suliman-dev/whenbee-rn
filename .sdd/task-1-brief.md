# Task 1 — Persist `startLocalMinute` on TaskEvent

**Context:** First task of the "learned focus window" feature. The focus engine (built in later tasks) needs the local time-of-day at which each task STARTED. Recomputing it from `createdAt` epoch is wrong (travel/DST/retroactive logs corrupt it), so we persist it at log time. This task only adds + plumbs the field.

## Global constraints (bind every task)
- TypeScript strict (`noUncheckedIndexedAccess` on — indexed access is `T | undefined`, handle it; no `!` unless provably safe).
- Layer rule: `src/app/**` and `src/components/**` never import `src/services/*` or `src/db/*` directly.
- Tokens only for any UI (n/a this task).
- Conventional Commits; **NEVER** add AI/co-author attribution (no `Co-Authored-By`, no "Generated with", no robot emoji).
- Use `npx expo install` for Expo deps (n/a this task).

## Files
- Modify: `src/domain/types.ts` (the `TaskEvent` interface, around lines 125–138)
- Modify: `src/db/types.ts` (the `TaskEventRow` interface)
- Modify: the SQLite schema/migration + the row↔domain mappers + the log/insert path that builds a `TaskEvent` (find these under `src/db/` — follow the existing migration pattern)
- Test: `src/db/__tests__/taskEvents.startLocalMinute.test.ts`

## Produces (later tasks rely on these exact names)
- `TaskEvent.startLocalMinute: number | null`
- persisted DB column `startLocalMinute` (INTEGER, nullable), carried through both `createMemoryDatabase` and `createSqliteDatabase`.

## TDD steps

### Step 1 — write the failing test
`src/db/__tests__/taskEvents.startLocalMinute.test.ts`:
```ts
import { createMemoryDatabase } from '@/src/db/memory/createMemoryDatabase';

test('persists startLocalMinute on a task event round-trip', async () => {
  const db = createMemoryDatabase();
  await db.insertTaskEvent({
    id: 'e1', category: 'admin', label: null, estimateMin: 30, actualMin: 25,
    status: 'completed', source: 'timer', startedAt: 1, endedAt: 2, createdAt: 3,
    suggestedHonestMin: null, reclaimDividendMin: 0, startLocalMinute: 615, // 10:15
  });
  const rows = await db.listRecentEvents(10);
  expect(rows[0]!.startLocalMinute).toBe(615);
});
```
**Note:** confirm the exact import path of `createMemoryDatabase` and the exact `TaskEventRow` field set from `src/db/`; adjust the literal to match the real row shape (keep `startLocalMinute: 615`). If `insertTaskEvent`/`listRecentEvents` differ, use the real methods on the `Database` interface.

### Step 2 — run it, verify it FAILS
`npx jest src/db/__tests__/taskEvents.startLocalMinute.test.ts`
Expected: FAIL (field unknown / not persisted).

### Step 3 — implement
- `src/domain/types.ts`, add to `TaskEvent` after `reclaimDividendMin`:
```ts
  /** Local minute-of-day (0–1439) at the moment work STARTED, captured at log
   *  time. null = no trustworthy start time (retroactive/backfilled) → excluded
   *  from focus-window learning. Never recomputed from createdAt, never trained. */
  startLocalMinute: number | null;
```
- `src/db/types.ts`: add the same `startLocalMinute: number | null` to `TaskEventRow`.
- SQLite: add column `startLocalMinute INTEGER` to the events table schema, with a migration that ALTERs existing tables to add it defaulting `NULL` (mirror the newest existing migration step — find the schema/migration module under `src/db/` and follow its exact pattern + bump version if the codebase versions migrations).
- Mappers: carry `startLocalMinute` in both row→domain and domain→row (default `null` when missing). Ensure `createMemoryDatabase` stores/returns it too.
- Log/insert path: where the event is constructed (timer stop / log apply, where `startedAt` is known), set:
```ts
startLocalMinute:
  startedAt != null ? new Date(startedAt).getHours() * 60 + new Date(startedAt).getMinutes() : null,
```

### Step 4 — run tests
`npx jest src/db/__tests__/taskEvents.startLocalMinute.test.ts` → PASS
`npx jest src/db` → existing event tests still pass.
`npx tsc --noEmit` (or `npm run typecheck`) → clean.

### Step 5 — lint + commit (plain git — do NOT use any init-cmt / interactive commit tool)
```bash
npx eslint src/domain/types.ts src/db --max-warnings=0
git add src/domain/types.ts src/db
git commit -m "feat(events): persist startLocalMinute for focus-window learning"
```
