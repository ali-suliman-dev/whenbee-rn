/**
 * Tests for routineNotifications.ts — start-by alerts for scheduled routines.
 *
 * All requires are lazy (inside `jest.isolateModules`) so that:
 *  1. `expo-modules-core` is never pre-loaded into the main module registry,
 *     preventing `jest.doMock` from taking effect inside isolated scopes.
 *  2. Module-level state (`cached`, `triedRequire`) starts fresh per case.
 *
 * The native expo-notifications module is absent in tests → the guarded
 * getModule() returns null → every function is a clean no-op.
 */

/** Minimal shape of the expo-notifications module we rely on. */
interface FakeNotifModule {
  SchedulableTriggerInputTypes: { WEEKLY: 'weekly' };
  scheduleNotificationAsync: jest.Mock;
  cancelScheduledNotificationAsync: jest.Mock;
  getPermissionsAsync: jest.Mock;
  requestPermissionsAsync: jest.Mock;
}

function fakeNotifModule(): FakeNotifModule {
  return {
    SchedulableTriggerInputTypes: { WEEKLY: 'weekly' as const },
    scheduleNotificationAsync: jest.fn().mockResolvedValue('notif-id'),
    cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
    getPermissionsAsync: jest.fn().mockResolvedValue({ granted: true, canAskAgain: true }),
    requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  };
}

/** Minimal kv mock — in-memory map. */
function makeKvMock() {
  const store: Record<string, string> = {};
  return {
    set: jest.fn((k: string, v: string) => { store[k] = v; }),
    getString: jest.fn((k: string): string | null => store[k] ?? null),
    delete: jest.fn((k: string) => { delete store[k]; }),
    _store: store,
  };
}

const BASE_ROUTINE = {
  id: 'r1',
  name: 'Morning Focus',
  scheduleDays: [1, 3, 5], // Mon, Wed, Fri (0-indexed Sun=0)
  alertEnabled: true,
  alertLeadMin: 10,
  doneByMinuteOfDay: 9 * 60, // 9:00 AM
};

