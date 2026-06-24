import { scheduleTimerDone } from '@/src/services/timerNotifications';

const scheduled: any[] = [];

jest.mock('expo-modules-core', () => ({
  requireOptionalNativeModule: () => ({}), // pretend the native scheduler exists
}));
jest.mock('@/src/lib/isExpoGo', () => ({ isExpoGo: false }));
jest.mock('@/src/stores/settingsStore', () => ({
  useSettingsStore: {
    getState: () => ({ notificationSound: 'default', quietHours: { enabled: false, startMin: 0, endMin: 0 } }),
  },
}));
jest.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval', WEEKLY: 'weekly' },
  getPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  scheduleNotificationAsync: jest.fn(async (req: any) => {
    scheduled.push(req);
    return 'id-1';
  }),
  cancelScheduledNotificationAsync: jest.fn(async () => {}),
  setNotificationCategoryAsync: jest.fn(async () => {}),
}));

describe('scheduleTimerDone — honest-reached content', () => {
  beforeEach(() => (scheduled.length = 0));

  it('fires at the honest anchor with the no-guilt copy, category, timeSensitive, thread, sound', async () => {
    const startedAt = Date.now();
    await scheduleTimerDone({ label: 'Email', startedAt, honestMin: 30 });
    expect(scheduled).toHaveLength(1);
    const { content, trigger } = scheduled[0];
    expect(content.title).toBe("You're near the finish");
    expect(content.body).toBe("This is about when Email usually wraps. Log it when you're done.");
    expect(content.categoryIdentifier).toBe('WB_HONEST_REACHED');
    expect(content.interruptionLevel).toBe('timeSensitive');
    expect(content.threadIdentifier).toBe('wb-timer');
    expect(content.data.kind).toBe('honest');
    expect(trigger.seconds).toBeGreaterThan(1700); // ~30 min
    expect(trigger.seconds).toBeLessThan(1900);
  });

  it('uses the not-enough-data copy when hasCalibration is false', async () => {
    await scheduleTimerDone({ label: 'Email', startedAt: Date.now(), honestMin: 20, hasCalibration: false });
    expect(scheduled[0].content.title).toBe('Time check for Email');
    expect(scheduled[0].content.body).toBe('This was your estimate for Email. Log it whenever you wrap.');
  });
});
