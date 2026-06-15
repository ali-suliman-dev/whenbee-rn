import { useMemo } from 'react';
import { TierTrail } from '@/src/components/TierTrail';
import type { CompanionStage } from '@/src/engine';

// ──────────────────────────────────────────────────────────────────────────────
// TierTrailHub — the companion's ripeness journey, Raw → Keeper, as a trail of six
// milestone nodes. Thin adapter over the shared TierTrail: it maps the companion
// `stage` (1..6) onto node state (done / now / lock), so state is always carried by
// BOTH color AND icon (the accessibility rule TierTrail already enforces).
//
// The trail is the FULL 6-stage ladder — the five tier bands plus the Keeper cap,
// which is the 6th node (set-once, every cell sealed). Stage indexes from 1, so the
// active node is `stage - 1`:
//
//   nodes BEFORE stage-1 → done   (✓, filled)
//   the stage-1 node      → now    (○ ring + center dot)
//   nodes AFTER stage-1   → lock   (🔒 hairline)
//
// Monotonic by construction: stage never goes backward, so a done node never reverts.
// ──────────────────────────────────────────────────────────────────────────────

const TRAIL_LABELS = ['Raw', 'Setting', 'Ripening', 'Thickening', 'Honest', 'Keeper'] as const;

export function TierTrailHub({ stage }: { stage: CompanionStage }) {
  const nodes = useMemo(() => {
    const nowIdx = stage - 1;
    return TRAIL_LABELS.map((label, i) => ({
      label,
      state: (i < nowIdx ? 'done' : i === nowIdx ? 'now' : 'lock') as 'done' | 'now' | 'lock',
    }));
  }, [stage]);

  return <TierTrail nodes={nodes} />;
}
