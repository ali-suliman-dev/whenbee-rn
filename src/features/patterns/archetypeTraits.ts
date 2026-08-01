import i18n from '@/src/i18n';
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

function midLabel(mid: NonNullable<QuizAnswers['mid']>): string {
  return i18n.t(`patterns:archetypeTraits.mid.${mid}`);
}

function focusLabel(focus: NonNullable<QuizAnswers['focus']>): string {
  return i18n.t(`patterns:archetypeTraits.focus.${focus}`);
}

export function archetypeTraits(
  answers: Partial<QuizAnswers>,
  multiplier: number,
): ArchetypeTraitRow[] {
  const rows: ArchetypeTraitRow[] = [
    {
      label: i18n.t('patterns:archetypeTraits.runsLabel'),
      value: i18n.t('patterns:archetypeTraits.runsValue', { multiplier: multiplier.toFixed(1) }),
      amber: true,
    },
  ];
  if (answers.mid !== undefined) {
    rows.push({ label: i18n.t('patterns:archetypeTraits.midTaskLabel'), value: midLabel(answers.mid) });
  }
  if (answers.focus !== undefined) {
    rows.push({ label: i18n.t('patterns:archetypeTraits.sharpestLabel'), value: focusLabel(answers.focus) });
  }
  return rows;
}
