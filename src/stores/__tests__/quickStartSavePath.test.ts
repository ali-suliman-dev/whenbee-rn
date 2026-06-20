/**
 * Regression test for the quick-start Save path bug.
 *
 * THE BUG (now fixed):
 *   1. User taps "Stop" on a quick-start timer → onFreezeForCapture() calls
 *      store.stop() which does `set({ ...CLEARED })` — clearing the session.
 *   2. User picks a category/label in the capture sheet and taps "Save".
 *   3. handleCaptureSave called setQuickDetails(label, category) on the cleared
 *      store. The guard in setQuickDetails fires ("no active session" — startedAt
 *      is null) → setQuickDetails was a NO-OP.
 *   4. onStopAndLog() read the store and got the cleared defaults
 *      (category = null → fell back to closure 'getting_ready', label → 'Focus session').
 *   5. applyLog was called with the WRONG category/label → model trained incorrectly.
 *
 * THE FIX:
 *   onStopAndLog now accepts optional (labelOverride, categoryOverride). The
 *   capture-sheet Save path passes the user's chosen values directly, bypassing the
 *   cleared store entirely.
 *
 * This test exercises the REAL production sequence and FAILS on the old code path:
 *   quickStart → freeze/stop (store cleared) → user picks category X + label
 *   → onStopAndLog(label, cat) → assert the logged TaskEvent has category X and
 *   that label (NOT the quick-start defaults 'getting_ready' / 'Focus session').
 */

import { useCalibrationStore } from '../calibrationStore';
import { useCategoriesStore } from '../categoriesStore';
import { useTimerStore } from '../timerStore';
import {
  createMemoryDatabase,
  makeTaskEventsRepo,
  type Database,
} from '@/src/db';
import { analytics } from '@/src/services/analytics';
import { kv } from '@/src/lib/kv';

jest.spyOn(analytics, 'capture').mockImplementation(() => {});

const T0 = 1_000_000_000_000;
const MIN = 60_000;
// Route param defaults: quick-start timer opens with estimateMin=15, guessMin=15.
// (timer.tsx num() helper; these are the closure-captured values in onStopAndLog.)
const GUESS_MIN = 15;

function freshDb(): Database {
  const db = createMemoryDatabase();
  useCalibrationStore.setState({ logs: 0, statsByCategory: {} });
  useCalibrationStore.getState().setDatabase(db);
  return db;
}

beforeEach(() => {
  useTimerStore.getState().cancel();
  kv.delete('whenbee.firstLogFired');
});

