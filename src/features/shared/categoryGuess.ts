// ──────────────────────────────────────────────────────────────────────────────
// categoryGuess — pure, on-device heuristics for the Add-Task category picker.
//   • guessCategory(title, ctx?) → best-effort category id, resolved by strict
//     tiers: learned (the user's own banked picks) > custom-category name match >
//     built-in keyword list. Returns null when nothing matches.
//   • bankAssociation(map, …)    → learns a title→category link (used by vocabStore)
//   • sortPickerCategories       → frequency-sorted, with the guessed pill floated first
// No network, no clock, no React — honors the "core loop is on-device-only" invariant
// and stays cheap to unit-test. A guess can land on a built-in SEED id OR a custom
// (tracked) id; anything unrecognised returns null so the picker shows no pre-selection.
// ──────────────────────────────────────────────────────────────────────────────

import type { AppLang } from '@/src/i18n/resources';
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

/**
 * Swedish built-in keywords, mirroring the SAME id set as `GUESS_KEYWORDS`
 * (email folds into `admin`, writing folds into `creative` — matching the
 * English shape exactly so tier-3 behaves consistently across locales).
 */
const SV_GUESS_KEYWORDS: readonly (readonly [string, readonly string[]])[] = [
  ['admin', ['mejl', 'mejla', 'mejlar', 'mejlat', 'inkorg', 'svara', 'svar', 'post', 'e-post', 'räkning', 'räkningar', 'betala', 'faktura', 'fakturor', 'blankett', 'blanketter', 'skatt', 'skatter', 'bank', 'bankärende', 'möte', 'boka', 'bokning', 'försäkring', 'förnya', 'admin', 'pappersarbete', 'konto', 'lösenord']],
  ['errands', ['ärende', 'ärenden', 'handla', 'shoppa', 'affär', 'affären', 'köpa', 'hämta', 'apotek', 'marknad', 'paket', 'retur', 'returnera', 'posta']],
  ['cleaning', ['städa', 'städning', 'städ', 'tvätt', 'tvätta', 'disk', 'diska', 'dammsuga', 'dammsugning', 'skura', 'sopa', 'damma', 'rensa']],
  ['cooking', ['laga', 'lagar', 'matlagning', 'middag', 'lunch', 'frukost', 'måltid', 'recept', 'baka', 'bakning', 'mat', 'koka']],
  ['creative', ['skriva', 'skriv', 'skrivande', 'utkast', 'blogg', 'uppsats', 'artikel', 'dagbok', 'designa', 'design', 'skissa', 'måla', 'rita', 'redigera', 'redigering', 'skapa', 'kreativ', 'brainstorma']],
  ['getting_ready', ['dusch', 'duscha', 'kläder', 'klä', 'redo', 'smink', 'sminka', 'hår', 'borsta', 'tänder', 'ordna', 'morgonrutin']],
];

/** Filler words that carry no category signal — dropped before matching/banking. */
const STOPWORDS: ReadonlySet<string> = new Set([
  'to', 'that', 'the', 'a', 'an', 'of', 'for', 'my', 'this', 'some',
  'and', 'on', 'in', 'it', 'is', 'as', 'up', 'do',
]);

/**
 * Light suffix stemmer — NOT full Porter. Collapses common inflections so
 * `emailing/emails/emailed → email` and `cleaning/cleaned → clean`, while
 * leaving short words (`is`, `buy`, `gym`) intact. Only stems when the root
 * stays ≥ 3 chars so we never strip a word down to noise.
 */
