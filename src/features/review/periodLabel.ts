import i18n from '@/src/i18n';
import { localeForLang } from '@/src/i18n/format';
import type { ReviewPeriod } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// periodLabel — the review period's human title ("Jun 8 – 14", "January" /
// "8–14 juni", "januari").
//
// The engine can't build this: month names are copy, and it stays pure. It also
// must not be a hardcoded table — `Intl` already knows every month name and the
// per-locale order (Swedish is "8 juni", lowercase; English is "Jun 8"). Same
// approach the PDF report uses.
//
// `Intl.DateTimeFormat` construction is not free (js-hoist-intl), so formatters
// are cached per locale, and the whole label is cached per locale + period id.
// ──────────────────────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

interface PeriodFormatters {
  monthDay: Intl.DateTimeFormat;
  monthLong: Intl.DateTimeFormat;
}

const formatterCache = new Map<string, PeriodFormatters>();
const labelCache = new Map<string, string>();

function formattersFor(locale: string): PeriodFormatters {
  const hit = formatterCache.get(locale);
  if (hit) return hit;
  const f: PeriodFormatters = {
    monthDay: new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }),
    monthLong: new Intl.DateTimeFormat(locale, { month: 'long' }),
  };
  formatterCache.set(locale, f);
  return f;
}

/**
 * Range label for the week. `formatRange` collapses a same-month span the way
 * each locale expects ("Jun 8 – 14", "8–14 juni") — but Hermes ships a partial
 * `Intl`, so a device without it falls back to two formatted endpoints joined by
 * an EN dash (never an em dash).
 */
function weekLabel(locale: string, startMs: number, endMs: number): string {
  const { monthDay } = formattersFor(locale);
  const start = new Date(startMs);
  const lastDay = new Date(endMs - DAY_MS);
  if (typeof monthDay.formatRange === 'function') {
    return monthDay.formatRange(start, lastDay);
  }
  return `${monthDay.format(start)} – ${monthDay.format(lastDay)}`;
}

/** The review period's title, in the active language. */
export function reviewPeriodLabel(period: ReviewPeriod): string {
  const locale = localeForLang(i18n.language);
  const cacheKey = `${locale}:${period.id}`;
  const hit = labelCache.get(cacheKey);
  if (hit !== undefined) return hit;
  const label =
    period.kind === 'month'
      ? formattersFor(locale).monthLong.format(new Date(period.startMs))
      : weekLabel(locale, period.startMs, period.endMs);
  labelCache.set(cacheKey, label);
  return label;
}