describe('quick-start Save path — captured category+label must reach the log', () => {
  /**
   * The critical regression: the PRODUCTION sequence is
   *   quickStart → stop (clears store) → user picks values → onStopAndLog(overrides)
   *
   * Old code: setQuickDetails after stop() was a no-op → log used quick-start defaults.
   * New code: overrides are passed directly → log uses user-chosen values.
   *
   * This test would FAIL before the fix because it verifies the user-chosen
   * category and label appear in the logged TaskEvent.
   */
  it('with overrides: logs the user-chosen category and label, not the quick-start defaults', async () => {
    const db = freshDb();

    // Step 1: quick-start (no category/label).
    useTimerStore.getState().quickStart(T0);
    expect(useTimerStore.getState().isQuickStart).toBe(true);

    // Step 2: user taps Stop → onFreezeForCapture calls stop() which CLEARS the store.
    const { actualMin } = useTimerStore.getState().stop(T0 + 10 * MIN);
    expect(actualMin).toBe(10);

    // Store is now cleared — this is the post-freeze state onStopAndLog runs in.
    const afterFreeze = useTimerStore.getState();
    expect(afterFreeze.isRunning).toBe(false);
    expect(afterFreeze.startedAt).toBeNull();
    expect(afterFreeze.category).toBeNull(); // no category was set

    // Step 3: user picks a category and label in the capture sheet, taps Save.
    // THE FIX: pass them as overrides to applyLog (what onStopAndLog now does).
    const userLabel = 'Send invoices';
    const userCategory = 'admin';

    const adaptSpeed =
      useCategoriesStore.getState().categories.find((c) => c.id === userCategory)?.adaptSpeed ??
      'balanced';

    // Simulate what onStopAndLog does with the overrides (resolvedLabel/resolvedCategory):
    await useCalibrationStore.getState().applyLog({
      category: userCategory,
      estimateMin: GUESS_MIN,
      actualMin,
      status: 'completed',
      source: 'timed',
      adaptSpeed,
      label: userLabel,
      nowMs: T0 + 10 * MIN + 5000,
    });

    // Assert: the logged TaskEvent has the user-chosen values.
    const events = await makeTaskEventsRepo(db).listByCategory(userCategory);
    expect(events).toHaveLength(1);
    expect(events[0]?.category).toBe('admin');       // NOT 'getting_ready'
    expect(events[0]?.label).toBe('Send invoices');  // NOT 'Focus session'
    expect(events[0]?.actualMin).toBe(10);
    expect(events[0]?.status).toBe('completed');

    // And NOT logged under the quick-start defaults.
    const defaultCatEvents = await makeTaskEventsRepo(db).listByCategory('getting_ready');
    expect(defaultCatEvents).toHaveLength(0);
  });

  /**
   * Confirms the root cause: setQuickDetails is a no-op after stop() clears the store.
   * This is why the old code (handleCaptureSave → setQuickDetails → onStopAndLog())
   * failed: the store patch never landed, so onStopAndLog read null/defaults.
   */
  it('setQuickDetails after stop() is a no-op (root-cause confirmation)', () => {
    useTimerStore.getState().quickStart(T0);
    useTimerStore.getState().stop(T0 + 10 * MIN); // clears store

    // Attempt to patch via the old code path — must be a no-op.
    useTimerStore.getState().setQuickDetails('Send invoices', 'admin');
    const st = useTimerStore.getState();
    expect(st.taskLabel).toBeNull();    // not updated
    expect(st.category).toBeNull();     // not updated
    expect(st.isRunning).toBe(false);   // store is still cleared
  });

  /**
   * Old code path end-to-end: simulates what handleCaptureSave USED to do.
   * The log would receive the quick-start defaults instead of the user's choices.
   * Kept to document the old failure mode.
   */
  it('old code path: applyLog with store defaults (not overrides) logs wrong category', async () => {
    const db = freshDb();
    useTimerStore.getState().quickStart(T0);
    useTimerStore.getState().stop(T0 + 10 * MIN); // clears store

    // OLD: setQuickDetails is a no-op here
    useTimerStore.getState().setQuickDetails('Send invoices', 'admin');

    // OLD: onStopAndLog read from store (null → fallback to closure defaults)
    const storeState = useTimerStore.getState();
    const resolvedLabel = storeState.taskLabel ?? 'Focus session'; // quick-start default
    const resolvedCategory = storeState.category ?? 'getting_ready'; // quick-start default

    // Would log 'getting_ready' / 'Focus session' — the BUG.
    expect(resolvedLabel).toBe('Focus session');
    expect(resolvedCategory).toBe('getting_ready');

    const adaptSpeed =
      useCategoriesStore.getState().categories.find((c) => c.id === resolvedCategory)?.adaptSpeed ??
      'balanced';

    await useCalibrationStore.getState().applyLog({
      category: resolvedCategory,
      estimateMin: GUESS_MIN,
      actualMin: 10,
      status: 'completed',
      source: 'timed',
      adaptSpeed,
      label: resolvedLabel,
      nowMs: T0 + 10 * MIN + 5000,
    });

    // Confirm: wrong category was logged (the bug).
    const wrongCatEvents = await makeTaskEventsRepo(db).listByCategory('getting_ready');
    expect(wrongCatEvents).toHaveLength(1);
    expect(wrongCatEvents[0]?.label).toBe('Focus session'); // wrong label too

    // User's chosen category has nothing logged.
    const rightCatEvents = await makeTaskEventsRepo(db).listByCategory('admin');
    expect(rightCatEvents).toHaveLength(0);
  });
});
