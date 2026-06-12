import { useMemo } from 'react';
import { TierTrail } from '@/src/components/TierTrail';
import type { Tier } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// TierTrailHub — the companion's ripeness journey, Raw → Honest, as a trail of
// milestone nodes. Thin adapter over the shared TierTrail: it maps the lead
// `tier` onto node state (done / now / lock), so state is always carried by BOTH
// color AND icon (the accessibility rule TierTrail already enforces).
//
//   tiers BEFORE the lead tier → done   (✓, filled)
//   the lead tier              → now     (○ ring + center dot)
//   tiers AFTER the lead tier  → lock    (🔒 hairline)
//
// Monotonic by construction: tier never goes backward, so a done node never
// reverts to locked.
// ──────────────────────────────────────────────────────────────────────────────

const TIER_ORDER: readonly Tier[] = ['Raw', 'Setting', 'Ripening', 'Thickening', 'Honest'];

export function TierTrailHub({ tier }: { tier: Tier }) {
  const nodes = useMemo(() => {
    const nowIdx = TIER_ORDER.indexOf(tier);
    return TIER_ORDER.map((label, i) => ({
      label,
      state: (i < nowIdx ? 'done' : i === nowIdx ? 'now' : 'lock') as 'done' | 'now' | 'lock',
    }));
  }, [tier]);

  return <TierTrail nodes={nodes} />;
}
