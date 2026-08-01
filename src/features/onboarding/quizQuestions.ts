import type { TFunction } from 'i18next';
import type { QuizAnswers } from '@/src/engine';
import type { QuizGlyphKind } from './ArchetypeQuizGlyph';

// ──────────────────────────────────────────────────────────────────────────────
// quizQuestions — the single source of truth for the time-style quiz content,
// shared by the onboarding per-step screen (QuizStepScreen) and the re-take modal
// (TimeStyleQuiz). Order matches QUIZ_STEPS in onboardingStore (pace → mid → focus).
// `layout` picks the option presentation: a 2-col tile grid for 3–4 options, full
// width rows for 2. The subtext is one warm reassurance line under every question.
//
// Prompt/label copy is localized: both are built from a `t` function rather than
// hardcoded, since this module has no React context of its own. Call sites hold a
// `useTranslation('onboarding')` instance and pass its `t` through.
// ──────────────────────────────────────────────────────────────────────────────

export interface QuizOptionDef {
  value: string;
  label: string;
  glyph: QuizGlyphKind;
}

export interface QuizQuestionDef {
  key: keyof QuizAnswers;
  prompt: string;
  layout: 'tile' | 'row';
  options: readonly QuizOptionDef[];
}

/** Warm, no-pressure reassurance shown under every quiz question. */
export function getQuizSubtext(t: TFunction<'onboarding'>): string {
  return t('quiz.subtext');
}

export function getQuizQuestions(t: TFunction<'onboarding'>): readonly QuizQuestionDef[] {
  return [
    {
      key: 'pace',
      prompt: t('quiz.questions.pace.prompt'),
      layout: 'tile',
      options: [
        { value: 'about', label: t('quiz.questions.pace.options.about'), glyph: 'pace_about' },
        { value: 'bit', label: t('quiz.questions.pace.options.bit'), glyph: 'pace_bit' },
        { value: 'lot', label: t('quiz.questions.pace.options.lot'), glyph: 'pace_lot' },
        { value: 'lose', label: t('quiz.questions.pace.options.lose'), glyph: 'pace_lose' },
      ],
    },
    {
      key: 'mid',
      prompt: t('quiz.questions.mid.prompt'),
      layout: 'row',
      options: [
        { value: 'track', label: t('quiz.questions.mid.options.track'), glyph: 'mid_track' },
        { value: 'rabbit', label: t('quiz.questions.mid.options.rabbit'), glyph: 'mid_rabbit' },
      ],
    },
    {
      key: 'sink',
      prompt: t('quiz.questions.sink.prompt'),
      layout: 'tile',
      options: [
        { value: 'meetings', label: t('quiz.questions.sink.options.meetings'), glyph: 'sink_meetings' },
        { value: 'chores', label: t('quiz.questions.sink.options.chores'), glyph: 'sink_chores' },
        { value: 'errands', label: t('quiz.questions.sink.options.errands'), glyph: 'sink_errands' },
        { value: 'deepwork', label: t('quiz.questions.sink.options.deepwork'), glyph: 'sink_deepwork' },
      ],
    },
    {
      key: 'focus',
      prompt: t('quiz.questions.focus.prompt'),
      layout: 'tile',
      options: [
        { value: 'morning', label: t('quiz.questions.focus.options.morning'), glyph: 'focus_morning' },
        { value: 'evening', label: t('quiz.questions.focus.options.evening'), glyph: 'focus_evening' },
        { value: 'varies', label: t('quiz.questions.focus.options.varies'), glyph: 'focus_varies' },
      ],
    },
  ] as const;
}
