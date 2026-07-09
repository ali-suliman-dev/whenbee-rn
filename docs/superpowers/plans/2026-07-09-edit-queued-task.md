# Edit a Queued Task — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user edit a *queued* task's name, category, guess, and scheduled day by long-pressing its row → **Edit** → the reused Add-Task drawer in edit mode.

**Architecture:** Add a thin `updateTask`/`getTaskById` pair to `dayTasksStore` (both wrap the existing `tasksRepo.update`/`.get`). Teach `useAddTask` + the Add-Task screen an `editId` mode (prefill, retitle, Save / Save & start). Add **Edit** to the existing long-press `ActionSheet` in `index.tsx`, gated off the running task. Teach the list a one-time long-press coach and retire the now-redundant queued-row swipe peek.

**Tech Stack:** React Native (Expo SDK 54), expo-router 6, Zustand, `expo-sqlite` via `tasksRepo`, Jest + `@testing-library/react-native`, Reanimated.

Design source: `docs/superpowers/specs/2026-07-09-edit-queued-task-design.md`.

## Global Constraints

- **Tap-to-start is untouched** — `startRow` stays the row's `onPress`. Long-press is the only manage affordance.
- **Queued-only.** Never edit a `completed` row; the engine trains solely on `status: 'completed'`, so a queued edit cannot move a multiplier. Done rows expose no Edit.
- **No calibration mutation** from this feature. `updateTask` only patches a non-completed row's editable columns.
- **Every color/size/spacing value is a token** from `src/theme/tokens.ts` via `useTheme()` — no raw hex/number.
- **Modal rule:** Add-Task is an existing `formSheet` with `headerShown:false`; do not add a native header or per-screen `paddingHorizontal`.
- **Animation rule:** coach pill fades via opacity only (`t.motion.base`) — no slide, no bounce; reduced-motion → final state.
- **Copy (verbatim):** menu item `Edit`; drawer header `Edit task`; primary CTA `Save`; secondary CTA `Save & start`; save toast `Saved`; edit-mode day chip prefix `Scheduled for`; coach pill `Press & hold for options`.
- **Commits:** Conventional Commits, no AI/co-author trailer. Never create a branch or merge without the founder's explicit yes.

---

### Task 1: `updateTask` + `getTaskById` on `dayTasksStore`

**Files:**
- Modify: `src/stores/dayTasksStore.ts` (interface `DayTasksState` ~line 60–160; factory `makeDayTasksStore` ~line 188+, beside `moveTask`/`removeTask` ~line 360–400)
- Test: `src/stores/__tests__/dayTasksStore.test.ts`

**Interfaces:**
- Consumes: existing `repo.update(id, patch: Partial<Task>)`, `repo.get(id): Promise<Task|null>`, `loadDayAndDots`, `refreshShelf`.
- Produces:
  - `updateTask(id: string, patch: { label?: string; category?: string; guessMin?: number; plannedDate?: string | null }, nowMs?: number): Promise<void>`
  - `getTaskById(id: string): Promise<Task | null>`

- [ ] **Step 1: Write the failing test**

Add to `src/stores/__tests__/dayTasksStore.test.ts`:

```ts
test('updateTask patches an editable queued task and reload reflects it', async () => {
  const { store } = freshStore();
  await store.getState().init(NOW);
  const task = await store.getState().addTask({ label: 'Draf', category: 'admin', guessMin: 20, nowMs: NOW });

  await store.getState().updateTask(
    task.id,
    { label: 'Draft outline', category: 'deep-work', guessMin: 45 },
    NOW,
  );

  const row = store.getState().dayTasks.find((t) => t.id === task.id);
  expect(row?.label).toBe('Draft outline');
  expect(row?.category).toBe('deep-work');
  expect(row?.guessMin).toBe(45);
  expect(row?.status).toBe('queued'); // never flipped to completed
});

test('getTaskById returns the stored task or null', async () => {
  const { store } = freshStore();
  await store.getState().init(NOW);
  const task = await store.getState().addTask({ label: 'Gym', category: 'health', guessMin: 60, nowMs: NOW });
  expect((await store.getState().getTaskById(task.id))?.label).toBe('Gym');
  expect(await store.getState().getTaskById('nope')).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/stores/__tests__/dayTasksStore.test.ts -t updateTask`
Expected: FAIL — `updateTask is not a function`.

- [ ] **Step 3: Add the two methods to the interface**

In `DayTasksState` (near `removeTask`), add:

