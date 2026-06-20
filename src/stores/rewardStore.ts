import { create } from 'zustand';
import type { LogResult } from './calibrationStore';
import type { LogSource } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// rewardStore — transient hand-off from Timer/Retro → Reward screen.
//
// EPHEMERAL by design (NOT persisted): the producer (Timer "Stop & log" or Retro
// "Save & ripen") sets the reward payload immediately before navigating; the
// Reward screen reads it on mount and calls clear() on the way out. It exists so
// the Reward modal can render the just-logged numbers + honey result without
// re-deriving them from the engine. Surviving a crash would only resurrect a
// stale celebration, so we deliberately keep it in-memory only.
// ──────────────────────────────────────────────────────────────────────────────

interface RewardState {
  actualMin: number;
  guessMin: number;
  category: string;
  label: string | null;
  /** How the log was captured — drives the reward headline (retro → "Caught up"). */
  source: LogSource;
  /**
   * The full applyLog outcome. Still carries `reclaimDeltaMin` / `reclaimLifetimeMin`
   * as dormant fields (the reclaim bank keeps accumulating in the DB), but the Reward
   * screen no longer renders them — reclaim was removed as a user-facing metric.
   */
  result: LogResult | null;
  setReward: (p: {
    actualMin: number;
    guessMin: number;
    category: string;
    label: string | null;
    result: LogResult;
    /** Defaults to 'timed' when omitted (keeps the Timer call site terse). */
    source?: LogSource;
  }) => void;
  clear: () => void;
}

const CLEARED = {
  actualMin: 0,
  guessMin: 0,
  category: '',
  label: null,
  source: 'timed' as LogSource,
  result: null,
} as const;

export const useRewardStore = create<RewardState>((set) => ({
  ...CLEARED,
  setReward: (p) => set({ ...p, source: p.source ?? 'timed' }),
  clear: () => set({ ...CLEARED }),
}));
