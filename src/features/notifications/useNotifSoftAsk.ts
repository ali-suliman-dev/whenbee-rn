// src/features/notifications/useNotifSoftAsk.ts
// Hook that drives the post-calibration notification soft-ask card.
//
// Show predicate (ALL must hold):
//   1. The current reward is the user's FIRST completed calibration (logs === 1).
//   2. The soft-ask state is 'pending' (never shown / user has not responded).
//   3. The OS notification permission is still 'undetermined' (not yet granted or denied).
//
// On "Sounds good": fires the existing ensureNotificationPermission (guarded),
// then records 'accepted' in KV.
// On "Not now": records 'declined'. Re-entry path = Settings notification toggle.

import { useState, useEffect, useCallback } from 'react';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { getNotifSoftAsk, setNotifSoftAsk, type NotifSoftAskStatus } from './notifSoftAskState';
import {
  ensureNotificationPermission,
  getNotificationPermissionStatus,
  type NotificationPermissionStatus,
} from '@/src/services/timerNotifications';

export interface NotifSoftAskView {
  /** Whether the soft-ask card should be rendered. */
  show: boolean;
  /** User tapped "Sounds good" — fires the OS permission prompt, records accepted. */
  onAccept: () => Promise<void>;
  /** User tapped "Not now" — records declined, hides the card. */
  onDecline: () => void;
}

export function useNotifSoftAsk(): NotifSoftAskView {
  const logs = useCalibrationStore((s) => s.logs);
  const isFirstCalibration = logs === 1;

  // Async state: null = loading, values populate after mount. Card stays hidden
  // while loading so there is no flash; the opacity entrance covers the reveal.
  const [status, setStatus] = useState<NotifSoftAskStatus | null>(null);
  const [permStatus, setPermStatus] = useState<NotificationPermissionStatus | null>(null);

  useEffect(() => {
    setStatus(getNotifSoftAsk());
    void getNotificationPermissionStatus().then(setPermStatus);
  }, []);

  // All three guards must pass before the card renders.
  const show =
    isFirstCalibration &&
    status === 'pending' &&
    permStatus === 'undetermined';

  const onAccept = useCallback(async () => {
    // Optimistically hide the card, then fire the OS prompt.
    setNotifSoftAsk('accepted');
    setStatus('accepted');
    await ensureNotificationPermission();
  }, []);

  const onDecline = useCallback(() => {
    setNotifSoftAsk('declined');
    setStatus('declined');
  }, []);

  return { show, onAccept, onDecline };
}
