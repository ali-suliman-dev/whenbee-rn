# Category delete + "Manage this area" card — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user delete a category (area) from the category detail screen, beside a redesigned Reset, both guarded by the app's `ConfirmSheet`.

**Architecture:** Add a real per-category `category_stats` delete down the db → repo → store stack (mirroring the existing per-category events delete). A new `calibrationStore.deleteCategory` wipes stats + logs + goal; `categoriesStore.removeCategory` drops the tracked entry. The detail screen replaces its inline reset pill with a grouped "Manage this area" card whose two rows each open `ConfirmSheet` (caution for reset, danger for delete).

**Tech Stack:** TypeScript (strict), Zustand stores, expo-sqlite + in-memory Database adapters, React Native / expo-router, Jest + @testing-library/react-native.

## Global Constraints

- **Tokens only** — every color/size/spacing from `src/theme/tokens.ts` via `useTheme()`; never inline a raw hex or number. Add a token if one is missing.
- **Delete is the only red** — `t.colors.danger` / `t.colors.dangerEdge`. Reset never uses red.
- **Last-area guard** — Delete is unavailable when `useCategoriesStore.getState().categories.length <= 1`. `removeCategory` already refuses to remove the last entry; the UI must also hide the Delete row.
- **Honey/sharpness monotonic** — deleting an area must not lower the global companion tier. No guilt/shame copy anywhere.
- **On-device only** — all local db/KV; no network.
- **DB column names** — `task_events` uses column `category`; `category_stats` uses column `category_id`. Param name in TS is `categoryId` everywhere.
- **Commits** — Conventional Commits, no AI/co-author attribution. After each task run `npx eslint <files>`, `npm run typecheck`, and the affected `npx jest <path>`.

---

### Task 1: `deleteCategoryStat` on the Database port + both adapters

**Files:**
- Modify: `src/db/Database.ts` (interface)
- Modify: `src/db/sqliteDatabase.ts` (impl near `deleteEventsByCategory`, ~line 320)
- Modify: `src/db/memoryDatabase.ts` (impl near `deleteEventsByCategory`, ~line 49)
- Test: `src/db/__tests__/deleteCategoryStat.test.ts` (create)

**Interfaces:**
- Produces: `Database.deleteCategoryStat(categoryId: string): Promise<void>` — deletes the single `category_stats` row for a category (no-op if absent).

- [ ] **Step 1: Write the failing test**

Create `src/db/__tests__/deleteCategoryStat.test.ts`:

```ts
import { createMemoryDatabase } from '@/src/db';
import { priorFor } from '@/src/engine';

function seedStat(categoryId: string) {
  return {
    categoryId, n: 4, logEwma: 0.5, mEffective: 2.1, sharpness: 40,
    priorMult: priorFor(categoryId), adaptSpeed: 'balanced' as const, updatedAt: 1,
    reclaimedMinutes: 0, firstHonestRange: null,
    sw: 0, swx: 0, swy: 0, swxx: 0, swxy: 0,
  };
}

describe('Database.deleteCategoryStat', () => {
  it('removes the row so getCategoryStat returns null', async () => {
    const db = createMemoryDatabase();
    await db.upsertCategoryStat(seedStat('cleaning'));
    expect(await db.getCategoryStat('cleaning')).not.toBeNull();

    await db.deleteCategoryStat('cleaning');

    expect(await db.getCategoryStat('cleaning')).toBeNull();
  });

  it('is a no-op when the row is absent', async () => {
    const db = createMemoryDatabase();
    await expect(db.deleteCategoryStat('ghost')).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/db/__tests__/deleteCategoryStat.test.ts`
Expected: FAIL — `db.deleteCategoryStat is not a function`.

- [ ] **Step 3: Add the interface method**

In `src/db/Database.ts`, directly below the `deleteEventsByCategory` line (after line 17):

```ts
  /** Delete the single category_stats row for a category (no-op if absent). */
  deleteCategoryStat(categoryId: string): Promise<void>;
```

- [ ] **Step 4: Implement in the sqlite adapter**

