import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandKv } from '@/src/lib/kv';
import { bankAssociation, type LearnedMap } from '@/src/features/shared/categoryGuess';

// ──────────────────────────────────────────────────────────────────────────────
// vocabStore — on-device learned vocabulary for the category guesser. Maps task
// title stems → the categories the user actually picked, banked on every real
// commit (Add-Task confirm, Retro "forgot to log"). `seq` is a monotonic integer
// stamped on each bank so recency can break count ties WITHOUT a clock — the
// guesser stays deterministic and the engine purity invariant holds.
//   • No network — pure local KV.
//   • bank() is the only writer; the guesser reads `map` to pre-pick.
// ──────────────────────────────────────────────────────────────────────────────

interface VocabState {
  /** stem → { categoryId → { count, lastSeq } }. */
  map: LearnedMap;
  /** Monotonic bank counter; provides recency ordering without Date.now(). */
  seq: number;
  /** Learn a title → category link. Bumps counts and ticks seq. */
  bank: (title: string, catId: string) => void;
}

export const useVocabStore = create<VocabState>()(
  persist(
    (set, get) => ({
      map: {},
      seq: 0,
      bank: (title, catId) => {
        const nextSeq = get().seq + 1;
        set({ map: bankAssociation(get().map, title, catId, nextSeq), seq: nextSeq });
      },
    }),
    { name: 'vocab', storage: createJSONStorage(() => zustandKv) },
  ),
);
