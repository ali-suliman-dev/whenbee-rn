import { create } from 'zustand';
import { kv } from '@/src/lib/kv';
import { submitFeedback, fetchChangelog, drainQueue } from '@/src/services/feedback';
import type { ChangelogEntry, FeedbackInput } from '@/src/features/feedback/types';

// ──────────────────────────────────────────────────────────────────────────────
// feedbackStore — the changelog + unread state, shared across Settings and the
// What's-new sheet. A plain hook per screen kept its own `useState`, so Settings
// never saw the entries What's-new had already loaded and never noticed
// `markChangelogSeen` firing there. Owning it in a store fixes both: any screen
// reading `changelog`/`hasUnread` sees the same state everyone else does.
//
// `lastSeenAt` is durable but NOT zustand-persisted — it's a single ISO string
// read/written straight to kv (mirrors how other stores keep one KV-backed field
// alongside otherwise in-memory state), so there's no persist-middleware
// round-trip for a value this small.
// ──────────────────────────────────────────────────────────────────────────────

const SEEN_KEY = 'feedback.changelog.lastSeenAt';

export function computeHasUnread(entries: ChangelogEntry[], lastSeenAt: string | null): boolean {
  if (entries.length === 0) return false;
  const newest = entries.reduce((m, e) => (e.publishedAt > m ? e.publishedAt : m), '');
  if (!lastSeenAt) return true;
  return newest > lastSeenAt;
}

interface FeedbackState {
  changelog: ChangelogEntry[];
  loading: boolean;
  lastSeenAt: string | null;
  loadChangelog: () => Promise<void>;
  markChangelogSeen: () => void;
  submit: (input: FeedbackInput) => Promise<void>;
}

export const useFeedbackStore = create<FeedbackState>()((set, get) => ({
  changelog: [],
  loading: false,
  lastSeenAt: kv.getString(SEEN_KEY),

  loadChangelog: async () => {
    set({ loading: true });
    const rows = await fetchChangelog();
    set({ changelog: rows, loading: false });
  },

  markChangelogSeen: () => {
    const newest = get().changelog.reduce((m, e) => (e.publishedAt > m ? e.publishedAt : m), '');
    if (newest) {
      kv.set(SEEN_KEY, newest);
      set({ lastSeenAt: newest });
    }
  },

  submit: (input) => submitFeedback(input),
}));

/** Selector: true when an unseen published changelog entry exists. */
export function useHasUnreadChangelog(): boolean {
  return useFeedbackStore((s) => computeHasUnread(s.changelog, s.lastSeenAt));
}

let drained = false;
/**
 * Drains any queued submissions, best-effort — guarded so it runs at most
 * once per app session no matter how many screens call it. Kept as an
 * explicit function (rather than a module-load side effect) so import order
 * in tests can't race a mocked `drainQueue`.
 */
export function drainFeedbackQueueOnce(): void {
  if (drained) return;
  drained = true;
  void drainQueue();
}
