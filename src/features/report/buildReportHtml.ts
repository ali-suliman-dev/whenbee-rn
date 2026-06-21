// buildReportHtml — PURE: a ReportModel + the print CSS in, a self-contained HTML
// string out. No React, no native, NO network (a test asserts it never calls
// fetch). Every user-controlled string (category names, labels, companion name) is
// HTML-escaped before it enters the document so a clinician doc never breaks on a
// `<` in a task label. NO reclaim / "time saved" section — reclaim was removed from
// the product. The page leads with calibration: accuracy, bias table, surprises,
// sharpest window.
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

/** A plain, locale-stable date for the subline (e.g. "21 Jun 2026"). */
function formatDate(ms: number): string {
  const d = new Date(ms);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
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

function surpriseLine(s: ReportSurprise): string {
  const label = s.label ? ` ${esc(s.label)}` : '';
  // Numbers stay inline (the whole line carries `num` for tabular figures) so the
  // sentence reads as one clean phrase a clinician can quote.
  return `<p class="surprise num">${esc(s.categoryName)}${label} — guessed ${s.estimateMin}m, took ${s.actualMin}m</p>`;
}

const FOOTER_LEFT = 'Whenbee · personal time report';
const DISCLAIMER = 'These are personal estimates, not a clinical measure.';

export function buildReportHtml(model: ReportModel, css: string): string {
  const prepared =
    model.companionName !== null && model.companionName.trim().length > 0
      ? `<p class="prepared">Prepared by Whenbee for ${esc(model.companionName)}'s data</p>`
      : '';

  const glance = `<div class="glance">
  <div class="glance-cell"><p class="glance-label">Tasks logged</p><p class="glance-value num">${model.totalLogs}</p></div>
  <div class="glance-cell"><p class="glance-label">Categories tracked</p><p class="glance-value num">${model.categoryCount}</p></div>
  <div class="glance-cell"><p class="glance-label">Steadiest category</p><p class="glance-value">${
    model.steadiestCategoryName ? esc(model.steadiestCategoryName) : '—'
  }</p></div>
</div>`;

  const tableRows = model.categories.map(categoryRow).join('\n');
  const omitted =
    model.omittedCategoryCount > 0
      ? `<p class="omitted">${model.omittedCategoryCount} more ${
          model.omittedCategoryCount === 1 ? 'category is' : 'categories are'
        } still settling and ${model.omittedCategoryCount === 1 ? 'was' : 'were'} left out.</p>`
      : '';

  const biasTable = `<div class="section">
  <h2 class="heading">How long things really take you</h2>
  <table>
    <thead><tr>
      <th>Category</th>
      <th class="r">Logs</th>
      <th class="r">You guess</th>
      <th class="r">It really takes</th>
      <th class="r">Bias</th>
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
  <h2 class="heading">Biggest surprises</h2>
  ${model.surprises.map(surpriseLine).join('\n  ')}
</div>`
      : '';

  const sharpest =
    model.sharpestNote !== null
      ? `<div class="section">
  <h2 class="heading">When your estimates land closest</h2>
  <p class="note">${esc(model.sharpestNote)}</p>
</div>`
      : '';

  const footer = `<div class="footer">
  <span>${FOOTER_LEFT}</span>
  <span>${DISCLAIMER}</span>
</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><style>${css}</style></head>
<body>
  <header>
    <h1 class="title">Time report</h1>
    <p class="subline">Generated ${formatDate(model.generatedAtMs)} · ${esc(model.window.label)}</p>
    ${prepared}
  </header>

  <div class="section">
    <p class="eyebrow">Estimation accuracy</p>
    <p class="hero num">${model.accuracyPct}%</p>
    <p class="hero-def">How close your time guesses landed to reality, on average.</p>
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
