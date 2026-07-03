import { createAndroidPresence, type AndroidPresenceDeps } from '@/src/services/presence/createAndroidPresence';
import type { WidgetSnapshot, LiveActivityAttributes } from '@/src/services/liveActivity';

const snapshot: WidgetSnapshot = {
  nextTaskLabel: 'Write the report', category: 'Deep work', honestFinishClock: '7:10',
  startDeepLink: 'whenbee://timer?taskId=1', updatedAtEpoch: 1000, honestFinishEpoch: 3700, isPro: true,
};
const attrs: LiveActivityAttributes = { taskLabel: 'Write', finishEpoch: 3700, startEpoch: 1000, isProRich: true };

function makeDeps(overrides: Partial<AndroidPresenceDeps> = {}): jest.Mocked<AndroidPresenceDeps> {
  return {
    notif: {
      writeWidgetSnapshot: jest.fn(),
      clearWidgetSnapshot: jest.fn(),
      startTimerNotification: jest.fn(),
      updateTimerNotification: jest.fn(),
      stopTimerNotification: jest.fn(),
    },
    ...overrides,
  } as jest.Mocked<AndroidPresenceDeps>;
}

test('isStub is false — Android presence is a real surface', () => {
  expect(createAndroidPresence(makeDeps()).isStub).toBe(false);
});

test('writeSnapshot forwards a JSON-serialized snapshot to the native widget writer', () => {
  const deps = makeDeps();
  createAndroidPresence(deps).writeSnapshot(snapshot);
  expect(deps.notif!.writeWidgetSnapshot).toHaveBeenCalledWith(JSON.stringify(snapshot));
});

test('clearSnapshot forwards to the native widget clearer', () => {
  const deps = makeDeps();
  createAndroidPresence(deps).clearSnapshot();
  expect(deps.notif!.clearWidgetSnapshot).toHaveBeenCalledTimes(1);
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

test('every call no-ops safely when the native module is absent', () => {
  const deps = makeDeps({ notif: null });
  const p = createAndroidPresence(deps);
  expect(() => {
    p.writeSnapshot(snapshot);
    p.clearSnapshot();
    p.startLiveActivity(attrs);
    p.updateLiveActivity({ isOverrun: true });
    p.endLiveActivity();
  }).not.toThrow();
});

test('a throwing dep never escapes writeSnapshot', () => {
  const deps = makeDeps({
    notif: {
      writeWidgetSnapshot: jest.fn(() => { throw new Error('binder down'); }),
      clearWidgetSnapshot: jest.fn(),
      startTimerNotification: jest.fn(),
      updateTimerNotification: jest.fn(),
      stopTimerNotification: jest.fn(),
    },
  });
  expect(() => createAndroidPresence(deps).writeSnapshot(snapshot)).not.toThrow();
});
