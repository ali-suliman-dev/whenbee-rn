import { useEffect, useState } from 'react';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import type { ReasonInsight } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// useReasonInsights — read-only loader for the Pro "what steals your time" surface.
//
// Reason correlations change slowly (they need ≥4 tagged over-runs in a category),
// so a plain mount-time load is enough — no need to re-query on every focus the way
// the volatile Patterns cards do. The store owns all db access (layer rule); this
// hook only triggers the load and exposes the result. It NEVER trains the model.
// ──────────────────────────────────────────────────────────────────────────────

export function useReasonInsights(): { insights: ReasonInsight[]; loading: boolean } {
  const load = useCalibrationStore((s) => s.loadReasonInsights);
  const [insights, setInsights] = useState<ReasonInsight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void load().then((rows) => {
      if (active) {
        setInsights(rows);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [load]);

  return { insights, loading };
}