function stem(word: string): string {
  if (word.length < 4) return word;
  if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`;
  for (const suffix of ['ing', 'ed', 'es', 's'] as const) {
    if (word.endsWith(suffix)) {
      const base = word.slice(0, -suffix.length);
      if (base.length >= 3) return base;
    }
  }
  return word;
}

/** Lowercase content stems of a title: split → drop stopwords → stem. */
export function tokenizeStems(title: string): string[] {
  return title
    .toLowerCase()
    // Includes åäö so Swedish words (e.g. "städa", "köket") aren't shredded
    // into ASCII fragments — a no-op for pure-ASCII (English) titles.
    .split(/[^a-z0-9åäö]+/)
    .filter(Boolean)
    .filter((w) => !STOPWORDS.has(w))
    .map(stem)
    .filter(Boolean);
}

/** Per-stem learned vote: how many times a stem was banked to a category, and
 *  the highest `seq` (recency) at which it happened. */
export type LearnedMap = Record<string, Record<string, { count: number; lastSeq: number }>>;

/** Optional signals that make the guess smarter than the built-in keyword list. */
export interface GuessContext {
  /** Per-stem → category counts learned from the user's confirmed picks. */
  learned?: LearnedMap;
  /** Tracked categories (id + display name) for name-word matching. */
  namedCats?: readonly { id: string; name: string }[];
  /** Ids the picker is currently showing; a guess outside this set is dropped. */
  availableIds?: readonly string[];
  /** Active app language for the built-in keyword tier (tier 3). Defaults to 'en'.
   *  Typically an `AppLang` ('en' | 'sv'), but accepts any string so an
   *  unrecognised/unsupported locale falls through cleanly rather than being a
   *  type error — a lang with no built-in table skips tier 3 entirely rather
   *  than matching against the wrong language's keywords. */
  lang?: AppLang | (string & {});
}

/** Built-in keywords, pre-stemmed once so title stems match inflected keywords. */
const STEMMED_KEYWORDS: readonly (readonly [string, ReadonlySet<string>])[] =
  GUESS_KEYWORDS.map(([id, kws]) => [id, new Set(kws.map(stem))] as const);

const SV_STEMMED_KEYWORDS: readonly (readonly [string, ReadonlySet<string>])[] =
  SV_GUESS_KEYWORDS.map(([id, kws]) => [id, new Set(kws.map(stem))] as const);

/** Built-in keyword table selected per locale. A lang absent here (or mapped to
 *  `undefined`) means tier 3 is skipped for that locale. */
const BUILTIN_KEYWORDS_BY_LANG: Partial<Record<string, readonly (readonly [string, ReadonlySet<string>])[]>> = {
  en: STEMMED_KEYWORDS,
  sv: SV_STEMMED_KEYWORDS,
};

/**
 * Best-effort category id for a title, or null. Resolves by strict tiers:
 *   1. learned (the user's own banked picks) — max count, recency tiebreak
 *   2. custom-name (a tracked category whose NAME contains a title word)
 *   3. built-in keyword list (legacy behavior)
 * Only ever returns an id present in `ctx.availableIds` (when provided), so a
 * guess at a deleted category falls through to the next tier.
 */
export function guessCategory(title: string, ctx: GuessContext = {}): string | null {
  const stems = tokenizeStems(title);
  if (stems.length === 0) return null;
  const stemSet = new Set(stems);
  const avail = ctx.availableIds ? new Set(ctx.availableIds) : null;
  const ok = (id: string): boolean => avail === null || avail.has(id);

  // Tier 1 — learned.
  if (ctx.learned) {
    const tally: Record<string, { count: number; lastSeq: number }> = {};
    for (const s of stems) {
      const entry = ctx.learned[s];
      if (!entry) continue;
      for (const [id, v] of Object.entries(entry)) {
        if (!ok(id)) continue;
        const acc = tally[id] ?? { count: 0, lastSeq: 0 };
        tally[id] = { count: acc.count + v.count, lastSeq: Math.max(acc.lastSeq, v.lastSeq) };
      }
    }
    let best: { id: string; count: number; lastSeq: number } | null = null;
    for (const [id, t] of Object.entries(tally)) {
      if (
        best === null ||
        t.count > best.count ||
        (t.count === best.count && t.lastSeq > best.lastSeq)
      ) {
        best = { id, count: t.count, lastSeq: t.lastSeq };
      }
    }
    if (best) return best.id;
  }

  // Tier 2 — custom (tracked) category name words.
  if (ctx.namedCats && ctx.namedCats.length > 0) {
    let best: { id: string; hits: number } | null = null;
    for (const c of ctx.namedCats) {
      if (!ok(c.id)) continue;
      const nameStems = new Set(tokenizeStems(c.name));
      let hits = 0;
      for (const s of stemSet) if (nameStems.has(s)) hits += 1;
      if (hits > 0 && (best === null || hits > best.hits)) best = { id: c.id, hits };
    }
    if (best) return best.id;
  }

  // Tier 3 — built-in keyword list (stemmed), selected by locale. A locale with
  // no built-in table (not just 'en'/'sv') skips this tier rather than
  // matching the wrong language's keywords.
  const builtinKeywords = BUILTIN_KEYWORDS_BY_LANG[ctx.lang ?? 'en'];
  if (!builtinKeywords) return null;
  let bestId: string | null = null;
  let bestScore = 0;
  for (const [id, kwSet] of builtinKeywords) {
    if (!ok(id)) continue;
    let score = 0;
    for (const s of stemSet) if (kwSet.has(s)) score += 1;
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }
  return bestScore > 0 ? bestId : null;
}

/**
 * Bank a title → category association at sequence `seq`. For each content stem
 * in the title, bumps `count` for `catId` and stamps `lastSeq = seq`. Pure:
 * returns a new map and never mutates the input. No-op (returns the same
 * reference) when the title has no content stems.
 */
export function bankAssociation(
  map: LearnedMap,
  title: string,
  catId: string,
  seq: number,
): LearnedMap {
  const stems = tokenizeStems(title);
  if (stems.length === 0) return map;
  const next: LearnedMap = { ...map };
  for (const s of stems) {
    const entry = { ...(next[s] ?? {}) };
    const prev = entry[catId] ?? { count: 0, lastSeq: 0 };
    entry[catId] = { count: prev.count + 1, lastSeq: seq };
    next[s] = entry;
  }
  return next;
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
