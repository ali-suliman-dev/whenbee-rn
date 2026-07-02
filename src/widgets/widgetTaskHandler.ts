// Headless task the OS invokes for widget lifecycle events (add / periodic update /
// resize / click), even when the app is closed. We re-render NextTask from the
// last-known snapshot in kv, and open the Start deep link on tap.
import React from 'react';
import { Linking } from 'react-native';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { NextTaskWidget } from '@/src/widgets/NextTaskWidget';
import { widgetSnapshotStore } from '@/src/widgets/widgetSnapshotStore';

const nowSec = () => Math.round(Date.now() / 1000);

export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  const { widgetAction, renderWidget, clickAction } = props;

  if (widgetAction === 'WIDGET_CLICK' && clickAction === 'OPEN_START') {
    const snapshot = widgetSnapshotStore.load();
    const url = snapshot?.startDeepLink ?? 'whenbee://timer';
    await Linking.openURL(url).catch(() => {});
    return;
  }

  // WIDGET_ADDED | WIDGET_UPDATE | WIDGET_RESIZED → paint from stored state.
  renderWidget(React.createElement(NextTaskWidget, { snapshot: widgetSnapshotStore.load(), nowSec: nowSec() }));
}