describe('scheduleRoutineAlerts', () => {
  it('schedules N notifications for N scheduleDays when alertEnabled=true', async () => {
    await jest.isolateModulesAsync(async () => {
      const notifModule = fakeNotifModule();
      const kvMock = makeKvMock();

      jest.doMock('expo-modules-core', () => ({
        requireOptionalNativeModule: () => ({}), // truthy = module linked
      }));
      jest.doMock('@/src/lib/isExpoGo', () => ({ isExpoGo: false }));
      jest.doMock('expo-notifications', () => notifModule);
      jest.doMock('@/src/lib/kv', () => ({ kv: kvMock }));

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { scheduleRoutineAlerts } = require('../routineNotifications') as typeof import('../routineNotifications');

      // startByMinuteOfDay = doneByMinuteOfDay - alertLeadMin = 540 - 10 = 530 min
      const startByMinuteOfDay = 530;
      await scheduleRoutineAlerts(BASE_ROUTINE, startByMinuteOfDay);

      // One notification per scheduleDay: [1, 3, 5]
      expect(notifModule.scheduleNotificationAsync).toHaveBeenCalledTimes(3);
    });
  });

  it('maps weekdays from 0–6 (Sun=0) to 1–7 (Sun=1) for the WEEKLY trigger', async () => {
    await jest.isolateModulesAsync(async () => {
      const notifModule = fakeNotifModule();
      const kvMock = makeKvMock();

      jest.doMock('expo-modules-core', () => ({
        requireOptionalNativeModule: () => ({}),
      }));
      jest.doMock('@/src/lib/isExpoGo', () => ({ isExpoGo: false }));
      jest.doMock('expo-notifications', () => notifModule);
      jest.doMock('@/src/lib/kv', () => ({ kv: kvMock }));

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { scheduleRoutineAlerts } = require('../routineNotifications') as typeof import('../routineNotifications');

      // scheduleDays [0, 6] = Sunday and Saturday (0-indexed)
      const routine = { ...BASE_ROUTINE, scheduleDays: [0, 6] };
      const startByMinuteOfDay = 530;
      await scheduleRoutineAlerts(routine, startByMinuteOfDay);

      const calls = notifModule.scheduleNotificationAsync.mock.calls;
      const weekdays = calls.map(([arg]: [{ trigger: { weekday: number } }]) => arg.trigger.weekday);
      // Sun (0) → 1, Sat (6) → 7
      expect(weekdays).toContain(1); // Sunday
      expect(weekdays).toContain(7); // Saturday
    });
  });

  it('fires notifications at alertMinute = max(0, startByMinuteOfDay - alertLeadMin)', async () => {
    await jest.isolateModulesAsync(async () => {
      const notifModule = fakeNotifModule();
      const kvMock = makeKvMock();

      jest.doMock('expo-modules-core', () => ({
        requireOptionalNativeModule: () => ({}),
      }));
      jest.doMock('@/src/lib/isExpoGo', () => ({ isExpoGo: false }));
      jest.doMock('expo-notifications', () => notifModule);
      jest.doMock('@/src/lib/kv', () => ({ kv: kvMock }));

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { scheduleRoutineAlerts } = require('../routineNotifications') as typeof import('../routineNotifications');

      // startByMinuteOfDay=530, alertLeadMin=10 → alertMinute=520
      // 520 min = 8h 40m → hour=8, minute=40
      await scheduleRoutineAlerts(BASE_ROUTINE, 530);

      const firstCall = notifModule.scheduleNotificationAsync.mock.calls[0] as [
        { trigger: { hour: number; minute: number } },
      ];
      expect(firstCall[0].trigger.hour).toBe(8);
      expect(firstCall[0].trigger.minute).toBe(40);
    });
  });

  it('stores notification ids in kv keyed by routine id', async () => {
    await jest.isolateModulesAsync(async () => {
      let callCount = 0;
      const notifModule: FakeNotifModule = {
        ...fakeNotifModule(),
        scheduleNotificationAsync: jest.fn().mockImplementation(() =>
          Promise.resolve(`id-${++callCount}`),
        ),
        cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
      };
      const kvMock = makeKvMock();

      jest.doMock('expo-modules-core', () => ({
        requireOptionalNativeModule: () => ({}),
      }));
      jest.doMock('@/src/lib/isExpoGo', () => ({ isExpoGo: false }));
      jest.doMock('expo-notifications', () => notifModule);
      jest.doMock('@/src/lib/kv', () => ({ kv: kvMock }));

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { scheduleRoutineAlerts } = require('../routineNotifications') as typeof import('../routineNotifications');

      await scheduleRoutineAlerts(BASE_ROUTINE, 530);

      expect(kvMock.set).toHaveBeenCalled();
      const lastSetCall = kvMock.set.mock.calls.find(
        ([k]: [string, string]) => k === `routine-alerts:${BASE_ROUTINE.id}`,
      );
      expect(lastSetCall).toBeDefined();
      const stored = JSON.parse(lastSetCall?.[1] as string) as string[];
      expect(stored).toHaveLength(3);
    });
  });

  it('does not schedule when alertEnabled=false', async () => {
    await jest.isolateModulesAsync(async () => {
      const notifModule = fakeNotifModule();
      const kvMock = makeKvMock();

      jest.doMock('expo-modules-core', () => ({
        requireOptionalNativeModule: () => ({}),
      }));
      jest.doMock('@/src/lib/isExpoGo', () => ({ isExpoGo: false }));
      jest.doMock('expo-notifications', () => notifModule);
      jest.doMock('@/src/lib/kv', () => ({ kv: kvMock }));

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { scheduleRoutineAlerts } = require('../routineNotifications') as typeof import('../routineNotifications');

      await scheduleRoutineAlerts({ ...BASE_ROUTINE, alertEnabled: false }, 530);

      expect(notifModule.scheduleNotificationAsync).not.toHaveBeenCalled();
    });
  });

  it('does not schedule when scheduleDays is empty', async () => {
    await jest.isolateModulesAsync(async () => {
      const notifModule = fakeNotifModule();
      const kvMock = makeKvMock();

      jest.doMock('expo-modules-core', () => ({
        requireOptionalNativeModule: () => ({}),
      }));
      jest.doMock('@/src/lib/isExpoGo', () => ({ isExpoGo: false }));
      jest.doMock('expo-notifications', () => notifModule);
      jest.doMock('@/src/lib/kv', () => ({ kv: kvMock }));

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { scheduleRoutineAlerts } = require('../routineNotifications') as typeof import('../routineNotifications');

      await scheduleRoutineAlerts({ ...BASE_ROUTINE, scheduleDays: [] }, 530);

      expect(notifModule.scheduleNotificationAsync).not.toHaveBeenCalled();
    });
  });

  it('is a no-op in Expo Go (no module available)', async () => {
    await jest.isolateModulesAsync(async () => {
      const notifModule = fakeNotifModule();
      const kvMock = makeKvMock();

      jest.doMock('expo-modules-core', () => ({
        requireOptionalNativeModule: () => null,
      }));
      jest.doMock('@/src/lib/isExpoGo', () => ({ isExpoGo: true }));
      jest.doMock('expo-notifications', () => notifModule);
      jest.doMock('@/src/lib/kv', () => ({ kv: kvMock }));

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { scheduleRoutineAlerts } = require('../routineNotifications') as typeof import('../routineNotifications');

      await scheduleRoutineAlerts(BASE_ROUTINE, 530);

      expect(notifModule.scheduleNotificationAsync).not.toHaveBeenCalled();
    });
  });
});

