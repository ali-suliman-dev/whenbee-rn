import type { Tier } from '../domain/types';

export type CompanionStage = 1 | 2 | 3 | 4 | 5 | 6;
export type DriftHealth = 'settled' | 'curious';

export interface CompanionCapability {
  id:
    | 'running-finish-time'
    | 'today-done-time'
    | 'start-by-anchor'
    | 'full-day-forecast'
    | 'drift-recalibration'
    | 'keeper-standing';
  tier: Tier | null;
  label: string;
  gatesNewFeature: boolean;
}

export const COMPANION_KEEPER_QUOTA = 3;

export function companionStageFor(input: { maxTier: number; keeper: boolean }): CompanionStage {
  if (input.keeper) return 6;
  const clamped = Math.max(0, Math.min(4, Math.trunc(input.maxTier)));
  return (clamped + 1) as CompanionStage;
}

const CAPABILITIES: Record<CompanionStage, CompanionCapability> = {
  1: { id: 'running-finish-time', tier: 'Raw', label: 'Live finish-time on your timer', gatesNewFeature: true },
  2: { id: 'today-done-time', tier: 'Setting', label: 'Done-time on Today and Add-Task', gatesNewFeature: true },
  3: { id: 'start-by-anchor', tier: 'Ripening', label: 'Reverse start-by anchor', gatesNewFeature: true },
  4: { id: 'full-day-forecast', tier: 'Thickening', label: 'Full-day forecast on the widget', gatesNewFeature: true },
  5: { id: 'drift-recalibration', tier: 'Honest', label: 'Drift re-check when life shifts', gatesNewFeature: true },
  6: { id: 'keeper-standing', tier: null, label: 'Keeper — your comb is sealed', gatesNewFeature: false },
};

export function capabilityFor(stage: CompanionStage): CompanionCapability {
  return CAPABILITIES[stage] ?? CAPABILITIES[1];
}

export function keeperReached(input: { cappedCellCount: number; trackedCount: number }): boolean {
  if (input.trackedCount < COMPANION_KEEPER_QUOTA) return false;
  return input.cappedCellCount >= input.trackedCount;
}

const DRIFT_TRIGGER = 0.4;
export function driftHealthFromRecent(recentClampedRatios: number[]): DriftHealth {
  if (recentClampedRatios.length === 0) return 'settled';
  const meanAbsLn =
    recentClampedRatios.reduce((sum, r) => sum + Math.abs(Math.log(r)), 0) / recentClampedRatios.length;
  return meanAbsLn > DRIFT_TRIGGER ? 'curious' : 'settled';
}
