// Pure, dependency-injected Android implementation of NativePresenceModule.
// Widget writes go to the kv store + a widget re-render; the running-timer
// "Live Activity" maps onto the native ongoing-notification module. Every method
// is best-effort — a presence failure must never reach the core loop.
import type { NativePresenceModule, WidgetSnapshot, LiveActivityAttributes } from '@/src/services/liveActivity';

export interface AndroidPresenceDeps {
  saveSnapshot: (snapshot: WidgetSnapshot) => void;
  clearSnapshot: () => void;
  renderWidget: () => void;
  notif: {
    startTimerNotification: (attrs: Record<string, unknown>) => void;
    updateTimerNotification: (state: Record<string, unknown>) => void;
    stopTimerNotification: () => void;
  } | null;
}

const swallow = (fn: () => void): void => {
  try {
    fn();
  } catch {
    // best-effort; presence must never break the guess→timer→learn loop
  }
};

export function createAndroidPresence(deps: AndroidPresenceDeps): NativePresenceModule {
  return {
    isStub: false,
    writeSnapshot: (snapshot: WidgetSnapshot) =>
      swallow(() => {
        deps.saveSnapshot(snapshot);
        deps.renderWidget();
      }),
    clearSnapshot: () =>
      swallow(() => {
        deps.clearSnapshot();
        deps.renderWidget();
      }),
    startLiveActivity: (attributes: LiveActivityAttributes) =>
      swallow(() => deps.notif?.startTimerNotification({ ...attributes })),
    updateLiveActivity: (state: { isOverrun: boolean }) =>
      swallow(() => deps.notif?.updateTimerNotification({ ...state })),
    endLiveActivity: () => swallow(() => deps.notif?.stopTimerNotification()),
  };
}
