// src/services/notificationSetup.ts
// Launch-time notification wiring: register categories, set the foreground
// presentation handler, subscribe the response listener, return cleanup.
// No-op (noop cleanup) when the native module is absent (Expo Go / tests).

import { requireOptionalNativeModule } from 'expo-modules-core';
import { isExpoGo } from '@/src/lib/isExpoGo';
import { router } from 'expo-router';
import { registerNotificationCategories, ACTION } from '@/src/services/notificationCategories';
import { handleNotificationResponse } from '@/src/services/notificationResponses';
import { buildStartByTimerRoute } from '@/src/services/notificationRoutes';

type NotificationsModule = typeof import('expo-notifications');

function getModule(): NotificationsModule | null {
  if (isExpoGo) return null;
  if (!requireOptionalNativeModule('ExpoNotificationScheduler')) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications') as NotificationsModule;
  } catch {
    return null;
  }
}

/** Foreground navigation for the buttons that open the app. */
function navigateForAction(actionIdentifier: string, data: Record<string, unknown>): void {
  switch (actionIdentifier) {
    case ACTION.WRAP:
      // Hyperfocus-guardrail "Wrap up" must STOP + LOG the running timer, not just
      // open Today (which left it running — read as "did nothing / reset"). Route
      // through the timer screen's stop flow so it logs the session and shows reward.
      router.push('/(modals)/timer?action=stop');
      return;
    case ACTION.LOG:
      router.push('/(tabs)'); // Today, where logging lives
      return;
    case ACTION.START: {
      // Start the planned task's timer and land on the overlay. Falls back to
      // Today only if the reminder payload lacks the data to start a timer.
      const route = buildStartByTimerRoute(data);
      router.push(route ?? '/(tabs)');
      return;
    }
    case ACTION.REVIEW_OPEN:
      router.push('/(tabs)/patterns'); // review surface
      return;
    default:
      return;
  }
}

/**
 * Register categories + handlers once at launch. Returns a cleanup. No-op (noop
 * cleanup) without the native module so Expo Go / tests stay clean.
 */
export function initNotifications(): () => void {
  const N = getModule();
  if (!N) return () => {};

  void registerNotificationCategories(N);

  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  const sub = N.addNotificationResponseReceivedListener((response) => {
    const content = response.notification.request.content;
    const data = (content.data ?? {}) as Record<string, unknown>;
    const actionIdentifier = response.actionIdentifier;
    void handleNotificationResponse({ actionIdentifier, data });
    navigateForAction(actionIdentifier, data);
  });

  return () => sub.remove();
}
