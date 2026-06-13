import { BeeBurst } from '@/src/components/bee/BeeBurst';

// ──────────────────────────────────────────────────────────────────────────────
// RewardBee — the Reward-moment hero. Now a thin wrapper over the reusable
// BeeBurst illustration (sunburst + floating Whenbee + coin token), replacing the
// old boxed honey-cell stand-in. A normal honest log shows the "+1 nectar" coin; a
// cap/seal (tier ripened) swaps to the ▲ upgrade coin to mark the level-up.
// ──────────────────────────────────────────────────────────────────────────────

export function RewardBee({ sealed = false }: { sealed?: boolean }) {
  return <BeeBurst variant={sealed ? 'upgrade' : 'reward'} />;
}
