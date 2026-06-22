import type { QuizAnswers } from '@/src/engine';

// ──────────────────────────────────────────────────────────────────────────────
// archetypeTraits — turns the time-style quiz answers + the calibration
// multiplier into the readable rows shown on the Patterns archetype stat-sheet.
// Pure. Row 1 (the multiplier) is always present; mid/focus rows appear only when
// that answer exists. No rank/streak/guilt language (product invariant).
// ──────────────────────────────────────────────────────────────────────────────

export interface ArchetypeTraitRow {
  label: string;
  value: string;
  /** When true the value renders in honey/amber (the headline stat). */
  amber?: boolean;
}

const MID_LABEL: Record<NonNullable<QuizAnswers['mid']>, string> = {
  track: 'Stays on track',
  rabbit: 'Falls down rabbit holes',
};

const FOCUS_LABEL: Record<NonNullable<QuizAnswers['focus']>, string> = {
  morning: 'Mornings',
  evening: 'Evenings',
  varies: 'Varies',
};

export function archetypeTraits(
  answers: Partial<QuizAnswers>,
  multiplier: number,
): ArchetypeTraitRow[] {
  const rows: ArchetypeTraitRow[] = [
    { label: 'Runs', value: `${multiplier.toFixed(1)}× long`, amber: true },
  ];
  if (answers.mid !== undefined) {
    rows.push({ label: 'Mid-task', value: MID_LABEL[answers.mid] });
  }
  if (answers.focus !== undefined) {
    rows.push({ label: 'Sharpest', value: FOCUS_LABEL[answers.focus] });
  }
  return rows;
}
