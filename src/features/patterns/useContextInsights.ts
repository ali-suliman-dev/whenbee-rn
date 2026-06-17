import { useEffect, useState } from 'react';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import type { ContextCorrelation } from '@/src/engine';

// ──────────────────────────────────────────────────────────────────────────────
// useContextInsights (S4) — read-only loader for the Pro context surface (e.g.
// "on low-energy sessions your estimates run further off"). Like reason insights,
// these move slowly (they need enough tagged sessions per value), so a mount-time
// load is enough. The store owns all db access; this hook only triggers + exposes.
// It NEVER trains the calibration model.
// ──────────────────────────────────────────────────────────────────────────────

export function useContextInsights(): { insights: ContextCorrelation[]; loading: boolean } {
  const load = useCalibrationStore((s) => s.loadContextInsights);
  const [insights, setInsights] = useState<ContextCorrelation[]>([]);
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
