import { createAndroidPresence, type AndroidPresenceDeps } from '@/src/services/presence/createAndroidPresence';
import type { WidgetSnapshot, LiveActivityAttributes } from '@/src/services/liveActivity';

const snapshot: WidgetSnapshot = {
  nextTaskLabel: 'Write the report', category: 'Deep work', honestFinishClock: '7:10',
  startDeepLink: 'whenbee://timer?taskId=1', updatedAtEpoch: 1000, honestFinishEpoch: 3700, isPro: true,
};
const attrs: LiveActivityAttributes = { taskLabel: 'Write', finishEpoch: 3700, startEpoch: 1000, isProRich: true };

function makeDeps(overrides: Partial<AndroidPresenceDeps> = {}): jest.Mocked<AndroidPresenceDeps> {
  return {
    saveSnapshot: jest.fn(), clearSnapshot: jest.fn(), renderWidget: jest.fn(),
    notif: { startTimerNotification: jest.fn(), updateTimerNotification: jest.fn(), stopTimerNotification: jest.fn() },
    ...overrides,
  } as jest.Mocked<AndroidPresenceDeps>;
}

test('isStub is false — Android presence is a real surface', () => {
  expect(createAndroidPresence(makeDeps()).isStub).toBe(false);
});

test('writeSnapshot persists then re-renders the widget', () => {
  const deps = makeDeps();
  createAndroidPresence(deps).writeSnapshot(snapshot);
  expect(deps.saveSnapshot).toHaveBeenCalledWith(snapshot);
  expect(deps.renderWidget).toHaveBeenCalledTimes(1);
});

test('clearSnapshot clears store then re-renders the empty widget', () => {
  const deps = makeDeps();
  createAndroidPresence(deps).clearSnapshot();
  expect(deps.clearSnapshot).toHaveBeenCalledTimes(1);
  expect(deps.renderWidget).toHaveBeenCalledTimes(1);
});

test('startLiveActivity forwards attrs to the native notification', () => {
  const deps = makeDeps();
  createAndroidPresence(deps).startLiveActivity(attrs);
  expect(deps.notif!.startTimerNotification).toHaveBeenCalledWith(attrs);
});

test('updateLiveActivity forwards overrun state', () => {
  const deps = makeDeps();
  createAndroidPresence(deps).updateLiveActivity({ isOverrun: true });
  expect(deps.notif!.updateTimerNotification).toHaveBeenCalledWith({ isOverrun: true });
});

test('endLiveActivity stops the notification', () => {
  const deps = makeDeps();
  createAndroidPresence(deps).endLiveActivity();
  expect(deps.notif!.stopTimerNotification).toHaveBeenCalledTimes(1);
});

test('notification calls no-op safely when the native module is absent', () => {
  const deps = makeDeps({ notif: null });
  const p = createAndroidPresence(deps);
  expect(() => { p.startLiveActivity(attrs); p.updateLiveActivity({ isOverrun: true }); p.endLiveActivity(); }).not.toThrow();
});

test('a throwing dep never escapes writeSnapshot', () => {
  const deps = makeDeps({ saveSnapshot: jest.fn(() => { throw new Error('kv down'); }) });
  expect(() => createAndroidPresence(deps).writeSnapshot(snapshot)).not.toThrow();
});
