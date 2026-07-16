import { useCallback, useEffect, useState } from 'react';
import { kv } from '@/src/lib/kv';
import { submitFeedback, fetchChangelog, drainQueue } from '@/src/services/feedback';
import type { ChangelogEntry, FeedbackInput } from './types';

const SEEN_KEY = 'feedback.changelog.lastSeenAt';

export function computeHasUnread(entries: ChangelogEntry[], lastSeenAt: string | null): boolean {
  if (entries.length === 0) return false;
  const newest = entries.reduce((m, e) => (e.publishedAt > m ? e.publishedAt : m), '');
  if (!lastSeenAt) return true;
  return newest > lastSeenAt;
}

export function useFeedback() {
  const [changelog, setChangelog] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(() => kv.getString(SEEN_KEY));

  const submit = useCallback((input: FeedbackInput) => submitFeedback(input), []);

  const loadChangelog = useCallback(async () => {
    setLoading(true);
    const rows = await fetchChangelog();
    setChangelog(rows);
    setLoading(false);
  }, []);

  const markChangelogSeen = useCallback(() => {
    const newest = changelog.reduce((m, e) => (e.publishedAt > m ? e.publishedAt : m), '');
    if (newest) {
      kv.set(SEEN_KEY, newest);
      setLastSeenAt(newest);
    }
  }, [changelog]);

  // Drain any queued submissions once on mount (best-effort).
  useEffect(() => { void drainQueue(); }, []);

  return {
    submit,
    changelog,
    loading,
    loadChangelog,
    hasUnread: computeHasUnread(changelog, lastSeenAt),
    markChangelogSeen,
  };
}
