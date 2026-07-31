import { useEffect } from 'react';
import i18n from '@/src/i18n';
import { kv } from '@/src/lib/kv';
import {
  REVIEW_NOTIFY_ENABLED_KEY,
  scheduleWeeklyReview,
} from '@/src/services/reviewNotifications';
import { reviewCadenceFor, resolveMonthPeriod, resolveWeekPeriod } from '@/src/engine';
import { useRoutinesStore } from '@/src/stores/routinesStore';

// ──────────────────────────────────────────────────────────────────────────────
// useRelocalizeNotifications — re-issue queued notifications after a language change.
//
// A scheduled notification carries its TEXT, not a key: the title and body are
// resolved through i18next at schedule time and handed to the OS. So switching
// language in Settings (or the device locale changing under a 'system'
// preference) leaves every already-queued alert speaking the old language, some
// of them days out. Nothing re-renders them — they have to be re-scheduled.
//
// Only the DURABLE schedules need this. Timer-done / start-by / guard alerts are
// re-issued whenever a timer or the day's plan changes, and never outlive the
// session by long; the weekly review and routine start-by alerts can sit in the
// queue for days.
// ──────────────────────────────────────────────────────────────────────────────

export function useRelocalizeNotifications(): void {
  useEffect(() => {
    const relocalize = () => {
      void (async () => {
        if (kv.getString(REVIEW_NOTIFY_ENABLED_KEY) === '1') {
          const now = Date.now();
          const period =
            reviewCadenceFor(now) === 'month' ? resolveMonthPeriod(now) : resolveWeekPeriod(now);
          // scheduleWeeklyReview cancels the existing one first.
          await scheduleWeeklyReview(period.id);
        }
        await useRoutinesStore.getState().rescheduleAllAlerts();
      })();
    };

    i18n.on('languageChanged', relocalize);
    return () => {
      i18n.off('languageChanged', relocalize);
    };
  }, []);
}