```ts
  /**
   * Patch an editable QUEUED task (label/category/guess/day). Never touches a
   * completed row's actual — the engine trains only on completed rows, so this
   * cannot move a multiplier. Reloads the day + shelf so the UI reflects it.
   */
  updateTask: (
    id: string,
    patch: { label?: string; category?: string; guessMin?: number; plannedDate?: string | null },
    nowMs?: number,
  ) => Promise<void>;
  /** Read a single task by id (edit-drawer prefill). Null when absent. */
  getTaskById: (id: string) => Promise<Task | null>;
```

- [ ] **Step 4: Implement in the factory**

In `makeDayTasksStore`, beside `moveTask`:

```ts
    async updateTask(id, patch, nowMs) {
      await repo.update(id, patch);
      const today = toLocalDayKey(nowMs ?? Date.now());
      await Promise.all([
        loadDayAndDots(get().selectedDate, today).then((d) => set(d)),
        refreshShelf(),
      ]);
    },

    async getTaskById(id) {
      return repo.get(id);
    },
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest src/stores/__tests__/dayTasksStore.test.ts`
Expected: PASS (all, including the two new).

- [ ] **Step 6: Commit**

```bash
git add src/stores/dayTasksStore.ts src/stores/__tests__/dayTasksStore.test.ts
git commit -m "feat(today): add updateTask + getTaskById to the day store"
```

---

### Task 2: `useAddTask` edit branch (prefill + save)

**Files:**
- Modify: `src/features/add-task/useAddTask.ts`
- Test: covered at the screen level in Task 3 (this task ships the logic the screen renders).

**Interfaces:**
- Consumes: `useDayTasksStore.getState().getTaskById` + `.updateTask` (Task 1); existing `suggestion`, `router`, `bank`.
- Produces, added to `UseAddTaskResult`:
  - `isEditing: boolean`
  - `loadedDate: string | null | undefined` — the edited task's `plannedDate` once loaded (`undefined` = not loaded yet; `null` = shelf).
  - `save: (date?: string | null) => Promise<boolean>` — patches the task, returns true on success (screen shows toast, dismisses).
  - `saveAndStart: (date?: string | null) => Promise<void>` — patches then routes to the timer.

- [ ] **Step 1: Add the `editId` param + edit state**

Change the signature and add state near the other `useState`s:

```ts
export function useAddTask(initialTitle?: string, editId?: string): UseAddTaskResult {
  // ...existing hooks...
  const updateTask = useDayTasksStore((s) => s.updateTask);
  const [isEditing] = useState(() => typeof editId === 'string' && editId.length > 0);
  const [loadedDate, setLoadedDate] = useState<string | null | undefined>(undefined);
```

- [ ] **Step 2: Prefill once from the stored task (skip auto-guess/seed)**

Add after the spoken-title seed effect:

```ts
  // Edit mode: hydrate the fields from the stored task exactly once. Sets manualRef
  // so the title-driven category auto-guess never overwrites the stored category.
  const editSeededRef = useRef(false);
  useEffect(() => {
    if (!isEditing || !editId || editSeededRef.current) return;
    editSeededRef.current = true;
    void useDayTasksStore.getState().getTaskById(editId).then((task) => {
      if (!task) return;
      manualRef.current = true;
      setTitleState(task.label);
      setGuessedCategory(null);
      setCategoryState(task.category);
      setGuessMin(task.guessMin);
      setLoadedDate(task.plannedDate);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot; ref guards re-entry
  }, [isEditing, editId]);
```

- [ ] **Step 3: Add `save` / `saveAndStart`**

```ts
  const save = async (date?: string | null): Promise<boolean> => {
    if (!isEditing || !editId || !canSubmit || category === null) return false;
    const resolvedDate = date === undefined ? loadedDate ?? null : date;
    await updateTask(editId, { label: title.trim(), category, guessMin, plannedDate: resolvedDate });
    bank(title.trim(), category);
    return true;
  };

  const saveAndStart = async (date?: string | null): Promise<void> => {
    const ok = await save(date);
    if (!ok || editId === undefined || suggestion === null) return;
    router.replace({
      pathname: '/(modals)/timer',
      params: {
        taskId: editId,
        label: title.trim(),
        category: category as string,
        estimateMin: String(suggestion.honestMinutes),
        guessMin: String(guessMin),
        suggestedHonestMin: String(suggestion.honestMinutes),
      },
    });
  };
```

- [ ] **Step 4: Expose the new fields in the return object**

