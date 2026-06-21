// reportCss — the print stylesheet for the Pro PDF report. PURE: tokens in, a CSS
// string out. The PDF is ALWAYS rendered in the light palette (a printed page is
// white paper; dark-mode ink on paper is wrong), so the caller passes
// `tokens.colors.light` — never the active theme. One accent only (indigo); the
// neutrals carry 60/30/10. US-Letter page, 0.6in margins, a pt type scale, and
// tabular numbers on every column figure so digits line up like a ledger.

/** The slice of the light palette the report needs. Pass `tokens.colors.light`. */
export interface ReportPalette {
  ink: string; // primary text (the 10% — high-emphasis)
  inkSoft: string; // muted text (the 30%)
  inkFaint: string; // hairline labels
  primary: string; // the single accent (indigo)
  primaryEdge: string; // deeper accent for the hero figure
  surface: string; // paper (white)
  hairline: string; // 1px internal dividers
  border: string; // stronger table edge
}

/**
 * Build the print CSS from the light palette. System sans keeps a clinician doc
 * legible without embedding fonts; the pt scale matches the app's roles converted
 * for print (title 22 / heading 14 / body 11 / caption 9 / hero 40).
 */
export function buildReportCss(p: ReportPalette): string {
  return `
:root {
  --c-ink: ${p.ink};
  --c-ink-soft: ${p.inkSoft};
  --c-ink-faint: ${p.inkFaint};
  --c-primary: ${p.primary};
  --c-primary-edge: ${p.primaryEdge};
  --c-paper: ${p.surface};
  --c-hairline: ${p.hairline};
  --c-border: ${p.border};
}
@page { size: Letter; margin: 0.6in; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: var(--c-paper); }
body {
  color: var(--c-ink);
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
  font-size: 11pt;
  line-height: 1.5;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.num { font-variant-numeric: tabular-nums; }
.title { font-size: 22pt; line-height: 1.2; font-weight: 700; margin: 0; letter-spacing: -0.01em; }
.subline { font-size: 9pt; line-height: 1.4; color: var(--c-ink-soft); margin: 4pt 0 0; }
.prepared { font-size: 9pt; line-height: 1.4; color: var(--c-ink-soft); margin: 2pt 0 0; }
.section { margin-top: 22pt; }
.heading { font-size: 14pt; line-height: 1.2; font-weight: 700; margin: 0 0 8pt; }
.eyebrow {
  font-size: 9pt; line-height: 1.4; font-weight: 600; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--c-ink-soft); margin: 0 0 4pt;
}
.hero { font-size: 40pt; line-height: 1.1; font-weight: 700; color: var(--c-primary-edge); margin: 2pt 0; }
.hero-def { font-size: 11pt; color: var(--c-ink-soft); margin: 0; }
.spark { margin-top: 8pt; }
.glance { display: flex; gap: 0; border-top: 1px solid var(--c-hairline); border-bottom: 1px solid var(--c-hairline); margin-top: 14pt; }
.glance-cell { flex: 1; padding: 8pt 0; }
.glance-cell + .glance-cell { border-left: 1px solid var(--c-hairline); padding-left: 10pt; }
.glance-label { font-size: 9pt; color: var(--c-ink-soft); margin: 0; }
.glance-value { font-size: 14pt; font-weight: 700; margin: 2pt 0 0; }
table { width: 100%; border-collapse: collapse; }
thead th {
  font-size: 9pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;
  color: var(--c-ink-soft); text-align: left; padding: 6pt 8pt; border-bottom: 1px solid var(--c-border);
}
thead th.r, tbody td.r { text-align: right; }
tbody td { font-size: 11pt; padding: 8pt 8pt; border-bottom: 1px solid var(--c-hairline); vertical-align: top; }
tbody td.cat { font-weight: 600; }
.range { font-size: 9pt; color: var(--c-ink-soft); margin: 2pt 0 0; }
.mult-x { font-size: 0.62em; color: var(--c-ink-soft); }
.omitted { font-size: 9pt; color: var(--c-ink-soft); margin: 8pt 0 0; }
.surprise { font-size: 11pt; margin: 0 0 4pt; }
.note { font-size: 11pt; color: var(--c-ink); margin: 0; }
.footer {
  margin-top: 26pt; padding-top: 8pt; border-top: 1px solid var(--c-hairline);
  display: flex; justify-content: space-between; font-size: 9pt; color: var(--c-ink-faint);
}
`.trim();
}
