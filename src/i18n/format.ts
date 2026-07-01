// Locale-aware date/number formatters, hoisted per locale.
//
// `Intl.DateTimeFormat`/`Intl.NumberFormat` construction is not free — the
// `js-hoist-intl` perf rule says never build one inside a render/loop. This
// module caches one `Formatters` bundle per BCP-47 locale so repeated calls
// (e.g. one per calendar-strip cell) reuse the same underlying `Intl` objects.

type Formatters = {
  weekdayShort: (d: Date) => string;
  monthDay: (d: Date) => string;
  /** Full a11y-style date, e.g. "Wednesday, June 24". */
  fullDate: (d: Date) => string;
  number: (n: number) => string;
};

const cache = new Map<string, Formatters>();

export const makeFormatters = (locale: string): Formatters => {
  const hit = cache.get(locale);
  if (hit) return hit;
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  const md = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' });
  const full = new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric' });
  const num = new Intl.NumberFormat(locale);
  const f: Formatters = {
    weekdayShort: (d) => weekday.format(d),
    monthDay: (d) => md.format(d),
    fullDate: (d) => full.format(d),
    number: (n) => num.format(n),
  };
  cache.set(locale, f);
  return f;
};
