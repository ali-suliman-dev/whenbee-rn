// Locale-aware date/number formatters, hoisted per locale.
//
// `Intl.DateTimeFormat`/`Intl.NumberFormat` construction is not free — the
// `js-hoist-intl` perf rule says never build one inside a render/loop. This
// module caches one `Formatters` bundle per BCP-47 locale so repeated calls
// (e.g. one per calendar-strip cell) reuse the same underlying `Intl` objects.

type Formatters = {
  weekdayShort: (d: Date) => string;
  /** Full weekday name only, e.g. "Wednesday" (no month/day). */
  weekdayLong: (d: Date) => string;
  monthDay: (d: Date) => string;
  /** Full a11y-style date, e.g. "Wednesday, June 24". */
  fullDate: (d: Date) => string;
  number: (n: number) => string;
};

const cache = new Map<string, Formatters>();

/** App language code (e.g. 'en', 'sv') → BCP-47 locale for `Intl` formatters. */
const BCP47: Record<string, string> = { en: 'en-US', sv: 'sv-SE' };

/** Resolve the BCP-47 locale for an app language code, defaulting to en-US. */
export const localeForLang = (lang: string): string => BCP47[lang] ?? 'en-US';

export const makeFormatters = (locale: string): Formatters => {
  const hit = cache.get(locale);
  if (hit) return hit;
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  const weekdayFull = new Intl.DateTimeFormat(locale, { weekday: 'long' });
  const md = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' });
  const full = new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric' });
  const num = new Intl.NumberFormat(locale);
  const f: Formatters = {
    weekdayShort: (d) => weekday.format(d),
    weekdayLong: (d) => weekdayFull.format(d),
    monthDay: (d) => md.format(d),
    fullDate: (d) => full.format(d),
    number: (n) => num.format(n),
  };
  cache.set(locale, f);
  return f;
};