In `src/db/sqliteDatabase.ts`, directly after the `deleteEventsByCategory` method (~line 322):

```ts
    async deleteCategoryStat(categoryId: string): Promise<void> {
      await db.runAsync('DELETE FROM category_stats WHERE category_id = ?', categoryId);
    },
```

- [ ] **Step 5: Implement in the memory adapter**

In `src/db/memoryDatabase.ts`, directly after the `deleteEventsByCategory` method (~line 53):

```ts
    async deleteCategoryStat(categoryId: string): Promise<void> {
      categoryStats.delete(categoryId);
    },
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx jest src/db/__tests__/deleteCategoryStat.test.ts`
Expected: PASS (both cases).

- [ ] **Step 7: Typecheck + commit**

```bash
npm run typecheck
git add src/db/Database.ts src/db/sqliteDatabase.ts src/db/memoryDatabase.ts src/db/__tests__/deleteCategoryStat.test.ts
git commit -m "feat: add deleteCategoryStat to the Database port and adapters"
```

---

### Task 2: `deleteStat` on `CategoryStatsRepo`

**Files:**
- Modify: `src/db/repositories/categoryStatsRepo.ts`
- Test: `src/db/repositories/__tests__/categoryStatsRepo.test.ts` (append)

**Interfaces:**
- Consumes: `Database.deleteCategoryStat` (Task 1).
- Produces: `CategoryStatsRepo.deleteStat(categoryId: string): Promise<void>`.

- [ ] **Step 1: Write the failing test**

Append to `src/db/repositories/__tests__/categoryStatsRepo.test.ts`:

```ts
describe('CategoryStatsRepo.deleteStat', () => {
  it('deletes the row so the raw db row is gone (repo.get falls back to the seed)', async () => {
    const db = createMemoryDatabase();
    const repo = makeCategoryStatsRepo(db);
    await repo.upsert({
      categoryId: 'cleaning', n: 3, logEwma: 0.4, mEffective: 2.0, sharpness: 30,
      priorMult: priorFor('cleaning'), adaptSpeed: 'balanced', updatedAt: 1,
      reclaimedMinutes: 0, firstHonestRange: null,
      sw: 0, swx: 0, swy: 0, swxx: 0, swxy: 0,
    });

    await repo.deleteStat('cleaning');

    // raw row gone
    expect(await db.getCategoryStat('cleaning')).toBeNull();
    // repo.get re-seeds a fresh n=0 row (never throws)
    expect((await repo.get('cleaning')).n).toBe(0);
  });
});
```

Confirm the top of the file already imports `createMemoryDatabase`, `makeCategoryStatsRepo`, and `priorFor`; add any missing import (e.g. `import { priorFor } from '@/src/engine';`).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/db/repositories/__tests__/categoryStatsRepo.test.ts`
Expected: FAIL — `repo.deleteStat is not a function`.

- [ ] **Step 3: Extend the repo interface + impl**

In `src/db/repositories/categoryStatsRepo.ts`, add to the `CategoryStatsRepo` interface (after `upsert`):

```ts
  deleteStat(categoryId: string): Promise<void>;
```

And in `makeCategoryStatsRepo`'s returned object (after `upsert`):

```ts
    async deleteStat(categoryId: string): Promise<void> {
      await db.deleteCategoryStat(categoryId);
    },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/db/repositories/__tests__/categoryStatsRepo.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run typecheck
