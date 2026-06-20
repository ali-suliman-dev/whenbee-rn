// Tier-1 spoken-task parser — PURE. Strips conversational preamble/filler and
// trims a ramble to a short imperative title. It does NOT paraphrase (that is the
// Tier-2 on-device LLM's job); messy input therefore stays editable. No RN, no
// clock, no network — honors the on-device-only invariant and is exhaustively
// unit-tested like the engine.

import type { ParsedTaskDraft } from '@/src/domain/types';
import {
  CLAUSE_SPLIT,
  FILLER_WORDS,
  MAX_TITLE_WORDS,
  PREAMBLE_PATTERNS,
} from './parserConstants';

const stripPreamble = (text: string): string => {
  let out = text;
  // Apply repeatedly so stacked preambles ("i need to remind me to …") collapse.
  let changed = true;
  while (changed) {
    changed = false;
    for (const re of PREAMBLE_PATTERNS) {
      const next = out.replace(re, '');
      if (next !== out) {
        out = next;
        changed = true;
      }
    }
  }
  return out;
};

const dropFiller = (text: string): string =>
  text
    .split(/\s+/)
    .filter((w) => w.length > 0 && !FILLER_WORDS.has(w.toLowerCase()))
    .join(' ');

const capitalizeFirst = (text: string): string =>
  text.length === 0 ? text : text[0]!.toUpperCase() + text.slice(1);

export const parseSpokenTask = (transcript: string): ParsedTaskDraft => {
  const raw = transcript.trim();
  const firstClause = raw.split(CLAUSE_SPLIT)[0] ?? '';
  const cleaned = dropFiller(stripPreamble(firstClause.trim()))
    .trim()
    .split(/\s+/)
    .slice(0, MAX_TITLE_WORDS)
    .join(' ');

  return {
    title: capitalizeFirst(cleaned),
    rawTranscript: transcript,
    source: 'rules',
  };
};
