import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { seedMultiplierFor, type QuizAnswers } from '@/src/engine';
import { analytics } from '@/src/services/analytics';

// Maps a seed multiplier to the same 4-rung ladder deriveArchetype uses, so the
// reveal label matches what Patterns will show. Kept in lockstep with the engine
// ladder thresholds (Steady<1.3, Gentle<1.8, Sprint<2.6, Dreamer>=2.6).
// Thresholds and titles MUST stay in sync with `archetypeFor` in usePatterns.ts.
function rungFor(m: number, tr: TFunction<'onboarding'>): { title: string; blurb: string } {
  if (m < 1.3) return { title: tr('archetype.steady.title'), blurb: tr('archetype.steady.blurb') };
  if (m < 1.8) return { title: tr('archetype.gentle.title'), blurb: tr('archetype.gentle.blurb') };
  if (m < 2.6) return { title: tr('archetype.sprint.title'), blurb: tr('archetype.sprint.blurb') };
  return { title: tr('archetype.dreamer.title'), blurb: tr('archetype.dreamer.blurb') };
}

export interface RevealCard {
  title: string;
  blurb: string;
  multiplier: number;
}

export function usePersonalize() {
  const setDisplayName = useSettingsStore((s) => s.setDisplayName);
  const setArchetypeSeed = useSettingsStore((s) => s.setArchetypeSeed);
  const { t: tr } = useTranslation('onboarding');
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
      setArchetypeSeed({ m0, source: 'quiz', tookAt: Date.now() });
      const { title, blurb } = rungFor(m0, tr);
      analytics.capture('quiz_completed', { archetype: title });
      return { title, blurb, multiplier: m0 };
    },
    trackQuizSkipped: () => analytics.capture('quiz_skipped'),
    trackReopened: () => analytics.capture('archetype_reopened'),
  };
}