Add `isEditing, loadedDate, save, saveAndStart` to the returned object and to the `UseAddTaskResult` interface (mirror the existing JSDoc style).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in `useAddTask.ts` (screen still passes only `spokenTitle`; that's fine — `editId` is optional until Task 3).

- [ ] **Step 6: Commit**

```bash
git add src/features/add-task/useAddTask.ts
git commit -m "feat(add-task): editId prefill + save/saveAndStart in useAddTask"
```

---

### Task 3: Add-Task screen — edit mode (copy, CTA, day chip)

**Files:**
- Modify: `src/app/(modals)/add-task.tsx`
- Test: `src/features/add-task/__tests__/addTaskScreen.test.tsx`

**Interfaces:**
- Consumes: `useAddTask(spokenTitle, editId)` → `isEditing`, `loadedDate`, `save`, `saveAndStart` (Task 2).

- [ ] **Step 1: Write the failing test**

Add to `addTaskScreen.test.tsx` (the file already mocks `expo-router` + `useDayTasksStore`). Add a second `describe` that overrides `useLocalSearchParams` to return an `editId` and stubs `getTaskById`/`updateTask`:

```ts
// At top-level, make useLocalSearchParams configurable per test:
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { replace: (...a: unknown[]) => mockReplace(...a), back: (...a: unknown[]) => mockBack(...a) },
  useLocalSearchParams: () => mockParams,
}));

describe('edit mode', () => {
  const editing: Task = {
    id: 'edit-1', label: 'Reply to Marcus', category: 'admin', guessMin: 30,
    plannedDate: '2026-06-24', status: 'queued', orderIndex: 1, doneByMin: null,
    createdAt: 1, completedAt: null, actualMin: null, fromRoutineId: null, calendarEventId: null,
  };
  const updateSpy = jest.fn(async () => {});

  beforeEach(() => {
    mockParams = { editId: 'edit-1' };
    useDayTasksStore.setState({
      getTaskById: jest.fn(async () => editing),
      updateTask: updateSpy,
    } as unknown as Parameters<typeof useDayTasksStore.setState>[0]);
    updateSpy.mockClear();
  });
  afterEach(() => { mockParams = {}; });

  test('renders Edit-task chrome and prefilled title', async () => {
    render(<AddTask />);
    expect(await screen.findByText('Edit task')).toBeTruthy();
    expect(screen.getByText('Save')).toBeTruthy();
    expect(screen.getByDisplayValue('Reply to Marcus')).toBeTruthy();
  });

  test('Save patches via updateTask', async () => {
    render(<AddTask />);
    await screen.findByText('Edit task');
    await act(async () => { fireEvent.press(screen.getByText('Save')); });
    expect(updateSpy).toHaveBeenCalledWith(
      'edit-1',
      expect.objectContaining({ label: 'Reply to Marcus', category: 'admin', guessMin: 30 }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest addTaskScreen -t "edit mode"`
Expected: FAIL — no "Edit task" text / `Save` absent.

- [ ] **Step 3: Read `editId` and pass it to the hook**

Near the top of the component:

```ts
  const { title: spokenTitle, editId } = useLocalSearchParams<{ title?: string; editId?: string }>();
  const a = useAddTask(spokenTitle, editId);
```

- [ ] **Step 4: Sync `targetDate` from the loaded task in edit mode**

After the existing `targetDate` state:

```ts
  // Edit mode: adopt the task's stored day once it loads (undefined = still loading).
  useEffect(() => {
    if (a.isEditing && a.loadedDate !== undefined) setTargetDate(a.loadedDate);
  }, [a.isEditing, a.loadedDate]);
```

- [ ] **Step 5: Swap the heading, sub, and day-chip prefix**

Where the heading renders:

```tsx
    <Text style={heading}>{a.isEditing ? 'Edit task' : 'New task'}</Text>
    <Text style={sub}>{a.isEditing ? 'Adjust the details.' : 'What are you working on?'}</Text>
```

For the "Adding to X" row, change the label prefix in edit mode:

```tsx
      <Text style={targetLabel} accessibilityLabel={`${a.isEditing ? 'Scheduled for' : 'Adding to'} ${targetDayLabel(targetDate, today)}`}>
        {`${a.isEditing ? 'Scheduled for' : 'Adding to'} ${targetDayLabel(targetDate, today)}`}
      </Text>
```

- [ ] **Step 6: Add a Save handler and swap the footer CTAs**

Add beside `handleAddToToday`:

```ts
  async function handleSave() {
    const ok = await a.save(targetDate);
    if (!ok) return;
    setToastVisible(true);
    dismissTimer.current = setTimeout(() => router.back(), toastDismissMs);
  }
```

Replace the footer buttons with a mode-aware pair (one primary indigo CTA per screen):

```tsx
        <View style={footerStyle}>
          {a.isEditing ? (
            <>
              <AppButton label="Save" variant="indigo" fullWidth disabled={!a.canSubmit} onPress={handleSave} />
              <AppButton label="Save & start" variant="ghost" fullWidth disabled={!a.canSubmit} onPress={() => void a.saveAndStart(targetDate)} />
            </>
          ) : (
            <>
              <AppButton label="Add & start timer" variant="indigo" fullWidth disabled={!a.canSubmit} onPress={() => a.onAddAndStart(targetDate)} />
              <AppButton label={addCtaLabel} variant="ghost" fullWidth disabled={!a.canSubmit} onPress={handleAddToToday} />
            </>
          )}
        </View>
```

- [ ] **Step 7: Make the save toast say "Saved" in edit mode**

In the `<Toast message=…>` prop, wrap the existing expression:

```tsx
        message={a.isEditing ? 'Saved' : (targetDate === null ? 'Saved to shelf' : targetDate === today ? 'Added to today' : `Added to ${targetDayLabel(targetDate, today)}`)}
```

- [ ] **Step 8: Run tests + lint**

Run: `npx jest addTaskScreen`
Expected: PASS (existing add tests + the new edit-mode tests).
Run: `npx eslint src/app/(modals)/add-task.tsx src/features/add-task/useAddTask.ts`
Expected: clean.

- [ ] **Step 9: Commit**

```bash
git add "src/app/(modals)/add-task.tsx" src/features/add-task/__tests__/addTaskScreen.test.tsx
git commit -m "feat(add-task): edit mode — Edit task header, Save / Save & start, Scheduled-for chip"
```

---

### Task 4: Add **Edit** to the row action menu (gated off the running task)

**Files:**
- Create: `src/features/today/canEditRow.ts`
- Test: `src/features/today/__tests__/canEditRow.test.ts`
- Modify: `src/app/(tabs)/index.tsx` (the `rowActions` `ActionSheet`, ~line 544; imports ~line 28)

**Interfaces:**
- Produces: `canEditRow(isTimerRunning: boolean, runningTaskId: string | null, rowId: string): boolean` — false only when that exact row is the live timer.
- Consumes: `useTimerStore((s) => s.taskId)`; navigates `router.push({ pathname: '/(modals)/add-task', params: { editId } })`.

- [ ] **Step 1: Write the failing test**

`src/features/today/__tests__/canEditRow.test.ts`:

```ts
import { canEditRow } from '@/src/features/today/canEditRow';

test('editable when no timer is running', () => {
  expect(canEditRow(false, null, 'a')).toBe(true);
});
test('editable when a DIFFERENT task is running', () => {
  expect(canEditRow(true, 'other', 'a')).toBe(true);
});
test('not editable when THIS task is the running timer', () => {
  expect(canEditRow(true, 'a', 'a')).toBe(false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest canEditRow`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helper**

`src/features/today/canEditRow.ts`:

```ts
// A queued row is editable unless it is the task whose timer is currently running
// (editing a live session's guess is ambiguous — Move/Remove stay available).
export function canEditRow(
  isTimerRunning: boolean,
  runningTaskId: string | null,
  rowId: string,
): boolean {
  return !(isTimerRunning && runningTaskId === rowId);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest canEditRow`
Expected: PASS.

- [ ] **Step 5: Wire Edit into the menu**

In `src/app/(tabs)/index.tsx`, add imports:

```ts
import { canEditRow } from '@/src/features/today/canEditRow';
```

Add the running-task id near `isTimerRunning` (~line 107):

```ts
  const runningTaskId = useTimerStore((s) => s.taskId);
```

Add a navigator beside `navigateToTimer`:

```ts
  function editRow(id: string) {
    haptics.light();
    router.push({ pathname: '/(modals)/add-task', params: { editId: id } });
  }
```

In the `rowActions` `ActionSheet` `items`, prepend Edit when allowed:

```tsx
        items={
          rowActions
            ? [
                ...(canEditRow(isTimerRunning, runningTaskId, rowActions.id)
                  ? [{ label: 'Edit', onPress: () => editRow(rowActions.id) }]
                  : []),
                { label: 'Move to tomorrow', onPress: () => void useDayTasksStore.getState().moveToTomorrow(rowActions.id) },
                { label: 'Pick a day…', onPress: () => showDayPicker(rowActions.id) },
                { label: 'Remove', destructive: true, onPress: () => setDeletingId(rowActions.id) },
              ]
            : []
        }
```

- [ ] **Step 6: Lint + typecheck + test**

Run: `npx eslint "src/app/(tabs)/index.tsx" src/features/today/canEditRow.ts`
Run: `npx jest canEditRow`
Expected: clean + PASS.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(tabs)/index.tsx" src/features/today/canEditRow.ts src/features/today/__tests__/canEditRow.test.ts
git commit -m "feat(today): add Edit to the row action menu, gated off the running task"
```

---

### Task 5: Long-press coach + retire the queued-row swipe peek

**Files:**
- Modify: `src/features/today/TaskRow.tsx` (parameterize the coach label)
- Modify: `src/app/(tabs)/index.tsx` (new one-shot KV, coach on the first queued row, drop the queued swipe peek)
- Test: `src/features/today/__tests__/TaskRow.test.tsx`

**Interfaces:**
- Produces on `TaskRow`: new optional prop `coachLabel?: string` (default `'← swipe to remove'` — keeps `DoneSection` unchanged).
- KV key: `today.seenLongPressHintV1` (string `'1'` once seen).

- [ ] **Step 1: Write the failing test**

Add to `src/features/today/__tests__/TaskRow.test.tsx`:

```ts
test('renders a custom coach label when provided', () => {
  render(
    <TaskRow title="Reply" categoryLabel="Email" guessMin={30} honestMin={35}
      onPress={() => {}} showCoachMark coachLabel="Press & hold for options" />,
  );
  expect(screen.getByText('Press & hold for options')).toBeTruthy();
});

test('defaults the coach label to the swipe hint', () => {
  render(
    <TaskRow title="Reply" categoryLabel="Email" guessMin={30} honestMin={35}
      onPress={() => {}} showCoachMark />,
  );
  expect(screen.getByText('← swipe to remove')).toBeTruthy();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest TaskRow -t "custom coach label"`
Expected: FAIL — the text is hardcoded, so the custom label isn't found.

- [ ] **Step 3: Parameterize the coach label in `TaskRow`**

Add to `TaskRowProps` (near `showCoachMark`):

```ts
  /** Coach-mark text. Defaults to the swipe hint; the Today list passes the
   *  long-press hint on the first queued row. */
  coachLabel?: string;
```

Destructure with a default in the function signature:

```ts
  showCoachMark = false,
  coachLabel = '← swipe to remove',
  onCoachMarkDismiss,
```

Replace the hardcoded pill text:

```tsx
            <Text style={coachLabel /* TextStyle */}>{coachLabel}</Text>
```

> Note: the existing local `const coachLabel: TextStyle` (the *style*) collides with the new *prop* name. Rename the style const to `coachLabelStyle` (declaration + the two usages in the pill) to avoid the shadow. Grep `coachLabel` in the file and fix all references.

- [ ] **Step 4: Run to verify the TaskRow tests pass**

Run: `npx jest TaskRow`
Expected: PASS (new + existing).

- [ ] **Step 5: Add the one-shot long-press hint in `index.tsx`**

Near the other first-run flags (~line 124):

```ts
  const [showLongPressHint, setShowLongPressHint] = useState(
    () => kv.getString('today.seenLongPressHintV1') == null,
  );
  const dismissLongPressHint = useCallback(() => {
    setShowLongPressHint(false);
    kv.set('today.seenLongPressHintV1', '1');
  }, []);
```

- [ ] **Step 6: Show it on the first queued row + retire the swipe peek**

In the `upNext.map(...)` `TaskRow` (~line 466), change the coach/peek props:

```tsx
                      <TaskRow
                        key={row.id}
                        title={row.label}
                        categoryLabel={row.categoryLabel}
                        guessMin={row.guessMin}
                        honestMin={row.honestMin}
                        carriedFrom={row.carriedFrom}
                        onPress={() => startRow(row)}
                        onDelete={() => deleteTask(row.id)}
                        onLongPress={() => { dismissLongPressHint(); promptRowActions(row.id, row.label); }}
                        onMove={() => void useDayTasksStore.getState().moveToTomorrow(row.id)}
                        showCoachMark={showLongPressHint && idx === 0}
                        coachLabel="Press & hold for options"
                        onCoachMarkDismiss={dismissLongPressHint}
                        isExiting={deletingId === row.id}
                      />
```

Remove the now-unused `peekHint`/`onPeeked` props from this row and delete the `peekFirstRow` state + `markSwipeHintSeen` callback (and the `today.seenSwipeHint` read) — grep `peekFirstRow`, `markSwipeHintSeen`, `onPeeked`, `peekHint` and remove them. Leave the **done-row** coach (`showCoachMark`/`today.seenCoachMarkV1` in `DoneSection`) untouched — it keeps its default "← swipe to remove" label.

> Guardrail: never show two first-run hints on one row. The queued row now shows only the long-press hint; the swipe still works (just no auto-peek).

- [ ] **Step 7: Lint + typecheck + test**

Run: `npx eslint "src/app/(tabs)/index.tsx" src/features/today/TaskRow.tsx`
Run: `npx tsc --noEmit`
Run: `npx jest TaskRow`
Expected: clean + PASS. (If `tsc` flags an unused `peekHint`/`onPeeked` in `TaskRowProps`, leave the props defined — other call sites may use them — but ensure `index.tsx` no longer references the removed state.)

- [ ] **Step 8: Commit**

```bash
git add "src/app/(tabs)/index.tsx" src/features/today/TaskRow.tsx src/features/today/__tests__/TaskRow.test.tsx
git commit -m "feat(today): teach long-press with a one-time coach; retire the queued swipe peek"
```

---

### Task 6: Full verification pass

**Files:** none (verification only).

- [ ] **Step 1: Full static + test suite**

Run: `npm run lint`
Run: `npm run typecheck`
Run: `npm test`
Expected: all green (0 warnings, 0 type errors, all suites pass).

- [ ] **Step 2: Manual sim — open edit on a queued task**

Boot the app (`npm run ios`), add a task, then deep-link straight to the drawer in edit mode with a real task id (grab an id from a long-press → Edit in the running app), or open via the menu:
- Long-press a queued row → menu shows **Edit** first.
- Tap Edit → drawer opens titled **Edit task**, title/category/guess prefilled, day chip reads **Scheduled for …**.
- Change the guess → the honest suggestion recomputes live.
- **Save** → toast **Saved**, drawer dismisses, the row shows the new number.
- Re-open → **Save & start** routes to the timer with the updated honest number.

Screenshot the drawer: `xcrun simctl io booted screenshot /tmp/edit-drawer.png` and eyeball spacing/alignment against the add view.

- [ ] **Step 3: Manual sim — gates + coach**

- Start a timer for a task → long-press it (via the running card path if reachable) → **Edit is absent**; Move/Remove present.
- Long-press hint pill (**Press & hold for options**) shows on the first queued row on a fresh install (clear `today.seenLongPressHintV1`), fades on first long-press, and does not return.
- Confirm the queued row no longer auto-peeks its swipe on first run, and swipe-to-remove / swipe-to-tomorrow still work.

- [ ] **Step 4: Confirm calibration untouched**

Edit a queued task's category/guess, then check Patterns / a category's stat `n` is unchanged (no completed event was written).

---

## Self-Review

**Spec coverage:**
- Entry = long-press menu Edit → Task 4. ✓
- Reuse Add-Task drawer, edit mode, header/CTA/day-chip copy → Tasks 2–3. ✓
- `updateTask` store method, calibration-safe → Task 1 (+ Step 4 verification). ✓
- Queued-only / done rows no Edit → done rows never call this menu; `canEditRow` gates running. ✓ (Done-row Edit is out of scope by construction — DoneSection wires no Edit.)
- Long-press coach + retire queued swipe peek → Task 5. ✓
- Copy table (Edit / Edit task / Save / Save & start / Saved / Scheduled for / Press & hold for options) → Global Constraints + Tasks 3, 5. ✓
- Edge case: running task suppresses Edit → Task 4. ✓
- Motion: opacity-only coach → existing `TaskRow` coach animation (opacity `markOpacity`), no change needed. ✓

**Placeholder scan:** none — every code step shows real code; every command has expected output.

**Type consistency:** `updateTask(id, patch, nowMs?)` and `getTaskById(id)` names match across Tasks 1→2→3; `canEditRow(isRunning, runningTaskId, rowId)` matches Task 4 test + call site; `coachLabel` prop name consistent in Task 5 (style const renamed to `coachLabelStyle` to avoid the shadow).

**Open decisions locked (founder may override):** day chip moves the day in edit mode (Task 3 Step 4–5); queued-row swipe peek retired (Task 5 Step 6).
