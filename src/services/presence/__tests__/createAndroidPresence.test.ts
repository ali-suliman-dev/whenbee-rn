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
      writeWidgetData: jest.fn(),
      clearWidgetData: jest.fn(),
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

test('writeSnapshot routes to the generic writer under the "nextTask" key', () => {
  const deps = makeDeps();
  createAndroidPresence(deps).writeSnapshot(snapshot);
  expect(deps.notif!.writeWidgetData).toHaveBeenCalledWith('nextTask', JSON.stringify(snapshot));
});

test('clearSnapshot routes to the generic clearer under the "nextTask" key', () => {
  const deps = makeDeps();
  createAndroidPresence(deps).clearSnapshot();
  expect(deps.notif!.clearWidgetData).toHaveBeenCalledWith('nextTask');
});

test('writeWidgetData forwards key + json to the native writer', () => {
  const deps = makeDeps();
  createAndroidPresence(deps).writeWidgetData('capacity', '{"a":1}');
  expect(deps.notif!.writeWidgetData).toHaveBeenCalledWith('capacity', '{"a":1}');
});

test('clearWidgetData forwards the key to the native clearer', () => {
  const deps = makeDeps();
  createAndroidPresence(deps).clearWidgetData('capacity');
  expect(deps.notif!.clearWidgetData).toHaveBeenCalledWith('capacity');
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
    p.writeWidgetData('capacity', '{"a":1}');
    p.clearWidgetData('capacity');
    p.startLiveActivity(attrs);
    p.updateLiveActivity({ isOverrun: true });
    p.endLiveActivity();
  }).not.toThrow();
});

test('a throwing dep never escapes writeSnapshot', () => {
  const deps = makeDeps({
    notif: {
      writeWidgetData: jest.fn(() => { throw new Error('binder down'); }),
      clearWidgetData: jest.fn(),
      startTimerNotification: jest.fn(),
      updateTimerNotification: jest.fn(),
      stopTimerNotification: jest.fn(),
    },
  });
  expect(() => createAndroidPresence(deps).writeSnapshot(snapshot)).not.toThrow();
});

test('a throwing dep never escapes writeWidgetData', () => {
  const deps = makeDeps({
    notif: {
      writeWidgetData: jest.fn(() => { throw new Error('binder down'); }),
      clearWidgetData: jest.fn(),
      startTimerNotification: jest.fn(),
      updateTimerNotification: jest.fn(),
      stopTimerNotification: jest.fn(),
    },
  });
  expect(() => createAndroidPresence(deps).writeWidgetData('capacity', '{"a":1}')).not.toThrow();
});
