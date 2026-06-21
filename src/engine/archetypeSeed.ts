// Archetype quiz seed — PURE TS. Maps self-perceived style answers to a provisional
// multiplier, and blends that seed (as a prior) with real log ratios so the
// provisional time-personality moves toward the truth as data accumulates. The quiz
// asks about BIAS/STYLE, never durations, so this never substitutes for calibration.
import { ARCHETYPE_SEED_PACE, ARCHETYPE_SEED_RABBIT_BUMP, ARCHETYPE_SEED_PSEUDO, RATIO_CEIL } from './constants';

export interface QuizAnswers {
  pace: 'about' | 'bit' | 'lot' | 'lose';
  mid?: 'track' | 'rabbit';
  focus?: 'morning' | 'evening' | 'varies';
}

export function seedMultiplierFor(a: QuizAnswers): number {
  let m = ARCHETYPE_SEED_PACE[a.pace];
  if (a.mid === 'rabbit') m *= ARCHETYPE_SEED_RABBIT_BUMP;
  return Math.min(RATIO_CEIL, m);
}

/** Geometric-mean blend of the seed (worth ARCHETYPE_SEED_PSEUDO pseudo-logs) with
 *  the real data's log-mean. Mirrors the engine's log-space blend-with-prior. */
export function provisionalArchetypeMultiplier(seedM: number, dataRatios: number[]): number {
  const k = ARCHETYPE_SEED_PSEUDO;
  const n = dataRatios.length;
  const seedLog = Math.log(seedM);
  if (n === 0) return seedM;
  const dataLog = dataRatios.reduce((s, r) => s + Math.log(r), 0) / n;
  const blended = (k * seedLog + n * dataLog) / (k + n);
  return Math.exp(blended);
}
