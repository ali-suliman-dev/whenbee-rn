// src/services/__tests__/notificationResponses.test.ts
const calls: Record<string, any[]> = { timer: [], startBy: [] };
jest.mock('@/src/services/timerNotifications', () => ({
  scheduleTimerDone: jest.fn(async (o: any) => calls.timer.push(o)),
  scheduleStartBy: jest.fn(async (o: any) => calls.startBy.push(o)),
  cancelTimerDone: jest.fn(async () => {}),
}));
const captured: any[] = [];
jest.mock('@/src/services/analytics', () => ({ analytics: { capture: (e: string, p: any) => captured.push([e, p]) } }));

// eslint-disable-next-line import/first
import { handleNotificationResponse } from '@/src/services/notificationResponses';

describe('handleNotificationResponse', () => {
  beforeEach(() => { calls.timer.length = 0; calls.startBy.length = 0; captured.length = 0; });

  it('+10 reschedules the honest ping 10 min later and logs the action', async () => {
    const startedAt = Date.now() - 5 * 60_000;
    await handleNotificationResponse({
      actionIdentifier: 'EXTEND_10',
      data: { kind: 'honest', label: 'Email', startedAt, honestMin: 30 },
    });
    expect(calls.timer).toHaveLength(1);
    expect(calls.timer[0].honestMin).toBe(40); // 30 + 10
    expect(captured[0]).toEqual(['notification_action', { category: 'honest', action: 'EXTEND_10' }]);
  });

  it('Snooze 15 reschedules 15 min from now', async () => {
    await handleNotificationResponse({
      actionIdentifier: 'SNOOZE_15',
      data: { kind: 'honest', label: 'Email', startedAt: Date.now(), honestMin: 30 },
    });
    expect(calls.timer).toHaveLength(1);
    // snooze re-anchors so the ping fires ~15 min from now regardless of original
    expect(calls.timer[0].honestMin).toBeGreaterThanOrEqual(15);
  });

  it('foreground actions only log (navigation handled by setup)', async () => {
    await handleNotificationResponse({ actionIdentifier: 'LOG', data: { kind: 'honest' } });
    expect(calls.timer).toHaveLength(0);
    expect(captured[0]).toEqual(['notification_action', { category: 'honest', action: 'LOG' }]);
  });
});
