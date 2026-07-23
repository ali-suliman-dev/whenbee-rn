// src/features/notifications/useNotifSoftAsk.ts
// Hook that drives the post-calibration notification soft-ask card.
//
// Show predicate (ALL must hold):
//   1. The current reward is the user's FIRST completed calibration EVER
//      (lifetimeNectar === 1, sourced from the persisted companion row via
//      loadReclaimSummary — NOT the session-scoped `logs` counter which resets
//      to 0 on every app boot).
//   2. The soft-ask state is 'pending' (never shown / user has not responded).
//   3. The OS notification permission is still 'undetermined' (not yet granted or denied).
//
// On "Turn on the ping": fires the existing ensureNotificationPermission
// (guarded), records 'accepted' in KV, and — on grant — flips the master
// remindersEnabled setting so the ping actually schedules.
// On "Not now": records 'declined'. Re-entry path = Settings notification toggle.

import { useState, useEffect, useCallback, useRef } from 'react';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useSettingsStore } from '@/src/stores/settingsStore';
import {
  getNotifSoftAsk,
  setNotifSoftAsk,
  recordNotifSoftAskDecline,
  type NotifSoftAskStatus,
} from './notifSoftAskState';
import {
  ensureNotificationPermission,
  getNotificationPermissionStatus,
  type NotificationPermissionStatus,
} from '@/src/services/timerNotifications';
import { analytics } from '@/src/services/analytics';

export interface NotifSoftAskView {
  /** Whether the soft-ask card should be rendered. */
  show: boolean;
  /** User tapped "Turn on the ping" — fires the OS permission prompt, records accepted. */
  onAccept: () => Promise<void>;
  /** User tapped "Not now" — records declined, hides the card. */
  onDecline: () => void;
}

export function useNotifSoftAsk(): NotifSoftAskView {
  const loadReclaimSummary = useCalibrationStore((s) => s.loadReclaimSummary);

  // Async state: null = loading, values populate after mount. Card stays hidden
  // while loading so there is no flash; the opacity entrance covers the reveal.
  // lifetimeNectar comes from the persisted companion row (survives session restarts).
  const [lifetimeNectar, setLifetimeNectar] = useState<number | null>(null);
  const [status, setStatus] = useState<NotifSoftAskStatus | null>(null);
  const [permStatus, setPermStatus] = useState<NotificationPermissionStatus | null>(null);

  useEffect(() => {
    setStatus(getNotifSoftAsk());
    void getNotificationPermissionStatus().then(setPermStatus);
    void loadReclaimSummary().then((s) => setLifetimeNectar(s.companion.lifetimeNectar));
  }, [loadReclaimSummary]);

  // All three guards must pass before the card renders.
  const show =
    lifetimeNectar === 1 &&
    status === 'pending' &&
    permStatus === 'undetermined';

  // Fire notif_softask_shown exactly once when the card first becomes visible.
  const shownTrackedRef = useRef(false);
  useEffect(() => {
    if (show && !shownTrackedRef.current) {
      shownTrackedRef.current = true;
      analytics.capture('notif_softask_shown');
    }
  }, [show]);

  const onAccept = useCallback(async () => {
    // Optimistically hide the card, then fire the OS prompt.
    setNotifSoftAsk('accepted');
    setStatus('accepted');
    analytics.capture('notif_softask_accepted');
    // OS grant alone is not enough — the timer-done ping is gated on the app's
    // master Reminders setting (useTimer), so flip it on too. Mirrors
    // useReminderSetting.toggle(true); stays off if the OS prompt is denied.
    const granted = await ensureNotificationPermission();
    if (granted) {
      useSettingsStore.getState().setRemindersEnabled(true);
      analytics.capture('reminder_enabled', {});
    }
  }, []);

  const onDecline = useCallback(() => {
    // Stamp when + at what log count the decline happened — the once-ever
    // re-ask (reaskGate) runs its ≥days/≥logs clocks from these.
    recordNotifSoftAskDecline(lifetimeNectar ?? 0);
    setStatus('declined');
    analytics.capture('notif_softask_declined');
  }, [lifetimeNectar]);

  return { show, onAccept, onDecline };
}
