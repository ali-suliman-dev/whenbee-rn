// src/features/notifications/useNotificationSetup.ts
// Thin hook that wires initNotifications into the React tree at launch.
// Lives in features/ so src/app/ can import it without violating the layer rule.

import { useEffect } from 'react';
import { initNotifications } from '@/src/services/notificationSetup';

/** Register notification categories + handlers once at root mount. */
export function useNotificationSetup(): void {
  useEffect(() => {
    const cleanup = initNotifications();
    return cleanup;
  }, []);
}
