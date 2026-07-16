import type { QuizAnswers } from '@/src/engine';
import type { QuizGlyphKind } from './ArchetypeQuizGlyph';

// ──────────────────────────────────────────────────────────────────────────────
// quizQuestions — the single source of truth for the time-style quiz content,
// shared by the onboarding per-step screen (QuizStepScreen) and the re-take modal
// (TimeStyleQuiz). Order matches QUIZ_STEPS in onboardingStore (pace → mid → focus).
// `layout` picks the option presentation: a 2-col tile grid for 3–4 options, full
// width rows for 2. The subtext is one warm reassurance line under every question.
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
export const QUIZ_SUBTEXT = "No right answer here. Pick what's true most days, and I'll learn from it.";

export const QUIZ_QUESTIONS: readonly QuizQuestionDef[] = [
  {
    key: 'pace',
    prompt: 'When you plan your day, things usually take…',
    layout: 'tile',
    options: [
      { value: 'about', label: 'About right', glyph: 'pace_about' },
      { value: 'bit', label: 'A bit longer', glyph: 'pace_bit' },
      { value: 'lot', label: 'A lot longer', glyph: 'pace_lot' },
      { value: 'lose', label: 'I lose track', glyph: 'pace_lose' },
    ],
  },
  {
    key: 'mid',
    prompt: 'Mid-task, you usually…',
    layout: 'row',
    options: [
      { value: 'track', label: 'Stay on track', glyph: 'mid_track' },
      { value: 'rabbit', label: 'Fall down rabbit holes', glyph: 'mid_rabbit' },
    ],
  },
  {
    key: 'sink',
    prompt: 'Where does time run away from you most?',
    layout: 'tile',
    options: [
      { value: 'meetings', label: 'Calls & meetings', glyph: 'sink_meetings' },
      { value: 'chores',   label: 'Chores',    glyph: 'sink_chores' },
      { value: 'errands',  label: 'Errands',   glyph: 'sink_errands' },
      { value: 'deepwork', label: 'Deep work', glyph: 'sink_deepwork' },
    ],
  },
  {
    key: 'focus',
    prompt: 'You focus best…',
    layout: 'tile',
    options: [
      { value: 'morning', label: 'Mornings', glyph: 'focus_morning' },
      { value: 'evening', label: 'Evenings', glyph: 'focus_evening' },
      { value: 'varies', label: 'It varies', glyph: 'focus_varies' },
    ],
  },
] as const;