git add src/db/repositories/categoryStatsRepo.ts src/db/repositories/__tests__/categoryStatsRepo.test.ts
git commit -m "feat: add deleteStat to categoryStatsRepo"
```

---

### Task 3: `calibrationStore.deleteCategory`

**Files:**
- Modify: `src/stores/calibrationStore.ts` (interface ~line 463; impl near `resetCategory` ~line 1294)
- Test: `src/stores/__tests__/calibrationStore.test.ts` (append a describe block)

**Interfaces:**
- Consumes: `makeCategoryStatsRepo(db).deleteStat` (Task 2), existing `makeTaskEventsRepo(db).deleteByCategory`, existing `get().clearGoal`.
- Produces: `CalibrationState.deleteCategory(categoryId: string): Promise<void>` — deletes the category's events + stats row + goal, and removes its `statsByCategory` cache key. Does NOT touch the tracked list (that is `categoriesStore.removeCategory`).

- [ ] **Step 1: Write the failing test**

Append to `src/stores/__tests__/calibrationStore.test.ts` (reuse the file's existing `freshDb`, `seedEvent`, `T0`, `priorFor`, `makeCategoryStatsRepo`):

```ts
describe('calibrationStore — deleteCategory', () => {
  it('removes the stat row, events, cache key, and goal', async () => {
    const db = freshDb();

    await db.upsertCategoryStat({
      categoryId: 'cleaning', n: 5, logEwma: 0.7, mEffective: 2.4, sharpness: 60,
      priorMult: priorFor('cleaning'), adaptSpeed: 'balanced', updatedAt: T0,
      reclaimedMinutes: 0,
      sw: 0, swx: 0, swy: 0, swxx: 0, swxy: 0,
    });
    await db.insertTaskEvent(seedEvent({ id: 'd1', createdAt: T0 }));
    useCalibrationStore.setState({
      statsByCategory: {
        cleaning: { mEffective: 2.4, n: 5, sharpness: 60, tier: 'Ripening', fit: { a: 0, b: 2.4 } },
      },
    });
    useCalibrationStore.getState().setGoal('cleaning', 20);
    expect(useCalibrationStore.getState().getGoal('cleaning')).not.toBeNull();

    await useCalibrationStore.getState().deleteCategory('cleaning');

    // raw stat row gone (distinct from reset, which upserts an n=0 row)
    expect(await db.getCategoryStat('cleaning')).toBeNull();
    // events gone
    expect(await db.listEventsByCategory('cleaning', 30)).toHaveLength(0);
    // cache key removed
    expect(useCalibrationStore.getState().statsByCategory.cleaning).toBeUndefined();
    // goal cleared
    expect(useCalibrationStore.getState().getGoal('cleaning')).toBeNull();
  });
});
```

> If `setGoal`/`getGoal` are not the exact public action names, open `src/stores/__tests__/calibrationStore.goals.test.ts`, copy the real goal set/read calls it uses, and substitute them here. Keep the four assertions unchanged.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/stores/__tests__/calibrationStore.test.ts -t deleteCategory`
Expected: FAIL — `deleteCategory is not a function`.

- [ ] **Step 3: Add the interface signature**

In `src/stores/calibrationStore.ts`, directly below the `resetCategory` signature (line 463):

```ts
  /** Delete a category outright: its events, stats row, goal, and cache entry. */
  deleteCategory: (categoryId: string) => Promise<void>;
```

- [ ] **Step 4: Implement the action**

In `src/stores/calibrationStore.ts`, directly after the `resetCategory` implementation closes (~line 1294), add:

```ts
  deleteCategory: async (categoryId) => {
    const db = await resolveDb(get, set);
    const categoryStatsRepo = makeCategoryStatsRepo(db);
    const taskEventsRepo = makeTaskEventsRepo(db);

    await taskEventsRepo.deleteByCategory(categoryId);
    await categoryStatsRepo.deleteStat(categoryId);

    set((state) => {
      const next = { ...state.statsByCategory };
      delete next[categoryId];
      return { statsByCategory: next };
    });

    get().clearGoal(categoryId);
  },
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/stores/__tests__/calibrationStore.test.ts -t deleteCategory`
Expected: PASS (all four assertions).

- [ ] **Step 6: Commit**

```bash
npm run typecheck
git add src/stores/calibrationStore.ts src/stores/__tests__/calibrationStore.test.ts
git commit -m "feat: add deleteCategory action to the calibration store"
```

---

### Task 4: `useCategoryDetail` — `canDelete` + `deleteCategory`

**Files:**
- Modify: `src/features/category-detail/useCategoryDetail.ts`
- Test: `src/features/category-detail/__tests__/useCategoryDetail.test.ts` (append a describe block)

