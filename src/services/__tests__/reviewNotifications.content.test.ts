import { scheduleWeeklyReview } from '@/src/services/reviewNotifications';

const scheduled: any[] = [];

jest.mock('expo-modules-core', () => ({ requireOptionalNativeModule: () => ({}) }));
jest.mock('@/src/lib/isExpoGo', () => ({ isExpoGo: false }));
jest.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { WEEKLY: 'weekly' },
  scheduleNotificationAsync: jest.fn(async (req: any) => { scheduled.push(req); return 'rid'; }),
  cancelScheduledNotificationAsync: jest.fn(async () => {}),
}));
jest.mock('@/src/stores/settingsStore', () => ({
  useSettingsStore: { getState: () => ({ notificationSound: 'default' }) },
}));
jest.mock('@/src/lib/kv', () => ({
  kv: { set: jest.fn(), getString: jest.fn(() => null), delete: jest.fn() },
}));

beforeEach(() => (scheduled.length = 0));

it('schedules the Monday review with revoiced body, category, thread', async () => {
  await scheduleWeeklyReview('2026-W26');
  const { content, trigger } = scheduled[0];
  expect(content.title).toBe('Your honest week is ready');
  expect(content.body).toBe("Your week in honest numbers, whenever you've got a minute.");
  expect(content.categoryIdentifier).toBe('WB_REVIEW');
  expect(content.threadIdentifier).toBe('wb-review');
  expect(trigger.weekday).toBe(2);
});
