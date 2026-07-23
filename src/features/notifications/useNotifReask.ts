// src/features/notifications/useNotifReask.ts
// Hook driving the once-ever re-ask row on the reward screen after a declined
// soft-ask. Eligibility is decided by the pure reaskGate; this hook wires the
// async reads (permission status, lifetime nectar), spends the one-shot budget
// the moment the row renders, and handles the two accept paths:
//   'granted' — OS permission already exists → just flip Reminders on.
//   'overrun' — fire the OS prompt first; flip Reminders on only on grant.

import { useState, useEffect, useCallback, useRef } from 'react';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useSettingsStore } from '@/src/stores/settingsStore';
import {
  getNotifSoftAsk,
  getNotifReaskMeta,
  ensureDeclineMeta,
  markNotifReaskUsed,
} from './notifSoftAskState';
import { reaskTriggerFor, type ReaskTrigger } from './reaskGate';
import {
  ensureNotificationPermission,
  getNotificationPermissionStatus,
  type NotificationPermissionStatus,
} from '@/src/services/timerNotifications';
import { analytics } from '@/src/services/analytics';

export interface NotifReaskView {
  /** Whether the re-ask row should be rendered. */
  show: boolean;
  /** Which moment qualified — drives the row's copy. Null when hidden. */
  trigger: ReaskTrigger | null;
  /** Minutes the log ran past its guess (overrun copy). */
  overrunMin: number;
  /** Accept: enable the ping (prompting the OS only when still undetermined). */
  onAccept: () => Promise<void>;
  /** Dismiss the row. The budget is already spent by the show itself. */
  onDismiss: () => void;
}

export function useNotifReask(input: { guessMin: number; actualMin: number }): NotifReaskView {
  const loadReclaimSummary = useCalibrationStore((s) => s.loadReclaimSummary);
  const remindersEnabled = useSettingsStore((s) => s.remindersEnabled);

  const [permStatus, setPermStatus] = useState<NotificationPermissionStatus | null>(null);
  const [lifetimeNectar, setLifetimeNectar] = useState<number | null>(null);
  // Local terminal state: accepted/dismissed this session → row gone.
  const [done, setDone] = useState(false);

  useEffect(() => {
    void getNotificationPermissionStatus().then(setPermStatus);
    void loadReclaimSummary().then((s) => {
      // Legacy declines (pre-feature) get their clocks stamped from "now".
      ensureDeclineMeta(s.companion.lifetimeNectar);
      setLifetimeNectar(s.companion.lifetimeNectar);
    });
  }, [loadReclaimSummary]);

  const meta = getNotifReaskMeta();
  const trigger =
    permStatus !== null && lifetimeNectar !== null && !done && meta.declinedAtMs !== null
      ? reaskTriggerFor({
          status: getNotifSoftAsk(),
          reaskUsed: meta.used,
          remindersEnabled,
          permStatus,
          declinedAtMs: meta.declinedAtMs,
          nectarAtDecline: meta.nectarAtDecline ?? 0,
          lifetimeNectar,
          nowMs: Date.now(),
          guessMin: input.guessMin,
          actualMin: input.actualMin,
        })
      : null;

  const show = trigger !== null;

  // Spend the one-shot budget (and track) the moment the row first renders.
  const spentRef = useRef(false);
  useEffect(() => {
    if (show && !spentRef.current) {
      spentRef.current = true;
      markNotifReaskUsed();
      analytics.capture('notif_reask', { action: 'shown', trigger });
    }
  }, [show, trigger]);

  const onAccept = useCallback(async () => {
    setDone(true);
    analytics.capture('notif_reask', { action: 'accepted', trigger });
    if (trigger === 'granted') {
      useSettingsStore.getState().setRemindersEnabled(true);
      analytics.capture('reminder_enabled', {});
      return;
    }
    const granted = await ensureNotificationPermission();
    if (granted) {
      useSettingsStore.getState().setRemindersEnabled(true);
      analytics.capture('reminder_enabled', {});
    }
  }, [trigger]);

  const onDismiss = useCallback(() => {
    setDone(true);
    analytics.capture('notif_reask', { action: 'dismissed', trigger });
  }, [trigger]);

  return {
    show,
    trigger,
    overrunMin: Math.max(0, Math.round(input.actualMin - input.guessMin)),
    onAccept,
    onDismiss,
  };
}
