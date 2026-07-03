// Pure, dependency-injected Android implementation of NativePresenceModule.
// Every call forwards to the native WhenbeePresence module — the home-screen
// widget is a real RemoteViews surface it paints directly, and the running-timer
// "Live Activity" maps onto its ongoing-notification API. Every method is
// best-effort — a presence failure must never reach the core loop.
import type { NativePresenceModule, WidgetSnapshot, LiveActivityAttributes } from '@/src/services/liveActivity';

export interface AndroidPresenceDeps {
  notif: {
    writeWidgetSnapshot: (json: string) => void;
    clearWidgetSnapshot: () => void;
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
      swallow(() => deps.notif?.writeWidgetSnapshot(JSON.stringify(snapshot))),
    clearSnapshot: () => swallow(() => deps.notif?.clearWidgetSnapshot()),
    startLiveActivity: (attributes: LiveActivityAttributes) =>
      swallow(() => deps.notif?.startTimerNotification({ ...attributes })),
    updateLiveActivity: (state: { isOverrun: boolean }) =>
      swallow(() => deps.notif?.updateTimerNotification({ ...state })),
    endLiveActivity: () => swallow(() => deps.notif?.stopTimerNotification()),
  };
}
