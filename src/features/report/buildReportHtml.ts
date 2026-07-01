// buildReportHtml — PURE (no db, no native, NO network — a test asserts it never
// calls fetch): a ReportModel + the print CSS in, a self-contained HTML string
// out. Every user-controlled string (category names, labels, companion name) is
// HTML-escaped before it enters the document so a clinician doc never breaks on a
// `<` in a task label. NO reclaim / "time saved" section — reclaim was removed from
// the product. The page leads with calibration: accuracy, bias table, surprises,
// sharpest window.
//
// Localization: copy comes from the `report` namespace via the app's shared i18n
// singleton (mirrors `useReview.ts`'s `sharpestPhraseFor` — a raw `i18n.t` call
// outside a component, since this builder has no React tree of its own). Month
// names are locale-derived through `Intl.DateTimeFormat`, never a hardcoded
// English array. Production callers never pass anything beyond `model`/`css` — the
// singleton always reflects the app's active language — but tests may inject an
// override instance to exercise a different language deterministically.
import defaultI18n from '@/src/i18n';
import { localeForLang } from '@/src/i18n/format';
import type { ReportModel, ReportCategoryRow, ReportSurprise } from './reportModel';

/** Escape the five HTML-significant characters. Applied to every dynamic string. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** A plain, locale-aware date for the subline (e.g. "21 Jun 2026" / "21 juni 2026"). */
function formatDate(ms: number, locale: string): string {
  const d = new Date(ms);
  const month = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(d);
  return `${d.getUTCDate()} ${month} ${d.getUTCFullYear()}`;
}

/** The bias multiplier as `×1.6`, with the `×` a smaller muted suffix. */
function multiplier(m: number): string {
  return `<span class="num">${m.toFixed(1)}</span><span class="mult-x">×</span>`;
}

/** A vector sparkline of accuracy over the window — no chart lib, just inline SVG. */
function sparkline(spark: number[]): string {
  if (spark.length < 2) return '';
  const w = 180;
  const h = 28;
  const max = 100;
  const step = w / (spark.length - 1);
  const points = spark
    .map((v, i) => {
      const x = (i * step).toFixed(1);
      const y = (h - (Math.max(0, Math.min(max, v)) / max) * h).toFixed(1);
      return `${x},${y}`;
    })
    .join(' ');
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">
  <polyline points="${points}" fill="none" stroke="var(--c-primary)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
</svg>`;
}

function categoryRow(row: ReportCategoryRow): string {
  const range = row.range
    ? `<div class="range num">${row.range.lowMinutes}–${row.range.highMinutes}m</div>`
    : '';
  return `<tr>
  <td class="cat">${esc(row.categoryName)}</td>
  <td class="r num">${row.logs}</td>
  <td class="r num">${row.typicalGuessMin}m</td>
  <td class="r"><span class="num">${row.honestMin}m</span>${range}</td>
  <td class="r">${multiplier(row.multiplier)}</td>
</tr>`;
}

function surpriseLine(s: ReportSurprise, t: typeof defaultI18n.t): string {
  const label = s.label ? ` ${esc(s.label)}` : '';
  const rest = t('report:pdf.surprises.line', { estimate: s.estimateMin, actual: s.actualMin });
  // Numbers stay inline (the whole line carries `num` for tabular figures) so the
  // sentence reads as one clean phrase a clinician can quote.
  return `<p class="surprise num">${esc(s.categoryName)}${label} — ${rest}</p>`;
}

export function buildReportHtml(
  model: ReportModel,
  css: string,
  i18nInstance: typeof defaultI18n = defaultI18n,
): string {
  const t = i18nInstance.t.bind(i18nInstance);
  const locale = localeForLang(i18nInstance.language);
  const htmlLang = i18nInstance.language || 'en';

  const prepared =
    model.companionName !== null && model.companionName.trim().length > 0
      ? `<p class="prepared">${t('report:pdf.preparedBy', { name: esc(model.companionName) })}</p>`
      : '';

  const glance = `<div class="glance">
  <div class="glance-cell"><p class="glance-label">${t('report:pdf.glance.tasksLogged')}</p><p class="glance-value num">${model.totalLogs}</p></div>
  <div class="glance-cell"><p class="glance-label">${t('report:pdf.glance.categoriesTracked')}</p><p class="glance-value num">${model.categoryCount}</p></div>
  <div class="glance-cell"><p class="glance-label">${t('report:pdf.glance.steadiestCategory')}</p><p class="glance-value">${
    model.steadiestCategoryName ? esc(model.steadiestCategoryName) : t('report:pdf.glance.none')
  }</p></div>
</div>`;

  const tableRows = model.categories.map(categoryRow).join('\n');
  const omitted =
    model.omittedCategoryCount > 0
      ? `<p class="omitted">${t('report:pdf.omitted', { count: model.omittedCategoryCount })}</p>`
      : '';

  const biasTable = `<div class="section">
  <h2 class="heading">${t('report:pdf.biasTable.heading')}</h2>
  <table>
    <thead><tr>
      <th>${t('report:pdf.biasTable.category')}</th>
      <th class="r">${t('report:pdf.biasTable.logs')}</th>
      <th class="r">${t('report:pdf.biasTable.youGuess')}</th>
      <th class="r">${t('report:pdf.biasTable.reallyTakes')}</th>
      <th class="r">${t('report:pdf.biasTable.bias')}</th>
    </tr></thead>
    <tbody>
${tableRows}
    </tbody>
  </table>
  ${omitted}
</div>`;

  const surprises =
    model.surprises.length > 0
      ? `<div class="section">
  <h2 class="heading">${t('report:pdf.surprises.heading')}</h2>
  ${model.surprises.map((s) => surpriseLine(s, t)).join('\n  ')}
</div>`
      : '';

  const sharpest =
    model.sharpestNote !== null
      ? `<div class="section">
  <h2 class="heading">${t('report:pdf.sharpest.heading')}</h2>
  <p class="note">${esc(model.sharpestNote)}</p>
</div>`
      : '';

  const footer = `<div class="footer">
  <span>${t('report:pdf.footer.left')}</span>
  <span>${t('report:pdf.footer.disclaimer')}</span>
</div>`;

  return `<!DOCTYPE html>
<html lang="${htmlLang}">
<head><meta charset="utf-8" /><style>${css}</style></head>
<body>
  <header>
    <h1 class="title">${t('report:pdf.title')}</h1>
    <p class="subline">${t('report:pdf.subline', { date: formatDate(model.generatedAtMs, locale), window: esc(model.window.label) })}</p>
    ${prepared}
  </header>

  <div class="section">
    <p class="eyebrow">${t('report:pdf.eyebrowAccuracy')}</p>
    <p class="hero num">${model.accuracyPct}%</p>
    <p class="hero-def">${t('report:pdf.accuracyDefinition')}</p>
    ${sparkline(model.accuracySpark)}
  </div>

  ${glance}

  ${biasTable}
  ${surprises}
  ${sharpest}

  ${footer}
</body>
</html>`;
}