describe('cancelRoutineAlerts', () => {
  it('cancels all stored ids and clears kv', async () => {
    await jest.isolateModulesAsync(async () => {
      const notifModule = fakeNotifModule();
      const kvMock = makeKvMock();
      // Pre-seed kv with stored ids
      kvMock._store[`routine-alerts:${BASE_ROUTINE.id}`] = JSON.stringify(['id-a', 'id-b', 'id-c']);
      kvMock.getString.mockImplementation((k: string) => kvMock._store[k] ?? null);

      jest.doMock('expo-modules-core', () => ({
        requireOptionalNativeModule: () => ({}),
      }));
      jest.doMock('@/src/lib/isExpoGo', () => ({ isExpoGo: false }));
      jest.doMock('expo-notifications', () => notifModule);
      jest.doMock('@/src/lib/kv', () => ({ kv: kvMock }));

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { cancelRoutineAlerts } = require('../routineNotifications') as typeof import('../routineNotifications');

      await cancelRoutineAlerts(BASE_ROUTINE.id);

      expect(notifModule.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(3);
      expect(notifModule.cancelScheduledNotificationAsync).toHaveBeenCalledWith('id-a');
      expect(notifModule.cancelScheduledNotificationAsync).toHaveBeenCalledWith('id-b');
      expect(notifModule.cancelScheduledNotificationAsync).toHaveBeenCalledWith('id-c');
      expect(kvMock.delete).toHaveBeenCalledWith(`routine-alerts:${BASE_ROUTINE.id}`);
    });
  });

  it('is a no-op in Expo Go', async () => {
    await jest.isolateModulesAsync(async () => {
      const notifModule = fakeNotifModule();
      const kvMock = makeKvMock();
      kvMock._store[`routine-alerts:${BASE_ROUTINE.id}`] = JSON.stringify(['id-a']);
      kvMock.getString.mockImplementation((k: string) => kvMock._store[k] ?? null);

      jest.doMock('expo-modules-core', () => ({
        requireOptionalNativeModule: () => null,
      }));
      jest.doMock('@/src/lib/isExpoGo', () => ({ isExpoGo: true }));
      jest.doMock('expo-notifications', () => notifModule);
      jest.doMock('@/src/lib/kv', () => ({ kv: kvMock }));

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { cancelRoutineAlerts } = require('../routineNotifications') as typeof import('../routineNotifications');

      await cancelRoutineAlerts(BASE_ROUTINE.id);

      expect(notifModule.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    });
  });
});
