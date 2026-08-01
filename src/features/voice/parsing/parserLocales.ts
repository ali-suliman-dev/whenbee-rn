// Per-locale phrase tables for the Tier-1 spoken-task parser. Pure data, no
// imports — add a new locale here, never in the parser itself. A locale with
// no table falls back to the raw first clause (see spokenTaskParser.ts) rather
// than applying another locale's rules.

export interface ParserLocaleTable {
  /** Leading "I need to / remind me to …" preambles stripped from the front of an utterance. */
  preamblePatterns: readonly RegExp[];
  /** Filler tokens dropped anywhere in the utterance (lowercased match). */
  fillerWords: ReadonlySet<string>;
  /** Clause splitters — Tier-1 keeps only the first clause for a single-task field. */
  clauseSplit: RegExp;
  /** Soft cap on cleaned title length (words). */
  maxTitleWords: number;
}

const en: ParserLocaleTable = {
  preamblePatterns: [
    /^i (?:need|want|have|would like|wanted|was going|am going|keep meaning) to\s+/i,
    /^i(?:'?d| would) like to\s+/i,
    /^i was thinking (?:about|of)\s+/i,
    /^(?:can you |could you |please )?remind me to\s+/i,
    /^(?:i should|let me|gotta|got to|i gotta)\s+/i,
    /^(?:my task is|task:|todo:?|to do:?)\s+/i,
  ],
  fillerWords: new Set([
    'um', 'uh', 'erm', 'like', 'basically', 'actually', 'just', 'really',
    'kinda', 'sorta', 'maybe', 'somehow', 'literally',
  ]),
  clauseSplit: /\s+(?:then|and then|after that|also|plus)\s+/i,
  maxTitleWords: 8,
};

// Swedish preambles: "jag måste/ska/behöver/vill/tänkte/borde …", "kom ihåg att …",
// "påminn mig att/om att …", "min uppgift är / uppgift: / att göra: / todo: …".
const sv: ParserLocaleTable = {
  preamblePatterns: [
    /^jag (?:måste|ska|behöver|vill|tänkte|borde|kommer att)\s+/i,
    /^(?:kan du |kom ihåg att |påminn mig att |påminn mig om att )\s*/i,
    /^(?:min uppgift är|uppgift:|att göra:?|todo:?)\s+/i,
  ],
  fillerWords: new Set(['eh', 'öh', 'ehm', 'typ', 'liksom', 'alltså', 'bara', 'verkligen', 'kanske', 'asså']),
  clauseSplit: /\s+(?:sedan|och sedan|sen|efter det|också|plus)\s+/i,
  maxTitleWords: 8,
};

const TABLES: Record<string, ParserLocaleTable> = { en, sv };

/** Returns the locale's phrase table, or null when the locale has no Tier-1 rules. */
export const getParserTable = (lang: string): ParserLocaleTable | null => TABLES[lang] ?? null;
