import { create } from 'zustand';
import type { LogResult } from './calibrationStore';

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
  result: LogResult | null;
  setReward: (p: {
    actualMin: number;
    guessMin: number;
    category: string;
    label: string | null;
    result: LogResult;
  }) => void;
  clear: () => void;
}

const CLEARED = {
  actualMin: 0,
  guessMin: 0,
  category: '',
  label: null,
  result: null,
} as const;

export const useRewardStore = create<RewardState>((set) => ({
  ...CLEARED,
  setReward: (p) => set({ ...p }),
  clear: () => set({ ...CLEARED }),
}));
