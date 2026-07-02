// Android wiring: binds the real kv store, widget renderer, and native
// notification module into the pure createAndroidPresence factory. This file is
// only bundled on Android, so the Android-only library import stays out of iOS.
import React from 'react';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { createAndroidPresence } from '@/src/services/presence/createAndroidPresence';
import { widgetSnapshotStore } from '@/src/widgets/widgetSnapshotStore';
import { NextTaskWidget } from '@/src/widgets/NextTaskWidget';
import type { NativePresenceModule } from '@/src/services/liveActivity';

const WIDGET_NAME = 'NextTask';

type NotifModule = {
  startTimerNotification: (attrs: Record<string, unknown>) => void;
  updateTimerNotification: (state: Record<string, unknown>) => void;
  stopTimerNotification: () => void;
};

function renderCurrentWidget(): void {
  const nowSec = Math.round(Date.now() / 1000);
  void requestWidgetUpdate({
    widgetName: WIDGET_NAME,
    renderWidget: () =>
      React.createElement(NextTaskWidget, { snapshot: widgetSnapshotStore.load(), nowSec }),
    widgetNotFound: () => {
      // no widget on the home screen yet — nothing to paint
    },
  });
}

export function loadAndroidPresence(): NativePresenceModule {
  const notif = requireOptionalNativeModule<NotifModule>('WhenbeePresence') ?? null;
  return createAndroidPresence({
    saveSnapshot: widgetSnapshotStore.save,
    clearSnapshot: widgetSnapshotStore.clear,
    renderWidget: renderCurrentWidget,
    notif,
  });
}
