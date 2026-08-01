// Tier-1 spoken-task parser — PURE. Strips conversational preamble/filler and
// trims a ramble to a short imperative title. It does NOT paraphrase (that is the
// Tier-2 on-device LLM's job); messy input therefore stays editable. No RN, no
// clock, no network — honors the on-device-only invariant and is exhaustively
// unit-tested like the engine.
//
// Locale-aware: cleanup rules come from a per-locale phrase table (parserLocales.ts).
// A locale with no table is left raw (capitalized only) rather than run through
// another locale's rules — never worse than the transcript, never mis-cleaned.

import type { ParsedTaskDraft } from '@/src/domain/types';
import { getParserTable } from './parserLocales';

const stripPreamble = (text: string, patterns: readonly RegExp[]): string => {
  let out = text;
  // Apply repeatedly so stacked preambles ("i need to remind me to …") collapse.
  let changed = true;
  while (changed) {
    changed = false;
    for (const re of patterns) {
      const next = out.replace(re, '');
      if (next !== out) {
        out = next;
        changed = true;
      }
    }
  }
  return out;
};

const dropFiller = (text: string, fillerWords: ReadonlySet<string>): string =>
  text
    .split(/\s+/)
    .filter((w) => w.length > 0 && !fillerWords.has(w.toLowerCase()))
    .join(' ');

const capitalizeFirst = (text: string): string =>
  text.length === 0 ? text : text[0]!.toUpperCase() + text.slice(1);

export const parseSpokenTask = (transcript: string, lang: string): ParsedTaskDraft => {
  const raw = transcript.trim();
  const table = getParserTable(lang);

  if (!table) {
    // Unknown locale: no cleanup rules — keep the raw first clause, capitalized.
    return { title: capitalizeFirst(raw), rawTranscript: transcript, source: 'rules' };
  }

  const firstClause = raw.split(table.clauseSplit)[0] ?? '';
  const cleaned = dropFiller(stripPreamble(firstClause.trim(), table.preamblePatterns), table.fillerWords)
    .trim()
    .split(/\s+/)
    .slice(0, table.maxTitleWords)
    .join(' ');

  return {
    title: capitalizeFirst(cleaned),
    rawTranscript: transcript,
    source: 'rules',
  };
};
