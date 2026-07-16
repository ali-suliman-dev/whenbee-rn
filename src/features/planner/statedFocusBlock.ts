import type { FocusAnswer } from '@/src/domain/types'; // canonical — do NOT re-declare

export type StatedFocusBlock = { startMin: number; endMin: number; label: string; source: 'stated' };

/**
 * The user's SELF-REPORTED focus window, as a coarse block.
 *
 * This never enters focusWindowLearn: that engine earns its confidence from
 * logged startLocalMinute events and permutation strength, and a self-report is
 * not evidence. This block exists so the answer does visible work on day 1, and
 * it is REPLACED (not blended) the moment the learner clears its gates.
 * 'varies' makes no claim, so it returns null rather than a fake block.
 */
export function statedFocusBlock(focus: FocusAnswer | undefined): StatedFocusBlock | null {
  if (focus === undefined || focus === 'varies') return null;
  if (focus === 'morning') {
    return { startMin: 9 * 60, endMin: 11 * 60, label: 'You said mornings', source: 'stated' };
  }
  return { startMin: 19 * 60, endMin: 21 * 60, label: 'You said evenings', source: 'stated' };
}
