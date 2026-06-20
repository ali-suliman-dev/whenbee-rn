// Phrase lists for the Tier-1 spoken-task parser. No magic strings live in the
// parser itself — tune cleanup behavior here. Pure data, no imports.

/**
 * Leading "I was going to / remind me to …" preambles stripped from the front of
 * an utterance. Anchored to start, case-insensitive, each consumes trailing space.
 */
export const PREAMBLE_PATTERNS: readonly RegExp[] = [
  /^i (?:need|want|have|would like|wanted|was going|am going|keep meaning) to\s+/i,
  /^i(?:'?d| would) like to\s+/i,
  /^i was thinking (?:about|of)\s+/i,
  /^(?:can you |could you |please )?remind me to\s+/i,
  /^(?:i should|let me|gotta|got to|i gotta)\s+/i,
  /^(?:my task is|task:|todo:?|to do:?)\s+/i,
];

/** Filler tokens dropped anywhere in the utterance (lowercased match). */
export const FILLER_WORDS: ReadonlySet<string> = new Set([
  'um', 'uh', 'erm', 'like', 'basically', 'actually', 'just', 'really',
  'kinda', 'sorta', 'maybe', 'somehow', 'literally',
]);

/** Soft cap on cleaned title length (words). Tier-1 trims to the leading clause. */
export const MAX_TITLE_WORDS = 8;

/** Clause splitters — Tier-1 keeps only the first clause for a single-task field. */
export const CLAUSE_SPLIT = /\s+(?:then|and then|after that|also|plus)\s+/i;