**Interfaces:**
- Consumes: `useCalibrationStore(s => s.deleteCategory)` (Task 3), `useCategoriesStore(s => s.removeCategory)`, `useCategoriesStore(s => s.categories)`.
- Produces (added to the hook's return object):
  - `canDelete: boolean` — `categories.length > 1`.
  - `deleteCategory: () => Promise<void>` — awaits `deleteCategoryAction(categoryId)` then calls `removeCategory(categoryId)`. Does NOT navigate (the screen owns navigation).

- [ ] **Step 1: Write the failing test**

Append to `src/features/category-detail/__tests__/useCategoryDetail.test.ts` (the file already imports `renderHook`, `waitFor`, `act`, both stores, `createMemoryDatabase`):

```ts
describe('useCategoryDetail — delete', () => {
  it('canDelete is false with one category, true with more', async () => {
    const db = createMemoryDatabase();
    useCalibrationStore.getState().setDatabase(db);
    useCategoriesStore.getState().setCategories([
      { id: 'cleaning', name: 'Cleaning', adaptSpeed: 'balanced' },
    ]);
    const one = renderHook(() => useCategoryDetail('cleaning'));
    await waitFor(() => expect(one.result.current.loading).toBe(false));
    expect(one.result.current.canDelete).toBe(false);

    useCategoriesStore.getState().setCategories([
      { id: 'cleaning', name: 'Cleaning', adaptSpeed: 'balanced' },
      { id: 'admin', name: 'Admin', adaptSpeed: 'balanced' },
    ]);
    const two = renderHook(() => useCategoryDetail('cleaning'));
    await waitFor(() => expect(two.result.current.loading).toBe(false));
    expect(two.result.current.canDelete).toBe(true);
  });

  it('deleteCategory drops the entry from the tracked list and wipes its stats', async () => {
    const db = createMemoryDatabase();
    useCalibrationStore.getState().setDatabase(db);
    useCategoriesStore.getState().setCategories([
      { id: 'cleaning', name: 'Cleaning', adaptSpeed: 'balanced' },
      { id: 'admin', name: 'Admin', adaptSpeed: 'balanced' },
    ]);
    await db.upsertCategoryStat({
      categoryId: 'cleaning', n: 3, logEwma: 0.4, mEffective: 2.0, sharpness: 30,
      priorMult: 1, adaptSpeed: 'balanced', updatedAt: 1, reclaimedMinutes: 0,
      sw: 0, swx: 0, swy: 0, swxx: 0, swxy: 0,
    });

    const { result } = renderHook(() => useCategoryDetail('cleaning'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.deleteCategory(); });

    expect(useCategoriesStore.getState().categories.map((c) => c.id)).not.toContain('cleaning');
    expect(await db.getCategoryStat('cleaning')).toBeNull();
  });
});
```

Ensure the file's imports include `useCalibrationStore` and `useCategoriesStore` (the head shown in research already imports both).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/category-detail/__tests__/useCategoryDetail.test.ts -t delete`
Expected: FAIL — `canDelete`/`deleteCategory` are `undefined`.

- [ ] **Step 3: Wire the store bindings + expose the API**

In `src/features/category-detail/useCategoryDetail.ts`, next to the existing store selectors (~lines 37-42), add:

```ts
  const deleteCategoryAction = useCalibrationStore((s) => s.deleteCategory);
  const removeCategory = useCategoriesStore((s) => s.removeCategory);
  const categories = useCategoriesStore((s) => s.categories);
```

Add a memoized handler near `resetCategory` (~line 116):

```ts
  const deleteCategory = useCallback(async () => {
    await deleteCategoryAction(categoryId);
    removeCategory(categoryId);
  }, [categoryId, deleteCategoryAction, removeCategory]);

  const canDelete = categories.length > 1;
```

Add `deleteCategory` and `canDelete` to the returned object (~line 121-132) and to the `UseCategoryDetailResult` type (~lines 17-34):

```ts
  // in UseCategoryDetailResult:
  deleteCategory: () => Promise<void>;
  canDelete: boolean;
```

If `useCategoriesStore` is not yet imported in this file, add `import { useCategoriesStore } from '@/src/stores/categoriesStore';`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/features/category-detail/__tests__/useCategoryDetail.test.ts`
Expected: PASS (whole file, no regressions).

- [ ] **Step 5: Commit**

```bash
npm run typecheck
git add src/features/category-detail/useCategoryDetail.ts src/features/category-detail/__tests__/useCategoryDetail.test.ts
git commit -m "feat: expose canDelete and deleteCategory from useCategoryDetail"
```

---

### Task 5: `ConfirmSheet` — optional `cancelLabel` prop

**Files:**
- Modify: `src/components/ConfirmSheet.tsx`
- Test: `src/components/__tests__/ConfirmSheet.test.tsx` (create if absent; otherwise append)

**Interfaces:**
- Produces: `ConfirmSheetProps.cancelLabel?: string` (default `'Cancel'`). Keeps every existing caller unchanged (Settings Danger Zone still shows "Cancel").

- [ ] **Step 1: Write the failing test**

Create/append `src/components/__tests__/ConfirmSheet.test.tsx`:

```tsx
import { render } from '@testing-library/react-native';
import { ConfirmSheet } from '@/src/components/ConfirmSheet';

const base = {
  visible: true, tone: 'danger' as const, glyphKind: 'erase' as const,
  title: 'Delete Cooking?', bullets: ['Removes this area.'],
  confirmLabel: 'Delete area', onConfirm: () => {}, onCancel: () => {},
};

describe('ConfirmSheet cancelLabel', () => {
  it('defaults the cancel button to "Cancel"', () => {
    const { getByText } = render(<ConfirmSheet {...base} />);
    expect(getByText('Cancel')).toBeTruthy();
  });
  it('uses a custom cancelLabel when provided', () => {
    const { getByText } = render(<ConfirmSheet {...base} cancelLabel="Keep it" />);
    expect(getByText('Keep it')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/__tests__/ConfirmSheet.test.tsx`
Expected: FAIL on the custom-label case ("Keep it" not found).

- [ ] **Step 3: Add the prop**

In `src/components/ConfirmSheet.tsx`, add to `ConfirmSheetProps` (after `confirmLabel`):

```ts
  /** Cancel button label. Defaults to 'Cancel'. */
  cancelLabel?: string;
```

Destructure it with a default in the component signature, e.g. `cancelLabel = 'Cancel'`, and change the Cancel button (line 125) to:

```tsx
            <AppButton label={cancelLabel} onPress={onCancel} variant="ghost" fullWidth />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/__tests__/ConfirmSheet.test.tsx`
Expected: PASS (both cases).

- [ ] **Step 5: Commit**

```bash
npm run typecheck
git add src/components/ConfirmSheet.tsx src/components/__tests__/ConfirmSheet.test.tsx
git commit -m "feat: add optional cancelLabel prop to ConfirmSheet"
```

---

### Task 6: `ManageAreaCard` component

**Files:**
- Create: `src/features/category-detail/ManageAreaCard.tsx`
- Test: `src/features/category-detail/__tests__/ManageAreaCard.test.tsx` (create)

**Interfaces:**
- Consumes: `ConfirmSheet` (Task 5), `useTheme`, `Ionicons`.
- Produces: `ManageAreaCard` props:
  ```ts
  interface ManageAreaCardProps {
    categoryName: string;      // e.g. "Cooking" — interpolated into confirm titles
    canDelete: boolean;        // false → Delete row hidden
    onConfirmReset: () => void;  // called when the reset ConfirmSheet is confirmed
    onConfirmDelete: () => void; // called when the delete ConfirmSheet is confirmed
  }
  ```
  Internally owns `confirm: 'reset' | 'delete' | null` state; renders the grouped card + a single `ConfirmSheet`.

- [ ] **Step 1: Write the failing test**

Create `src/features/category-detail/__tests__/ManageAreaCard.test.tsx`:

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { ManageAreaCard } from '@/src/features/category-detail/ManageAreaCard';

const base = {
  categoryName: 'Cooking',
  onConfirmReset: jest.fn(),
  onConfirmDelete: jest.fn(),
};

describe('ManageAreaCard', () => {
  it('hides the Delete row when canDelete is false', () => {
    const { queryByText, getByText } = render(<ManageAreaCard {...base} canDelete={false} />);
    expect(getByText('Reset learning')).toBeTruthy();
    expect(queryByText('Delete area')).toBeNull();
  });

  it('shows the Delete row when canDelete is true', () => {
    const { getByText } = render(<ManageAreaCard {...base} canDelete />);
    expect(getByText('Delete area')).toBeTruthy();
  });

  it('opens the delete confirm and fires onConfirmDelete', () => {
    const onConfirmDelete = jest.fn();
    const { getByText } = render(
      <ManageAreaCard {...base} canDelete onConfirmDelete={onConfirmDelete} />,
    );
    fireEvent.press(getByText('Delete area'));       // opens ConfirmSheet
    fireEvent.press(getByText('Delete area'));        // confirm button (same label)
    expect(onConfirmDelete).toHaveBeenCalledTimes(1);
  });
});
```

> Note: the Delete row title and the confirm button share the label "Delete area". If that makes the third test ambiguous, give the confirm button a distinct testID or query by role; simplest is to press the row via its `accessibilityLabel="Delete area"` and the confirm via `getByText('Delete area')` inside the sheet. Keep the assertion (`onConfirmDelete` called once).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/category-detail/__tests__/ManageAreaCard.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

Create `src/features/category-detail/ManageAreaCard.tsx`:

```tsx
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { ConfirmSheet } from '@/src/components/ConfirmSheet';

interface ManageAreaCardProps {
  categoryName: string;
  canDelete: boolean;
  onConfirmReset: () => void;
  onConfirmDelete: () => void;
}

export function ManageAreaCard({
  categoryName, canDelete, onConfirmReset, onConfirmDelete,
}: ManageAreaCardProps) {
  const t = useTheme();
  const s = styles(t);
  const [confirm, setConfirm] = useState<'reset' | 'delete' | null>(null);

  return (
    <View style={s.card}>
      <Text style={s.header}>Manage this area</Text>

      <Pressable
        style={s.row}
        accessibilityRole="button"
        accessibilityLabel="Reset learning"
        onPress={() => setConfirm('reset')}
      >
        <Ionicons name="refresh-outline" size={t.iconSize.sm} color={t.colors.inkSoft} />
        <View style={s.rowText}>
          <Text style={s.rowTitle}>Reset learning</Text>
          <Text style={s.rowSub}>Clears the guess history, keeps your honey</Text>
        </View>
        <Ionicons name="chevron-forward" size={t.iconSize.sm} color={t.colors.inkFaint} />
      </Pressable>

      {canDelete && (
        <Pressable
          style={[s.row, s.rowDivider]}
          accessibilityRole="button"
          accessibilityLabel="Delete area"
          onPress={() => setConfirm('delete')}
        >
          <Ionicons name="trash-outline" size={t.iconSize.sm} color={t.colors.danger} />
          <View style={s.rowText}>
            <Text style={[s.rowTitle, { color: t.colors.danger }]}>Delete area</Text>
            <Text style={s.rowSub}>Removes this area and its data</Text>
          </View>
          <Ionicons name="chevron-forward" size={t.iconSize.sm} color={t.colors.inkFaint} />
        </Pressable>
      )}

      <ConfirmSheet
        visible={confirm === 'reset'}
        tone="caution"
        glyphKind="progress"
        title={`Reset ${categoryName}'s learning?`}
        bullets={[
          'Whenbee starts over learning this area.',
          'Your honey and tier stay — only the guess history resets.',
        ]}
        confirmLabel="Reset"
        cancelLabel="Keep it"
        onConfirm={() => { setConfirm(null); onConfirmReset(); }}
        onCancel={() => setConfirm(null)}
      />

      <ConfirmSheet
        visible={confirm === 'delete'}
        tone="danger"
        glyphKind="erase"
        title={`Delete ${categoryName}?`}
        bullets={[
          'Removes this area along with its logs, learning, and goal.',
          "This can't be undone.",
        ]}
        confirmLabel="Delete area"
        cancelLabel="Keep it"
        onConfirm={() => { setConfirm(null); onConfirmDelete(); }}
        onCancel={() => setConfirm(null)}
      />
    </View>
  );
}

function styles(t: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    card: {
      backgroundColor: t.colors.surface,
      borderRadius: t.radii.card,
      borderCurve: 'continuous',
      overflow: 'hidden',
      marginTop: t.space[5],
    } as ViewStyle,
    header: {
      ...(type.caption as TextStyle),
      color: t.colors.inkFaint,
      letterSpacing: t.letterSpacing.wide,
      textTransform: 'uppercase',
      paddingHorizontal: t.space[4],
      paddingTop: t.space[4],
      paddingBottom: t.space[2],
    } as TextStyle,
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.space[3],
      minHeight: t.size.control.md,
      paddingHorizontal: t.space[4],
      paddingVertical: t.space[3],
    } as ViewStyle,
    rowDivider: { borderTopWidth: 1, borderTopColor: t.colors.hairline } as ViewStyle,
    rowText: { flex: 1 } as ViewStyle,
    rowTitle: { ...(type.body as TextStyle), color: t.colors.ink } as TextStyle,
    rowSub: { ...(type.caption as TextStyle), color: t.colors.inkFaint, marginTop: t.space[0.5] } as TextStyle,
  });
}
```

> If `type` has no `caption`/`body` member with those exact names, open `src/theme/typography.ts` and use the nearest existing roles (the reset styles in `category/[category].tsx` use `type.bodySm`). Match whatever roles that screen already uses; do not inline raw font sizes.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/features/category-detail/__tests__/ManageAreaCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Lint + commit**

```bash
npx eslint src/features/category-detail/ManageAreaCard.tsx
npm run typecheck
git add src/features/category-detail/ManageAreaCard.tsx src/features/category-detail/__tests__/ManageAreaCard.test.tsx
git commit -m "feat: add ManageAreaCard with reset + delete confirm rows"
```

---

### Task 7: Wire `ManageAreaCard` into the category detail screen

**Files:**
- Modify: `src/app/category/[category].tsx` (replace the `resetBlock` at lines 166-202; remove the `confirming` state at line 57 and the reset styles at lines 301-349)
- Test: `src/features/category-detail/__tests__/categoryDetailScreen.test.tsx` (update)

**Interfaces:**
- Consumes: `ManageAreaCard` (Task 6), `useCategoryDetail().deleteCategory` + `.canDelete` (Task 4).

- [ ] **Step 1: Update the screen test first**

In `src/features/category-detail/__tests__/categoryDetailScreen.test.tsx`, add a test that the Delete row appears when more than one category is tracked and that confirming it navigates back. Model the store/db setup on the existing tests in that file. Minimal shape:

```tsx
it('deletes the area and navigates back', async () => {
  // ...existing render setup with two tracked categories + a memory db...
  const { getByLabelText, getByText } = renderScreen('cleaning');
  fireEvent.press(getByLabelText('Delete area'));   // open ConfirmSheet
  fireEvent.press(getByText('Delete area'));          // confirm
  await waitFor(() => expect(routerBackMock).toHaveBeenCalled());
});
```

Reuse the file's existing router mock; if none, add `jest.mock('expo-router', () => ({ ...jest.requireActual('expo-router'), router: { back: jest.fn(), /* keep useLocalSearchParams */ } }))` consistent with how the file already mocks routing.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/category-detail/__tests__/categoryDetailScreen.test.tsx`
Expected: FAIL — no "Delete area" element yet.

- [ ] **Step 3: Replace the reset block with the card**

In `src/app/category/[category].tsx`:

Pull the new values from the hook (where `resetCategory` is destructured):

```ts
  const { detail, /* ...existing... */ resetCategory, deleteCategory, canDelete } = useCategoryDetail(categoryId);
```

Replace `handleReset` (lines 71-75) so it no longer touches the removed `confirming` state, and add `handleDelete`:

```ts
  async function handleReset() {
    await resetCategory();
    showToast('Learning reset — your honey stays');
  }

  async function handleDelete() {
    await deleteCategory();
    router.back();
  }
```

Replace the entire `resetBlock` JSX (lines 166-202) with:

```tsx
      <ManageAreaCard
        categoryName={detail.categoryName}
        canDelete={canDelete}
        onConfirmReset={handleReset}
        onConfirmDelete={handleDelete}
      />
```

Delete the now-unused `const [confirming, setConfirming] = useState(false);` (line 57) and the reset-only styles `resetBlock`, `resetLink`, `resetLinkText`, `resetConfirmCopy`, `resetActions`, `resetCancel`, `resetCancelText`, `resetConfirm`, `resetConfirmText` (lines 301-349). Add the import:

```ts
import { ManageAreaCard } from '@/src/features/category-detail/ManageAreaCard';
```

> Confirm the detail object exposes `categoryName` (research shows the screen reads the resolved name off `detail.categoryName`). If the field name differs, pass the value the screen already renders as the title.

- [ ] **Step 4: Run the screen test to verify it passes**

Run: `npx jest src/features/category-detail/__tests__/categoryDetailScreen.test.tsx`
Expected: PASS.

- [ ] **Step 5: Lint the touched files**

Run: `npx eslint src/app/category/[category].tsx src/features/category-detail/ManageAreaCard.tsx`
Expected: 0 errors. Remove any now-unused imports (`Ionicons`, `Pressable`) if the screen no longer uses them.

- [ ] **Step 6: Full gate + commit**

```bash
npm run typecheck && npm run lint && npm test
git add src/app/category/[category].tsx src/features/category-detail/__tests__/categoryDetailScreen.test.tsx
git commit -m "feat: replace inline reset with the Manage this area card"
```

---

### Task 8: Manual device/sim verification + monotonic-honey check

**Files:** none (verification only).

- [ ] **Step 1: Verify the honey invariant in code**

Read how the global companion tier is derived (search `companionRepo` / `tier` in `src/stores/calibrationStore.ts`). Confirm the tier is not recomputed downward from `statsByCategory` after a delete. If it is, add a regression test asserting the companion tier before a delete equals the tier after. If tier is stored independently (companion table), note that no code path lowers it — the invariant holds by construction.

- [ ] **Step 2: Run on the simulator**

Launch (`npm run ios`), open the Whenbee tab, tap an area to open its detail screen, scroll to "Manage this area". Confirm:
- With ≥2 tracked areas: both Reset and Delete rows show.
- Delete → ConfirmSheet (danger/red, "Delete Cooking?", "Keep it" / "Delete area"). Confirm → returns to the tab, the area is gone.
- Reset → ConfirmSheet (caution, "Reset Cooking's learning?"). Confirm → stays on screen, toast shows.
- Reduce to a single tracked area (delete others): the Delete row disappears; Reset stays.

Deep-link shortcut to the detail screen: `xcrun simctl openurl booted "whenbee:///category/cleaning"` then `xcrun simctl io booted screenshot`.

- [ ] **Step 3: Screenshot-verify spacing/alignment**

Element-screenshot the Manage card. Check row alignment, the danger red only on Delete, hairline divider between rows, and that the card reads as one grouped unit. Fix any misalignment before calling it done.

---

## Notes for the implementer

- **Do not** re-add per-path start/reset guards or an inline confirm — both actions go through `ConfirmSheet`.
- Deleting an area intentionally shows **no toast** (the screen unmounts on `router.back()`; a toast on an unmounting screen never renders). The area vanishing from the tab is the feedback.
- `categoriesStore.removeCategory` already refuses to remove the last entry; the `canDelete` guard means the Delete row is never shown in that case, so the two layers agree.
- Reset's confirm button is **amber** (caution tone in `ConfirmSheet`), not indigo — this is the app's established destructive-confirm styling and was accepted when choosing `ConfirmSheet` over a bespoke dialog.
