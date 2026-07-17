import { useSettingsStore } from '@/src/stores/settingsStore';
import { seedMultiplierFor, type QuizAnswers } from '@/src/engine';
import { analytics } from '@/src/services/analytics';

// Maps a seed multiplier to the same 4-rung ladder deriveArchetype uses, so the
// reveal label matches what Patterns will show. Kept in lockstep with the engine
// ladder thresholds (Steady<1.2, Gentle<1.5, Sprint<2.0, Dreamer>=2.0).
// Thresholds and titles MUST stay in sync with `archetypeFor` in usePatterns.ts.
function rungFor(m: number): { title: string; blurb: string } {
  if (m < 1.2) return { title: 'The Steady Reader', blurb: 'Your guesses already land close to reality. I\'ll sharpen this with every task you log.' };
  if (m < 1.5) return { title: 'The Gentle Optimist', blurb: 'You lean hopeful, then mostly catch up. A little padding does it.' };
  if (m < 2.0) return { title: 'The Sprint Optimist', blurb: 'Your mind moves fast; the doing takes a touch longer. Now you know by how much.' };
  return { title: 'The Dreamer', blurb: 'Big plans, generous timelines. Your honest numbers keep them grounded.' };
}

export interface RevealCard {
  title: string;
  blurb: string;
  multiplier: number;
}

export function usePersonalize() {
  const setDisplayName = useSettingsStore((s) => s.setDisplayName);
  const setArchetypeSeed = useSettingsStore((s) => s.setArchetypeSeed);
  return {
    trackShown: () => analytics.capture('personalize_shown'),
    /** Fire once when quiz step 0 first renders — marks quiz entry in the funnel. */
    trackQuizStarted: () => analytics.capture('quiz_started'),
    /** Fire once when the reveal screen first mounts (archetype payoff shown). */
    trackRevealShown: () => analytics.capture('reveal_shown'),
    saveName: (name?: string) => {
      setDisplayName(name);
      if (name) {
        analytics.capture('name_set', { length: name.length });
      } else {
        analytics.capture('name_skipped');
      }
    },
    saveQuiz: (answers: QuizAnswers): RevealCard => {
      const m0 = seedMultiplierFor(answers);
      // tookAt is stamped here at the hook layer (allowed — not the engine).
      setArchetypeSeed({ m0, sink: answers.sink, source: 'quiz', tookAt: Date.now() });
      const { title, blurb } = rungFor(m0);
      // quiz_completed is NOT fired here — saveQuiz is a data write, not an event
      // owner. A caller re-running this (e.g. a re-mounted reveal screen after a
      // back-swipe) would otherwise double-count the funnel. Callers fire
      // trackQuizCompleted() themselves, once, at the point that actually means
      // "the user completed the quiz" for their flow.
      return { title, blurb, multiplier: m0 };
    },
    /** Fire once per quiz completion — moved out of saveQuiz so a re-mount (or a
     *  re-take from Settings/the Hub) doesn't silently double- or under-count. */
    trackQuizCompleted: (payload: { archetype: string }) =>
      analytics.capture('quiz_completed', payload),
    trackQuizSkipped: () => analytics.capture('quiz_skipped'),
    trackReopened: () => analytics.capture('archetype_reopened'),
  };
}
