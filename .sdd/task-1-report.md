# Task 1 Report — Persist `startLocalMinute` on TaskEvent

## Status
DONE

## Commit
`6340599` — feat(events): persist startLocalMinute for focus-window learning

## Test summary
- New test: `src/db/__tests__/taskEvents.startLocalMinute.test.ts` — 1/1 pass
- Full suite: 970/970 pass (171 test suites)
- Typecheck: clean (0 errors)
- Lint: clean (0 warnings)

## Files changed

### `src/domain/types.ts`
Added `startLocalMinute: number | null` to the `TaskEvent` interface after `reclaimDividendMin`, with the required JSDoc comment explaining it is captured at log time and never recomputed.

### `src/db/types.ts`
Added `startLocalMinute: number | null` to `TaskEventRow` — the DB DTO boundary type.

### `src/db/migrations.ts`
Appended migration step 0009 (index 8):
```sql
ALTER TABLE task_events ADD COLUMN start_local_minute INTEGER;
```
Follows the existing additive pattern (ALTER TABLE, nullable, no default required since NULL is appropriate for legacy rows).

### `src/db/sqliteDatabase.ts`
- Added `start_local_minute: number | null` to `TaskEventDbRow` (SQL shape interface)
- Updated `mapTaskEvent()` to carry `startLocalMinute: r.start_local_minute ?? null`
- Updated `insertTaskEvent()` to include `start_local_minute` in the INSERT column list and bind `row.startLocalMinute`

### `src/stores/calibrationStore.ts`
- Added `startedAt?: number | null` to `ApplyLogParams` interface (the timer stop passes this so the local minute can be derived)
- In the `applyLog` event-insert path, changed `startedAt: null` to `startedAt: input.startedAt ?? null` and added the `startLocalMinute` computation:
  ```ts
  startLocalMinute:
    input.startedAt != null
      ? new Date(input.startedAt).getHours() * 60 + new Date(input.startedAt).getMinutes()
      : null,
  ```
  This matches the formula specified in the brief exactly.

### Test files updated (added `startLocalMinute: null` to `makeEvent`/`seedEvent`/inline helpers)
- `src/db/__tests__/memoryDatabase.test.ts`
- `src/db/__tests__/reasonRead.test.ts`
- `src/db/__tests__/repositories.test.ts`
- `src/db/__tests__/wipeAll.test.ts`
- `src/db/queries/__tests__/frequentTasks.test.ts`
- `src/db/repositories/__tests__/taskEventsRepo.frequent.test.ts`
- `src/domain/__tests__/types.test.ts`
- `src/features/category-detail/__tests__/categoryDetailScreen.test.tsx`
- `src/features/category-detail/__tests__/useCategoryDetail.test.ts`
- `src/features/quick-tasks/__tests__/useQuickTasks.test.ts`
- `src/stores/__tests__/calibrationStore.test.ts`
- `src/stores/__tests__/calibrationStore.reasons.test.ts`
- `src/stores/__tests__/calibrationStore.context.test.ts`
- `src/stores/__tests__/calibrationStore.confidence.test.ts`

## TDD note
The test was written before the types were changed. It passed at runtime (JS dynamic dispatch stored the extra field in the memory Map), but `npx tsc --noEmit` reported TS2339 (`startLocalMinute` does not exist on `TaskEventRow`) and TS2820 (the brief used `source: 'timer'` — corrected to `'timed'` to match `LogSource`). The implementation then made both the runtime test and typecheck green.

## Migration approach
Followed the existing additive pattern: a single `ALTER TABLE` appended as the last entry (index 8 = step 0009). No default value needed since `NULL` is the correct semantic for pre-existing rows (no trustworthy start time for retroactively logged events).

## Notable
- `createMemoryDatabase` required no changes beyond the new field being present on `TaskEventRow` — it stores and returns whatever row shape is passed via `{ ...row }`.
- `useTimer.ts` was NOT modified in this task. The `startedAt` plumbing from the timer to `applyLog` is prepared (`ApplyLogParams.startedAt` added), but `useTimer.ts` does not yet pass it. That wire-up belongs in a subsequent task once the caller is ready.
