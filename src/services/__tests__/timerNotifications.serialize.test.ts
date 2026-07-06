/**
 * Regression test for the notification double-fire bug: scheduleStartBy did a
 * non-atomic cancel→schedule against a single kv id. If two calls for the same
 * key overlap, the OS can end up with TWO scheduled notifications while kv only
 * remembers the LAST id — the orphaned one fires as a duplicate and can never
 * be cancelled. A per-key async lock (src/lib/asyncLock.ts) makes cancel→
 * schedule atomic so overlapping calls serialize instead of interleaving.
 *
 * All requires are lazy (inside `jest.isolateModulesAsync`) so module-level
 * state (`cached`, `triedRequire`) starts fresh per case, mirroring
 * routineNotifications.test.ts's pattern.
 */

/** A deferred scheduleNotificationAsync so the test controls exactly when each
 *  call resolves — this is what lets us prove overlapping calls don't interleave. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

/** Flush a generous number of microtask turns — enough for a lock handoff plus
 *  a few chained `await`s inside the unlocked inner helpers to settle. */
async function flushMicrotasks(turns = 10): Promise<void> {
  for (let i = 0; i < turns; i++) {
    await Promise.resolve();
  }
}

describe('scheduleStartBy — serialized schedule/cancel', () => {
  it('does not interleave two concurrent calls; no orphaned notification id', async () => {
    await jest.isolateModulesAsync(async () => {
      const startOrder: string[] = [];
      let nextId = 0;
      const deferreds: ReturnType<typeof deferred<string>>[] = [];

      const scheduleNotificationAsync = jest.fn(() => {
        const id = `id-${++nextId}`;
        startOrder.push(`schedule-start:${id}`);
        const d = deferred<string>();
        deferreds.push(d);
        // Resolve the deferred with this call's own id once released.
        return d.promise.then(() => id);
      });
      const cancelScheduledNotificationAsync = jest.fn(async (_id: string) => undefined);

      const notifModule = {
        SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval', WEEKLY: 'weekly' },
        getPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
        requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
        scheduleNotificationAsync,
        cancelScheduledNotificationAsync,
      };

      const store: Record<string, string> = {};
      const kvMock = {
        set: jest.fn((k: string, v: string) => {
          store[k] = v;
        }),
        getString: jest.fn((k: string): string | null => store[k] ?? null),
        delete: jest.fn((k: string) => {
          delete store[k];
        }),
      };

      jest.doMock('expo-modules-core', () => ({
        requireOptionalNativeModule: () => ({}),
      }));
      jest.doMock('@/src/lib/isExpoGo', () => ({ isExpoGo: false }));
      jest.doMock('expo-notifications', () => notifModule);
      jest.doMock('@/src/lib/kv', () => ({ kv: kvMock }));
      jest.doMock('@/src/stores/settingsStore', () => ({
        useSettingsStore: {
          getState: () => ({ notificationSound: 'default', quietHours: { enabled: false, startMin: 0, endMin: 0 } }),
        },
      }));

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { scheduleStartBy } = require('../timerNotifications') as typeof import('../timerNotifications');

      const opts = {
        startByMs: Date.now() + 10 * 60_000,
        firstTaskLabel: 'Email',
        deadlineMs: Date.now() + 40 * 60_000,
      };

      // Fire two concurrent calls WITHOUT awaiting the first before starting the second.
      const p1 = scheduleStartBy(opts);
      const p2 = scheduleStartBy(opts);

      // Let microtasks flush: only the FIRST call's scheduleNotificationAsync
      // should have started so far — the second must be waiting on the lock.
      await flushMicrotasks();
      expect(startOrder).toEqual(['schedule-start:id-1']);
      expect(scheduleNotificationAsync).toHaveBeenCalledTimes(1);

      // Release the first call's schedule — this lets call #1 finish (persist
      // id-1 to kv), which should THEN unblock call #2's lock acquisition.
      deferreds[0]?.resolve('id-1');
      await p1;

      await flushMicrotasks();
      expect(startOrder).toEqual(['schedule-start:id-1', 'schedule-start:id-2']);

      deferreds[1]?.resolve('id-2');
      await p2;

      // No orphan: the final kv id must be the LAST scheduled id, and every id
      // that isn't the final one must have been cancelled.
      const finalId = kvMock.getString('whenbee.startByNotifId');
      expect(finalId).toBe('id-2');
      // id-1 was superseded by call #2's internal cancel — it should have been
      // passed to cancelScheduledNotificationAsync, never left dangling.
      const cancelledIds = cancelScheduledNotificationAsync.mock.calls.map(([id]: [string]) => id);
      expect(cancelledIds).toContain('id-1');
    });
  });
});
