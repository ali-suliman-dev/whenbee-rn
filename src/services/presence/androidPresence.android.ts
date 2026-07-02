// Android wiring: binds the native WhenbeePresence module into the pure
// createAndroidPresence factory. This file is only bundled on Android, so the
// Android-only native module lookup stays out of iOS.
import { requireOptionalNativeModule } from 'expo-modules-core';
import { createAndroidPresence, type AndroidPresenceDeps } from '@/src/services/presence/createAndroidPresence';
import type { NativePresenceModule } from '@/src/services/liveActivity';

type NotifModule = NonNullable<AndroidPresenceDeps['notif']>;

export function loadAndroidPresence(): NativePresenceModule {
  const notif = requireOptionalNativeModule<NotifModule>('WhenbeePresence') ?? null;
  return createAndroidPresence({ notif });
}
