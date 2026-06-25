import { useState } from 'react';
import { kv } from '@/src/lib/kv';

// ──────────────────────────────────────────────────────────────────────────────
// usePatternDismiss — durable kv-backed dismissal for Patterns insight cards.
//
// Dismissing a card persists its id to the "patterns-dismissed" set in kv so
// the card stays gone across sessions. The id scheme must be STABLE for the same
// insight content but CHANGE when the content is genuinely new:
//
//   DriftNote:       "drift:{categoryId}:{ISO-week}"
//   BiggestSurprise: "surprise:{categoryId}:{estimateMin}x{actualMin}"
//   PlanExperiment:  "experiment:{timedCount}:{retroCount}"
//
// Each id encodes just enough of the content to detect a real change without
// changing on every minor float oscillation. The ISO-week for DriftNote and the
// exact counts for PlanExperiment mean a new week or a new observation batch
// produces a new id (and thus a visible card again). BiggestSurprise uses the
// exact guess+actual pair — a different task surprise (different numbers) is a
// new id and shows again; the same pair stays dismissed.
//
// A dismissed id renders null; a fresh id shows as normal. No regeneration of
// dismissed insights (the #1 "spam" complaint from user research).
// ──────────────────────────────────────────────────────────────────────────────

const KV_KEY = 'patterns-dismissed';

/** Load the persisted dismissed-id set from kv. Returns an empty array when no
 *  entry exists yet (first run or after clearAll). */
function loadDismissed(): string[] {
  const raw = kv.getString(KV_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

/** Maximum number of dismissed ids to keep. Oldest entries are dropped first
 *  when this cap is exceeded. The cap is intentionally generous (100 ids) — a
 *  user would have to dismiss every Insight card across many weeks to hit it,
 *  and when they do the oldest dismissals (weeks-ago insights) are the safest
 *  to forget (those insights will have new ids by then anyway). */
const MAX_DISMISSED = 100;

/** Persist a new dismissed id (idempotent — a second dismiss of the same id is
 *  a no-op; the set never has duplicates). Trims to MAX_DISMISSED by dropping
 *  the oldest entries (FIFO) so the set doesn't grow forever. */
function persistDismiss(id: string): void {
  const current = loadDismissed();
  if (current.includes(id)) return;
  const next = [...current, id];
  // Keep only the tail (most-recent MAX_DISMISSED entries).
  const trimmed = next.length > MAX_DISMISSED ? next.slice(next.length - MAX_DISMISSED) : next;
  kv.set(KV_KEY, JSON.stringify(trimmed));
}

/** Durable dismissal hook for a single Patterns insight card.
 *
 *  @param id  A stable, content-keyed identifier for this card instance (see
 *             the id scheme above). Changing the id produces a new, undismissed
 *             card — which is the intended behaviour when content changes.
 *
 *  @returns   `dismissed` — true when this id is in the persisted set (card
 *             should render null). `dismiss` — call once on user tap; updates
 *             local state immediately AND writes to kv so future mounts agree.
 */
export function usePatternDismiss(id: string): { dismissed: boolean; dismiss: () => void } {
  // Initialise from kv synchronously (kv is synchronous — expo-sqlite/kv-store).
  const [dismissed, setDismissed] = useState<boolean>(() => loadDismissed().includes(id));

  function dismiss(): void {
    persistDismiss(id);
    setDismissed(true);
  }

  return { dismissed, dismiss };
}
