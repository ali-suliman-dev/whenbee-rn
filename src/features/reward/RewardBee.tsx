import { BeeBurst } from '@/src/components/bee/BeeBurst';
import { useTheme } from '@/src/theme/useTheme';

// ──────────────────────────────────────────────────────────────────────────────
// RewardBee — the Reward-moment crest. A reward-scoped (smaller) BeeBurst so the
// bee is a calm intro, not the hero. Normal log shows "+1 nectar"; a seal swaps
// to the ▲ upgrade coin. Global burst sizes (hub/paywall) are untouched.
// ──────────────────────────────────────────────────────────────────────────────

export function RewardBee({ sealed = false }: { sealed?: boolean }) {
  const t = useTheme();
  return (
    <BeeBurst
      variant={sealed ? 'upgrade' : 'reward'}
      stageSize={t.burst.stageReward}
      beeSize={t.burst.beeReward}
    />
  );
}
