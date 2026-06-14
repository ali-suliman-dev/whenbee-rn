// ──────────────────────────────────────────────────────────────────────────────
// categoryGuess — pure, on-device heuristics for the Add-Task category picker.
//   • guessCategory(title)  → best-effort seed id from the task text (or null)
//   • sortPickerCategories  → frequency-sorted, with the guessed pill floated first
// No network, no clock, no React — honors the "core loop is on-device-only" invariant
// and stays cheap to unit-test. Guesses only ever land on a SEED id; anything
// unrecognised returns null so the picker simply shows no pre-selection.
// ──────────────────────────────────────────────────────────────────────────────

import type { PickerCategory } from './CategoryChips';

/** Seed ids the heuristic is allowed to guess, in tie-break priority order. */
const GUESS_KEYWORDS: readonly (readonly [string, readonly string[]])[] = [
  ['admin', ['email', 'emails', 'inbox', 'reply', 'mail', 'bill', 'bills', 'pay', 'invoice', 'form', 'forms', 'tax', 'taxes', 'bank', 'banking', 'appointment', 'schedule', 'insurance', 'renew', 'admin', 'paperwork', 'account', 'password', 'book']],
  ['errands', ['errand', 'errands', 'groceries', 'grocery', 'shop', 'shopping', 'store', 'buy', 'pickup', 'pharmacy', 'market', 'package', 'return', 'post']],
  ['cleaning', ['clean', 'cleaning', 'tidy', 'laundry', 'dishes', 'dish', 'vacuum', 'wash', 'washing', 'mop', 'sweep', 'dust', 'declutter']],
  ['cooking', ['cook', 'cooking', 'dinner', 'lunch', 'breakfast', 'meal', 'recipe', 'bake', 'baking', 'food']],
  ['creative', ['write', 'writing', 'draft', 'blog', 'essay', 'article', 'journal', 'design', 'sketch', 'paint', 'draw', 'edit', 'editing', 'create', 'creative', 'brainstorm']],
  ['getting_ready', ['shower', 'dress', 'dressed', 'ready', 'makeup', 'hair', 'brush', 'teeth', 'getting']],
];

/** Lowercase word tokens of a title (letters/digits only). */
function tokenize(title: string): string[] {
  return title.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/**
 * Best-effort category id guessed from the task title, or null when nothing
 * matches. Scores each seed by keyword hits; highest wins, ties broken by the
 * GUESS_KEYWORDS order. Always returns a SEED id (never a custom category).
 */
export function guessCategory(title: string): string | null {
  const words = new Set(tokenize(title));
  if (words.size === 0) return null;

  let bestId: string | null = null;
  let bestScore = 0;
  for (const [id, keywords] of GUESS_KEYWORDS) {
    let score = 0;
    for (const kw of keywords) if (words.has(kw)) score += 1;
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }
  return bestScore > 0 ? bestId : null;
}

/**
 * Order the picker for display: the guessed category first (if present), then by
 * descending usage count, with the incoming order as a stable tie-break. Pure —
 * never mutates the input array.
 */
export function sortPickerCategories(
  categories: PickerCategory[],
  usage: Record<string, number>,
  guessedId: string | null,
): PickerCategory[] {
  return categories
    .map((c, index) => ({ c, index }))
    .sort((a, b) => {
      const aGuess = a.c.id === guessedId ? 1 : 0;
      const bGuess = b.c.id === guessedId ? 1 : 0;
      if (aGuess !== bGuess) return bGuess - aGuess;
      const aUse = usage[a.c.id] ?? 0;
      const bUse = usage[b.c.id] ?? 0;
      if (aUse !== bUse) return bUse - aUse;
      return a.index - b.index;
    })
    .map((x) => x.c);
}
