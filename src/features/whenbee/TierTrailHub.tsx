import { useMemo } from 'react';
import { HoneyTrail, type TrailState } from '@/src/components/HoneyTrail';
import type { CompanionStage } from '@/src/engine';

// ──────────────────────────────────────────────────────────────────────────────
// TierTrailHub — the companion's ripeness journey, Raw → Keeper, as a trail of six
// milestone nodes. Thin adapter over the shared HoneyTrail: it maps the companion
// `stage` (1..6) onto node state (done / now / ahead), so state is always carried by
// BOTH color AND icon (the accessibility rule HoneyTrail already enforces).
//
// The trail is the FULL 6-stage ladder — the five tier bands plus the Keeper cap,
// which is the 6th node (set-once, every cell sealed). Stage indexes from 1, so the
// active node is `stage - 1`:
//
//   nodes BEFORE stage-1 → done   (✓, filled honey drop)
//   the stage-1 node      → now    (ring + BeeMascot centered)
//   nodes AFTER stage-1   → ahead  (hairline outline, no padlock)
//
// Monotonic by construction: stage never goes backward, so a done node never reverts.
// ──────────────────────────────────────────────────────────────────────────────

const TRAIL_LABELS = ['Raw', 'Setting', 'Ripening', 'Thickening', 'Honest', 'Keeper'] as const;

export function TierTrailHub({ stage }: { stage: CompanionStage }) {
  const nodes = useMemo(() => {
    const now = stage - 1;
    return TRAIL_LABELS.map((label, i) => ({
      label,
      state: (i < now ? 'done' : i === now ? 'now' : 'ahead') as TrailState,
    }));
  }, [stage]);
  return <HoneyTrail nodes={nodes} />;
}
