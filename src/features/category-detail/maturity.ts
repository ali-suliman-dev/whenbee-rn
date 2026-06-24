import { CONFIDENCE_HONEST_MIN_LOGS } from '@/src/engine';
import type { CalibrationConfidence } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// maturityMeter — the honey-cell "runs to one honest number" progress.
//
// One cell per log lit, capped at the honest-confidence log threshold. Pure: the
// caption + pip render derive entirely from this. `settledButNoisy` flags the
// honest case where there are enough logs but the spread is still too wide to
// graduate (confidence stays 'setting') — copy nudges differently there.
// ──────────────────────────────────────────────────────────────────────────────

export interface Meter {
  filled: number;
  total: number;
  runsLeft: number;
  settledButNoisy: boolean;
}

export function maturityMeter(n: number, confidence: CalibrationConfidence): Meter {
  const total = CONFIDENCE_HONEST_MIN_LOGS;
  const filled = Math.max(0, Math.min(n, total));
  const runsLeft = Math.max(0, total - n);
  const settledButNoisy = runsLeft === 0 && confidence !== 'honest';
  return { filled, total, runsLeft, settledButNoisy };
}
