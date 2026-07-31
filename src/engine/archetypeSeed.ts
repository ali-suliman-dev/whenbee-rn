// Archetype quiz seed — PURE TS. Maps self-perceived style answers to a provisional
// multiplier, and blends that seed (as a prior) with real log ratios so the
// provisional time-personality moves toward the truth as data accumulates. The quiz
// asks about BIAS/STYLE, never durations, so this never substitutes for calibration.
import { ARCHETYPE_SEED_PACE, ARCHETYPE_SEED_RABBIT_BUMP, ARCHETYPE_SEED_PSEUDO, RATIO_CEIL } from './constants';
import type { PaceAnswer, MidAnswer, FocusAnswer, SinkAnswer } from '@/src/domain/types';

export interface QuizAnswers {
  pace: PaceAnswer;
  mid?: MidAnswer;
  focus?: FocusAnswer;
  sink?: SinkAnswer;
}

/** Q3's answer → the category it names. Every value MUST exist in
 *  CATEGORY_PRIORS: an unpriced id would silently fall back to GLOBAL_PRIOR and
 *  the bump would land on nothing. The option LABELS are worded to match these
 *  categories — keep them in sync (quizQuestions.ts). */
const SINK_CATEGORY: Record<SinkAnswer, string> = {
  meetings: 'calls',
  chores: 'cleaning',
  errands: 'errands',
  deepwork: 'creative',
};

export function sinkCategoryFor(sink: SinkAnswer): string {
  return SINK_CATEGORY[sink];
}

export function seedMultiplierFor(a: QuizAnswers): number {
  let m = ARCHETYPE_SEED_PACE[a.pace];
  if (a.mid === 'rabbit') m *= ARCHETYPE_SEED_RABBIT_BUMP;
  return Math.min(RATIO_CEIL, m);
}

const AREA_LABEL: Record<NonNullable<QuizAnswers['sink']>, string> = {
  meetings: 'meetings',
  chores: 'chores',
  errands: 'errands',
  deepwork: 'deep work',
};

const PACE_FRAG: Record<QuizAnswers['pace'], string> = {
  about: 'your guesses land close',
  bit: 'you plan a touch tight',
  lot: 'you plan tight',
  lose: 'time slips away on you',
};

/** Produces the reveal "answer echo" line shown above the archetype title.
 *  Deterministic, no clock, pure TS. */
export function buildRevealEcho(a: QuizAnswers): string {
  const frags: string[] = [];

  // Frag A — always present, from pace
  frags.push(PACE_FRAG[a.pace]);

  // Frag B — from mid, optional
  if (a.mid === 'rabbit') {
    const areaSuffix = a.sink !== undefined ? ` on ${AREA_LABEL[a.sink]}` : '';
    frags.push(`rabbit-hole${areaSuffix}`);
  } else if (a.mid === 'track') {
    frags.push('you stay on track');
  }

  // Frag C — from sink, only when mid !== 'rabbit'
  if (a.sink !== undefined && a.mid !== 'rabbit') {
    frags.push(`${AREA_LABEL[a.sink]} eats your time`);
  }

  const joined = frags.join(' · ');
  return joined.charAt(0).toUpperCase() + joined.slice(1);
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
