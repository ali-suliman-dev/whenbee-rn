import { useCallback, useState } from 'react';
import { analytics } from '@/src/services/analytics';
import {
  ensureReviewNotificationPermission,
  scheduleWeeklyReview,
  cancelWeeklyReview,
  REVIEW_NOTIFY_ENABLED_KEY,
} from '@/src/services/reviewNotifications';
import { resolveWeekPeriod, resolveMonthPeriod, reviewCadenceFor } from '@/src/engine';
import { kv } from '@/src/lib/kv';

// ──────────────────────────────────────────────────────────────────────────────
// useReviewNotifySetting — the "Monday review" opt-in (Pro), default OFF. The
// enabled flag lives in KV (the review feature's own persistence, off the settings
// store), so this hook owns reading/writing it plus the permission + schedule
// dance. Turning it on asks for permission first; a decline keeps it off and
// reports false so the UI can explain. Keeps the service + analytics out of the route.
// ──────────────────────────────────────────────────────────────────────────────

export function useReviewNotifySetting() {
  const [enabled, setEnabled] = useState(() => kv.getString(REVIEW_NOTIFY_ENABLED_KEY) === '1');

  const toggle = useCallback(async (next: boolean): Promise<boolean> => {
    if (next) {
      const granted = await ensureReviewNotificationPermission();
      if (!granted) return false;
      kv.set(REVIEW_NOTIFY_ENABLED_KEY, '1');
      setEnabled(true);
      analytics.capture('review_notify_toggled', { enabled: true });
      const now = Date.now();
      const period =
        reviewCadenceFor(now) === 'month' ? resolveMonthPeriod(now) : resolveWeekPeriod(now);
      await scheduleWeeklyReview(period.id);
      return true;
    }
    kv.set(REVIEW_NOTIFY_ENABLED_KEY, '0');
    setEnabled(false);
    analytics.capture('review_notify_toggled', { enabled: false });
    await cancelWeeklyReview();
    return true;
  }, []);

  return { enabled, toggle };
}
