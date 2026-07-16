import { useEffect } from 'react';
import {
  useFeedbackStore,
  useHasUnreadChangelog,
  computeHasUnread,
  drainFeedbackQueueOnce,
} from '@/src/stores/feedbackStore';

export { computeHasUnread };

/**
 * Thin delegator onto the shared `feedbackStore` — kept so existing screens
 * (`settings.tsx`, `whats-new.tsx`, `feedback.tsx`) don't need to know about
 * Zustand. The state itself lives in the store, not per-instance `useState`,
 * so every screen reading `changelog`/`hasUnread` sees the same values and a
 * `markChangelogSeen()` call anywhere clears the unread dot everywhere.
 */
export function useFeedback() {
  const submit = useFeedbackStore((s) => s.submit);
  const changelog = useFeedbackStore((s) => s.changelog);
  const loading = useFeedbackStore((s) => s.loading);
  const loadChangelog = useFeedbackStore((s) => s.loadChangelog);
  const markChangelogSeen = useFeedbackStore((s) => s.markChangelogSeen);
  const hasUnread = useHasUnreadChangelog();

  // Drain any queued submissions once per app session (best-effort).
  useEffect(() => {
    drainFeedbackQueueOnce();
  }, []);

  return { submit, changelog, loading, loadChangelog, hasUnread, markChangelogSeen };
}
